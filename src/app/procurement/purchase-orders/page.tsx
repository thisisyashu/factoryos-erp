import Link from "next/link";
import { listPurchaseOrders } from "@/lib/services/purchase-order";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ value?: PurchaseOrderStatus; label: string }> = [
  { value: undefined, label: "All" },
  { value: PurchaseOrderStatus.DRAFT, label: "Draft" },
  { value: PurchaseOrderStatus.SUBMITTED, label: "Submitted" },
  { value: PurchaseOrderStatus.APPROVED, label: "Approved" },
  { value: PurchaseOrderStatus.SENT, label: "Sent" },
  { value: PurchaseOrderStatus.PARTIALLY_RECEIVED, label: "Partially received" },
  { value: PurchaseOrderStatus.RECEIVED, label: "Received" },
  { value: PurchaseOrderStatus.CLOSED, label: "Closed" },
  { value: PurchaseOrderStatus.CANCELLED, label: "Cancelled" },
];

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

function fmtCurrency(amount: { toString(): string }, currency: string): string {
  const n = Number(amount.toString());
  if (!Number.isFinite(n)) return amount.toString();
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

type Props = { searchParams: Promise<{ status?: string }> };

export default async function PoListPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter =
    status && status in PurchaseOrderStatus
      ? (status as PurchaseOrderStatus)
      : undefined;
  const pos = await listPurchaseOrders({ status: filter });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outbound orders to suppliers. Convert from approved PRs or create manually.
          </p>
        </div>
        <Link
          href="/procurement/purchase-orders/new"
          className={buttonVariants()}
        >
          + Create PO
        </Link>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <Link
              key={f.label}
              href={f.value ? `?status=${f.value}` : "?"}
              className={`px-3 py-1 text-sm rounded-full border transition ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>From PR</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No purchase orders yet.{" "}
                  <Link
                    href="/procurement/purchase-orders/new"
                    className="underline"
                  >
                    Create one
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {pos.map((po) => (
              <TableRow key={po.id}>
                <TableCell>
                  <Link
                    href={`/procurement/purchase-orders/${po.id}`}
                    className="font-medium underline"
                  >
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[po.status]}>{po.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{po.supplier.legalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {po.supplier.supplierNumber}
                  </div>
                </TableCell>
                <TableCell>
                  {po.sourcePr ? (
                    <Link
                      href={`/procurement/purchase-requisitions/${po.sourcePr.id}`}
                      className="text-sm underline"
                    >
                      {po.sourcePr.prNumber}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-sm">manual</span>
                  )}
                </TableCell>
                <TableCell>{po.requestedBy.name}</TableCell>
                <TableCell className="text-right">{po._count.lines}</TableCell>
                <TableCell className="text-right">
                  {fmtCurrency(po.totalAmount, po.currency)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(po.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
