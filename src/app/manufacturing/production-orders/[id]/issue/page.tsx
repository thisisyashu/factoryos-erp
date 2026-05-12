import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { getOrderComponentSourceBalances } from "@/lib/services/production-order";
import { IssueMaterialsForm } from "./IssueMaterialsForm";
import { ProductionOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IssueMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCurrentUser();

  let data;
  try {
    data = await getOrderComponentSourceBalances(id);
  } catch {
    notFound();
  }
  const { order, componentsWithStock } = data;

  if (
    order.status !== ProductionOrderStatus.RELEASED &&
    order.status !== ProductionOrderStatus.IN_PROGRESS
  ) {
    redirect(`/manufacturing/production-orders/${order.id}`);
  }

  // Filter components that still need issuance (remaining > 0)
  const issuableComponents = componentsWithStock.filter((cw) => {
    const remaining = cw.component.plannedQuantity.sub(cw.component.issuedQuantity);
    return remaining.gt(0);
  });

  if (issuableComponents.length === 0) {
    redirect(`/manufacturing/production-orders/${order.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Issue materials — {order.orderNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pull components from inventory locations into this production order.
          Each issue posts a negative ledger entry and decrements stock.
        </p>
      </div>
      <IssueMaterialsForm
        orderId={order.id}
        orderNumber={order.orderNumber}
        rows={issuableComponents.map((cw) => ({
          componentId: cw.component.id,
          lineNumber: cw.component.lineNumber,
          materialNumber: cw.component.material.materialNumber,
          materialName: cw.component.material.name,
          uomCode: cw.component.unitOfMeasure.code,
          plannedQuantity: cw.component.plannedQuantity.toString(),
          issuedQuantity: cw.component.issuedQuantity.toString(),
          remaining: cw.component.plannedQuantity
            .sub(cw.component.issuedQuantity)
            .toString(),
          balances: cw.balances.map((b) => ({
            storageLocationId: b.storageLocationId,
            warehouseCode: b.storageLocation.warehouse.code,
            warehouseName: b.storageLocation.warehouse.name,
            locationCode: b.storageLocation.code,
            available: b.quantityOnHand.toString(),
          })),
        }))}
      />
    </div>
  );
}
