import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import { getProductionOrder } from "@/lib/services/production-order";
import { ReceiveFgForm } from "./ReceiveFgForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReceiveFgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCurrentUser();

  const order = await getProductionOrder(id);
  if (!order) notFound();

  if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
    redirect(`/manufacturing/production-orders/${order.id}`);
  }

  const remaining = order.quantity
    .sub(order.completedQuantity)
    .sub(order.scrappedQuantity);
  if (remaining.lte(0)) {
    redirect(`/manufacturing/production-orders/${order.id}`);
  }

  const storageLocations = await prisma.storageLocation.findMany({
    where: { isActive: true },
    include: { warehouse: { select: { code: true, name: true } } },
    orderBy: [
      { warehouse: { code: "asc" } },
      { code: "asc" },
    ],
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link
            href={`/manufacturing/production-orders/${order.id}`}
            className="underline"
          >
            {order.orderNumber}
          </Link>{" "}
          / Receive finished goods
        </div>
        <h1 className="text-2xl font-semibold">
          Receive FG — {order.orderNumber}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Producing</div>
            <div className="font-medium">{order.parentMaterial.name}</div>
            <div className="text-xs text-muted-foreground">
              {order.parentMaterial.materialNumber}
              <Badge variant="secondary" className="ml-2 text-xs">
                {order.parentMaterial.type}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Planned</div>
            <div className="font-medium tabular-nums">
              {order.quantity.toString()} {order.unitOfMeasure.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Completed so far</div>
            <div className="font-medium tabular-nums">
              {order.completedQuantity.toString()} {order.unitOfMeasure.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Remaining</div>
            <div className="font-medium tabular-nums">
              {remaining.toString()} {order.unitOfMeasure.code}
            </div>
            {order.scrappedQuantity.gt(0) && (
              <div className="text-xs text-muted-foreground">
                ({order.scrappedQuantity.toString()} already scrapped)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ReceiveFgForm
        productionOrderId={order.id}
        orderNumber={order.orderNumber}
        uomCode={order.unitOfMeasure.code}
        remaining={remaining.toString()}
        storageLocations={storageLocations.map((s) => ({
          id: s.id,
          code: s.code,
          warehouseCode: s.warehouse.code,
          warehouseName: s.warehouse.name,
        }))}
      />
    </div>
  );
}
