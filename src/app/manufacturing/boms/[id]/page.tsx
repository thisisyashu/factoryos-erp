import Link from "next/link";
import { notFound } from "next/navigation";
import { getBom } from "@/lib/services/bom";
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

export default async function BomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bom = await getBom(id);
  if (!bom) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/manufacturing/boms" className="underline">
            All BOMs
          </Link>{" "}
          / {bom.bomNumber}
        </div>
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          {bom.bomNumber}
          <Badge
            variant={
              bom.status === "ACTIVE"
                ? "default"
                : bom.status === "INACTIVE"
                  ? "destructive"
                  : "secondary"
            }
          >
            {bom.status}
          </Badge>
          <span className="text-sm font-normal text-muted-foreground">v{bom.version}</span>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Parent material</div>
            <div className="font-medium">{bom.parentMaterial.name}</div>
            <div className="text-xs text-muted-foreground">
              {bom.parentMaterial.materialNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Type</div>
            <Badge variant="secondary">{bom.parentMaterial.type}</Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Base qty</div>
            <div className="font-medium">{bom.baseQuantity.toString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Created by</div>
            <div className="font-medium">{bom.createdBy.name}</div>
          </div>
          {bom.description && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Description</div>
              <div>{bom.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Components ({bom.lines.length})
            {bom._count.productionOrders > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-3">
                Used by {bom._count.productionOrders} production order
                {bom._count.productionOrders === 1 ? "" : "s"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>UoM</TableHead>
                <TableHead className="text-right">Scrap %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.lineNumber}</TableCell>
                  <TableCell>
                    <div className="font-medium">{line.componentMaterial.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.componentMaterial.materialNumber}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.quantity.toString()}
                  </TableCell>
                  <TableCell>{line.unitOfMeasure.code}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.scrapPercent.toString()}%
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        line.componentMaterial.status === "ACTIVE"
                          ? "default"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {line.componentMaterial.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.notes || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
