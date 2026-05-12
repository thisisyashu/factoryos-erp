import Link from "next/link";
import {
  listInventoryBalances,
  getInventoryFilterOptions,
} from "@/lib/services/inventory";
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

type Props = {
  searchParams: Promise<{
    material?: string;
    warehouse?: string;
  }>;
};

export default async function StockPage({ searchParams }: Props) {
  const params = await searchParams;
  const [balances, options] = await Promise.all([
    listInventoryBalances({
      materialId: params.material || undefined,
      warehouseId: params.warehouse || undefined,
    }),
    getInventoryFilterOptions(),
  ]);

  // Total quantity per material (across selected scope) for a quick eyeball.
  const totalsByMaterial = new Map<string, { qty: number; uom: string; name: string; number: string }>();
  for (const b of balances) {
    const key = b.materialId;
    const existing = totalsByMaterial.get(key);
    const qty = Number(b.quantityOnHand.toString());
    if (existing) {
      existing.qty += qty;
    } else {
      totalsByMaterial.set(key, {
        qty,
        uom: b.unitOfMeasure.code,
        name: b.material.name,
        number: b.material.materialNumber,
      });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock by material</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quantity on hand for each (material × storage location). Filter to drill in.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="material" className="text-xs text-muted-foreground uppercase">
            Material
          </label>
          <select
            id="material"
            name="material"
            defaultValue={params.material ?? ""}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All materials</option>
            {options.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.materialNumber} — {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="warehouse" className="text-xs text-muted-foreground uppercase">
            Warehouse
          </label>
          <select
            id="warehouse"
            name="warehouse"
            defaultValue={params.warehouse ?? ""}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All warehouses</option>
            {options.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Apply
        </button>
        {(params.material || params.warehouse) && (
          <Link
            href="/inventory/stock"
            className="h-8 px-3 rounded-md border text-sm flex items-center"
          >
            Clear
          </Link>
        )}
      </form>

      {totalsByMaterial.size > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...totalsByMaterial.values()].slice(0, 6).map((t) => (
            <div key={t.number} className="border rounded-md p-4">
              <div className="text-xs text-muted-foreground">{t.number}</div>
              <div className="font-medium truncate">{t.name}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {t.qty.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {t.uom}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Last movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No inventory balances. Post a goods receipt to see stock here.
                </TableCell>
              </TableRow>
            )}
            {balances.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.material.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.material.materialNumber}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {b.material.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/inventory/warehouses/${b.storageLocation.warehouse.id}`}
                    className="text-sm underline"
                  >
                    {b.storageLocation.warehouse.code}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{b.storageLocation.code}</TableCell>
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
      </div>
    </div>
  );
}
