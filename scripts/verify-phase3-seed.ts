// Quick verify of Phase 3 seed data.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const wcs = await prisma.workCenter.findMany({ orderBy: { code: "asc" } });
  console.log(
    "Work centers:",
    wcs.map((w) => `${w.code} (${w.type}, ${w.capacityHoursPerDay}h/d)`).join(", "),
  );

  const bom = await prisma.billOfMaterials.findFirstOrThrow({
    include: {
      parentMaterial: { select: { materialNumber: true, name: true } },
      lines: {
        include: {
          componentMaterial: { select: { materialNumber: true, name: true, status: true } },
          unitOfMeasure: { select: { code: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  console.log(
    `\nBOM ${bom.bomNumber} v${bom.version} for ${bom.parentMaterial.materialNumber} ${bom.parentMaterial.name} (${bom.status}):`,
  );
  for (const l of bom.lines) {
    console.log(
      `  L${l.lineNumber}: ${l.quantity.toString()} ${l.unitOfMeasure.code} of ${l.componentMaterial.materialNumber} ${l.componentMaterial.name} [${l.componentMaterial.status}] (scrap ${l.scrapPercent.toString()}%)`,
    );
  }

  const rtg = await prisma.routing.findFirstOrThrow({
    include: {
      operations: {
        include: { workCenter: { select: { code: true } } },
        orderBy: { sequence: "asc" },
      },
    },
  });
  console.log(`\nRouting ${rtg.routingNumber} (${rtg.status}):`);
  for (const op of rtg.operations) {
    console.log(
      `  Seq ${op.sequence}: ${op.description} @ ${op.workCenter.code} (setup ${op.setupTimeHours.toString()}h, run ${op.runTimeHoursPerUnit.toString()}h/unit)`,
    );
  }

  const fg = await prisma.material.findUniqueOrThrow({
    where: { materialNumber: "MAT-100100" },
  });
  console.log(
    `\nFinished good ${fg.materialNumber}: type=${fg.type}, status=${fg.status}, standardCost=$${fg.standardCost?.toString() ?? "—"}`,
  );

  // Quick BOM-explosion preview: how many units of each component to make 100 CM-100s?
  console.log("\nBOM-explosion preview for 100 units of CM-100:");
  for (const l of bom.lines) {
    const qPerUnit = Number(l.quantity.toString());
    const scrap = Number(l.scrapPercent.toString());
    const planned = qPerUnit * 100 * (1 + scrap / 100);
    console.log(
      `  ${l.componentMaterial.materialNumber}: ${planned} ${l.unitOfMeasure.code}  (= ${qPerUnit} × 100 × ${1 + scrap / 100})`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
