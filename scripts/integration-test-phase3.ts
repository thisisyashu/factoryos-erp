// Phase 3 chunk 2: exercise createProductionOrder + BOM explosion.
// Verifies:
//   - Order created in DRAFT
//   - Components match BOM × order qty × scrap multiplier (Decimal — no float drift)
//   - Operations snapshot has plannedRunHours = routingOp.runTime × order qty
//   - Audit entry written
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { createProductionOrder } from "../src/lib/services/production-order";

async function main() {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: "requester@factoryos.com" },
  });
  const fg = await prisma.material.findUniqueOrThrow({
    where: { materialNumber: "MAT-100100" },
  });

  const orderQty = 100;
  console.log(`[1] Create production order: 100× ${fg.materialNumber}…`);
  const created = await createProductionOrder(
    {
      parentMaterialId: fg.id,
      quantity: orderQty,
      notes: "Phase 3 chunk 2 integration test",
    },
    requester.id,
  );
  console.log(`   ✓ ${created.orderNumber} status=${created.status}`);

  // Reload with includes
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      bom: { include: { lines: { orderBy: { lineNumber: "asc" } } } },
      routing: { include: { operations: { orderBy: { sequence: "asc" } } } },
      components: {
        include: { material: { select: { materialNumber: true } } },
        orderBy: { lineNumber: "asc" },
      },
      operations: {
        include: { workCenter: { select: { code: true } } },
        orderBy: { sequence: "asc" },
      },
    },
  });

  // ---- Assert components match BOM explosion exactly ----
  console.log(`[2] Verify ${order.components.length} components match BOM × ${orderQty} × scrap…`);
  if (order.components.length !== order.bom.lines.length) {
    throw new Error(
      `Component count mismatch: got ${order.components.length}, expected ${order.bom.lines.length}`,
    );
  }
  let allMatch = true;
  for (let i = 0; i < order.bom.lines.length; i++) {
    const bomLine = order.bom.lines[i];
    const comp = order.components[i];
    const expected = new Prisma.Decimal(bomLine.quantity)
      .mul(orderQty)
      .mul(new Prisma.Decimal(1).add(new Prisma.Decimal(bomLine.scrapPercent).div(100)));
    const ok =
      comp.materialId === bomLine.componentMaterialId &&
      comp.plannedQuantity.eq(expected);
    const mark = ok ? "✓" : "✗";
    console.log(
      `   ${mark} L${comp.lineNumber} ${comp.material.materialNumber}: planned=${comp.plannedQuantity.toString()}  expected=${expected.toString()}`,
    );
    if (!ok) allMatch = false;
  }
  if (!allMatch) throw new Error("Component qty mismatch");

  // ---- Decimal precision check: no float drift ----
  // BOM line 30 (resistor) = 4 × 100 × 1.015 = 406 exact.
  // BOM line 50 (solder)   = 0.0005 × 100 × 1.05 = 0.0525 exact.
  console.log("[3] Verify Decimal precision (no float drift)…");
  const resistor = order.components.find((c) => c.material.materialNumber === "MAT-000002")!;
  const solder = order.components.find((c) => c.material.materialNumber === "MAT-000003")!;
  const resistorOk = resistor.plannedQuantity.toString() === "406";
  const solderOk = solder.plannedQuantity.toString() === "0.0525";
  console.log(
    `   ${resistorOk ? "✓" : "✗"} resistor: ${resistor.plannedQuantity.toString()} (expected 406)`,
  );
  console.log(
    `   ${solderOk ? "✓" : "✗"} solder:   ${solder.plannedQuantity.toString()} (expected 0.0525)`,
  );
  if (!resistorOk || !solderOk) {
    throw new Error("Decimal precision regression detected");
  }

  // ---- Operations snapshot ----
  console.log(`[4] Verify ${order.operations.length} operations snapshotted from routing…`);
  if (!order.routing) throw new Error("Routing missing");
  if (order.operations.length !== order.routing.operations.length) {
    throw new Error("Operation count mismatch");
  }
  let opsOk = true;
  for (let i = 0; i < order.routing.operations.length; i++) {
    const rOp = order.routing.operations[i];
    const op = order.operations[i];
    const expectedRun = new Prisma.Decimal(rOp.runTimeHoursPerUnit).mul(orderQty);
    const ok =
      op.sequence === rOp.sequence &&
      op.workCenterId === rOp.workCenterId &&
      op.plannedSetupHours.eq(rOp.setupTimeHours) &&
      op.plannedRunHours.eq(expectedRun);
    const mark = ok ? "✓" : "✗";
    console.log(
      `   ${mark} Seq ${op.sequence} @ ${op.workCenter.code}: setup=${op.plannedSetupHours.toString()}h run=${op.plannedRunHours.toString()}h`,
    );
    if (!ok) opsOk = false;
  }
  if (!opsOk) throw new Error("Operation snapshot mismatch");

  // ---- Audit log ----
  console.log("[5] Verify audit log entry…");
  const audit = await prisma.auditLog.findMany({
    where: { entityType: "ProductionOrder", entityId: order.id },
  });
  const hasCreate = audit.some((a) => a.action === "CREATE");
  console.log(
    `   ${hasCreate ? "✓" : "✗"} found CREATE audit entry (${audit.length} total)`,
  );
  if (!hasCreate) throw new Error("Missing audit");

  // ---- Negative test: order against inactive material ----
  console.log("[6] Negative test: order against non-ACTIVE material (expect rejection)…");
  const draftMat = await prisma.material.findFirst({
    where: { status: { not: "ACTIVE" } },
  });
  if (draftMat) {
    let rejected = false;
    try {
      await createProductionOrder(
        { parentMaterialId: draftMat.id, quantity: 1 },
        requester.id,
      );
    } catch (e) {
      rejected = true;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`   ✓ rejected: ${msg.substring(0, 90)}`);
    }
    if (!rejected) throw new Error("Inactive-material order should have been rejected");
  } else {
    console.log("   (no non-ACTIVE materials in DB to test against — skipping)");
  }

  console.log(
    `\n✅ Phase 3 chunk 2 e2e: production order ${created.orderNumber} created, BOM exploded ${order.components.length} components in Decimal, ${order.operations.length} operations snapshotted.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
