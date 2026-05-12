import Link from "next/link";
import { listWarehousesWithStats } from "@/lib/services/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const warehouses = await listWarehousesWithStats();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click any warehouse to drill into stock at each storage location.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">
            No active warehouses.
          </div>
        )}
        {warehouses.map((w) => (
          <Link key={w.id} href={`/inventory/warehouses/${w.id}`} className="block">
            <Card className="hover:bg-muted/40 transition h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{w.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {w.code}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {w.description && (
                  <div className="text-muted-foreground">{w.description}</div>
                )}
                {(w.city || w.country) && (
                  <div className="text-xs text-muted-foreground">
                    {[w.city, w.country].filter(Boolean).join(", ")}
                  </div>
                )}
                <div className="pt-2 text-muted-foreground text-xs">
                  {w._count.storageLocations} storage location
                  {w._count.storageLocations === 1 ? "" : "s"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
