import Link from "next/link";
import { listBoms } from "@/lib/services/bom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BillOfMaterialsStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  BillOfMaterialsStatus,
  "default" | "secondary" | "destructive"
> = { ACTIVE: "default", DRAFT: "secondary", INACTIVE: "destructive" };

export default async function BomListPage() {
  const boms = await listBoms();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bills of Materials</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each BOM defines what goes into one unit of a parent material. Only ACTIVE
          BOMs are eligible to drive production orders.
        </p>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BOM #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Parent material</TableHead>
              <TableHead className="text-right">Version</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">POs using</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {boms.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No BOMs yet.
                </TableCell>
              </TableRow>
            )}
            {boms.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link
                    href={`/manufacturing/boms/${b.id}`}
                    className="font-medium underline"
                  >
                    {b.bomNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[b.status]}>{b.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{b.parentMaterial.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.parentMaterial.materialNumber}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {b.parentMaterial.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">v{b.version}</TableCell>
                <TableCell className="text-right">{b._count.lines}</TableCell>
                <TableCell className="text-right">{b._count.productionOrders}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(b.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
