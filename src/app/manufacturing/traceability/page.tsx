import Link from "next/link";
import { requireCurrentUser } from "@/lib/current-user";
import {
  listFinishedGoodLots,
  listMaterialLots,
} from "@/lib/services/traceability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TraceabilityLanding() {
  await requireCurrentUser();
  const [fgLots, materialLots] = await Promise.all([
    listFinishedGoodLots({ limit: 25 }),
    listMaterialLots({ limit: 25 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Traceability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a finished-good lot to trace it back to the supplier lots it was
          built from. Pick a material lot to trace it forward to the finished
          goods that contain it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Finished-good lots ({fgLots.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fgLots.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground text-center">
              No FG lots yet. Receive finished goods on a production order to
              create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>From order</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fgLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{lot.material.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lot.material.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lot.quantity.toString()} {lot.unitOfMeasure.code}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/manufacturing/production-orders/${lot.productionOrder.id}`}
                        className="font-medium underline"
                      >
                        {lot.productionOrder.orderNumber}
                      </Link>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {lot.productionOrder.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.storageLocation.warehouse.code}/{lot.storageLocation.code}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(lot.receivedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/manufacturing/traceability/fg/${lot.id}`}
                        className="text-sm underline hover:text-foreground"
                      >
                        Trace back →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Material lots ({materialLots.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {materialLots.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground text-center">
              No material lots yet. Goods receipts (Phase 2 → /procurement) will
              create them.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot #</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Used by</TableHead>
                  <TableHead className="text-right">Trace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{lot.material.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lot.material.materialNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lot.quantityReceived.toString()} {lot.unitOfMeasure.code}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lot.quantityRemaining.toString()}
                    </TableCell>
                    <TableCell>
                      {lot.supplier ? (
                        <>
                          <div className="text-sm">{lot.supplier.legalName}</div>
                          <div className="text-xs text-muted-foreground">
                            {lot.supplier.supplierNumber}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {lot.sourceType}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.storageLocation.warehouse.code}/{lot.storageLocation.code}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {lot._count.consumptions}
                    </TableCell>
                    <TableCell className="text-right">
                      {lot._count.consumptions > 0 ? (
                        <Link
                          href={`/manufacturing/traceability/material/${lot.id}`}
                          className="text-sm underline hover:text-foreground"
                        >
                          Trace forward →
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">unused</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
