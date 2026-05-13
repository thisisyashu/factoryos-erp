import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkCenter } from "@/lib/services/work-center";
import { listWorkCenterQueue } from "@/lib/services/production-order";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkCenterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [wc, queue] = await Promise.all([
    getWorkCenter(id),
    listWorkCenterQueue(id),
  ]);
  if (!wc) notFound();

  // Aggregate queue stats
  const totalPlannedRunHours = queue.reduce(
    (sum, op) => sum + Number(op.plannedRunHours.toString()),
    0,
  );
  const totalPlannedSetupHours = queue.reduce(
    (sum, op) => sum + Number(op.plannedSetupHours.toString()),
    0,
  );
  const dailyCapacity = wc.capacityHoursPerDay
    ? Number(wc.capacityHoursPerDay.toString())
    : null;
  const daysOfWork =
    dailyCapacity && dailyCapacity > 0
      ? (totalPlannedSetupHours + totalPlannedRunHours) / dailyCapacity
      : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/manufacturing/work-centers" className="underline">
            All work centers
          </Link>{" "}
          / {wc.code}
        </div>
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span className="font-mono">{wc.code}</span>
          <span>{wc.name}</span>
          <Badge variant="secondary">{wc.type}</Badge>
        </h1>
        {wc.description && (
          <p className="text-sm text-muted-foreground">{wc.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacity</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Daily capacity</div>
            <div className="font-medium tabular-nums">
              {dailyCapacity != null ? `${dailyCapacity} h` : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Active routings</div>
            <div className="font-medium tabular-nums">
              {wc.routingOperations.length}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Open ops in queue</div>
            <div className="font-medium tabular-nums">{queue.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Backlog (~days)</div>
            <div className="font-medium tabular-nums">
              {daysOfWork != null ? daysOfWork.toFixed(1) : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operation queue ({queue.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              Queue is clear — no PENDING or IN_PROGRESS operations at this work center
              from any RELEASED or IN_PROGRESS production order.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Production order</TableHead>
                  <TableHead>Producing</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="w-16 text-right">Seq</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">Setup (h)</TableHead>
                  <TableHead className="text-right">Run (h)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      <Link
                        href={`/manufacturing/production-orders/${op.productionOrder.id}`}
                        className="font-medium underline"
                      >
                        {op.productionOrder.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {op.productionOrder.parentMaterial.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {op.productionOrder.parentMaterial.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {op.productionOrder.quantity.toString()}{" "}
                      {op.productionOrder.unitOfMeasure.code}
                    </TableCell>
                    <TableCell className="font-mono text-right">{op.sequence}</TableCell>
                    <TableCell>{op.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {op.plannedSetupHours.toString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {op.plannedRunHours.toString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          op.status === "PENDING" ? "secondary" : "outline"
                        }
                      >
                        {op.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <Link
                        href={`/manufacturing/production-orders/${op.productionOrder.id}/operations/${op.id}/confirm`}
                        className="underline hover:text-foreground"
                      >
                        Confirm →
                      </Link>
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
