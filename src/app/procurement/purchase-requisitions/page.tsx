import Link from "next/link";
import { listPurchaseRequisitions } from "@/lib/services/purchase-requisition";
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
import { PurchaseRequisitionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ value?: PurchaseRequisitionStatus; label: string }> = [
  { value: undefined, label: "All" },
  { value: PurchaseRequisitionStatus.DRAFT, label: "Draft" },
  { value: PurchaseRequisitionStatus.SUBMITTED, label: "Submitted" },
  { value: PurchaseRequisitionStatus.APPROVED, label: "Approved" },
  { value: PurchaseRequisitionStatus.REJECTED, label: "Rejected" },
  { value: PurchaseRequisitionStatus.CONVERTED_TO_PO, label: "Converted" },
];

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

type Props = { searchParams: Promise<{ status?: string }> };

export default async function PrListPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter =
    status && status in PurchaseRequisitionStatus
      ? (status as PurchaseRequisitionStatus)
      : undefined;
  const prs = await listPurchaseRequisitions({ status: filter });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Requisitions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal requests to procure materials.
          </p>
        </div>
        <Link
          href="/procurement/purchase-requisitions/new"
          className={buttonVariants()}
        >
          + Create PR
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
              <TableHead>PR Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Needed by</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No purchase requisitions yet.{" "}
                  <Link
                    href="/procurement/purchase-requisitions/new"
                    className="underline"
                  >
                    Create one
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {prs.map((pr) => (
              <TableRow key={pr.id}>
                <TableCell>
                  <Link
                    href={`/procurement/purchase-requisitions/${pr.id}`}
                    className="font-medium underline"
                  >
                    {pr.prNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[pr.status]}>{pr.status}</Badge>
                </TableCell>
                <TableCell>{pr.requestedBy.name}</TableCell>
                <TableCell>{pr.department || "—"}</TableCell>
                <TableCell>
                  {pr.neededBy ? new Date(pr.neededBy).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">{pr._count.lines}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(pr.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
