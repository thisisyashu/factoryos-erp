import "dotenv/config";
import { PrismaClient, UserRole, MaterialType, MasterDataStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding FactoryOS ERP database...\n");

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "requester@factoryos.com" },
      update: {},
      create: {
        email: "requester@factoryos.com",
        name: "Riya Requester",
        passwordHash,
        role: UserRole.REQUESTER,
        department: "Engineering",
      },
    }),
    prisma.user.upsert({
      where: { email: "steward@factoryos.com" },
      update: {},
      create: {
        email: "steward@factoryos.com",
        name: "Sam Steward",
        passwordHash,
        role: UserRole.STEWARD,
        department: "Master Data Office",
      },
    }),
    prisma.user.upsert({
      where: { email: "approver@factoryos.com" },
      update: {},
      create: {
        email: "approver@factoryos.com",
        name: "Aisha Approver",
        passwordHash,
        role: UserRole.APPROVER,
        department: "Operations",
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@factoryos.com" },
      update: {},
      create: {
        email: "admin@factoryos.com",
        name: "Alex Admin",
        passwordHash,
        role: UserRole.ADMIN,
        department: "IT",
      },
    }),
  ]);
  const [requester, steward, approver, admin] = users;
  void steward;
  void admin;
  console.log(`✓ Created ${users.length} users\n`);

  console.log("Creating units of measure...");
  const uoms = await Promise.all([
    prisma.unitOfMeasure.upsert({ where: { code: "EA" }, update: {}, create: { code: "EA", description: "Each", category: "Quantity" } }),
    prisma.unitOfMeasure.upsert({ where: { code: "KG" }, update: {}, create: { code: "KG", description: "Kilogram", category: "Weight" } }),
    prisma.unitOfMeasure.upsert({ where: { code: "G" }, update: {}, create: { code: "G", description: "Gram", category: "Weight" } }),
    prisma.unitOfMeasure.upsert({ where: { code: "M" }, update: {}, create: { code: "M", description: "Meter", category: "Length" } }),
    prisma.unitOfMeasure.upsert({ where: { code: "L" }, update: {}, create: { code: "L", description: "Liter", category: "Volume" } }),
  ]);
  const [ea, kg, , m] = uoms;
  console.log(`✓ Created ${uoms.length} units of measure\n`);

  console.log("Creating materials...");
  await prisma.material.upsert({
    where: { materialNumber: "MAT-000001" },
    update: {},
    create: {
      materialNumber: "MAT-000001", name: "Silicon Wafer 200mm",
      description: "Prime grade, P-type, 200mm diameter silicon wafer",
      type: MaterialType.RAW_MATERIAL, status: MasterDataStatus.ACTIVE,
      unitOfMeasureId: ea.id, weightKg: 0.05, standardCost: 45.0, leadTimeDays: 21,
      dataQualityScore: 95, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-01-15"), activatedAt: new Date("2026-01-15"),
    },
  });
  await prisma.material.upsert({
    where: { materialNumber: "MAT-000002" },
    update: {},
    create: {
      materialNumber: "MAT-000002", name: "Surface Mount Resistor 10k Ohm",
      description: "0805 package, 1% tolerance",
      type: MaterialType.COMPONENT, status: MasterDataStatus.ACTIVE,
      unitOfMeasureId: ea.id, weightKg: 0.0001, standardCost: 0.012, leadTimeDays: 14,
      dataQualityScore: 90, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-02-01"), activatedAt: new Date("2026-02-01"),
    },
  });
  await prisma.material.upsert({
    where: { materialNumber: "MAT-000003" },
    update: {},
    create: {
      materialNumber: "MAT-000003", name: "Solder Paste SAC305",
      description: "Lead-free solder paste, 500g jar",
      type: MaterialType.CONSUMABLE, status: MasterDataStatus.ACTIVE,
      unitOfMeasureId: kg.id, weightKg: 0.5, hazardClass: "Class 9", shelfLifeDays: 180,
      standardCost: 85.0, leadTimeDays: 7,
      dataQualityScore: 100, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-02-10"), activatedAt: new Date("2026-02-10"),
    },
  });
  await prisma.material.upsert({
    where: { materialNumber: "MAT-000004" },
    update: {},
    create: {
      materialNumber: "MAT-000004", name: "PCB Substrate FR4",
      type: MaterialType.RAW_MATERIAL, status: MasterDataStatus.DRAFT,
      unitOfMeasureId: m.id, dataQualityScore: 40, createdById: requester.id,
    },
  });
  const pendingMaterial = await prisma.material.upsert({
    where: { materialNumber: "MAT-000005" },
    update: {},
    create: {
      materialNumber: "MAT-000005", name: "Capacitor 100uF Electrolytic",
      description: "Radial lead, 25V rated",
      type: MaterialType.COMPONENT, status: MasterDataStatus.SUBMITTED,
      unitOfMeasureId: ea.id, weightKg: 0.002, standardCost: 0.18, leadTimeDays: 28,
      dataQualityScore: 85, createdById: requester.id,
    },
  });
  console.log("✓ Created 5 materials (3 active, 1 draft, 1 submitted)\n");

  console.log("Creating suppliers...");
  await prisma.supplier.upsert({
    where: { supplierNumber: "SUP-000001" },
    update: {},
    create: {
      supplierNumber: "SUP-000001", legalName: "Pacific Semiconductor Materials Inc.",
      tradeName: "PacSemi", taxId: "US-94-1234567", status: MasterDataStatus.ACTIVE,
      contactEmail: "sales@pacsemi.example.com", contactPhone: "+1-408-555-0101",
      addressLine1: "1500 Technology Drive", city: "San Jose", stateRegion: "CA",
      postalCode: "95110", country: "USA",
      paymentTermsDays: 30, currency: "USD", preferredFlag: true,
      dataQualityScore: 98, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-01-10"), activatedAt: new Date("2026-01-10"),
    },
  });
  await prisma.supplier.upsert({
    where: { supplierNumber: "SUP-000002" },
    update: {},
    create: {
      supplierNumber: "SUP-000002", legalName: "Tokyo Electronic Components Ltd.",
      tradeName: "TEC Japan", taxId: "JP-7-1234-5678901", status: MasterDataStatus.ACTIVE,
      contactEmail: "export@tec.example.jp", contactPhone: "+81-3-5555-0202",
      addressLine1: "2-3-4 Akihabara", city: "Tokyo", postalCode: "101-0021", country: "Japan",
      paymentTermsDays: 45, currency: "JPY",
      dataQualityScore: 92, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-01-20"), activatedAt: new Date("2026-01-20"),
    },
  });
  await prisma.supplier.upsert({
    where: { supplierNumber: "SUP-000003" },
    update: {},
    create: {
      supplierNumber: "SUP-000003", legalName: "Bavarian Precision Parts GmbH",
      tradeName: "BPP", taxId: "DE-123456789", status: MasterDataStatus.SUBMITTED,
      contactEmail: "verkauf@bpp.example.de", addressLine1: "Industriestrasse 42",
      city: "Munich", country: "Germany",
      paymentTermsDays: 30, currency: "EUR",
      dataQualityScore: 78, createdById: requester.id,
    },
  });
  console.log("✓ Created 3 suppliers (2 active, 1 submitted)\n");

  console.log("Creating customers...");
  await prisma.customer.upsert({
    where: { customerNumber: "CUS-000001" },
    update: {},
    create: {
      customerNumber: "CUS-000001", legalName: "NorthStar Robotics Corp.",
      taxId: "US-77-9876543", status: MasterDataStatus.ACTIVE,
      contactEmail: "purchasing@northstar.example.com",
      addressLine1: "2200 Innovation Way", city: "Boston", country: "USA",
      creditLimit: 500000.0, paymentTermsDays: 45, currency: "USD",
      dataQualityScore: 95, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-01-12"), activatedAt: new Date("2026-01-12"),
    },
  });
  await prisma.customer.upsert({
    where: { customerNumber: "CUS-000002" },
    update: {},
    create: {
      customerNumber: "CUS-000002", legalName: "Helios Aerospace Systems",
      tradeName: "Helios", taxId: "US-55-1112223", status: MasterDataStatus.ACTIVE,
      contactEmail: "supply@helios.example.com",
      addressLine1: "8800 Skyline Boulevard", city: "Seattle", country: "USA",
      creditLimit: 1200000.0, paymentTermsDays: 60, currency: "USD",
      dataQualityScore: 90, createdById: requester.id, approvedById: approver.id,
      approvedAt: new Date("2026-02-05"), activatedAt: new Date("2026-02-05"),
    },
  });
  console.log("✓ Created 2 customers\n");

  console.log("Creating warehouses + storage locations...");
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: {
      code: "WH-MAIN", name: "Main Warehouse — San Jose",
      description: "Primary receiving + raw materials storage",
      addressLine1: "1500 Technology Drive", city: "San Jose", country: "USA",
    },
  });
  const locations = await Promise.all([
    prisma.storageLocation.upsert({
      where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: "A1-01" } },
      update: {},
      create: { warehouseId: mainWarehouse.id, code: "A1-01", description: "Aisle A, Bin 1 — Wafers" },
    }),
    prisma.storageLocation.upsert({
      where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: "A1-02" } },
      update: {},
      create: { warehouseId: mainWarehouse.id, code: "A1-02", description: "Aisle A, Bin 2 — SMT components" },
    }),
    prisma.storageLocation.upsert({
      where: { warehouseId_code: { warehouseId: mainWarehouse.id, code: "B1-01" } },
      update: {},
      create: { warehouseId: mainWarehouse.id, code: "B1-01", description: "Aisle B, Bin 1 — Consumables" },
    }),
  ]);
  console.log(`✓ Created 1 warehouse + ${locations.length} storage locations\n`);

  // ---------------------------------------------------------------------
  // Phase 3: manufacturing master data
  // ---------------------------------------------------------------------

  console.log("Activating MAT-000004 (PCB) + MAT-000005 (Capacitor) for use in BOM...");
  const pcbSubstrate = await prisma.material.update({
    where: { materialNumber: "MAT-000004" },
    data: {
      status: MasterDataStatus.ACTIVE,
      approvedById: approver.id,
      approvedAt: new Date("2026-03-01"),
      activatedAt: new Date("2026-03-01"),
      dataQualityScore: 80,
      standardCost: 12.5,
      leadTimeDays: 14,
    },
  });
  await prisma.material.update({
    where: { materialNumber: "MAT-000005" },
    data: {
      status: MasterDataStatus.ACTIVE,
      approvedById: approver.id,
      approvedAt: new Date("2026-03-01"),
      activatedAt: new Date("2026-03-01"),
    },
  });
  console.log("✓ MAT-000004 + MAT-000005 now ACTIVE\n");

  console.log("Creating finished good + semi-finished materials...");
  const computeModule = await prisma.material.upsert({
    where: { materialNumber: "MAT-100100" },
    update: {},
    create: {
      materialNumber: "MAT-100100",
      name: "Compute Module CM-100",
      description: "Edge compute module — wafer, MCU, regulator, capacitors",
      type: MaterialType.FINISHED_GOOD,
      status: MasterDataStatus.ACTIVE,
      unitOfMeasureId: ea.id,
      weightKg: 0.18,
      standardCost: 95.0,
      leadTimeDays: 5,
      dataQualityScore: 95,
      createdById: requester.id,
      approvedById: approver.id,
      approvedAt: new Date("2026-03-15"),
      activatedAt: new Date("2026-03-15"),
    },
  });
  await prisma.material.upsert({
    where: { materialNumber: "MAT-100200" },
    update: {},
    create: {
      materialNumber: "MAT-100200",
      name: "Power Supply Board PSB-A1",
      description: "5V/3.3V regulated supply sub-assembly",
      type: MaterialType.SEMI_FINISHED,
      status: MasterDataStatus.ACTIVE,
      unitOfMeasureId: ea.id,
      weightKg: 0.04,
      standardCost: 18.0,
      leadTimeDays: 3,
      dataQualityScore: 92,
      createdById: requester.id,
      approvedById: approver.id,
      approvedAt: new Date("2026-03-15"),
      activatedAt: new Date("2026-03-15"),
    },
  });
  console.log("✓ Created 2 manufactured materials (MAT-100100 FG, MAT-100200 SEMI)\n");

  console.log("Creating work centers...");
  const wcSmt = await prisma.workCenter.upsert({
    where: { code: "WC-SMT-01" },
    update: {},
    create: {
      code: "WC-SMT-01",
      name: "SMT Placement Line 1",
      description: "Pick-and-place + reflow oven",
      type: "MACHINE",
      capacityHoursPerDay: 16,
    },
  });
  const wcAssy = await prisma.workCenter.upsert({
    where: { code: "WC-ASSY-01" },
    update: {},
    create: {
      code: "WC-ASSY-01",
      name: "Final Assembly Cell A",
      description: "Manual assembly bench",
      type: "ASSEMBLY",
      capacityHoursPerDay: 8,
    },
  });
  const wcTest = await prisma.workCenter.upsert({
    where: { code: "WC-TEST-01" },
    update: {},
    create: {
      code: "WC-TEST-01",
      name: "Functional Test Bay",
      description: "Automated functional + parametric test",
      type: "INSPECTION",
      capacityHoursPerDay: 16,
    },
  });
  console.log("✓ Created 3 work centers\n");

  // Look up the rest of the materials we'll use as BOM components.
  const wafer    = await prisma.material.findUniqueOrThrow({ where: { materialNumber: "MAT-000001" } });
  const resistor = await prisma.material.findUniqueOrThrow({ where: { materialNumber: "MAT-000002" } });
  const solder   = await prisma.material.findUniqueOrThrow({ where: { materialNumber: "MAT-000003" } });
  const capacitor = await prisma.material.findUniqueOrThrow({ where: { materialNumber: "MAT-000005" } });

  console.log("Creating BOM for Compute Module CM-100...");
  const bom = await prisma.billOfMaterials.upsert({
    where: { parentMaterialId_version: { parentMaterialId: computeModule.id, version: 1 } },
    update: {},
    create: {
      bomNumber: "BOM-CM-100-V1",
      parentMaterialId: computeModule.id,
      version: 1,
      status: "ACTIVE",
      description: "Single-level BOM for CM-100 compute module",
      baseQuantity: 1,
      createdById: requester.id,
      lines: {
        create: [
          { lineNumber: 10, componentMaterialId: pcbSubstrate.id, quantity: 1,      unitOfMeasureId: m.id,  scrapPercent: 0 },
          { lineNumber: 20, componentMaterialId: wafer.id,        quantity: 1,      unitOfMeasureId: ea.id, scrapPercent: 0 },
          { lineNumber: 30, componentMaterialId: resistor.id,     quantity: 4,      unitOfMeasureId: ea.id, scrapPercent: 1.5 },
          { lineNumber: 40, componentMaterialId: capacitor.id,    quantity: 2,      unitOfMeasureId: ea.id, scrapPercent: 1.5 },
          { lineNumber: 50, componentMaterialId: solder.id,       quantity: 0.0005, unitOfMeasureId: kg.id, scrapPercent: 5 },
        ],
      },
    },
  });
  console.log(`✓ Created ${bom.bomNumber} (5 lines)\n`);

  console.log("Creating Routing for Compute Module CM-100...");
  const routing = await prisma.routing.upsert({
    where: { parentMaterialId_version: { parentMaterialId: computeModule.id, version: 1 } },
    update: {},
    create: {
      routingNumber: "RTG-CM-100-V1",
      parentMaterialId: computeModule.id,
      version: 1,
      status: "ACTIVE",
      description: "3-step routing: SMT → assembly → test",
      createdById: requester.id,
      operations: {
        create: [
          { sequence: 10, description: "SMT placement + reflow", workCenterId: wcSmt.id,  setupTimeHours: 1.5,    runTimeHoursPerUnit: 0.05 },
          { sequence: 20, description: "Final assembly",         workCenterId: wcAssy.id, setupTimeHours: 0.5,    runTimeHoursPerUnit: 0.10 },
          { sequence: 30, description: "Functional test",        workCenterId: wcTest.id, setupTimeHours: 0.1667, runTimeHoursPerUnit: 0.02 },
        ],
      },
    },
  });
  console.log(`✓ Created ${routing.routingNumber} (3 operations)\n`);

  console.log("Creating sample MDG request + approval...");
  const sampleRequest = await prisma.mdgRequest.upsert({
    where: { requestNumber: "MDG-2026-000001" },
    update: {},
    create: {
      requestNumber: "MDG-2026-000001", entityType: "MATERIAL", requestType: "CREATE",
      status: "SUBMITTED",
      payload: { materialNumber: "MAT-000005", name: "Capacitor 100uF Electrolytic", type: "COMPONENT" },
      businessJustification: "Required for new power supply board design (Project Halo).",
      requestedById: requester.id, submittedAt: new Date(),
      completenessScore: 85, duplicateRiskScore: 5, materialId: pendingMaterial.id,
    },
  });
  await prisma.mdgApproval.create({
    data: { requestId: sampleRequest.id, approverId: approver.id, stepOrder: 1, decision: "PENDING" },
  });
  console.log("✓ Created 1 sample MDG request with pending approval\n");

  console.log("Creating sample audit log entries...");
  await prisma.auditLog.createMany({
    data: [
      { entityType: "Material", entityId: "MAT-000001", action: "CREATE", actorId: requester.id,
        afterState: { status: "DRAFT", name: "Silicon Wafer 200mm" } },
      { entityType: "Material", entityId: "MAT-000001", action: "STATUS_CHANGE", actorId: approver.id,
        beforeState: { status: "SUBMITTED" }, afterState: { status: "ACTIVE" },
        metadata: { reason: "Approved by operations" } },
      { entityType: "Supplier", entityId: "SUP-000001", action: "CREATE", actorId: requester.id,
        afterState: { status: "DRAFT", legalName: "Pacific Semiconductor Materials Inc." } },
    ],
  });
  console.log("✓ Created 3 sample audit log entries\n");

  console.log("✅ Seeding complete!\n");
  console.log("Login credentials (all use password 'password123'):");
  console.log("  • requester@factoryos.com");
  console.log("  • steward@factoryos.com");
  console.log("  • approver@factoryos.com");
  console.log("  • admin@factoryos.com");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
