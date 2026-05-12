-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('GOODS_RECEIPT', 'MATERIAL_ISSUE', 'STOCK_TRANSFER', 'ADJUSTMENT', 'SHIPMENT');

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "warehouseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "department" TEXT,
    "reason" TEXT,
    "neededBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionLine" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "estimatedCost" DECIMAL(14,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "sourcePrId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "lineTotal" DECIMAL(16,4) NOT NULL,
    "quantityReceived" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "grNumber" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "poId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "grId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "poLineId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "id" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "materialId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "unitOfMeasureId" TEXT NOT NULL,
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_warehouseId_code_key" ON "StorageLocation"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_prNumber_key" ON "PurchaseRequisition"("prNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_status_idx" ON "PurchaseRequisition"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_requestedById_idx" ON "PurchaseRequisition"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisitionLine_prId_lineNumber_key" ON "PurchaseRequisitionLine"("prId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_sourcePrId_key" ON "PurchaseOrder"("sourcePrId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderLine_poId_lineNumber_key" ON "PurchaseOrderLine"("poId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_grNumber_key" ON "GoodsReceipt"("grNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_status_idx" ON "GoodsReceipt"("status");

-- CreateIndex
CREATE INDEX "GoodsReceipt_poId_idx" ON "GoodsReceipt"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_grId_lineNumber_key" ON "GoodsReceiptLine"("grId", "lineNumber");

-- CreateIndex
CREATE INDEX "InventoryLedger_materialId_idx" ON "InventoryLedger"("materialId");

-- CreateIndex
CREATE INDEX "InventoryLedger_storageLocationId_idx" ON "InventoryLedger"("storageLocationId");

-- CreateIndex
CREATE INDEX "InventoryLedger_materialId_storageLocationId_idx" ON "InventoryLedger"("materialId", "storageLocationId");

-- CreateIndex
CREATE INDEX "InventoryLedger_referenceType_referenceId_idx" ON "InventoryLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryLedger_postedAt_idx" ON "InventoryLedger"("postedAt");

-- CreateIndex
CREATE INDEX "InventoryBalance_materialId_idx" ON "InventoryBalance"("materialId");

-- CreateIndex
CREATE INDEX "InventoryBalance_storageLocationId_idx" ON "InventoryBalance"("storageLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_materialId_storageLocationId_key" ON "InventoryBalance"("materialId", "storageLocationId");

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sourcePrId_fkey" FOREIGN KEY ("sourcePrId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_grId_fkey" FOREIGN KEY ("grId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
