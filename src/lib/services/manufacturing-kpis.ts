import { prisma } from "@/lib/db";
import {
  Prisma,
  ProductionOrderStatus,
  ProductionOperationStatus,
} from "@prisma/client";

// =====================================================================
// Order status breakdown
// =====================================================================

export type OrderStatusRow = {
  status: ProductionOrderStatus;
  count: number;
  pct: number;
};

export async function getOrderStatusBreakdown(): Promise<OrderStatusRow[]> {
  const groups = await prisma.productionOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const total = groups.reduce((s, g) => s + g._count._all, 0);
  return groups
    .map((g) => ({
      status: g.status,
      count: g._count._all,
      pct: total > 0 ? (g._count._all / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// =====================================================================
// Open WIP summary (DRAFT + RELEASED + IN_PROGRESS)
// =====================================================================

export type WipSummary = {
  openOrderCount: number;
  totalPlannedQty: string;
  totalCompletedQty: string;
  totalScrappedQty: string;
  totalRemainingQty: string;
};

export async function getOpenWipSummary(): Promise<WipSummary> {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: {
        in: [
          ProductionOrderStatus.DRAFT,
          ProductionOrderStatus.RELEASED,
          ProductionOrderStatus.IN_PROGRESS,
        ],
      },
    },
    select: {
      quantity: true,
      completedQuantity: true,
      scrappedQuantity: true,
    },
  });
  let plannedSum = new Prisma.Decimal(0);
  let completedSum = new Prisma.Decimal(0);
  let scrappedSum = new Prisma.Decimal(0);
  for (const o of orders) {
    plannedSum = plannedSum.add(o.quantity);
    completedSum = completedSum.add(o.completedQuantity);
    scrappedSum = scrappedSum.add(o.scrappedQuantity);
  }
  return {
    openOrderCount: orders.length,
    totalPlannedQty: plannedSum.toString(),
    totalCompletedQty: completedSum.toString(),
    totalScrappedQty: scrappedSum.toString(),
    totalRemainingQty: plannedSum.sub(completedSum).sub(scrappedSum).toString(),
  };
}

// =====================================================================
// Yield by material (over COMPLETED + CLOSED orders)
// =====================================================================

export type YieldRow = {
  materialId: string;
  materialNumber: string;
  materialName: string;
  uomCode: string;
  orderCount: number;
  totalCompleted: string;
  totalScrapped: string;
  totalProduced: string;
  yieldPct: string;
  scrapPct: string;
};

export async function getYieldByMaterial(): Promise<YieldRow[]> {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: {
        in: [
          ProductionOrderStatus.COMPLETED,
          ProductionOrderStatus.CLOSED,
        ],
      },
    },
    include: {
      parentMaterial: {
        select: { id: true, materialNumber: true, name: true },
      },
      unitOfMeasure: { select: { code: true } },
    },
  });

  const byMaterial = new Map<
    string,
    {
      materialNumber: string;
      materialName: string;
      uomCode: string;
      orderCount: number;
      completed: Prisma.Decimal;
      scrapped: Prisma.Decimal;
    }
  >();
  for (const o of orders) {
    const key = o.parentMaterialId;
    const existing = byMaterial.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.completed = existing.completed.add(o.completedQuantity);
      existing.scrapped = existing.scrapped.add(o.scrappedQuantity);
    } else {
      byMaterial.set(key, {
        materialNumber: o.parentMaterial.materialNumber,
        materialName: o.parentMaterial.name,
        uomCode: o.unitOfMeasure.code,
        orderCount: 1,
        completed: o.completedQuantity,
        scrapped: o.scrappedQuantity,
      });
    }
  }

  return Array.from(byMaterial.entries())
    .map(([id, v]) => {
      const produced = v.completed.add(v.scrapped);
      const yieldPct = produced.gt(0)
        ? v.completed.div(produced).mul(100).toFixed(2)
        : "0.00";
      const scrapPct = produced.gt(0)
        ? v.scrapped.div(produced).mul(100).toFixed(2)
        : "0.00";
      return {
        materialId: id,
        materialNumber: v.materialNumber,
        materialName: v.materialName,
        uomCode: v.uomCode,
        orderCount: v.orderCount,
        totalCompleted: v.completed.toString(),
        totalScrapped: v.scrapped.toString(),
        totalProduced: produced.toString(),
        yieldPct,
        scrapPct,
      };
    })
    .sort((a, b) => Number(b.totalCompleted) - Number(a.totalCompleted));
}

// =====================================================================
// Work-center utilization (planned vs actual hours over all production ops)
// =====================================================================

export type WorkCenterUtilizationRow = {
  workCenterId: string;
  code: string;
  name: string;
  type: string;
  capacityHoursPerDay: string | null;
  totalPlannedHours: string;
  totalActualHours: string;
  totalSetupHours: string;
  totalRunHours: string;
  operationCount: number;
  confirmedOperationCount: number;
  utilizationVsPlannedPct: string | null;
};

export async function getWorkCenterUtilization(): Promise<WorkCenterUtilizationRow[]> {
  const wcs = await prisma.workCenter.findMany({
    where: { isActive: true },
    include: { productionOrderOperations: true },
    orderBy: { code: "asc" },
  });
  return wcs.map((wc) => {
    const ops = wc.productionOrderOperations;
    const totalPlanned = ops.reduce(
      (s, op) => s.add(op.plannedSetupHours).add(op.plannedRunHours),
      new Prisma.Decimal(0),
    );
    const totalActualSetup = ops.reduce(
      (s, op) => s.add(op.actualSetupHours),
      new Prisma.Decimal(0),
    );
    const totalActualRun = ops.reduce(
      (s, op) => s.add(op.actualRunHours),
      new Prisma.Decimal(0),
    );
    const totalActual = totalActualSetup.add(totalActualRun);
    const confirmedCount = ops.filter(
      (op) => op.status === ProductionOperationStatus.CONFIRMED,
    ).length;
    const utilizationVsPlannedPct = totalPlanned.gt(0)
      ? totalActual.div(totalPlanned).mul(100).toFixed(1)
      : null;
    return {
      workCenterId: wc.id,
      code: wc.code,
      name: wc.name,
      type: wc.type,
      capacityHoursPerDay: wc.capacityHoursPerDay?.toString() ?? null,
      totalPlannedHours: totalPlanned.toString(),
      totalActualHours: totalActual.toString(),
      totalSetupHours: totalActualSetup.toString(),
      totalRunHours: totalActualRun.toString(),
      operationCount: ops.length,
      confirmedOperationCount: confirmedCount,
      utilizationVsPlannedPct,
    };
  });
}

// =====================================================================
// Top over-plan operations
// =====================================================================

export type OperationVarianceRow = {
  operationId: string;
  productionOrderId: string;
  productionOrderNumber: string;
  workCenterCode: string;
  sequence: number;
  description: string;
  plannedHours: string;
  actualHours: string;
  varianceHours: string;
  variancePct: string;
};

export async function getTopOperationVariances(
  limit = 10,
): Promise<OperationVarianceRow[]> {
  const ops = await prisma.productionOrderOperation.findMany({
    where: { status: ProductionOperationStatus.CONFIRMED },
    include: {
      productionOrder: { select: { id: true, orderNumber: true } },
      workCenter: { select: { code: true } },
    },
  });

  type WithSort = OperationVarianceRow & { _sort: number };

  const rows: WithSort[] = ops.map((op) => {
    const planned = op.plannedSetupHours.add(op.plannedRunHours);
    const actual = op.actualSetupHours.add(op.actualRunHours);
    const variance = actual.sub(planned);
    const pct = planned.gt(0) ? variance.div(planned).mul(100) : new Prisma.Decimal(0);
    return {
      operationId: op.id,
      productionOrderId: op.productionOrder.id,
      productionOrderNumber: op.productionOrder.orderNumber,
      workCenterCode: op.workCenter.code,
      sequence: op.sequence,
      description: op.description,
      plannedHours: planned.toString(),
      actualHours: actual.toString(),
      varianceHours: variance.toString(),
      variancePct: pct.toFixed(2),
      _sort: Number(variance.toString()),
    };
  });

  return rows
    .sort((a, b) => b._sort - a._sort)
    .slice(0, limit)
    .map(({ _sort: _, ...row }) => row);
}

// =====================================================================
// Cycle time by material (avg startedAt → completedAt)
// =====================================================================

export type CycleTimeRow = {
  materialId: string;
  materialNumber: string;
  materialName: string;
  orderCount: number;
  avgCycleHours: number;
  minCycleHours: number;
  maxCycleHours: number;
};

export async function getCycleTimeByMaterial(): Promise<CycleTimeRow[]> {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: {
        in: [
          ProductionOrderStatus.COMPLETED,
          ProductionOrderStatus.CLOSED,
        ],
      },
      startedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      parentMaterialId: true,
      parentMaterial: {
        select: { materialNumber: true, name: true },
      },
      startedAt: true,
      completedAt: true,
    },
  });

  const byMaterial = new Map<
    string,
    { materialNumber: string; materialName: string; samples: number[] }
  >();
  for (const o of orders) {
    if (!o.startedAt || !o.completedAt) continue;
    const hours = (o.completedAt.getTime() - o.startedAt.getTime()) / (1000 * 60 * 60);
    const key = o.parentMaterialId;
    const existing = byMaterial.get(key);
    if (existing) {
      existing.samples.push(hours);
    } else {
      byMaterial.set(key, {
        materialNumber: o.parentMaterial.materialNumber,
        materialName: o.parentMaterial.name,
        samples: [hours],
      });
    }
  }

  return Array.from(byMaterial.entries())
    .map(([id, v]) => ({
      materialId: id,
      materialNumber: v.materialNumber,
      materialName: v.materialName,
      orderCount: v.samples.length,
      avgCycleHours: v.samples.reduce((a, b) => a + b, 0) / v.samples.length,
      minCycleHours: Math.min(...v.samples),
      maxCycleHours: Math.max(...v.samples),
    }))
    .sort((a, b) => b.orderCount - a.orderCount);
}

// =====================================================================
// Convenience: a single rolled-up "headline" tile bundle for the dashboard
// =====================================================================

export type KpiHeadlines = {
  totalOrders: number;
  openOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  /** Weighted avg yield across all completed orders (good / produced × 100). */
  avgYieldPct: string | null;
  totalGoodFgProduced: string;
  totalScrap: string;
};

export async function getKpiHeadlines(): Promise<KpiHeadlines> {
  const [totalOrders, openOrders, completedOrders, cancelledOrders, completedAgg] =
    await Promise.all([
      prisma.productionOrder.count(),
      prisma.productionOrder.count({
        where: {
          status: {
            in: [
              ProductionOrderStatus.DRAFT,
              ProductionOrderStatus.RELEASED,
              ProductionOrderStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      prisma.productionOrder.count({
        where: {
          status: {
            in: [
              ProductionOrderStatus.COMPLETED,
              ProductionOrderStatus.CLOSED,
            ],
          },
        },
      }),
      prisma.productionOrder.count({
        where: { status: ProductionOrderStatus.CANCELLED },
      }),
      prisma.productionOrder.aggregate({
        where: {
          status: {
            in: [
              ProductionOrderStatus.COMPLETED,
              ProductionOrderStatus.CLOSED,
            ],
          },
        },
        _sum: { completedQuantity: true, scrappedQuantity: true },
      }),
    ]);

  const good = completedAgg._sum.completedQuantity ?? new Prisma.Decimal(0);
  const scrap = completedAgg._sum.scrappedQuantity ?? new Prisma.Decimal(0);
  const produced = good.add(scrap);
  const avgYieldPct = produced.gt(0)
    ? good.div(produced).mul(100).toFixed(2)
    : null;

  return {
    totalOrders,
    openOrders,
    completedOrders,
    cancelledOrders,
    avgYieldPct,
    totalGoodFgProduced: good.toString(),
    totalScrap: scrap.toString(),
  };
}
