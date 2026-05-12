import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InventoryLanding() {
  const [balanceCount, ledgerCount, warehouseCount, locationCount] =
    await Promise.all([
      prisma.inventoryBalance.count(),
      prisma.inventoryLedger.count(),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.storageLocation.count({ where: { isActive: true } }),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stock balances by location, full movement history, and warehouse views.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Balance rows" value={balanceCount} />
        <Stat label="Ledger movements" value={ledgerCount} />
        <Stat label="Warehouses" value={warehouseCount} />
        <Stat label="Storage locations" value={locationCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard
          href="/inventory/stock"
          title="Stock by material"
          description="Current quantity on hand for each (material × storage location) pair. The denormalized cache, fast for daily use."
        />
        <DashboardCard
          href="/inventory/ledger"
          title="Inventory ledger"
          description="Every stock movement ever posted, in time order. The source of truth — balances are derived from this."
        />
        <DashboardCard
          href="/inventory/warehouses"
          title="Warehouses"
          description="Drill into any warehouse to see what's at each storage location."
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:bg-muted/40 transition h-full">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {description}
        </CardContent>
      </Card>
    </Link>
  );
}
