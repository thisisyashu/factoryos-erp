-- CreateTable
CREATE TABLE "MaterialLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(16,4) NOT NULL,
    "quantityRemaining" DECIMAL(16,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT NOT NULL,
    "supplierId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLotConsumption" (
    "id" TEXT NOT NULL,
    "productionOrderComponentId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
    "quantity" DECIMAL(16,4) NOT NULL,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MaterialLotConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedGoodLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "quantity" DECIMAL(16,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinishedGoodLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLot_lotNumber_key" ON "MaterialLot"("lotNumber");

-- CreateIndex
CREATE INDEX "MaterialLot_materialId_quantityRemaining_idx" ON "MaterialLot"("materialId", "quantityRemaining");

-- CreateIndex
CREATE INDEX "MaterialLot_sourceType_sourceRefId_idx" ON "MaterialLot"("sourceType", "sourceRefId");

-- CreateIndex
CREATE INDEX "MaterialLot_materialId_storageLocationId_quantityRemaining_idx" ON "MaterialLot"("materialId", "storageLocationId", "quantityRemaining");

-- CreateIndex
CREATE INDEX "MaterialLotConsumption_productionOrderComponentId_idx" ON "MaterialLotConsumption"("productionOrderComponentId");

-- CreateIndex
CREATE INDEX "MaterialLotConsumption_materialLotId_idx" ON "MaterialLotConsumption"("materialLotId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedGoodLot_lotNumber_key" ON "FinishedGoodLot"("lotNumber");

-- CreateIndex
CREATE INDEX "FinishedGoodLot_productionOrderId_idx" ON "FinishedGoodLot"("productionOrderId");

-- CreateIndex
CREATE INDEX "FinishedGoodLot_materialId_idx" ON "FinishedGoodLot"("materialId");

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLot" ADD CONSTRAINT "MaterialLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLotConsumption" ADD CONSTRAINT "MaterialLotConsumption_productionOrderComponentId_fkey" FOREIGN KEY ("productionOrderComponentId") REFERENCES "ProductionOrderComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLotConsumption" ADD CONSTRAINT "MaterialLotConsumption_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLotConsumption" ADD CONSTRAINT "MaterialLotConsumption_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodLot" ADD CONSTRAINT "FinishedGoodLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodLot" ADD CONSTRAINT "FinishedGoodLot_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodLot" ADD CONSTRAINT "FinishedGoodLot_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodLot" ADD CONSTRAINT "FinishedGoodLot_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
