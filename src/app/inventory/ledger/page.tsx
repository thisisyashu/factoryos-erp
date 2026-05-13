import Link from "next/link";
import {
  listInventoryLedger,
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
import { InventoryMovementType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOVEMENT_TYPES = Object.values(InventoryMovementType);

const MOVEMENT_BADGE: Record<
  InventoryMovementType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  GOODS_RECEIPT: "default",
  PRODUCTION_RECEIPT: "default",
  MATERIAL_ISSUE: "outline",
  STOCK_TRANSFER: "secondary",
  ADJUSTMENT: "secondary",
  SHIPMENT: "outline",
};

type Props = {
  searchParams: Promise<{
    material?: string;
    warehouse?: string;
    movement?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
};

function buildQuery(
  base: Record<string, string | undefined>,
  override: Partial<Record<string, string | undefined>>,
): string {
  const merged = { ...base, ...override };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function refLink(refType: string, refId: string): string | null {
  switch (refType) {
    case "GoodsReceipt":
      return `/procurement/goods-receipts/${refId}`;
    case "ProductionOrder":
      return `/manufacturing/production-orders/${refId}`;
    default:
      return null;
  }
}

export default async function LedgerPage({ searchParams }: Props) {
  const params = await searchParams;
  const movementType =
    params.movement && MOVEMENT_TYPES.includes(params.movement as InventoryMovementType)
      ? (params.movement as InventoryMovementType)
      : undefined;
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;

  const [{ entries, nextCursor }, options] = await Promise.all([
    listInventoryLedger({
      materialId: params.material || undefined,
      warehouseId: params.warehouse || undefined,
      movementType,
      dateFrom,
      dateTo,
      cursor: params.cursor || undefined,
      limit: 50,
    }),
    getInventoryFilterOptions(),
  ]);

  const baseParams = {
    material: params.material,
    warehouse: params.warehouse,
    movement: params.movement,
    from: params.from,
    to: params.to,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory ledger</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable record of every stock movement. Source of truth for inventory balance.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <FilterField label="Material" name="material" defaultValue={params.material}>
          <option value="">All materials</option>
          {options.materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.materialNumber} — {m.name}
            </option>
          ))}
        </FilterField>
        <FilterField label="Warehouse" name="warehouse" defaultValue={params.warehouse}>
          <option value="">All warehouses</option>
          {options.warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code}
            </option>
          ))}
        </FilterField>
        <FilterField label="Movement" name="movement" defaultValue={params.movement}>
          <option value="">All types</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterField>
        <DateField label="From" name="from" defaultValue={params.from} />
        <DateField label="To" name="to" defaultValue={params.to} />
        <button
          type="submit"
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Apply
        </button>
        {(params.material ||
          params.warehouse ||
          params.movement ||
          params.from ||
          params.to) && (
          <Link
            href="/inventory/ledger"
            className="h-8 px-3 rounded-md border text-sm flex items-center"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Posted at</TableHead>
              <TableHead>Movement</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Posted by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No ledger entries match these filters.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => {
              const ref = refLink(entry.referenceType, entry.referenceId);
              const qtyStr = entry.quantity.toString();
              const isPositive = entry.quantity.gte(0);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(entry.postedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={MOVEMENT_BADGE[entry.movementType]}>
                      {entry.movementType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{entry.material.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.material.materialNumber}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      isPositive ? "" : "text-destructive"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {qtyStr}
                  </TableCell>
                  <TableCell>{entry.unitOfMeasure.code}</TableCell>
                  <TableCell className="text-sm">
                    {entry.storageLocation.warehouse.code}/
                    {entry.storageLocation.code}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ref ? (
                      <Link href={ref} className="underline">
                        {entry.referenceType}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{entry.referenceType}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.postedBy.name}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Link
            href={`/inventory/ledger${buildQuery(baseParams, { cursor: nextCursor })}`}
            className="h-8 px-3 rounded-md border text-sm flex items-center"
          >
            Next page →
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="text-xs text-muted-foreground uppercase block"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={name}
        className="text-xs text-muted-foreground uppercase block"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="date"
        defaultValue={defaultValue ?? ""}
        className="h-8 rounded-md border bg-background px-2 text-sm"
      />
    </div>
  );
}
