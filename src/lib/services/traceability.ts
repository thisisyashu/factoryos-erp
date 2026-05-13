import { prisma } from "@/lib/db";

/**
 * Phase 3 Chunk 6 — traceability reads.
 *
 * The trace graph is:
 *
 *   Supplier ─→ PurchaseOrder ─→ GoodsReceipt ─→ MaterialLot
 *                                                    │
 *                                                    │ MaterialLotConsumption
 *                                                    ▼
 *                                          ProductionOrderComponent
 *                                                    │
 *                                                    ▼
 *                                          ProductionOrder ─→ FinishedGoodLot
 *
 * Backward trace (FG → Supplier): start at a FinishedGoodLot, walk to the
 * production order, then to its components, then to MaterialLotConsumptions,
 * then to MaterialLots and on to the source GR + supplier.
 *
 * Forward trace (Material lot → FG): start at a MaterialLot, walk to its
 * consumptions, the production orders they fed, and the FG lots produced.
 */

/** All FG lots, newest first — for the picker. */
export async function listFinishedGoodLots(opts: { limit?: number } = {}) {
  return prisma.finishedGoodLot.findMany({
    include: {
      material: { select: { id: true, materialNumber: true, name: true, type: true } },
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          quantity: true,
        },
      },
      unitOfMeasure: { select: { code: true } },
      storageLocation: {
        include: { warehouse: { select: { code: true, name: true } } },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: opts.limit ?? 50,
  });
}

/** All material lots, newest first — for the picker on the forward trace. */
export async function listMaterialLots(opts: { limit?: number } = {}) {
  return prisma.materialLot.findMany({
    include: {
      material: { select: { id: true, materialNumber: true, name: true, type: true } },
      supplier: { select: { id: true, supplierNumber: true, legalName: true } },
      unitOfMeasure: { select: { code: true } },
      storageLocation: {
        include: { warehouse: { select: { code: true, name: true } } },
      },
      _count: { select: { consumptions: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: opts.limit ?? 100,
  });
}

/**
 * Backward trace from one FG lot — what supplier lots fed this batch?
 * Returns the FG lot + its production order + per-component consumed lots
 * (with supplier + GR ref) and a deduped supplier list.
 */
export async function traceBackwardFromFgLot(fgLotId: string) {
  const fg = await prisma.finishedGoodLot.findUnique({
    where: { id: fgLotId },
    include: {
      material: { select: { id: true, materialNumber: true, name: true, type: true } },
      unitOfMeasure: { select: { code: true } },
      storageLocation: {
        include: { warehouse: { select: { code: true, name: true } } },
      },
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          quantity: true,
          completedQuantity: true,
          scrappedQuantity: true,
          completedAt: true,
          createdById: true,
          createdBy: { select: { name: true } },
          components: {
            include: {
              material: {
                select: { id: true, materialNumber: true, name: true, type: true },
              },
              unitOfMeasure: { select: { code: true } },
              lotConsumptions: {
                include: {
                  materialLot: {
                    include: {
                      supplier: {
                        select: { id: true, supplierNumber: true, legalName: true },
                      },
                      unitOfMeasure: { select: { code: true } },
                    },
                  },
                },
                orderBy: { postedAt: "asc" },
              },
            },
            orderBy: { lineNumber: "asc" },
          },
        },
      },
    },
  });
  if (!fg) return null;

  // Resolve each MaterialLot's source GR (if any) — polymorphic so we look it up.
  const grIds = new Set<string>();
  for (const c of fg.productionOrder.components) {
    for (const cons of c.lotConsumptions) {
      if (cons.materialLot.sourceType === "GoodsReceipt") {
        grIds.add(cons.materialLot.sourceRefId);
      }
    }
  }
  const grs = await prisma.goodsReceipt.findMany({
    where: { id: { in: [...grIds] } },
    select: {
      id: true,
      grNumber: true,
      receivedAt: true,
      po: {
        select: {
          id: true,
          poNumber: true,
          supplier: {
            select: { id: true, supplierNumber: true, legalName: true },
          },
        },
      },
    },
  });
  const grById = new Map(grs.map((g) => [g.id, g]));

  // Deduped supplier list across the whole bill of consumption.
  const supplierMap = new Map<
    string,
    { id: string; supplierNumber: string; legalName: string }
  >();
  for (const c of fg.productionOrder.components) {
    for (const cons of c.lotConsumptions) {
      const s = cons.materialLot.supplier;
      if (s) supplierMap.set(s.id, s);
    }
  }

  return { fg, grById, suppliers: [...supplierMap.values()] };
}

/**
 * Forward trace from one material lot — where did this lot get used?
 * Returns the lot + each consumption, the production order it fed,
 * and any FG lots that came out of that order.
 */
export async function traceForwardFromMaterialLot(materialLotId: string) {
  const lot = await prisma.materialLot.findUnique({
    where: { id: materialLotId },
    include: {
      material: { select: { id: true, materialNumber: true, name: true, type: true } },
      supplier: { select: { id: true, supplierNumber: true, legalName: true } },
      unitOfMeasure: { select: { code: true } },
      storageLocation: {
        include: { warehouse: { select: { code: true, name: true } } },
      },
      consumptions: {
        include: {
          productionOrderComponent: {
            include: {
              productionOrder: {
                include: {
                  parentMaterial: {
                    select: { materialNumber: true, name: true },
                  },
                  finishedGoodLots: {
                    include: {
                      storageLocation: {
                        include: { warehouse: { select: { code: true } } },
                      },
                    },
                    orderBy: { receivedAt: "asc" },
                  },
                },
              },
              material: { select: { materialNumber: true, name: true } },
              unitOfMeasure: { select: { code: true } },
            },
          },
          postedBy: { select: { name: true, role: true } },
        },
        orderBy: { postedAt: "asc" },
      },
    },
  });
  if (!lot) return null;

  // Resolve source GR (if any) for the lot itself
  let sourceGr: {
    id: string;
    grNumber: string;
    receivedAt: Date | null;
    po: { id: string; poNumber: string };
  } | null = null;
  if (lot.sourceType === "GoodsReceipt") {
    sourceGr = await prisma.goodsReceipt.findUnique({
      where: { id: lot.sourceRefId },
      select: {
        id: true,
        grNumber: true,
        receivedAt: true,
        po: { select: { id: true, poNumber: true } },
      },
    });
  }

  return { lot, sourceGr };
}
