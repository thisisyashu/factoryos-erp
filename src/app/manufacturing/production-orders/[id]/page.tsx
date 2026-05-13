import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProductionOrder,
  getProductionOrderAuditTrail,
  getMaterialAvailability,
  getProductionOrderVariance,
} from "@/lib/services/production-order";
import { requireCurrentUser } from "@/lib/current-user";
import {
  releasePoFormAction,
  cancelPoFormAction,
} from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ProductionOrderStatus,
  ProductionOperationStatus,
  UserRole,
} from "@prisma/client";

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

const OP_STATUS_BADGE: Record<
  ProductionOperationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  IN_PROGRESS: "outline",
  CONFIRMED: "default",
  SKIPPED: "destructive",
};

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleString() : "—";
}

function fmtDate(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export default async function ProductionOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [order, audit, availability, variance] = await Promise.all([
    getProductionOrder(id),
    getProductionOrderAuditTrail(id),
    getMaterialAvailability(id).catch(() => []),
    getProductionOrderVariance(id).catch(() => null),
  ]);
  if (!order) notFound();

  const canRelease =
    order.status === ProductionOrderStatus.DRAFT &&
    (user.role === UserRole.APPROVER || user.role === UserRole.ADMIN);
  const canCancel =
    (order.status === ProductionOrderStatus.DRAFT ||
      order.status === ProductionOrderStatus.RELEASED) &&
    (user.role === UserRole.APPROVER || user.role === UserRole.ADMIN);
  const canIssue =
    (order.status === ProductionOrderStatus.RELEASED ||
      order.status === ProductionOrderStatus.IN_PROGRESS) &&
    (user.role === UserRole.REQUESTER ||
      user.role === UserRole.APPROVER ||
      user.role === UserRole.ADMIN);
  const remainingFg = order.quantity
    .sub(order.completedQuantity)
    .sub(order.scrappedQuantity);
  const canReceiveFg =
    order.status === ProductionOrderStatus.IN_PROGRESS &&
    remainingFg.gt(0) &&
    (user.role === UserRole.REQUESTER ||
      user.role === UserRole.APPROVER ||
      user.role === UserRole.ADMIN);
  const hasShortage = availability.some((a) => a.isShort);

  // Total planned operation hours (setup + run × qty)
  const totalPlannedHours = order.operations.reduce((sum, op) => {
    const setup = Number(op.plannedSetupHours.toString());
    const run = Number(op.plannedRunHours.toString());
    return sum + setup + run;
  }, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link
              href="/manufacturing/production-orders"
              className="underline"
            >
              All orders
            </Link>{" "}
            / {order.orderNumber}
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {order.orderNumber}
            <Badge variant={STATUS_BADGE[order.status]}>{order.status}</Badge>
          </h1>
        </div>
        <div className="flex gap-2 items-start">
          {canRelease && !hasShortage && (
            <form action={releasePoFormAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <Button type="submit">Release for production</Button>
            </form>
          )}
          {canRelease && hasShortage && (
            <span className="text-xs text-destructive max-w-[200px] text-right">
              Cannot release — material shortage. See availability below.
            </span>
          )}
          {canIssue && (
            <Link
              href={`/manufacturing/production-orders/${order.id}/issue`}
              className={buttonVariants({ variant: "outline" })}
            >
              Issue materials
            </Link>
          )}
          {canReceiveFg && (
            <Link
              href={`/manufacturing/production-orders/${order.id}/receive`}
              className={buttonVariants()}
            >
              Receive FG
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Parent material</div>
            <div className="font-medium">{order.parentMaterial.name}</div>
            <div className="text-xs text-muted-foreground">
              {order.parentMaterial.materialNumber}
              <Badge variant="secondary" className="ml-2 text-xs">
                {order.parentMaterial.type}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Quantity</div>
            <div className="font-medium tabular-nums">
              {order.quantity.toString()} {order.unitOfMeasure.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">BOM</div>
            <Link
              href={`/manufacturing/boms/${order.bom.id}`}
              className="font-medium underline"
            >
              {order.bom.bomNumber}
            </Link>
            <div className="text-xs text-muted-foreground">
              v{order.bom.version} ·{" "}
              <Badge variant="secondary" className="text-xs">
                {order.bom.status}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Routing</div>
            {order.routing ? (
              <>
                <Link
                  href={`/manufacturing/routings/${order.routing.id}`}
                  className="font-medium underline"
                >
                  {order.routing.routingNumber}
                </Link>
                <div className="text-xs text-muted-foreground">
                  v{order.routing.version}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">—</div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Planned start</div>
            <div className="font-medium">{fmtDate(order.plannedStartDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Planned end</div>
            <div className="font-medium">{fmtDate(order.plannedEndDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created by</div>
            <div className="font-medium">{order.createdBy.name}</div>
            <div className="text-xs text-muted-foreground">{fmt(order.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Released</div>
            <div className="font-medium">{fmt(order.releasedAt)}</div>
            {order.releasedBy && (
              <div className="text-xs text-muted-foreground">
                by {order.releasedBy.name}
              </div>
            )}
          </div>
          {order.notes && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Notes</div>
              <div>{order.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {variance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Production variance</span>
              {variance.yieldPercent != null && (
                <span className="text-sm font-normal">
                  yield{" "}
                  <span
                    className={
                      Number(variance.yieldPercent) >= 95
                        ? "text-foreground font-medium"
                        : "text-destructive font-medium"
                    }
                  >
                    {variance.yieldPercent}%
                  </span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground uppercase">
                <span>Quantity</span>
                <span>
                  {variance.quantityCompleted} good · {variance.quantityScrapped}{" "}
                  scrap · {variance.quantityRemaining} left of{" "}
                  {variance.quantityPlanned}
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-muted relative">
                {(() => {
                  const planned = Number(variance.quantityPlanned) || 1;
                  const completedPct = Math.min(
                    100,
                    (Number(variance.quantityCompleted) / planned) * 100,
                  );
                  const scrappedPct = Math.min(
                    100 - completedPct,
                    (Number(variance.quantityScrapped) / planned) * 100,
                  );
                  return (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{ width: `${completedPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 bg-destructive/70"
                        style={{
                          left: `${completedPct}%`,
                          width: `${scrappedPct}%`,
                        }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase">
                  Planned hours
                </div>
                <div className="font-medium tabular-nums">
                  {Number(variance.totalPlannedHours).toFixed(2)} h
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  setup {Number(variance.totalPlannedSetupHours).toFixed(2)} · run{" "}
                  {Number(variance.totalPlannedRunHours).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">
                  Actual hours
                </div>
                <div className="font-medium tabular-nums">
                  {Number(variance.totalActualHours).toFixed(2)} h
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  setup {Number(variance.totalActualSetupHours).toFixed(2)} · run{" "}
                  {Number(variance.totalActualRunHours).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">
                  Hours variance
                </div>
                <div
                  className={`font-medium tabular-nums ${
                    Number(variance.hoursVariance) > 0
                      ? "text-destructive"
                      : Number(variance.hoursVariance) < 0
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {Number(variance.hoursVariance) > 0 ? "+" : ""}
                  {Number(variance.hoursVariance).toFixed(2)} h
                </div>
                {variance.hoursVariancePercent != null && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {variance.hoursVariancePercent}%
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">
                  Scrap rate
                </div>
                <div
                  className={`font-medium tabular-nums ${
                    variance.scrapPercent && Number(variance.scrapPercent) > 5
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {variance.scrapPercent ?? "—"}{variance.scrapPercent ? "%" : ""}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {availability.length > 0 && (
        <Card className={hasShortage ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Material availability</span>
              {hasShortage ? (
                <Badge variant="destructive">SHORT</Badge>
              ) : (
                <Badge variant="default">OK</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Reserved (others)</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availability.map((a) => (
                  <TableRow key={a.componentId}>
                    <TableCell>{a.lineNumber}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{a.materialName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.materialNumber} · {a.uomCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.plannedQuantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.inventoryOnHand}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {a.reservedByOthers}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {a.availableForThisOrder}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${a.isShort ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                    >
                      {a.isShort ? a.shortage : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Material requirements (BOM explosion) — {order.components.length} components
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Planned qty</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Scrapped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.components.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.lineNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.material.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.material.materialNumber}
                      <Badge
                        variant={
                          c.material.status === "ACTIVE" ? "secondary" : "destructive"
                        }
                        className="ml-2 text-xs"
                      >
                        {c.material.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {c.plannedQuantity.toString()}
                  </TableCell>
                  <TableCell>{c.unitOfMeasure.code}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.issuedQuantity.toString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.reservedQuantity.toString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.scrappedQuantity.toString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.operations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Operations ({order.operations.length}) — total planned{" "}
              {totalPlannedHours.toFixed(2)} h
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Seq</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Work center</TableHead>
                  <TableHead className="text-right">Planned setup (h)</TableHead>
                  <TableHead className="text-right">Planned run (h)</TableHead>
                  <TableHead className="text-right">Actual setup</TableHead>
                  <TableHead className="text-right">Actual run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.operations.map((op) => {
                  const orderActive =
                    order.status === ProductionOrderStatus.RELEASED ||
                    order.status === ProductionOrderStatus.IN_PROGRESS;
                  const isPending =
                    op.status === ProductionOperationStatus.PENDING ||
                    op.status === ProductionOperationStatus.IN_PROGRESS;
                  const opCanConfirm =
                    orderActive &&
                    isPending &&
                    (user.role === UserRole.REQUESTER ||
                      user.role === UserRole.APPROVER ||
                      user.role === UserRole.ADMIN);
                  const opCanSkip =
                    orderActive &&
                    op.status === ProductionOperationStatus.PENDING &&
                    (user.role === UserRole.APPROVER ||
                      user.role === UserRole.ADMIN);
                  return (
                    <TableRow key={op.id}>
                      <TableCell className="font-mono">{op.sequence}</TableCell>
                      <TableCell>{op.description}</TableCell>
                      <TableCell>
                        <div className="font-medium font-mono">{op.workCenter.code}</div>
                        <div className="text-xs text-muted-foreground">
                          {op.workCenter.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {op.plannedSetupHours.toString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {op.plannedRunHours.toString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {op.actualSetupHours.toString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {op.actualRunHours.toString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={OP_STATUS_BADGE[op.status]}>{op.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 text-xs">
                          {opCanConfirm && (
                            <Link
                              href={`/manufacturing/production-orders/${order.id}/operations/${op.id}/confirm`}
                              className="underline hover:text-foreground"
                            >
                              Confirm
                            </Link>
                          )}
                          {opCanSkip && (
                            <Link
                              href={`/manufacturing/production-orders/${order.id}/operations/${op.id}/skip`}
                              className="underline text-muted-foreground hover:text-destructive"
                            >
                              Skip
                            </Link>
                          )}
                          {!opCanConfirm && !opCanSkip && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canCancel && (
        <Card>
          <CardHeader>
            <CardTitle>Cancel this order</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={cancelPoFormAction} className="space-y-2 max-w-md">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="text-sm font-medium block">
                Cancellation reason <span className="text-destructive">(required)</span>
              </label>
              <Textarea
                name="reason"
                rows={2}
                required
                placeholder="Why is this being cancelled?"
              />
              <p className="text-xs text-muted-foreground">
                {order.status === ProductionOrderStatus.RELEASED
                  ? "Reservations on all components will be released."
                  : "No inventory impact — order is still in DRAFT."}
              </p>
              <Button type="submit" variant="destructive">
                Cancel order
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit.length === 0 && (
            <div className="text-sm text-muted-foreground">No audit entries yet.</div>
          )}
          {audit.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 text-sm">
              <div className="w-44 text-muted-foreground shrink-0">
                {fmt(entry.createdAt)}
              </div>
              <div className="flex-1">
                <div>
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    by {entry.actor.name} ({entry.actor.role})
                  </span>
                </div>
                {entry.metadata != null && (
                  <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
