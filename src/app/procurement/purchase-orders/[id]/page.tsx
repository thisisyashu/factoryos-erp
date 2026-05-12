import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPurchaseOrder,
  getPoAuditTrail,
} from "@/lib/services/purchase-order";
import { requireCurrentUser } from "@/lib/current-user";
import {
  submitPoFormAction,
  approvePoFormAction,
  sendPoFormAction,
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
import { PurchaseOrderStatus, UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  PurchaseOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  SENT: "default",
  PARTIALLY_RECEIVED: "outline",
  RECEIVED: "default",
  CLOSED: "secondary",
  CANCELLED: "destructive",
};

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleString() : "—";
}

function fmtMoney(amount: { toString(): string }, currency: string): string {
  const n = Number(amount.toString());
  if (!Number.isFinite(n)) return amount.toString();
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [po, audit] = await Promise.all([
    getPurchaseOrder(id),
    getPoAuditTrail(id),
  ]);
  if (!po) notFound();

  const canSubmit =
    po.status === PurchaseOrderStatus.DRAFT &&
    (po.requestedById === user.id || user.role === UserRole.ADMIN);
  const canApprove =
    po.status === PurchaseOrderStatus.SUBMITTED &&
    (user.role === UserRole.APPROVER || user.role === UserRole.ADMIN);
  const canSend =
    po.status === PurchaseOrderStatus.APPROVED &&
    (user.role === UserRole.REQUESTER ||
      user.role === UserRole.APPROVER ||
      user.role === UserRole.ADMIN);
  const canReceive =
    (po.status === PurchaseOrderStatus.APPROVED ||
      po.status === PurchaseOrderStatus.SENT ||
      po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED) &&
    (user.role === UserRole.REQUESTER ||
      user.role === UserRole.APPROVER ||
      user.role === UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link href="/procurement/purchase-orders" className="underline">
              All POs
            </Link>{" "}
            / {po.poNumber}
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {po.poNumber}
            <Badge variant={STATUS_BADGE[po.status]}>{po.status}</Badge>
          </h1>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <form action={submitPoFormAction}>
              <input type="hidden" name="poId" value={po.id} />
              <Button type="submit">Submit for approval</Button>
            </form>
          )}
          {canSend && (
            <form action={sendPoFormAction}>
              <input type="hidden" name="poId" value={po.id} />
              <Button type="submit">Mark as sent</Button>
            </form>
          )}
          {canReceive && (
            <Link
              href={`/procurement/goods-receipts/new?poId=${po.id}`}
              className={buttonVariants()}
            >
              Receive goods
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
            <div className="text-muted-foreground">Supplier</div>
            <div className="font-medium">{po.supplier.legalName}</div>
            <div className="text-xs text-muted-foreground">
              {po.supplier.supplierNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Currency</div>
            <div className="font-medium">{po.currency}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="font-medium">{fmtMoney(po.totalAmount, po.currency)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Source PR</div>
            <div className="font-medium">
              {po.sourcePr ? (
                <Link
                  href={`/procurement/purchase-requisitions/${po.sourcePr.id}`}
                  className="underline"
                >
                  {po.sourcePr.prNumber}
                </Link>
              ) : (
                <span className="text-muted-foreground">— (manual)</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Requested by</div>
            <div className="font-medium">{po.requestedBy.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Submitted</div>
            <div className="font-medium">{fmt(po.submittedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Approved by</div>
            <div className="font-medium">{po.approvedBy?.name || "—"}</div>
            <div className="text-xs text-muted-foreground">{fmt(po.approvedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Sent</div>
            <div className="font-medium">{fmt(po.sentAt)}</div>
          </div>
          {po.notes && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Notes</div>
              <div>{po.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines ({po.lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.lineNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{line.material.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.material.materialNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity.toString()}</TableCell>
                  <TableCell>{line.unitOfMeasure.code}</TableCell>
                  <TableCell className="text-right">
                    {fmtMoney(line.unitPrice, po.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtMoney(line.lineTotal, po.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.quantityReceived.toString()} / {line.quantity.toString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={approvePoFormAction} className="space-y-2 max-w-md">
              <input type="hidden" name="poId" value={po.id} />
              <label className="text-sm font-medium block">
                Approve <span className="text-muted-foreground">(comments optional)</span>
              </label>
              <Textarea name="comments" rows={2} placeholder="Pricing looks reasonable." />
              <Button type="submit">Approve PO</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {po.goodsReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goods Receipts ({po.goodsReceipts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {po.goodsReceipts.map((gr) => (
              <div
                key={gr.id}
                className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0"
              >
                <Link
                  href={`/procurement/goods-receipts/${gr.id}`}
                  className="font-medium underline"
                >
                  {gr.grNumber}
                </Link>
                <Badge variant="secondary">{gr.status}</Badge>
                <span className="text-muted-foreground">{fmt(gr.createdAt)}</span>
              </div>
            ))}
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
