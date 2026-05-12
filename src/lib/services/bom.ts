import { prisma } from "@/lib/db";
import { type Prisma, BillOfMaterialsStatus } from "@prisma/client";

const bomListInclude = {
  parentMaterial: { select: { id: true, materialNumber: true, name: true, type: true } },
  createdBy: { select: { name: true } },
  _count: { select: { lines: true, productionOrders: true } },
} satisfies Prisma.BillOfMaterialsInclude;

export type BomListItem = Prisma.BillOfMaterialsGetPayload<{ include: typeof bomListInclude }>;

const bomDetailInclude = {
  parentMaterial: {
    select: { id: true, materialNumber: true, name: true, type: true, status: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      componentMaterial: {
        select: { id: true, materialNumber: true, name: true, type: true, status: true },
      },
      unitOfMeasure: { select: { code: true, description: true } },
    },
    orderBy: { lineNumber: "asc" as const },
  },
  _count: { select: { productionOrders: true } },
} satisfies Prisma.BillOfMaterialsInclude;

export type BomDetail = Prisma.BillOfMaterialsGetPayload<{ include: typeof bomDetailInclude }>;

export async function listBoms(): Promise<BomListItem[]> {
  return prisma.billOfMaterials.findMany({
    include: bomListInclude,
    orderBy: [
      { parentMaterial: { materialNumber: "asc" } },
      { version: "desc" },
    ],
  });
}

export async function getBom(id: string): Promise<BomDetail | null> {
  return prisma.billOfMaterials.findUnique({
    where: { id },
    include: bomDetailInclude,
  });
}

/** Materials that have at least one ACTIVE BOM — eligible to be produced. */
export async function listMaterialsWithActiveBom() {
  const boms = await prisma.billOfMaterials.findMany({
    where: { status: BillOfMaterialsStatus.ACTIVE },
    select: {
      parentMaterial: {
        select: {
          id: true,
          materialNumber: true,
          name: true,
          type: true,
          unitOfMeasureId: true,
          unitOfMeasure: { select: { code: true } },
        },
      },
    },
    orderBy: { parentMaterial: { materialNumber: "asc" } },
  });
  // Dedupe (same material could have multiple ACTIVE if data is bad — defensive)
  const seen = new Set<string>();
  const out: typeof boms[number]["parentMaterial"][] = [];
  for (const b of boms) {
    if (!seen.has(b.parentMaterial.id)) {
      seen.add(b.parentMaterial.id);
      out.push(b.parentMaterial);
    }
  }
  return out;
}
