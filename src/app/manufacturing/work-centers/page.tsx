import Link from "next/link";
import { listWorkCenters } from "@/lib/services/work-center";
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

export default async function WorkCentersPage() {
  const wcs = await listWorkCenters();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Work Centers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stations where production operations happen. Each operation in a routing
          is assigned to one work center.
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Capacity / day</TableHead>
              <TableHead className="text-right">Routings using</TableHead>
              <TableHead className="text-right">PO operations</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wcs.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <Link
                    href={`/manufacturing/work-centers/${w.id}`}
                    className="font-mono font-medium underline"
                  >
                    {w.code}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{w.name}</div>
                  {w.description && (
                    <div className="text-xs text-muted-foreground">
                      {w.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{w.type}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w.capacityHoursPerDay
                    ? `${w.capacityHoursPerDay.toString()} h`
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w._count.routingOperations}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {w._count.productionOrderOperations}
                </TableCell>
                <TableCell>
                  <Badge variant={w.isActive ? "default" : "secondary"}>
                    {w.isActive ? "ACTIVE" : "INACTIVE"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
