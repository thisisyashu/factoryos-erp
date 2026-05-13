import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import { ConfirmOperationForm } from "./ConfirmOperationForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionOrderStatus, ProductionOperationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConfirmOperationPage({
  params,
}: {
  params: Promise<{ id: string; opId: string }>;
}) {
  const { id, opId } = await params;
  await requireCurrentUser();

  const op = await prisma.productionOrderOperation.findUnique({
    where: { id: opId },
    include: {
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          quantity: true,
          parentMaterial: { select: { materialNumber: true, name: true } },
          unitOfMeasure: { select: { code: true } },
        },
      },
      workCenter: {
        select: { id: true, code: true, name: true, type: true },
      },
    },
  });
  if (!op || op.productionOrderId !== id) notFound();

  // Bounce if order isn't in a confirmable state
  if (
    op.productionOrder.status !== ProductionOrderStatus.RELEASED &&
    op.productionOrder.status !== ProductionOrderStatus.IN_PROGRESS
  ) {
    redirect(`/manufacturing/production-orders/${op.productionOrder.id}`);
  }
  // Bounce if operation isn't actually pending
  if (
    op.status !== ProductionOperationStatus.PENDING &&
    op.status !== ProductionOperationStatus.IN_PROGRESS
  ) {
    redirect(`/manufacturing/production-orders/${op.productionOrder.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link
            href={`/manufacturing/production-orders/${op.productionOrder.id}`}
            className="underline"
          >
            {op.productionOrder.orderNumber}
          </Link>{" "}
          / Confirm operation {op.sequence}
        </div>
        <h1 className="text-2xl font-semibold">
          Confirm — Seq {op.sequence}: {op.description}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operation context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Order</div>
            <div className="font-medium">{op.productionOrder.orderNumber}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="outline">{op.productionOrder.status}</Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Producing</div>
            <div className="font-medium">
              {op.productionOrder.quantity.toString()}{" "}
              {op.productionOrder.unitOfMeasure.code}
            </div>
            <div className="text-xs text-muted-foreground">
              {op.productionOrder.parentMaterial.materialNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Work center</div>
            <div className="font-medium font-mono">{op.workCenter.code}</div>
            <div className="text-xs text-muted-foreground">{op.workCenter.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Planned</div>
            <div className="font-medium tabular-nums">
              setup {op.plannedSetupHours.toString()}h
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              run {op.plannedRunHours.toString()}h
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmOperationForm
        productionOrderId={op.productionOrderId}
        operationId={op.id}
        plannedSetupHours={op.plannedSetupHours.toString()}
        plannedRunHours={op.plannedRunHours.toString()}
      />
    </div>
  );
}
