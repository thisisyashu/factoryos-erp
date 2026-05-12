import Link from "next/link";
import { notFound } from "next/navigation";
import { getRouting } from "@/lib/services/routing";
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

export default async function RoutingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRouting(id);
  if (!r) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/manufacturing/routings" className="underline">
            All Routings
          </Link>{" "}
          / {r.routingNumber}
        </div>
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          {r.routingNumber}
          <Badge
            variant={
              r.status === "ACTIVE"
                ? "default"
                : r.status === "INACTIVE"
                  ? "destructive"
                  : "secondary"
            }
          >
            {r.status}
          </Badge>
          <span className="text-sm font-normal text-muted-foreground">v{r.version}</span>
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Parent material</div>
            <div className="font-medium">{r.parentMaterial.name}</div>
            <div className="text-xs text-muted-foreground">
              {r.parentMaterial.materialNumber}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Created by</div>
            <div className="font-medium">{r.createdBy.name}</div>
          </div>
          {r.description && (
            <div className="col-span-full">
              <div className="text-muted-foreground">Description</div>
              <div>{r.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations ({r.operations.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Seq</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Work center</TableHead>
                <TableHead className="text-right">Setup (h)</TableHead>
                <TableHead className="text-right">Run (h/unit)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.operations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell className="font-mono">{op.sequence}</TableCell>
                  <TableCell>{op.description}</TableCell>
                  <TableCell>
                    <div className="font-medium font-mono">{op.workCenter.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {op.workCenter.name}
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {op.workCenter.type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {op.setupTimeHours.toString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {op.runTimeHoursPerUnit.toString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {op.notes || "—"}
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
