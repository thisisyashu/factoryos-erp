import Link from "next/link";
import { requireCurrentUser } from "@/lib/current-user";
import {
  getKpiHeadlines,
  getOrderStatusBreakdown,
  getOpenWipSummary,
  getYieldByMaterial,
  getWorkCenterUtilization,
  getTopOperationVariances,
  getCycleTimeByMaterial,
} from "@/lib/services/manufacturing-kpis";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductionOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  ProductionOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  RELEASED: "outline",
  IN_PROGRESS: "outline",
  COMPLETED: "default",
  CLOSED: "default",
  CANCELLED: "destructive",
};

function formatHours(h: string | number): string {
  const n = typeof h === "string" ? Number(h) : h;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} h`;
}

function formatCycle(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours >= 24) return `${(hours / 24).toFixed(1)} d`;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  return `${(hours * 60).toFixed(0)} m`;
}

export default async function KpiDashboardPage() {
  await requireCurrentUser();
  const [headlines, statusBreakdown, wip, yieldRows, wcs, varianceRows, cycleRows] =
    await Promise.all([
      getKpiHeadlines(),
      getOrderStatusBreakdown(),
      getOpenWipSummary(),
      getYieldByMaterial(),
      getWorkCenterUtilization(),
      getTopOperationVariances(10),
      getCycleTimeByMaterial(),
    ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manufacturing KPIs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregate metrics over every production order, operation, lot, and
          movement in the system. Real-time, no caching.
        </p>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HeadlineTile label="Total orders" value={headlines.totalOrders} />
        <HeadlineTile
          label="Open WIP"
          value={headlines.openOrders}
          sub={`${wip.totalRemainingQty} units left`}
        />
        <HeadlineTile
          label="Completed"
          value={headlines.completedOrders}
          sub={`${headlines.totalGoodFgProduced} good + ${headlines.totalScrap} scrap`}
        />
        <HeadlineTile
          label="Avg yield"
          value={headlines.avgYieldPct ? `${headlines.avgYieldPct}%` : "—"}
          highlight={
            headlines.avgYieldPct
              ? Number(headlines.avgYieldPct) >= 95
                ? "ok"
                : "warn"
              : undefined
          }
        />
      </div>

      {/* Order status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Orders by status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusBreakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground">No production orders yet.</div>
          ) : (
            <div className="space-y-2">
              {statusBreakdown.map((row) => (
                <div key={row.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge>
                    <span className="tabular-nums">
                      <strong>{row.count}</strong>{" "}
                      <span className="text-muted-foreground">
                        ({row.pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yield by material */}
      <Card>
        <CardHeader>
          <CardTitle>Yield by material (completed orders)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {yieldRows.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground text-center">
              No completed orders yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                  <TableHead className="text-right">Scrap</TableHead>
                  <TableHead className="text-right">Yield</TableHead>
                  <TableHead className="text-right">Scrap %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yieldRows.map((r) => (
                  <TableRow key={r.materialId}>
                    <TableCell>
                      <div className="font-medium">{r.materialName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.orderCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.totalCompleted} {r.uomCode}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.totalScrapped}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        Number(r.yieldPct) >= 95 ? "" : "text-destructive"
                      }`}
                    >
                      {r.yieldPct}%
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        Number(r.scrapPct) > 5 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {r.scrapPct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Work-center utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Work-center utilization</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work center</TableHead>
                <TableHead className="text-right">Capacity / day</TableHead>
                <TableHead className="text-right">Operations</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Planned hrs</TableHead>
                <TableHead className="text-right">Actual hrs</TableHead>
                <TableHead className="text-right">Util vs plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wcs.map((wc) => (
                <TableRow key={wc.workCenterId}>
                  <TableCell>
                    <Link
                      href={`/manufacturing/work-centers/${wc.workCenterId}`}
                      className="font-mono font-medium underline"
                    >
                      {wc.code}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {wc.name}{" "}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {wc.type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {wc.capacityHoursPerDay ? `${wc.capacityHoursPerDay} h` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {wc.operationCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {wc.confirmedOperationCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatHours(wc.totalPlannedHours)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatHours(wc.totalActualHours)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      wc.utilizationVsPlannedPct
                        ? Number(wc.utilizationVsPlannedPct) > 110
                          ? "text-destructive"
                          : Number(wc.utilizationVsPlannedPct) < 90
                            ? "text-foreground"
                            : ""
                        : "text-muted-foreground"
                    }`}
                  >
                    {wc.utilizationVsPlannedPct
                      ? `${wc.utilizationVsPlannedPct}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top variances */}
      <Card>
        <CardHeader>
          <CardTitle>Top over-plan operations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {varianceRows.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground text-center">
              No confirmed operations yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>WC</TableHead>
                  <TableHead className="w-12 text-right">Seq</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varianceRows.map((r) => {
                  const v = Number(r.varianceHours);
                  const isOver = v > 0;
                  const isUnder = v < 0;
                  return (
                    <TableRow key={r.operationId}>
                      <TableCell>
                        <Link
                          href={`/manufacturing/production-orders/${r.productionOrderId}`}
                          className="font-mono text-sm underline"
                        >
                          {r.productionOrderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.workCenterCode}</TableCell>
                      <TableCell className="text-right">{r.sequence}</TableCell>
                      <TableCell className="text-sm">{r.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHours(r.plannedHours)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHours(r.actualHours)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          isOver ? "text-destructive" : isUnder ? "text-foreground" : ""
                        }`}
                      >
                        {isOver ? "+" : ""}
                        {Number(r.varianceHours).toFixed(2)} h
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          isOver ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {Number(r.variancePct) > 0 ? "+" : ""}
                        {r.variancePct}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cycle time */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle time by material (start → complete)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cycleRows.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground text-center">
              No completed orders with both startedAt and completedAt set.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Avg cycle</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleRows.map((r) => (
                  <TableRow key={r.materialId}>
                    <TableCell>
                      <div className="font-medium">{r.materialName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.orderCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCycle(r.avgCycleHours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCycle(r.minCycleHours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCycle(r.maxCycleHours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HeadlineTile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "ok" | "warn";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div
          className={`text-2xl font-semibold tabular-nums ${
            highlight === "ok"
              ? "text-foreground"
              : highlight === "warn"
                ? "text-destructive"
                : ""
          }`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
          {label}
        </div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
