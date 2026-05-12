import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import { CreatePrForm } from "./CreatePrForm";
import { MasterDataStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewPrPage() {
  const user = await requireCurrentUser();
  const [materials, uoms] = await Promise.all([
    prisma.material.findMany({
      where: { status: MasterDataStatus.ACTIVE },
      select: {
        id: true,
        materialNumber: true,
        name: true,
        unitOfMeasureId: true,
        unitOfMeasure: { select: { code: true } },
        standardCost: true,
      },
      orderBy: { materialNumber: "asc" },
    }),
    prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New Purchase Requisition</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Materials must already be ACTIVE in master data to appear in the dropdown.
        </p>
      </div>
      <CreatePrForm
        materials={materials.map((m) => ({
          id: m.id,
          materialNumber: m.materialNumber,
          name: m.name,
          unitOfMeasureId: m.unitOfMeasureId,
          unitOfMeasureCode: m.unitOfMeasure.code,
          standardCost: m.standardCost ? m.standardCost.toString() : null,
        }))}
        uoms={uoms}
        defaultDepartment={user.department || ""}
      />
    </div>
  );
}
