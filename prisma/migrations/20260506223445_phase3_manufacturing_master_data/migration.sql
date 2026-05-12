-- CreateEnum
CREATE TYPE "BillOfMaterialsStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoutingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionOperationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CONFIRMED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkCenterType" AS ENUM ('MACHINE', 'MANUAL', 'ASSEMBLY', 'INSPECTION', 'PACKAGING');

-- CreateTable
CREATE TABLE "WorkCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkCenterType" NOT NULL,
    "capacityHoursPerDay" DECIMAL(8,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillOfMaterials" (
    "id" TEXT NOT NULL,
    "bomNumber" TEXT NOT NULL,
    "parentMaterialId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BillOfMaterialsStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "baseQuantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillOfMaterials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillOfMaterialLine" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "componentMaterialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "scrapPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "BillOfMaterialLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL,
    "routingNumber" TEXT NOT NULL,
    "parentMaterialId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RoutingStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingOperation" (
    "id" TEXT NOT NULL,
    "routingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "setupTimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "runTimeHoursPerUnit" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "RoutingOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "parentMaterialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "routingId" TEXT,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "completedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "scrappedQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderComponent" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(16,4) NOT NULL,
    "issuedQuantity" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "scrappedQuantity" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "reservedQuantity" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ProductionOrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderOperation" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "plannedSetupHours" DECIMAL(8,2) NOT NULL,
    "plannedRunHours" DECIMAL(10,4) NOT NULL,
    "actualSetupHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "actualRunHours" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "status" "ProductionOperationStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ProductionOrderOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkCenter_code_key" ON "WorkCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_bomNumber_key" ON "BillOfMaterials"("bomNumber");

-- CreateIndex
CREATE INDEX "BillOfMaterials_parentMaterialId_status_idx" ON "BillOfMaterials"("parentMaterialId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterials_parentMaterialId_version_key" ON "BillOfMaterials"("parentMaterialId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BillOfMaterialLine_bomId_lineNumber_key" ON "BillOfMaterialLine"("bomId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Routing_routingNumber_key" ON "Routing"("routingNumber");

-- CreateIndex
CREATE INDEX "Routing_parentMaterialId_status_idx" ON "Routing"("parentMaterialId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Routing_parentMaterialId_version_key" ON "Routing"("parentMaterialId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingOperation_routingId_sequence_key" ON "RoutingOperation"("routingId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_orderNumber_key" ON "ProductionOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionOrder_parentMaterialId_idx" ON "ProductionOrder"("parentMaterialId");

-- CreateIndex
CREATE INDEX "ProductionOrderComponent_materialId_idx" ON "ProductionOrderComponent"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderComponent_productionOrderId_lineNumber_key" ON "ProductionOrderComponent"("productionOrderId", "lineNumber");

-- CreateIndex
CREATE INDEX "ProductionOrderOperation_workCenterId_status_idx" ON "ProductionOrderOperation"("workCenterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderOperation_productionOrderId_sequence_key" ON "ProductionOrderOperation"("productionOrderId", "sequence");

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_parentMaterialId_fkey" FOREIGN KEY ("parentMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterials" ADD CONSTRAINT "BillOfMaterials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_componentMaterialId_fkey" FOREIGN KEY ("componentMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillOfMaterialLine" ADD CONSTRAINT "BillOfMaterialLine_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routing" ADD CONSTRAINT "Routing_parentMaterialId_fkey" FOREIGN KEY ("parentMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routing" ADD CONSTRAINT "Routing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingOperation" ADD CONSTRAINT "RoutingOperation_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_parentMaterialId_fkey" FOREIGN KEY ("parentMaterialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderComponent" ADD CONSTRAINT "ProductionOrderComponent_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderComponent" ADD CONSTRAINT "ProductionOrderComponent_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderComponent" ADD CONSTRAINT "ProductionOrderComponent_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderOperation" ADD CONSTRAINT "ProductionOrderOperation_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderOperation" ADD CONSTRAINT "ProductionOrderOperation_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
