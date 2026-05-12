import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import {
  listReceivablePos,
  getPoForReceiving,
} from "@/lib/services/goods-receipt";
import { ReceiveAgainstPoForm } from "./ReceiveAgainstPoForm";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PurchaseOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PO_STATUS_BADGE: Record<
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

type Props = { searchParams: Promise<{ poId?: string }> };

export default async function NewGrPage({ searchParams }: Props) {
  await requireCurrentUser();
  const { poId } = await searchParams;

  // No PO chosen yet → show picker.
  if (!poId) {
    const pos = await listReceivablePos();
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Receive against PO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a Purchase Order in APPROVED, SENT, or PARTIALLY_RECEIVED status.
          </p>
        </div>
        {pos.length === 0 ? (
          <div className="border rounded-md p-8 text-center text-muted-foreground">
            No POs are currently available for receipt. Approve and send a PO first.
            <div className="mt-3">
              <Link
                href="/procurement/purchase-orders"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                View Purchase Orders
              </Link>
            </div>
          </div>
        ) : (
          <ul className="border rounded-md divide-y">
            {pos.map((po) => (
              <li
                key={po.id}
                className="flex items-center justify-between p-4 hover:bg-muted/40 transition"
              >
                <div>
                  <div className="font-medium">{po.poNumber}</div>
                  <div className="text-sm text-muted-foreground">
                    {po.supplier.legalName} · {po._count.lines} line
                    {po._count.lines === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={PO_STATUS_BADGE[po.status]}>{po.status}</Badge>
                  <Link
                    href={`/procurement/goods-receipts/new?poId=${po.id}`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Receive
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // PO chosen → show receive form.
  const po = await getPoForReceiving(poId);
  if (!po) notFound();

  if (
    po.status !== PurchaseOrderStatus.APPROVED &&
    po.status !== PurchaseOrderStatus.SENT &&
    po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
  ) {
    // Wrong status — bounce back to PO.
    redirect(`/procurement/purchase-orders/${po.id}`);
  }

  // Active storage locations (across all warehouses)
  const storageLocations = await prisma.storageLocation.findMany({
    where: { isActive: true },
    include: { warehouse: { select: { code: true, name: true } } },
    orderBy: [
      { warehouse: { code: "asc" } },
      { code: "asc" },
    ],
  });

  // Compute remaining qty per line; skip lines with nothing left.
  const receivableLines = po.lines
    .map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      materialNumber: l.material.materialNumber,
      materialName: l.material.name,
      orderedQty: l.quantity.toString(),
      alreadyReceived: l.quantityReceived.toString(),
      remaining: l.quantity.sub(l.quantityReceived).toString(),
      uomId: l.unitOfMeasure.id,
      uomCode: l.unitOfMeasure.code,
    }))
    .filter((l) => Number(l.remaining) > 0);

  if (receivableLines.length === 0) {
    redirect(`/procurement/purchase-orders/${po.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Receive against {po.poNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {po.supplier.legalName} · {po.supplier.supplierNumber}
        </p>
      </div>
      <ReceiveAgainstPoForm
        poId={po.id}
        poNumber={po.poNumber}
        lines={receivableLines}
        storageLocations={storageLocations.map((s) => ({
          id: s.id,
          code: s.code,
          warehouseCode: s.warehouse.code,
          warehouseName: s.warehouse.name,
          description: s.description,
        }))}
      />
    </div>
  );
}
