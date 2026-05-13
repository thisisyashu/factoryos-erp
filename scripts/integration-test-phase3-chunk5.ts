// Phase 3 chunk 5: FG receipt + completion + variance.
// Walks: create → stock → release → confirm one op → partial FG receipt
// (still IN_PROGRESS) → final FG receipt with scrap (flips to COMPLETED).
// Verifies inventory ledger, balance, status flip, and variance summary.
import "dotenv/config";
import {
  Prisma,
  InventoryMovementType,
  ProductionOrderStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import {
  createProductionOrder,
  releaseProductionOrder,
  confirmOperation,
  receiveFinishedGoods,
  getProductionOrderVariance,
} from "../src/lib/services/production-order";
import { postInventoryMovement } from "../src/lib/services/inventory";

async function main() {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: "requester@factoryos.com" },
  });
  const approver = await prisma.user.findUniqueOrThrow({
    where: { email: "approver@factoryos.com" },
  });
  const fg = await prisma.material.findUniqueOrThrow({
    where: { materialNumber: "MAT-100100" },
  });
  const storage = await prisma.storageLocation.findFirstOrThrow({
    where: { isActive: true },
  });

  console.log("[1] Create + stock + release a fresh PO (qty 10)…");
  const created = await createProductionOrder(
    {
      parentMaterialId: fg.id,
      quantity: 10,
      notes: "Phase 3 chunk 5 e2e",
    },
    requester.id,
  );
  const orderFull = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      components: true,
      operations: { orderBy: { sequence: "asc" } },
    },
  });
  await prisma.$transaction(async (tx) => {
    for (const c of orderFull.components) {
      await postInventoryMovement(tx, {
        movementType: InventoryMovementType.ADJUSTMENT,
        materialId: c.materialId,
        storageLocationId: storage.id,
        quantity: c.plannedQuantity.add(new Prisma.Decimal(2)),
        unitOfMeasureId: c.unitOfMeasureId,
        referenceType: "InitialAdjustment",
        referenceId: created.id,
        postedById: approver.id,
      });
    }
  });
  await releaseProductionOrder(created.id, approver.id);

  // Confirm op 1 to flip RELEASED → IN_PROGRESS
  await confirmOperation(
    {
      productionOrderId: created.id,
      operationId: orderFull.operations[0].id,
      actualSetupHours: Number(orderFull.operations[0].plannedSetupHours.toString()),
      actualRunHours: Number(orderFull.operations[0].plannedRunHours.toString()),
    },
    requester.id,
  );
  console.log(`   ✓ ${created.orderNumber} now IN_PROGRESS`);

  // Snapshot FG inventory before
  const fgBalanceBefore = await prisma.inventoryBalance.findUnique({
    where: {
      materialId_storageLocationId: {
        materialId: fg.id,
        storageLocationId: storage.id,
      },
    },
  });
  const fgBefore = fgBalanceBefore?.quantityOnHand ?? new Prisma.Decimal(0);
  console.log(`   FG inventory @ ${storage.code} before: ${fgBefore.toString()}`);

  console.log("\n[2] Partial FG receipt: 6 good (still IN_PROGRESS)…");
  const r1 = await receiveFinishedGoods(
    {
      productionOrderId: created.id,
      quantity: 6,
      scrappedQuantity: 0,
      storageLocationId: storage.id,
      notes: "first batch off the line",
    },
    requester.id,
  );
  console.log(
    `   newStatus=${r1.newStatus} | completed=${r1.completedQuantity} | scrapped=${r1.scrappedQuantity}`,
  );
  if (r1.newStatus !== ProductionOrderStatus.IN_PROGRESS) {
    throw new Error("Should still be IN_PROGRESS after partial receipt");
  }

  // Verify ledger entry
  const ledger1 = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: "ProductionOrder",
      referenceId: created.id,
      movementType: InventoryMovementType.PRODUCTION_RECEIPT,
    },
  });
  console.log(`   ${ledger1.length === 1 ? "✓" : "✗"} 1 PRODUCTION_RECEIPT ledger entry created`);
  console.log(
    `   ${ledger1[0]?.quantity.eq(6) ? "✓" : "✗"} ledger qty = +6 (positive, inflow)`,
  );
  if (ledger1.length !== 1 || !ledger1[0].quantity.eq(6)) {
    throw new Error("Ledger entry malformed");
  }

  console.log("\n[3] Final FG receipt: 3 good + 1 scrap (= 4 total = remaining → COMPLETED)…");
  const r2 = await receiveFinishedGoods(
    {
      productionOrderId: created.id,
      quantity: 3,
      scrappedQuantity: 1,
      storageLocationId: storage.id,
      notes: "final batch with one rejected unit",
    },
    requester.id,
  );
  console.log(
    `   newStatus=${r2.newStatus} | completed=${r2.completedQuantity} | scrapped=${r2.scrappedQuantity}`,
  );
  if (r2.newStatus !== ProductionOrderStatus.COMPLETED) {
    throw new Error(`Should be COMPLETED after final receipt, got ${r2.newStatus}`);
  }
  if (r2.completedQuantity !== "9") {
    throw new Error(`Expected 9 good total, got ${r2.completedQuantity}`);
  }
  if (r2.scrappedQuantity !== "1") {
    throw new Error(`Expected 1 scrapped, got ${r2.scrappedQuantity}`);
  }

  // Verify completedAt set
  const orderFinal = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
  });
  console.log(`   ${orderFinal.completedAt ? "✓" : "✗"} completedAt set`);
  if (!orderFinal.completedAt) throw new Error("completedAt not set on completion");

  // Verify FG balance increased by exactly 9 (6 + 3)
  const fgBalanceAfter = await prisma.inventoryBalance.findUniqueOrThrow({
    where: {
      materialId_storageLocationId: {
        materialId: fg.id,
        storageLocationId: storage.id,
      },
    },
  });
  const fgAfter = fgBalanceAfter.quantityOnHand;
  const delta = fgAfter.sub(fgBefore);
  console.log(
    `   ${delta.eq(9) ? "✓" : "✗"} FG inventory delta: ${fgBefore.toString()} → ${fgAfter.toString()} (= +${delta.toString()}, expected +9)`,
  );
  if (!delta.eq(9)) throw new Error("FG inventory delta wrong");

  console.log("\n[4] Verify total ledger entries (2 PRODUCTION_RECEIPT, both positive)…");
  const ledger2 = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: "ProductionOrder",
      referenceId: created.id,
      movementType: InventoryMovementType.PRODUCTION_RECEIPT,
    },
    orderBy: { postedAt: "asc" },
  });
  console.log(
    `   ${ledger2.length === 2 ? "✓" : "✗"} 2 PRODUCTION_RECEIPT entries (got ${ledger2.length})`,
  );
  console.log(
    `   ${ledger2[0]?.quantity.eq(6) && ledger2[1]?.quantity.eq(3) ? "✓" : "✗"} entries are +6, then +3`,
  );

  console.log("\n[5] Variance summary…");
  const v = await getProductionOrderVariance(created.id);
  console.log(`   planned ${v.quantityPlanned} → completed ${v.quantityCompleted}, scrapped ${v.quantityScrapped}`);
  console.log(`   yield: ${v.yieldPercent}%, scrap rate: ${v.scrapPercent}%`);
  console.log(
    `   hours: planned ${v.totalPlannedHours} actual ${v.totalActualHours} variance ${v.hoursVariance} (${v.hoursVariancePercent}%)`,
  );
  // 9 / 10 = 90% yield
  if (v.yieldPercent !== "90.00") throw new Error(`Expected yield 90.00%, got ${v.yieldPercent}`);
  // 1 / 10 = 10% scrap rate
  if (v.scrapPercent !== "10.00") throw new Error(`Expected scrap 10.00%, got ${v.scrapPercent}`);

  console.log("\n[6] Audit trail — verify RECEIVE_FG + STATUS_CHANGE → COMPLETED entries…");
  const audits = await prisma.auditLog.findMany({
    where: { entityType: "ProductionOrder", entityId: created.id },
    orderBy: { createdAt: "asc" },
  });
  const actions = audits.map((a) => a.action);
  const receivesCount = actions.filter((a) => a === "RECEIVE_FG").length;
  console.log(`   ${receivesCount === 2 ? "✓" : "✗"} 2 RECEIVE_FG entries (got ${receivesCount})`);
  // Find STATUS_CHANGE → COMPLETED
  const completionAudit = audits.find(
    (a) => a.action === "STATUS_CHANGE" && (a.metadata as { triggeredBy?: { type?: string } })?.triggeredBy?.type === "FgReceipt",
  );
  console.log(`   ${completionAudit ? "✓" : "✗"} STATUS_CHANGE audit triggered by FG receipt found`);
  const meta = completionAudit?.metadata as Record<string, unknown> | undefined;
  console.log(
    `   ${meta?.yieldPercent ? "✓" : "✗"} yieldPercent metadata: ${meta?.yieldPercent ?? "missing"}`,
  );
  if (!completionAudit || !meta?.yieldPercent) {
    throw new Error("Completion audit missing or incomplete");
  }

  console.log("\n[7] Negative test: try to receive against a COMPLETED order (expect rejection)…");
  let rejected = false;
  try {
    await receiveFinishedGoods(
      {
        productionOrderId: created.id,
        quantity: 1,
        scrappedQuantity: 0,
        storageLocationId: storage.id,
      },
      requester.id,
    );
  } catch (e) {
    rejected = true;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ✓ rejected: ${msg.substring(0, 90)}…`);
  }
  if (!rejected) throw new Error("Should reject FG receipt on COMPLETED order");

  console.log(
    `\n✅ Phase 3 chunk 5 e2e: ${created.orderNumber} 6+3 good + 1 scrap → COMPLETED, FG inventory +9, yield 90%, audit complete.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
