import Link from "next/link";
import { listGoodsReceipts } from "@/lib/services/goods-receipt";
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

export default async function GrListPage() {
  const grs = await listGoodsReceipts();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Goods Receipts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record arrival of supplier shipments. Posting writes the inventory ledger.
          </p>
        </div>
        <Link
          href="/procurement/goods-receipts/new"
          className={buttonVariants()}
        >
          + Receive against PO
        </Link>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GR Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Received by</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead>Posted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No goods receipts yet.{" "}
                  <Link
                    href="/procurement/goods-receipts/new"
                    className="underline"
                  >
                    Receive against a PO
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {grs.map((gr) => (
              <TableRow key={gr.id}>
                <TableCell>
                  <Link
                    href={`/procurement/goods-receipts/${gr.id}`}
                    className="font-medium underline"
                  >
                    {gr.grNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[gr.status]}>{gr.status}</Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/procurement/purchase-orders/${gr.po.id}`}
                    className="text-sm underline"
                  >
                    {gr.po.poNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{gr.po.supplier.legalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {gr.po.supplier.supplierNumber}
                  </div>
                </TableCell>
                <TableCell>{gr.receivedBy.name}</TableCell>
                <TableCell className="text-right">{gr._count.lines}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {gr.receivedAt
                    ? new Date(gr.receivedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
