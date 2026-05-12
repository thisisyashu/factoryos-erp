import Link from "next/link";
import { notFound } from "next/navigation";
import { getWarehouseWithStock } from "@/lib/services/inventory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function WarehouseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wh = await getWarehouseWithStock(id);
  if (!wh) notFound();

  // Aggregate stats: total locations, locations with stock, total balance rows.
  const totalLocations = wh.storageLocations.length;
  const locationsWithStock = wh.storageLocations.filter(
    (l) => l.inventoryBalances.some((b) => b.quantityOnHand.gt(0)),
  ).length;
  const totalBalanceRows = wh.storageLocations.reduce(
    (sum, l) => sum + l.inventoryBalances.length,
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link href="/inventory/warehouses" className="underline">
              All warehouses
            </Link>{" "}
            / {wh.code}
          </div>
          <h1 className="text-2xl font-semibold">{wh.name}</h1>
          {(wh.city || wh.country) && (
            <div className="text-sm text-muted-foreground">
              {[wh.addressLine1, wh.city, wh.country].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Storage locations" value={totalLocations} />
        <Stat label="With stock" value={locationsWithStock} />
        <Stat label="Material × location rows" value={totalBalanceRows} />
      </div>

      <div className="space-y-4">
        {wh.storageLocations.map((loc) => (
          <Card key={loc.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                <span className="font-mono">{loc.code}</span>
                {loc.description && (
                  <span className="text-sm text-muted-foreground ml-2 font-normal">
                    {loc.description}
                  </span>
                )}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {loc.inventoryBalances.length} material
                {loc.inventoryBalances.length === 1 ? "" : "s"}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {loc.inventoryBalances.length === 0 ? (
                <div className="px-6 py-4 text-sm text-muted-foreground">
                  Empty
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>UoM</TableHead>
                      <TableHead>Last movement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loc.inventoryBalances.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{b.material.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.material.materialNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {b.material.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {b.quantityOnHand.toString()}
                        </TableCell>
                        <TableCell>{b.unitOfMeasure.code}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {b.lastMovementAt
                            ? new Date(b.lastMovementAt).toLocaleString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
