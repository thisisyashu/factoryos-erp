import { prisma } from "@/lib/db";
import { Prisma, type InventoryMovementType, MasterDataStatus } from "@prisma/client";

export type InventoryMovement = {
  movementType: InventoryMovementType;
  materialId: string;
  storageLocationId: string;
  quantity: Prisma.Decimal; // signed: + for inflow, − for outflow
  unitOfMeasureId: string;
  referenceType: string;
  referenceId: string;
  postedById: string;
  notes?: string | null;
};

/**
 * Posts a single inventory movement: writes one immutable ledger row and
 * upserts the running balance for (material, storageLocation). Must run
 * inside an existing transaction so ledger + balance commit atomically.
 *
 * Concurrency note: the upsert is atomic on its own row, but two concurrent
 * GR-posting transactions can still race because each computes "remaining
 * quantity" from the PO line outside any lock. Acceptable for Phase 2 dev
 * use; production needs SELECT FOR UPDATE or a CHECK constraint.
 */
export async function postInventoryMovement(
  tx: Prisma.TransactionClient,
  m: InventoryMovement,
) {
  const ledger = await tx.inventoryLedger.create({
    data: {
      movementType: m.movementType,
      materialId: m.materialId,
      storageLocationId: m.storageLocationId,
      quantity: m.quantity,
      unitOfMeasureId: m.unitOfMeasureId,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      postedById: m.postedById,
      notes: m.notes ?? null,
    },
  });

  await tx.inventoryBalance.upsert({
    where: {
      materialId_storageLocationId: {
        materialId: m.materialId,
        storageLocationId: m.storageLocationId,
      },
    },
    create: {
      materialId: m.materialId,
      storageLocationId: m.storageLocationId,
      quantityOnHand: m.quantity,
      unitOfMeasureId: m.unitOfMeasureId,
      lastMovementAt: ledger.postedAt,
    },
    update: {
      quantityOnHand: { increment: m.quantity },
      lastMovementAt: ledger.postedAt,
    },
  });

  return ledger;
}

/**
 * Read all ledger entries created by a specific source document.
 * Used by the GR detail page to surface "what stock movements did this create?"
 */
export async function getLedgerForReference(referenceType: string, referenceId: string) {
  return prisma.inventoryLedger.findMany({
    where: { referenceType, referenceId },
    include: {
      material: { select: { materialNumber: true, name: true } },
      storageLocation: {
        include: { warehouse: { select: { code: true, name: true } } },
      },
      unitOfMeasure: { select: { code: true } },
    },
    orderBy: { postedAt: "asc" },
  });
}

// =====================================================================
// Dashboard reads (Chunk 6)
// =====================================================================

const balanceInclude = {
  material: {
    select: { id: true, materialNumber: true, name: true, type: true, status: true },
  },
  storageLocation: {
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  },
  unitOfMeasure: { select: { code: true } },
} satisfies Prisma.InventoryBalanceInclude;

export type InventoryBalanceRow = Prisma.InventoryBalanceGetPayload<{
  include: typeof balanceInclude;
}>;

export async function listInventoryBalances(
  opts: {
    materialId?: string;
    warehouseId?: string;
    storageLocationId?: string;
  } = {},
): Promise<InventoryBalanceRow[]> {
  return prisma.inventoryBalance.findMany({
    where: {
      ...(opts.materialId ? { materialId: opts.materialId } : {}),
      ...(opts.storageLocationId ? { storageLocationId: opts.storageLocationId } : {}),
      ...(opts.warehouseId
        ? { storageLocation: { warehouseId: opts.warehouseId } }
        : {}),
    },
    include: balanceInclude,
    orderBy: [
      { material: { materialNumber: "asc" } },
      { storageLocation: { warehouse: { code: "asc" } } },
      { storageLocation: { code: "asc" } },
    ],
  });
}

const ledgerInclude = {
  material: { select: { id: true, materialNumber: true, name: true } },
  storageLocation: {
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  },
  unitOfMeasure: { select: { code: true } },
  postedBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.InventoryLedgerInclude;

export type InventoryLedgerRow = Prisma.InventoryLedgerGetPayload<{
  include: typeof ledgerInclude;
}>;

export type LedgerListResult = {
  entries: InventoryLedgerRow[];
  nextCursor: string | null;
};

export async function listInventoryLedger(
  opts: {
    materialId?: string;
    warehouseId?: string;
    storageLocationId?: string;
    movementType?: InventoryMovementType;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<LedgerListResult> {
  const limit = opts.limit ?? 50;
  const entries = await prisma.inventoryLedger.findMany({
    where: {
      ...(opts.materialId ? { materialId: opts.materialId } : {}),
      ...(opts.storageLocationId
        ? { storageLocationId: opts.storageLocationId }
        : {}),
      ...(opts.warehouseId
        ? { storageLocation: { warehouseId: opts.warehouseId } }
        : {}),
      ...(opts.movementType ? { movementType: opts.movementType } : {}),
      ...(opts.dateFrom || opts.dateTo
        ? {
            postedAt: {
              ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
              ...(opts.dateTo ? { lte: opts.dateTo } : {}),
            },
          }
        : {}),
    },
    include: ledgerInclude,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = entries.length > limit;
  const slice = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;
  return { entries: slice, nextCursor };
}

/** Lightweight options for ledger / stock filter dropdowns. */
export async function getInventoryFilterOptions() {
  const [materials, warehouses] = await Promise.all([
    prisma.material.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: { id: true, materialNumber: true, name: true },
      orderBy: { materialNumber: "asc" },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return { materials, warehouses };
}

export async function listWarehousesWithStats() {
  return prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { storageLocations: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function getWarehouseWithStock(warehouseId: string) {
  const wh = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    include: {
      storageLocations: {
        where: { isActive: true },
        include: {
          inventoryBalances: {
            include: {
              material: {
                select: { id: true, materialNumber: true, name: true, type: true },
              },
              unitOfMeasure: { select: { code: true } },
            },
          },
        },
        orderBy: { code: "asc" },
      },
    },
  });
  return wh;
}
