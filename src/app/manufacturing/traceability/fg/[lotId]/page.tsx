import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { traceBackwardFromFgLot } from "@/lib/services/traceability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TraceFgPage({
  params,
}: {
  params: Promise<{ lotId: string }>;
}) {
  const { lotId } = await params;
  await requireCurrentUser();

  const result = await traceBackwardFromFgLot(lotId);
  if (!result) notFound();
  const { fg, grById, suppliers } = result;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/manufacturing/traceability" className="underline">
            Traceability
          </Link>{" "}
          / Backward trace
        </div>
        <h1 className="text-2xl font-semibold">
          Trace from FG lot{" "}
          <span className="font-mono text-xl text-muted-foreground">
            {fg.lotNumber}
          </span>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This finished-good lot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Material</div>
            <div className="font-medium">{fg.material.name}</div>
            <div className="text-xs text-muted-foreground">
              {fg.material.materialNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Quantity</div>
            <div className="font-medium tabular-nums">
              {fg.quantity.toString()} {fg.unitOfMeasure.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Storage location</div>
            <div className="font-medium font-mono">
              {fg.storageLocation.warehouse.code}/{fg.storageLocation.code}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Received</div>
            <div className="font-medium">
              {new Date(fg.receivedAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production order that built this lot</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="md:col-span-2">
            <div className="text-muted-foreground">Order #</div>
            <Link
              href={`/manufacturing/production-orders/${fg.productionOrder.id}`}
              className="font-medium font-mono underline"
            >
              {fg.productionOrder.orderNumber}
            </Link>
            <Badge variant="secondary" className="ml-2">
              {fg.productionOrder.status}
            </Badge>
            <div className="text-xs text-muted-foreground mt-1">
              created by {fg.productionOrder.createdBy.name}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Planned vs completed</div>
            <div className="font-medium tabular-nums">
              {fg.productionOrder.completedQuantity.toString()} /{" "}
              {fg.productionOrder.quantity.toString()}
            </div>
            {fg.productionOrder.scrappedQuantity.gt(0) && (
              <div className="text-xs text-destructive">
                +{fg.productionOrder.scrappedQuantity.toString()} scrapped
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Completed at</div>
            <div className="font-medium">
              {fg.productionOrder.completedAt
                ? new Date(fg.productionOrder.completedAt).toLocaleString()
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Supplier lots consumed ({fg.productionOrder.components.length} components)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fg.productionOrder.components.map((c) => {
            return (
              <div key={c.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">
                      L{c.lineNumber}
                    </span>{" "}
                    <span className="font-medium">{c.material.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      ({c.material.materialNumber})
                    </span>
                  </div>
                  <div className="text-sm tabular-nums">
                    issued {c.issuedQuantity.toString()} of planned{" "}
                    {c.plannedQuantity.toString()} {c.unitOfMeasure.code}
                  </div>
                </div>
                {c.lotConsumptions.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">
                    No tracked lot consumption — material came from legacy
                    untracked stock (chunks 3–5 demos used adjustments without
                    lots).
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm pl-3 border-l">
                    {c.lotConsumptions.map((cons) => {
                      const lot = cons.materialLot;
                      const sourceGr =
                        lot.sourceType === "GoodsReceipt"
                          ? grById.get(lot.sourceRefId)
                          : null;
                      return (
                        <li key={cons.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-xs">{lot.lotNumber}</span>
                          <span className="tabular-nums text-xs">
                            consumed {cons.quantity.toString()} {lot.unitOfMeasure.code}
                          </span>
                          {lot.supplier && (
                            <span className="text-muted-foreground">
                              from{" "}
                              <strong className="text-foreground">
                                {lot.supplier.legalName}
                              </strong>{" "}
                              ({lot.supplier.supplierNumber})
                            </span>
                          )}
                          {sourceGr && (
                            <span className="text-muted-foreground">
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
                            </span>
                          )}
                          <Link
                            href={`/manufacturing/traceability/material/${lot.id}`}
                            className="text-xs underline ml-auto"
                          >
                            forward trace →
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers who fed this batch ({suppliers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No supplier-tracked lots in this build.
            </div>
          ) : (
            <ul className="space-y-1 text-sm">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <strong>{s.legalName}</strong>{" "}
                  <span className="text-muted-foreground">({s.supplierNumber})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
