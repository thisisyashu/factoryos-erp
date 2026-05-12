import Link from "next/link";
import { requireCurrentUser } from "@/lib/current-user";
import { listMaterialsWithActiveBom } from "@/lib/services/bom";
import { CreateProductionOrderForm } from "./CreateProductionOrderForm";
import { buttonVariants } from "@/components/ui/button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewProductionOrderPage() {
  await requireCurrentUser();
  const materials = await listMaterialsWithActiveBom();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">New Production Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a material that has an ACTIVE BOM and a quantity. The system will
          run BOM explosion and snapshot the routing into your order.
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="border rounded-md p-8 text-center text-muted-foreground">
          No materials have an ACTIVE BOM. Create a BOM first.
          <div className="mt-3">
            <Link
              href="/manufacturing/boms"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View BOMs
            </Link>
          </div>
        </div>
      ) : (
        <CreateProductionOrderForm
          materials={materials.map((m) => ({
            id: m.id,
            materialNumber: m.materialNumber,
            name: m.name,
            type: m.type,
            uomCode: m.unitOfMeasure.code,
          }))}
        />
      )}
    </div>
  );
}
