import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/current-user";
import { getPrForConversion } from "@/lib/services/purchase-order";
import { CreatePoForm } from "./CreatePoForm";
import { ConvertPrToPoForm } from "./ConvertPrToPoForm";
import { MasterDataStatus, PurchaseRequisitionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ fromPr?: string }> };

export default async function NewPoPage({ searchParams }: Props) {
  await requireCurrentUser();
  const { fromPr } = await searchParams;

  // Active suppliers + UoMs are needed in both modes (suppliers always, UoMs only manual).
  const suppliers = await prisma.supplier.findMany({
    where: { status: MasterDataStatus.ACTIVE },
    select: {
      id: true,
      supplierNumber: true,
      legalName: true,
      currency: true,
      paymentTermsDays: true,
    },
    orderBy: { supplierNumber: "asc" },
  });

  if (fromPr) {
    const pr = await getPrForConversion(fromPr);
    if (!pr) notFound();
    if (pr.status !== PurchaseRequisitionStatus.APPROVED) {
      // Already converted, or not approved → bounce back to the PR.
      redirect(`/procurement/purchase-requisitions/${pr.id}`);
    }
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Convert PR → PO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Source: <span className="font-medium text-foreground">{pr.prNumber}</span>
            {pr.department && <> · {pr.department}</>}
          </p>
        </div>
        <ConvertPrToPoForm
          prId={pr.id}
          prNumber={pr.prNumber}
          prLines={pr.lines.map((l) => ({
            id: l.id,
            lineNumber: l.lineNumber,
            materialNumber: l.material.materialNumber,
            materialName: l.material.name,
            quantity: l.quantity.toString(),
            uomCode: l.unitOfMeasure.code,
            estimatedCost: l.estimatedCost ? l.estimatedCost.toString() : "",
          }))}
          suppliers={suppliers}
        />
      </div>
    );
  }

  // Manual mode
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
        <h1 className="text-2xl font-semibold">New Purchase Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a PO directly to a supplier. To convert from a PR, open the PR and
          click "Convert to PO".
        </p>
      </div>
      <CreatePoForm
        suppliers={suppliers}
        materials={materials.map((m) => ({
          id: m.id,
          materialNumber: m.materialNumber,
          name: m.name,
          unitOfMeasureId: m.unitOfMeasureId,
          unitOfMeasureCode: m.unitOfMeasure.code,
          standardCost: m.standardCost ? m.standardCost.toString() : null,
        }))}
        uoms={uoms}
      />
    </div>
  );
}
