import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGoodsReceipt,
  getGrAuditTrail,
} from "@/lib/services/goods-receipt";
import { getLedgerForReference } from "@/lib/services/inventory";
import { requireCurrentUser } from "@/lib/current-user";
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
import { GoodsReceiptStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  GoodsReceiptStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  POSTED: "default",
  CANCELLED: "destructive",
};

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleString() : "—";
}

export default async function GrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCurrentUser();
  const [gr, audit, ledger] = await Promise.all([
    getGoodsReceipt(id),
    getGrAuditTrail(id),
    getLedgerForReference("GoodsReceipt", id),
  ]);
  if (!gr) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link href="/procurement/goods-receipts" className="underline">
              All GRs
            </Link>{" "}
            / {gr.grNumber}
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {gr.grNumber}
            <Badge variant={STATUS_BADGE[gr.status]}>{gr.status}</Badge>
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">PO</div>
            <Link
              href={`/procurement/purchase-orders/${gr.po.id}`}
              className="font-medium underline"
            >
              {gr.po.poNumber}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">
              <Badge variant="secondary">{gr.po.status}</Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Supplier</div>
            <div className="font-medium">{gr.po.supplier.legalName}</div>
            <div className="text-xs text-muted-foreground">
              {gr.po.supplier.supplierNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Received by</div>
            <div className="font-medium">{gr.receivedBy.name}</div>
            <div className="text-xs text-muted-foreground">{gr.receivedBy.role}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Posted</div>
            <div className="font-medium">{fmt(gr.receivedAt)}</div>
          </div>
          {gr.notes && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Notes</div>
              <div>{gr.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines ({gr.lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead>Storage location</TableHead>
                <TableHead>From PO line</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gr.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.lineNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{line.material.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.material.materialNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {line.quantity.toString()}
                  </TableCell>
                  <TableCell>{line.unitOfMeasure.code}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {line.storageLocation.warehouse.code}/{line.storageLocation.code}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {line.storageLocation.warehouse.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">PO line {line.poLine.lineNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      (ordered {line.poLine.quantity.toString()})
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ledger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory movements posted ({ledger.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Posted at</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{fmt(entry.postedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.movementType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.material.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.material.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.quantity.gte(0) ? "+" : ""}
                      {entry.quantity.toString()}
                    </TableCell>
                    <TableCell>{entry.unitOfMeasure.code}</TableCell>
                    <TableCell className="text-sm">
                      {entry.storageLocation.warehouse.code}/
                      {entry.storageLocation.code}
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
