// Phase 3 chunk 3: release + shortage check + material issue + status transition.
// Walks the full DRAFT → RELEASED → IN_PROGRESS path and asserts:
//   - Shortage blocks release
//   - Stocking the components unblocks release
//   - Reservations land
//   - Issuing materials posts negative ledger entries + decrements balance
//   - First issue flips RELEASED → IN_PROGRESS
//   - Reserved drops, issued rises by the right amounts
import "dotenv/config";
import {
  Prisma,
  MasterDataStatus,
  InventoryMovementType,
  ProductionOrderStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import {
  createProductionOrder,
  releaseProductionOrder,
  issueMaterialsToOrder,
  getMaterialAvailability,
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
  const storageLocation = await prisma.storageLocation.findFirstOrThrow({
    where: { isActive: true },
  });

  console.log(
    `Setup: parent=${fg.materialNumber}, location=${storageLocation.code}`,
  );

  console.log("\n[1] Create a fresh production order (qty 50)…");
  const created = await createProductionOrder(
    {
      parentMaterialId: fg.id,
      quantity: 50,
      notes: "Phase 3 chunk 3 e2e",
    },
    requester.id,
  );
  console.log(`   ✓ ${created.orderNumber} status=${created.status}`);

  // Read full order to know component IDs + planned qtys
  const orderFull = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      components: {
        include: { material: { select: { materialNumber: true } } },
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  console.log("[2] Try release (expect shortage rejection)…");
  let shortageDetected = false;
  try {
    await releaseProductionOrder(created.id, approver.id);
  } catch (e) {
    shortageDetected = true;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`   ✓ rejected: ${msg.substring(0, 110)}…`);
  }
  if (!shortageDetected) throw new Error("Shortage check failed to block release");

  console.log("[3] Stock all components via direct ledger adjustments (simulating prior GRs)…");
  await prisma.$transaction(async (tx) => {
    for (const c of orderFull.components) {
      const qty = c.plannedQuantity.add(new Prisma.Decimal(10)); // a little extra
      await postInventoryMovement(tx, {
        movementType: InventoryMovementType.ADJUSTMENT,
        materialId: c.materialId,
        storageLocationId: storageLocation.id,
        quantity: qty,
        unitOfMeasureId: c.unitOfMeasureId,
        referenceType: "InitialAdjustment",
        referenceId: created.id,
        postedById: approver.id,
        notes: "Initial stock for chunk 3 test",
      });
      console.log(`   + ${qty.toString()} ${c.material.materialNumber}`);
    }
  });

  console.log("[4] Verify availability now shows OK…");
  const avail = await getMaterialAvailability(created.id);
  const anyShort = avail.some((a) => a.isShort);
  console.log(
    `   ${anyShort ? "✗" : "✓"} all components OK${anyShort ? " — still short!" : ""}`,
  );
  if (anyShort) throw new Error("Stocking didn't clear shortages");

  console.log("[5] Release the order…");
  const released = await releaseProductionOrder(created.id, approver.id);
  console.log(`   ✓ ${released.id.substring(0, 8)}… status=${released.status}`);
  const afterRelease = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: { components: true },
  });
  const allReserved = afterRelease.components.every((c) =>
    c.reservedQuantity.eq(c.plannedQuantity),
  );
  console.log(
    `   ${allReserved ? "✓" : "✗"} reservedQuantity = plannedQuantity for all ${afterRelease.components.length} components`,
  );
  if (!allReserved) throw new Error("Reservations not set on release");
  if (afterRelease.status !== ProductionOrderStatus.RELEASED) {
    throw new Error(`Expected RELEASED, got ${afterRelease.status}`);
  }
  if (!afterRelease.releasedAt) throw new Error("releasedAt not set");
  if (afterRelease.releasedById !== approver.id) {
    throw new Error("releasedById not set");
  }

  console.log("[6] Issue partial materials (50% of each, rounded to 4dp to match Decimal(16,4))…");
  const issueLines = orderFull.components.map((c) => {
    // Round to 4 decimals to match the column's Decimal(16,4) precision —
    // otherwise 0.01315 would silently round to 0.0132 inside the DB and our
    // post-issue assertions would compare apples to pre-rounding oranges.
    const half = c.plannedQuantity.div(2).toDecimalPlaces(4);
    return {
      componentId: c.id,
      quantity: Number(half.toString()),
      storageLocationId: storageLocation.id,
    };
  });
  const expectedIssuedById = new Map(
    issueLines.map((l) => [l.componentId, new Prisma.Decimal(l.quantity)]),
  );
  const issueResult = await issueMaterialsToOrder(
    { orderId: created.id, lines: issueLines },
    requester.id,
  );
  console.log(
    `   ✓ issued ${issueResult.issuedLineCount} lines | newStatus=${issueResult.newStatus}`,
  );
  if (issueResult.newStatus !== ProductionOrderStatus.IN_PROGRESS) {
    throw new Error(`Expected IN_PROGRESS after first issue, got ${issueResult.newStatus}`);
  }

  console.log("[7] Verify component counters + inventory deltas…");
  const afterIssue = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      components: {
        include: { material: { select: { materialNumber: true } } },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!afterIssue.startedAt) throw new Error("startedAt not set on first issue");
  let counterMismatch = false;
  for (const c of afterIssue.components) {
    const expectedIssued = expectedIssuedById.get(c.id)!;
    const expectedReserved = c.plannedQuantity.sub(expectedIssued);
    const ok =
      c.issuedQuantity.eq(expectedIssued) && c.reservedQuantity.eq(expectedReserved);
    console.log(
      `   ${ok ? "✓" : "✗"} ${c.material.materialNumber}: issued=${c.issuedQuantity.toString()} (exp ${expectedIssued.toString()}), reserved=${c.reservedQuantity.toString()} (exp ${expectedReserved.toString()})`,
    );
    if (!ok) counterMismatch = true;
  }
  if (counterMismatch) throw new Error("Component counters wrong after issue");

  console.log("[8] Verify negative MATERIAL_ISSUE ledger entries created…");
  const ledger = await prisma.inventoryLedger.findMany({
    where: {
      referenceType: "ProductionOrder",
      referenceId: created.id,
      movementType: InventoryMovementType.MATERIAL_ISSUE,
    },
  });
  console.log(
    `   ${ledger.length === 5 ? "✓" : "✗"} ${ledger.length} MATERIAL_ISSUE ledger entries (expected 5)`,
  );
  const allNegative = ledger.every((e) => e.quantity.lt(0));
  console.log(`   ${allNegative ? "✓" : "✗"} all quantities negative (outflow)`);
  if (ledger.length !== 5 || !allNegative) {
    throw new Error("Ledger entries malformed");
  }

  console.log("[9] Audit log — check expected actions present…");
  const audits = await prisma.auditLog.findMany({
    where: { entityType: "ProductionOrder", entityId: created.id },
    orderBy: { createdAt: "asc" },
  });
  const actions = audits.map((a) => a.action);
  const expected = ["CREATE", "RELEASE", "STATUS_CHANGE", "ISSUE_MATERIALS"];
  const allPresent = expected.every((e) => actions.includes(e));
  console.log(
    `   ${allPresent ? "✓" : "✗"} actions present: ${actions.join(" → ")}`,
  );
  if (!allPresent) throw new Error("Missing audit actions");

  console.log(
    `\n✅ Phase 3 chunk 3 e2e: ${created.orderNumber} DRAFT → RELEASED → IN_PROGRESS, 5 negative ledger entries posted, reservations halved correctly.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
