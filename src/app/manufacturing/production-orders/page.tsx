import Link from "next/link";
import { listProductionOrders } from "@/lib/services/production-order";
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
import { ProductionOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ value?: ProductionOrderStatus; label: string }> = [
  { value: undefined, label: "All" },
  { value: ProductionOrderStatus.DRAFT, label: "Draft" },
  { value: ProductionOrderStatus.RELEASED, label: "Released" },
  { value: ProductionOrderStatus.IN_PROGRESS, label: "In progress" },
  { value: ProductionOrderStatus.COMPLETED, label: "Completed" },
  { value: ProductionOrderStatus.CLOSED, label: "Closed" },
  { value: ProductionOrderStatus.CANCELLED, label: "Cancelled" },
];

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

type Props = { searchParams: Promise<{ status?: string }> };

export default async function ProductionOrderListPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const filter =
    status && status in ProductionOrderStatus
      ? (status as ProductionOrderStatus)
      : undefined;
  const orders = await listProductionOrders({ status: filter });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Production Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Instances of "make N of material X" — drives material consumption and FG receipts.
          </p>
        </div>
        <Link
          href="/manufacturing/production-orders/new"
          className={buttonVariants()}
        >
          + Create order
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
              <TableHead>Order #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parent material</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>BOM</TableHead>
              <TableHead>Routing</TableHead>
              <TableHead className="text-right">Components</TableHead>
              <TableHead className="text-right">Operations</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No production orders yet.{" "}
                  <Link
                    href="/manufacturing/production-orders/new"
                    className="underline"
                  >
                    Create one
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/manufacturing/production-orders/${o.id}`}
                    className="font-medium underline"
                  >
                    {o.orderNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[o.status]}>{o.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{o.parentMaterial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.parentMaterial.materialNumber}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.quantity.toString()} {o.unitOfMeasure.code}
                </TableCell>
                <TableCell className="text-sm">
                  {o.bom.bomNumber}{" "}
                  <span className="text-xs text-muted-foreground">v{o.bom.version}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {o.routing
                    ? `${o.routing.routingNumber} v${o.routing.version}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">{o._count.components}</TableCell>
                <TableCell className="text-right">{o._count.operations}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(o.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
