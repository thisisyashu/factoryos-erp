// End-to-end integration test of the Phase 2 procure-to-receive flow.
// Run with: npx tsx scripts/integration-test-phase2.ts (from project root)
import "dotenv/config";
import { Prisma, MaterialType, MasterDataStatus } from "@prisma/client";
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

async function main() {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: "requester@factoryos.com" },
  });
  const approver = await prisma.user.findUniqueOrThrow({
    where: { email: "approver@factoryos.com" },
  });
  const material = await prisma.material.findFirstOrThrow({
    where: { status: MasterDataStatus.ACTIVE, type: MaterialType.RAW_MATERIAL },
  });
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { status: MasterDataStatus.ACTIVE },
  });
  const storageLocation = await prisma.storageLocation.findFirstOrThrow({
    where: { isActive: true },
  });

  console.log(
    `Setup: material=${material.materialNumber}, supplier=${supplier.supplierNumber}, location=${storageLocation.code}`,
  );

  const balanceBefore = await prisma.inventoryBalance.findUnique({
    where: {
      materialId_storageLocationId: {
        materialId: material.id,
        storageLocationId: storageLocation.id,
      },
    },
  });
  const ledgerCountBefore = await prisma.inventoryLedger.count({
    where: { materialId: material.id, storageLocationId: storageLocation.id },
  });
  const beforeQty = balanceBefore?.quantityOnHand ?? new Prisma.Decimal(0);
  console.log(
    `Snapshot before: balance=${beforeQty.toString()}, ledger entries=${ledgerCountBefore}`,
  );

  console.log("\n[1] Create PR (auto-submit)…");
  const pr = await createPurchaseRequisition(
    {
      department: "Integration test",
      reason: "Phase 2 chunk 5 e2e",
      submit: true,
      lines: [
        {
          materialId: material.id,
          unitOfMeasureId: material.unitOfMeasureId,
          quantity: 100,
          estimatedCost: 5,
        },
      ],
    },
    requester.id,
  );
  console.log(`   ✓ ${pr.prNumber} status=${pr.status}`);

  console.log("[2] Approve PR…");
  await approvePurchaseRequisition(pr.id, approver.id, "OK");

  console.log("[3] Convert PR → PO (submit)…");
  const prFull = await prisma.purchaseRequisition.findUniqueOrThrow({
    where: { id: pr.id },
    include: { lines: true },
  });
  const po = await convertPrToPo(
    {
      prId: pr.id,
      supplierId: supplier.id,
      currency: "USD",
      submit: true,
      lines: prFull.lines.map((l) => ({ prLineId: l.id, unitPrice: 5 })),
    },
    requester.id,
  );
  console.log(`   ✓ ${po.poNumber} status=${po.status}`);

  console.log("[4] Approve + send PO…");
  await approvePurchaseOrder(po.id, approver.id);
  await sendPurchaseOrder(po.id, requester.id);
  const poAfterSend = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  console.log(`   ✓ status=${poAfterSend.status}`);

  console.log("[5] Post partial GR (60 of 100)…");
  const gr1 = await postGoodsReceipt(
    {
      poId: po.id,
      notes: "first partial",
      lines: [
        {
          poLineId: poAfterSend.lines[0].id,
          quantity: 60,
          storageLocationId: storageLocation.id,
        },
      ],
    },
    requester.id,
  );
  const poAfterGr1 = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  const ok1 =
    poAfterGr1.status === "PARTIALLY_RECEIVED" &&
    poAfterGr1.lines[0].quantityReceived.toString() === "60";
  console.log(
    `   ${ok1 ? "✓" : "✗"} ${gr1.grNumber} | PO=${poAfterGr1.status} | line.received=${poAfterGr1.lines[0].quantityReceived.toString()}/100`,
  );
  if (!ok1) throw new Error("Assertion failed after first GR");

  console.log("[6] Post final GR (40 of remaining 40)…");
  const gr2 = await postGoodsReceipt(
    {
      poId: po.id,
      lines: [
        {
          poLineId: poAfterGr1.lines[0].id,
          quantity: 40,
          storageLocationId: storageLocation.id,
        },
      ],
    },
    requester.id,
  );
  const poAfterGr2 = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  const ok2 =
    poAfterGr2.status === "RECEIVED" &&
    poAfterGr2.lines[0].quantityReceived.toString() === "100";
  console.log(
    `   ${ok2 ? "✓" : "✗"} ${gr2.grNumber} | PO=${poAfterGr2.status} | line.received=${poAfterGr2.lines[0].quantityReceived.toString()}/100`,
  );
  if (!ok2) throw new Error("Assertion failed after second GR");

  console.log("[7] Attempt over-receipt (expect rejection)…");
  let rejected = false;
  try {
    await postGoodsReceipt(
      {
        poId: po.id,
        lines: [
          {
            poLineId: poAfterGr2.lines[0].id,
            quantity: 1,
            storageLocationId: storageLocation.id,
          },
        ],
      },
      requester.id,
    );
  } catch (e) {
    rejected = true;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ✓ rejected: ${msg.substring(0, 100)}`);
  }
  if (!rejected) throw new Error("Over-receipt was not rejected");

  console.log("[8] Verify inventory ledger + balance…");
  const ledgerCountAfter = await prisma.inventoryLedger.count({
    where: { materialId: material.id, storageLocationId: storageLocation.id },
  });
  const balanceAfter = await prisma.inventoryBalance.findUnique({
    where: {
      materialId_storageLocationId: {
        materialId: material.id,
        storageLocationId: storageLocation.id,
      },
    },
  });
  const newLedgerEntries = ledgerCountAfter - ledgerCountBefore;
  const expectedAfterQty = beforeQty.add(100);
  const okLedger = newLedgerEntries === 2;
  const okBalance =
    balanceAfter?.quantityOnHand.toString() === expectedAfterQty.toString();
  console.log(
    `   ${okLedger ? "✓" : "✗"} ledger: +${newLedgerEntries} entries (expected +2)`,
  );
  console.log(
    `   ${okBalance ? "✓" : "✗"} balance: ${beforeQty.toString()} → ${balanceAfter?.quantityOnHand.toString() ?? "?"} (expected ${expectedAfterQty.toString()})`,
  );
  if (!okLedger || !okBalance) throw new Error("Inventory assertions failed");

  console.log(
    `\n✅ Phase 2 chunk 5 e2e: PR ${pr.prNumber} → PO ${po.poNumber} → GR ${gr1.grNumber} + ${gr2.grNumber}, inventory +100 ${material.materialNumber}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
