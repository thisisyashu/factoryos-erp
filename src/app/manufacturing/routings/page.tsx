import Link from "next/link";
import { listRoutings } from "@/lib/services/routing";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoutingStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<RoutingStatus, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  INACTIVE: "destructive",
};

export default async function RoutingListPage() {
  const routings = await listRoutings();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Routings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each routing defines the operation sequence to produce a material — which
          work centers, in what order, with planned setup and run times.
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Routing #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parent material</TableHead>
              <TableHead className="text-right">Version</TableHead>
              <TableHead className="text-right">Operations</TableHead>
              <TableHead className="text-right">POs using</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No routings yet.
                </TableCell>
              </TableRow>
            )}
            {routings.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/manufacturing/routings/${r.id}`}
                    className="font-medium underline"
                  >
                    {r.routingNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.parentMaterial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.parentMaterial.materialNumber}
                  </div>
                </TableCell>
                <TableCell className="text-right">v{r.version}</TableCell>
                <TableCell className="text-right">{r._count.operations}</TableCell>
                <TableCell className="text-right">{r._count.productionOrders}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(r.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
