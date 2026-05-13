// Phase 3 chunk 6: lot tracking + traceability end-to-end.
// Full path: PR (5 lines) → PO → GR (5 lots created) → ProdOrder (5 components) →
// Issue (5 lots consumed FIFO) → Confirm op (status flip) → FG receipt (FG lot
// created) → backward trace + forward trace assertions.
import "dotenv/config";
import {
  Prisma,
  MasterDataStatus,
  PurchaseOrderStatus,
  ProductionOrderStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import {
  createPurchaseRequisition,
  approvePurchaseRequisition,
} from "../src/lib/services/purchase-requisition";
import {
  convertPrToPo,
  approvePurchaseOrder,
  sendPurchaseOrder,
} from "../src/lib/services/purchase-order";
import { postGoodsReceipt } from "../src/lib/services/goods-receipt";
import {
  createProductionOrder,
  releaseProductionOrder,
  confirmOperation,
  issueMaterialsToOrder,
  receiveFinishedGoods,
} from "../src/lib/services/production-order";
import {
  traceBackwardFromFgLot,
  traceForwardFromMaterialLot,
} from "../src/lib/services/traceability";

async function main() {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: "requester@factoryos.com" },
  });
  const approver = await prisma.user.findUniqueOrThrow({
    where: { email: "approver@factoryos.com" },
  });
  const fg = await prisma.material.findUniqueOrThrow({
    where: { materialNumber: "MAT-100100" },
    include: {
      bomsAsParent: {
        where: { status: "ACTIVE" },
        include: {
          lines: {
            include: { componentMaterial: true, unitOfMeasure: true },
            orderBy: { lineNumber: "asc" },
          },
        },
        take: 1,
      },
    },
  });
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { status: MasterDataStatus.ACTIVE },
  });
  const storage = await prisma.storageLocation.findFirstOrThrow({
    where: { isActive: true },
  });
  const bom = fg.bomsAsParent[0];
  if (!bom) throw new Error("No active BOM for MAT-100100");

  // Compute exact qtys we'll need to produce 5 units of CM-100
  const orderQty = 5;

  console.log(`Setup: producing ${orderQty}× ${fg.materialNumber} from ${supplier.supplierNumber}`);
  console.log(`       BOM has ${bom.lines.length} components`);

  console.log("\n[1] Create PR with all 5 components from a single supplier…");
  const pr = await createPurchaseRequisition(
    {
      department: "Phase3 chunk6 e2e",
      reason: "End-to-end trace demo",
      submit: true,
      lines: bom.lines.map((l) => {
        // need just enough for orderQty production runs: bomQty × orderQty × scrap
        const scrapMult = new Prisma.Decimal(1).add(
          new Prisma.Decimal(l.scrapPercent).div(100),
        );
        const need = new Prisma.Decimal(l.quantity).mul(orderQty).mul(scrapMult);
        return {
          materialId: l.componentMaterialId,
          unitOfMeasureId: l.unitOfMeasureId,
          quantity: Number(need.toString()),
          estimatedCost: 1,
        };
      }),
    },
    requester.id,
  );
  await approvePurchaseRequisition(pr.id, approver.id, "OK for trace test");
  console.log(`   ✓ ${pr.prNumber} APPROVED`);

  console.log("[2] Convert PR → PO with supplier…");
  const prFull = await prisma.purchaseRequisition.findUniqueOrThrow({
    where: { id: pr.id },
    include: { lines: true },
  });
  const po = await convertPrToPo(
    {
      prId: pr.id,
      supplierId: supplier.id,
      submit: true,
      lines: prFull.lines.map((l) => ({ prLineId: l.id, unitPrice: 1 })),
    },
    requester.id,
  );
  await approvePurchaseOrder(po.id, approver.id);
  await sendPurchaseOrder(po.id, requester.id);
  console.log(`   ✓ ${po.poNumber} SENT`);

  console.log("[3] Receive ALL PO lines in one GR (creates 5 MaterialLots)…");
  const poFull = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  const gr = await postGoodsReceipt(
    {
      poId: po.id,
      lines: poFull.lines.map((pl) => ({
        poLineId: pl.id,
        quantity: Number(pl.quantity.toString()),
        storageLocationId: storage.id,
      })),
    },
    requester.id,
  );
  console.log(`   ✓ ${gr.grNumber} POSTED, PO now ${gr.newPoStatus}`);
  if (gr.newPoStatus !== PurchaseOrderStatus.RECEIVED)
    throw new Error("PO should be fully RECEIVED");

  // Verify lots were created
  const lotsAfterGr = await prisma.materialLot.findMany({
    where: { sourceType: "GoodsReceipt", sourceRefId: gr.id },
  });
  console.log(`   ${lotsAfterGr.length === 5 ? "✓" : "✗"} created ${lotsAfterGr.length} MaterialLots (expected 5)`);
  if (lotsAfterGr.length !== 5) throw new Error("MaterialLot count wrong");
  const supplierLotCount = lotsAfterGr.filter((l) => l.supplierId === supplier.id).length;
  console.log(`   ${supplierLotCount === 5 ? "✓" : "✗"} all 5 lots tagged with supplier ${supplier.supplierNumber}`);
  if (supplierLotCount !== 5) throw new Error("Lots missing supplier tag");

  console.log("\n[4] Create + release production order…");
  const order = await createProductionOrder(
    { parentMaterialId: fg.id, quantity: orderQty },
    requester.id,
  );
  await releaseProductionOrder(order.id, approver.id);
  console.log(`   ✓ ${order.orderNumber} RELEASED`);

  console.log("[5] Issue all 5 components (FIFO consumes the lots we just created)…");
  const orderFull = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: order.id },
    include: { components: true, operations: { orderBy: { sequence: "asc" } } },
  });
  await issueMaterialsToOrder(
    {
      orderId: order.id,
      lines: orderFull.components.map((c) => ({
        componentId: c.id,
        quantity: Number(c.plannedQuantity.toString()),
        storageLocationId: storage.id,
      })),
    },
    requester.id,
  );

  // Verify lot consumption rows + lot remaining decremented
  const consumptions = await prisma.materialLotConsumption.findMany({
    where: { productionOrderComponent: { productionOrderId: order.id } },
    include: { materialLot: true },
  });
  console.log(`   ${consumptions.length >= 5 ? "✓" : "✗"} ${consumptions.length} MaterialLotConsumption rows created`);
  if (consumptions.length < 5) throw new Error("Should have at least 5 consumption rows");

  // Check that one of the lots' quantityRemaining went down
  const lotAfterConsumption = await prisma.materialLot.findUniqueOrThrow({
    where: { id: lotsAfterGr[0].id },
  });
  console.log(
    `   ${lotAfterConsumption.quantityRemaining.lt(lotAfterConsumption.quantityReceived) ? "✓" : "✗"} sample lot ${lotsAfterGr[0].lotNumber} remaining decremented (${lotAfterConsumption.quantityReceived.toString()} → ${lotAfterConsumption.quantityRemaining.toString()})`,
  );

  console.log("\n[6] Confirm op 1 → IN_PROGRESS, then receive all FG…");
  await confirmOperation(
    {
      productionOrderId: order.id,
      operationId: orderFull.operations[0].id,
      actualSetupHours: Number(orderFull.operations[0].plannedSetupHours.toString()),
      actualRunHours: Number(orderFull.operations[0].plannedRunHours.toString()),
    },
    requester.id,
  );
  const recv = await receiveFinishedGoods(
    {
      productionOrderId: order.id,
      quantity: orderQty,
      scrappedQuantity: 0,
      storageLocationId: storage.id,
      notes: "Single batch FG completion",
    },
    requester.id,
  );
  console.log(`   ✓ FG receipt: status=${recv.newStatus}, completed=${recv.completedQuantity}`);
  if (recv.newStatus !== ProductionOrderStatus.COMPLETED)
    throw new Error("Should be COMPLETED");

  // Verify FG lot created
  const fgLots = await prisma.finishedGoodLot.findMany({
    where: { productionOrderId: order.id },
  });
  console.log(`   ${fgLots.length === 1 ? "✓" : "✗"} 1 FinishedGoodLot created (got ${fgLots.length})`);
  if (fgLots.length !== 1) throw new Error("Should have 1 FG lot");
  console.log(`   ✓ FG lot number: ${fgLots[0].lotNumber}`);

  console.log("\n[7] Backward trace from FG lot…");
  const trace = await traceBackwardFromFgLot(fgLots[0].id);
  if (!trace) throw new Error("Backward trace returned null");
  console.log(`   ✓ trace returned`);
  console.log(`   FG lot:        ${trace.fg.lotNumber} (${trace.fg.material.materialNumber})`);
  console.log(`   Production:    ${trace.fg.productionOrder.orderNumber}`);
  console.log(`   Components:    ${trace.fg.productionOrder.components.length}`);
  const totalConsumptions = trace.fg.productionOrder.components.reduce(
    (n, c) => n + c.lotConsumptions.length,
    0,
  );
  console.log(`   ${totalConsumptions >= 5 ? "✓" : "✗"} ${totalConsumptions} total lot consumptions traced (expected ≥ 5)`);
  console.log(`   Suppliers:     ${trace.suppliers.map((s) => s.supplierNumber).join(", ")}`);
  console.log(`   GRs traced:    ${[...trace.grById.values()].map((g) => g.grNumber).join(", ")}`);
  if (trace.suppliers.length === 0) throw new Error("Should trace to ≥ 1 supplier");
  if (![...trace.grById.values()].some((g) => g.grNumber === gr.grNumber))
    throw new Error("Should trace back to our GR");

  console.log("\n[8] Forward trace from one of the supplier lots…");
  const fwdTarget = lotsAfterGr[0];
  const fwd = await traceForwardFromMaterialLot(fwdTarget.id);
  if (!fwd) throw new Error("Forward trace returned null");
  console.log(`   Lot:           ${fwd.lot.lotNumber} (${fwd.lot.material.materialNumber}) from ${fwd.lot.supplier?.supplierNumber}`);
  console.log(`   Source GR:     ${fwd.sourceGr?.grNumber ?? "—"}`);
  console.log(`   Consumptions:  ${fwd.lot.consumptions.length}`);
  const targetOrderHit = fwd.lot.consumptions.some(
    (c) => c.productionOrderComponent.productionOrder.id === order.id,
  );
  console.log(`   ${targetOrderHit ? "✓" : "✗"} our production order ${order.orderNumber} appears in forward trace`);
  if (!targetOrderHit)
    throw new Error("Forward trace should hit our production order");
  const fgsFound = fwd.lot.consumptions.flatMap(
    (c) => c.productionOrderComponent.productionOrder.finishedGoodLots,
  );
  const targetFgFound = fgsFound.some((fglot) => fglot.id === fgLots[0].id);
  console.log(`   ${targetFgFound ? "✓" : "✗"} FG lot ${fgLots[0].lotNumber} appears via forward trace`);
  if (!targetFgFound)
    throw new Error("Forward trace should reach the FG lot we made");

  console.log(
    `\n✅ Phase 3 chunk 6 e2e: ${gr.grNumber} created 5 lots from ${supplier.supplierNumber} → consumed in ${order.orderNumber} → FG ${fgLots[0].lotNumber}; backward and forward traces both pass.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
