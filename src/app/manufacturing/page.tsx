import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionOrderStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ManufacturingLanding() {
  const [poCount, draftCount, releasedCount, inProgressCount, bomCount, routingCount, wcCount] =
    await Promise.all([
      prisma.productionOrder.count(),
      prisma.productionOrder.count({ where: { status: ProductionOrderStatus.DRAFT } }),
      prisma.productionOrder.count({ where: { status: ProductionOrderStatus.RELEASED } }),
      prisma.productionOrder.count({ where: { status: ProductionOrderStatus.IN_PROGRESS } }),
      prisma.billOfMaterials.count({ where: { status: "ACTIVE" } }),
      prisma.routing.count({ where: { status: "ACTIVE" } }),
      prisma.workCenter.count({ where: { isActive: true } }),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Manufacturing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Production orders, BOMs, routings, and work centers — turning materials into finished goods.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total POs" value={poCount} />
        <Stat label="Draft" value={draftCount} />
        <Stat label="Released" value={releasedCount} />
        <Stat label="In progress" value={inProgressCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashCard
          href="/manufacturing/production-orders"
          title="Production Orders"
          description={`${poCount} order${poCount === 1 ? "" : "s"}. Create, release, run, and complete.`}
        />
        <DashCard
          href="/manufacturing/boms"
          title="Bills of Materials"
          description={`${bomCount} active BOM${bomCount === 1 ? "" : "s"}. The recipes that drive production.`}
        />
        <DashCard
          href="/manufacturing/routings"
          title="Routings"
          description={`${routingCount} active routing${routingCount === 1 ? "" : "s"}. The operation sequence per material.`}
        />
        <DashCard
          href="/manufacturing/work-centers"
          title="Work Centers"
          description={`${wcCount} active work center${wcCount === 1 ? "" : "s"}. Where the work happens.`}
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

function DashCard({
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
        <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
      </Card>
    </Link>
  );
}
