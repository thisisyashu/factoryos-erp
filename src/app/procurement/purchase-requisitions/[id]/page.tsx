import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPurchaseRequisition,
  getPrAuditTrail,
} from "@/lib/services/purchase-requisition";
import { requireCurrentUser } from "@/lib/current-user";
import {
  submitPrFormAction,
  approvePrFormAction,
  rejectPrFormAction,
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
import { PurchaseRequisitionStatus, UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  PurchaseRequisitionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  CONVERTED_TO_PO: "default",
  CANCELLED: "secondary",
};

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleString() : "—";
}

export default async function PrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const [pr, audit] = await Promise.all([
    getPurchaseRequisition(id),
    getPrAuditTrail(id),
  ]);
  if (!pr) notFound();

  const canSubmit =
    pr.status === PurchaseRequisitionStatus.DRAFT &&
    (pr.requestedById === user.id || user.role === UserRole.ADMIN);
  const canDecide =
    pr.status === PurchaseRequisitionStatus.SUBMITTED &&
    (user.role === UserRole.APPROVER || user.role === UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link
              href="/procurement/purchase-requisitions"
              className="underline"
            >
              All PRs
            </Link>{" "}
            / {pr.prNumber}
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {pr.prNumber}
            <Badge variant={STATUS_BADGE[pr.status]}>{pr.status}</Badge>
          </h1>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <form action={submitPrFormAction}>
              <input type="hidden" name="prId" value={pr.id} />
              <Button type="submit">Submit for approval</Button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Requested by</div>
            <div className="font-medium">{pr.requestedBy.name}</div>
            <div className="text-xs text-muted-foreground">{pr.requestedBy.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Department</div>
            <div className="font-medium">{pr.department || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Needed by</div>
            <div className="font-medium">
              {pr.neededBy ? new Date(pr.neededBy).toLocaleDateString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{fmt(pr.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Submitted</div>
            <div className="font-medium">{fmt(pr.submittedAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              {pr.status === PurchaseRequisitionStatus.REJECTED
                ? "Rejected by"
                : "Approved by"}
            </div>
            <div className="font-medium">{pr.approvedBy?.name || "—"}</div>
            <div className="text-xs text-muted-foreground">{fmt(pr.approvedAt)}</div>
          </div>
          {pr.status === PurchaseRequisitionStatus.REJECTED &&
            pr.rejectionReason && (
              <div className="col-span-full">
                <div className="text-muted-foreground">Rejection reason</div>
                <div className="font-medium text-destructive">
                  {pr.rejectionReason}
                </div>
              </div>
            )}
          {pr.reason && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Business reason</div>
              <div>{pr.reason}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines ({pr.lines.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Est. cost</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.lines.map((line) => (
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
                  <TableCell className="text-right">
                    {line.estimatedCost ? `$${line.estimatedCost.toString()}` : "—"}
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

      {pr.status === PurchaseRequisitionStatus.APPROVED && !pr.convertedPo && (
        <Card>
          <CardHeader>
            <CardTitle>Convert to Purchase Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              This PR is approved. Convert it into a PO to a specific supplier — you'll
              choose the supplier and confirm unit prices on the next screen.
            </p>
            <Link
              href={`/procurement/purchase-orders/new?fromPr=${pr.id}`}
              className={buttonVariants()}
            >
              Convert to PO
            </Link>
          </CardContent>
        </Card>
      )}

      {pr.convertedPo && (
        <Card>
          <CardHeader>
            <CardTitle>Converted to Purchase Order</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/procurement/purchase-orders/${pr.convertedPo.id}`}
              className="font-medium underline mr-3"
            >
              {pr.convertedPo.poNumber}
            </Link>
            <Badge variant="secondary">{pr.convertedPo.status}</Badge>
          </CardContent>
        </Card>
      )}

      {canDecide && (
        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form action={approvePrFormAction} className="space-y-2">
              <input type="hidden" name="prId" value={pr.id} />
              <label className="text-sm font-medium block">
                Approve <span className="text-muted-foreground">(comments optional)</span>
              </label>
              <Textarea name="comments" rows={2} placeholder="Looks good — proceed." />
              <Button type="submit" className="w-full">
                Approve
              </Button>
            </form>
            <form action={rejectPrFormAction} className="space-y-2">
              <input type="hidden" name="prId" value={pr.id} />
              <label className="text-sm font-medium block">
                Reject <span className="text-destructive">(reason required)</span>
              </label>
              <Textarea
                name="rejectionReason"
                rows={2}
                required
                placeholder="Why is this being rejected?"
              />
              <Button type="submit" variant="destructive" className="w-full">
                Reject
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
