import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { traceForwardFromMaterialLot } from "@/lib/services/traceability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TraceMaterialPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  const { lotId } = await params;
  await requireCurrentUser();

  const result = await traceForwardFromMaterialLot(lotId);
  if (!result) notFound();
  const { lot, sourceGr } = result;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/manufacturing/traceability" className="underline">
            Traceability
          </Link>{" "}
          / Forward trace
        </div>
        <h1 className="text-2xl font-semibold">
          Trace from material lot{" "}
          <span className="font-mono text-xl text-muted-foreground">
            {lot.lotNumber}
          </span>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This material lot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Material</div>
            <div className="font-medium">{lot.material.name}</div>
            <div className="text-xs text-muted-foreground">
              {lot.material.materialNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Received</div>
            <div className="font-medium tabular-nums">
              {lot.quantityReceived.toString()} {lot.unitOfMeasure.code}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {lot.quantityRemaining.toString()} remaining
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Storage</div>
            <div className="font-medium font-mono">
              {lot.storageLocation.warehouse.code}/{lot.storageLocation.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Source</div>
            {lot.supplier ? (
              <>
                <div className="font-medium">{lot.supplier.legalName}</div>
                <div className="text-xs text-muted-foreground">
                  {lot.supplier.supplierNumber}
                </div>
              </>
            ) : (
              <Badge variant="secondary">{lot.sourceType}</Badge>
            )}
            {sourceGr && (
              <div className="text-xs mt-1">
                via{" "}
                <Link
                  href={`/procurement/goods-receipts/${sourceGr.id}`}
                  className="underline"
                >
                  {sourceGr.grNumber}
                </Link>{" "}
                /{" "}
                <Link
                  href={`/procurement/purchase-orders/${sourceGr.po.id}`}
                  className="underline"
                >
                  {sourceGr.po.poNumber}
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Where this lot was used ({lot.consumptions.length} consumption
            {lot.consumptions.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lot.consumptions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              This lot hasn't been consumed yet.
            </div>
          ) : (
            lot.consumptions.map((cons) => {
              const comp = cons.productionOrderComponent;
              const order = comp.productionOrder;
              return (
                <div key={cons.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <Link
                        href={`/manufacturing/production-orders/${order.id}`}
                        className="font-mono font-medium underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {order.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground ml-2">
                        producing {order.parentMaterial.name}
                      </span>
                    </div>
                    <div className="text-sm tabular-nums">
                      consumed{" "}
                      <strong>{cons.quantity.toString()}</strong>{" "}
                      {comp.unitOfMeasure.code} on{" "}
                      {new Date(cons.postedAt).toLocaleDateString()}{" "}
                      <span className="text-xs text-muted-foreground">
                        by {cons.postedBy.name}
                      </span>
                    </div>
                  </div>
                  {order.finishedGoodLots.length > 0 && (
                    <div className="text-sm">
                      <div className="text-xs text-muted-foreground uppercase mb-1">
                        FG lots produced from this order
                      </div>
                      <ul className="space-y-1 pl-3 border-l">
                        {order.finishedGoodLots.map((fg) => (
                          <li key={fg.id} className="flex items-center gap-3">
                            <span className="font-mono text-xs">
                              {fg.lotNumber}
                            </span>
                            <span className="tabular-nums text-xs">
                              {fg.quantity.toString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              @ {fg.storageLocation.warehouse.code}/
                              {fg.storageLocation.code}
                            </span>
                            <Link
                              href={`/manufacturing/traceability/fg/${fg.id}`}
                              className="text-xs underline ml-auto"
                            >
                              backward trace →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
