import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import { skipOperationFormAction } from "../../../../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ProductionOrderStatus,
  ProductionOperationStatus,
  UserRole,
} from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SkipOperationPage({
  params,
}: {
  params: Promise<{ id: string; opId: string }>;
}) {
  const { id, opId } = await params;
  const user = await requireCurrentUser();
  if (user.role !== UserRole.APPROVER && user.role !== UserRole.ADMIN) {
    redirect(`/manufacturing/production-orders/${id}`);
  }

  const op = await prisma.productionOrderOperation.findUnique({
    where: { id: opId },
    include: {
      productionOrder: { select: { id: true, orderNumber: true, status: true } },
      workCenter: { select: { code: true, name: true } },
    },
  });
  if (!op || op.productionOrderId !== id) notFound();

  if (
    op.productionOrder.status !== ProductionOrderStatus.RELEASED &&
    op.productionOrder.status !== ProductionOrderStatus.IN_PROGRESS
  ) {
    redirect(`/manufacturing/production-orders/${op.productionOrder.id}`);
  }
  if (op.status !== ProductionOperationStatus.PENDING) {
    redirect(`/manufacturing/production-orders/${op.productionOrder.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link
            href={`/manufacturing/production-orders/${op.productionOrder.id}`}
            className="underline"
          >
            {op.productionOrder.orderNumber}
          </Link>{" "}
          / Skip operation {op.sequence}
        </div>
        <h1 className="text-2xl font-semibold">
          Skip — Seq {op.sequence}: {op.description}
        </h1>
        <p className="text-sm text-muted-foreground">
          @ {op.workCenter.code} {op.workCenter.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reason for skipping</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={skipOperationFormAction} className="space-y-3">
            <input type="hidden" name="productionOrderId" value={op.productionOrderId} />
            <input type="hidden" name="operationId" value={op.id} />
            <Textarea
              name="reason"
              rows={3}
              required
              placeholder="e.g. Prototype build — test step not applicable. Engineering signoff."
            />
            <p className="text-xs text-muted-foreground">
              The reason will be stored on the operation and in the audit log. Skipped
              operations contribute zero actual hours to the order's variance.
            </p>
            <div className="flex justify-end gap-2">
              <Link
                href={`/manufacturing/production-orders/${op.productionOrder.id}`}
                className="text-sm text-muted-foreground hover:text-foreground self-center"
              >
                Cancel
              </Link>
              <Button type="submit" variant="destructive">
                Skip operation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
