// Phase 3 chunk 4: confirm + skip operation, status transitions, variance audit.
// Walks the full lifecycle from order create → release → confirm one op
// (RELEASED→IN_PROGRESS) → skip another → confirm the last.
import "dotenv/config";
import {
  Prisma,
  InventoryMovementType,
  ProductionOrderStatus,
  ProductionOperationStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/db";
import {
  createProductionOrder,
  releaseProductionOrder,
  confirmOperation,
  skipOperation,
  listWorkCenterQueue,
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

  console.log("[1] Create + stock + release a fresh production order (qty 25)…");
  const created = await createProductionOrder(
    {
      parentMaterialId: fg.id,
      quantity: 25,
      notes: "Phase 3 chunk 4 e2e",
    },
    requester.id,
  );
  const orderFull = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      components: true,
      operations: {
        include: { workCenter: { select: { code: true } } },
        orderBy: { sequence: "asc" },
      },
    },
  });

  // Stock all components so release succeeds
  await prisma.$transaction(async (tx) => {
    for (const c of orderFull.components) {
      await postInventoryMovement(tx, {
        movementType: InventoryMovementType.ADJUSTMENT,
        materialId: c.materialId,
        storageLocationId: storage.id,
        quantity: c.plannedQuantity.add(new Prisma.Decimal(5)),
        unitOfMeasureId: c.unitOfMeasureId,
        referenceType: "InitialAdjustment",
        referenceId: created.id,
        postedById: approver.id,
        notes: "Initial stock for chunk 4",
      });
    }
  });
  await releaseProductionOrder(created.id, approver.id);
  console.log(`   ✓ ${created.orderNumber} RELEASED with ${orderFull.operations.length} operations`);

  // Pick the work center for op 1 and verify queue picks it up
  const op1 = orderFull.operations[0];
  console.log(`\n[2] Verify ${op1.workCenter.code} queue includes our op 1 (sequence ${op1.sequence})…`);
  const queueBefore = await listWorkCenterQueue(op1.workCenterId);
  const present = queueBefore.some((q) => q.id === op1.id);
  console.log(`   ${present ? "✓" : "✗"} queue length=${queueBefore.length}, our op present: ${present}`);
  if (!present) throw new Error("Operation should appear in work-center queue while PENDING + order RELEASED");

  console.log(`\n[3] Confirm op 1 with actuals (planned setup ${op1.plannedSetupHours}, run ${op1.plannedRunHours}; actuals +10% on each)…`);
  const actualSetup1 = Number(op1.plannedSetupHours.mul(new Prisma.Decimal(1.1)).toString());
  const actualRun1 = Number(op1.plannedRunHours.mul(new Prisma.Decimal(1.1)).toString());
  await confirmOperation(
    {
      productionOrderId: created.id,
      operationId: op1.id,
      actualSetupHours: actualSetup1,
      actualRunHours: actualRun1,
      notes: "Slight overage on reflow ramp-up",
    },
    requester.id,
  );

  // Verify op 1 + order updated
  const after1 = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      operations: { orderBy: { sequence: "asc" } },
    },
  });
  const op1After = after1.operations.find((o) => o.id === op1.id)!;
  const op1Confirmed = op1After.status === ProductionOperationStatus.CONFIRMED;
  const startedAtSet = op1After.startedAt !== null;
  const completedAtSet = op1After.completedAt !== null;
  const actualsStored =
    op1After.actualSetupHours.gt(op1.plannedSetupHours) &&
    op1After.actualRunHours.gt(op1.plannedRunHours);
  console.log(`   ${op1Confirmed ? "✓" : "✗"} op 1 status=${op1After.status}`);
  console.log(`   ${startedAtSet ? "✓" : "✗"} startedAt set`);
  console.log(`   ${completedAtSet ? "✓" : "✗"} completedAt set`);
  console.log(`   ${actualsStored ? "✓" : "✗"} actuals stored (setup ${op1After.actualSetupHours.toString()} > planned ${op1.plannedSetupHours.toString()}, run ${op1After.actualRunHours.toString()} > planned ${op1.plannedRunHours.toString()})`);
  if (!op1Confirmed || !startedAtSet || !completedAtSet || !actualsStored) {
    throw new Error("Operation 1 confirmation didn't update fields correctly");
  }
  // Order should have flipped RELEASED → IN_PROGRESS
  if (after1.status !== ProductionOrderStatus.IN_PROGRESS) {
    throw new Error(`Order should be IN_PROGRESS after first confirm, got ${after1.status}`);
  }
  if (!after1.startedAt) throw new Error("Order startedAt should be set");
  console.log(`   ✓ order flipped to IN_PROGRESS, startedAt=${after1.startedAt.toISOString()}`);

  console.log("\n[4] Skip op 2 (mid-sequence skip with required reason)…");
  const op2 = after1.operations[1];
  await skipOperation(
    {
      productionOrderId: created.id,
      operationId: op2.id,
      reason: "Prototype build — assembly skipped per engineering",
    },
    approver.id,
  );
  const after2 = await prisma.productionOrderOperation.findUniqueOrThrow({
    where: { id: op2.id },
  });
  const op2Skipped =
    after2.status === ProductionOperationStatus.SKIPPED &&
    after2.completedAt !== null &&
    after2.notes?.includes("engineering");
  console.log(`   ${op2Skipped ? "✓" : "✗"} op 2 status=${after2.status}, notes captured`);
  if (!op2Skipped) throw new Error("Skip didn't update operation correctly");

  console.log("\n[5] Confirm op 3 (planned exactly — zero variance)…");
  const op3 = after1.operations[2];
  await confirmOperation(
    {
      productionOrderId: created.id,
      operationId: op3.id,
      actualSetupHours: Number(op3.plannedSetupHours.toString()),
      actualRunHours: Number(op3.plannedRunHours.toString()),
    },
    requester.id,
  );
  const op3After = await prisma.productionOrderOperation.findUniqueOrThrow({
    where: { id: op3.id },
  });
  const op3Confirmed = op3After.status === ProductionOperationStatus.CONFIRMED;
  console.log(`   ${op3Confirmed ? "✓" : "✗"} op 3 status=${op3After.status}`);
  if (!op3Confirmed) throw new Error("Op 3 confirm failed");

  console.log("\n[6] Verify queue is now empty for all 3 work centers (all ops resolved)…");
  for (const wcOp of orderFull.operations) {
    const q = await listWorkCenterQueue(wcOp.workCenterId);
    const stillThere = q.some((x) => x.productionOrderId === created.id);
    console.log(
      `   ${stillThere ? "✗" : "✓"} ${wcOp.workCenter.code}: order absent from queue`,
    );
    if (stillThere) throw new Error(`Op should no longer appear in queue at ${wcOp.workCenter.code}`);
  }

  console.log("\n[7] Audit log — verify variance metadata + skip reason captured…");
  const audits = await prisma.auditLog.findMany({
    where: { entityType: "ProductionOrder", entityId: created.id },
    orderBy: { createdAt: "asc" },
  });
  const actions = audits.map((a) => a.action);
  const expected = ["CREATE", "RELEASE", "CONFIRM_OPERATION", "STATUS_CHANGE", "SKIP_OPERATION", "CONFIRM_OPERATION"];
  const allPresent = expected.every((e) => actions.includes(e));
  console.log(`   ${allPresent ? "✓" : "✗"} actions: ${actions.join(" → ")}`);
  if (!allPresent) throw new Error("Missing expected audit actions");

  // Drill into the first CONFIRM_OPERATION to verify variance fields
  const confirmEntry = audits.find((a) => a.action === "CONFIRM_OPERATION");
  const meta = confirmEntry?.metadata as Record<string, unknown> | undefined;
  const hasVariance =
    !!meta &&
    "setupVarianceHours" in meta &&
    "runVarianceHours" in meta &&
    typeof meta.setupVarianceHours === "string";
  console.log(
    `   ${hasVariance ? "✓" : "✗"} CONFIRM_OPERATION audit carries setupVarianceHours + runVarianceHours metadata`,
  );
  if (!hasVariance) throw new Error("Variance metadata missing from audit");

  // Drill into SKIP_OPERATION
  const skipEntry = audits.find((a) => a.action === "SKIP_OPERATION");
  const skipMeta = skipEntry?.metadata as Record<string, unknown> | undefined;
  const hasReason =
    !!skipMeta &&
    typeof skipMeta.reason === "string" &&
    skipMeta.reason.includes("engineering");
  console.log(`   ${hasReason ? "✓" : "✗"} SKIP_OPERATION audit carries reason metadata`);
  if (!hasReason) throw new Error("Skip reason missing from audit");

  console.log(
    `\n✅ Phase 3 chunk 4 e2e: ${created.orderNumber} 1 confirmed → status flip → 1 skipped → 1 confirmed; queues empty; variance + skip-reason audited.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
