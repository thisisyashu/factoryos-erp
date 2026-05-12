import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const wcListInclude = {
  _count: {
    select: { routingOperations: true, productionOrderOperations: true },
  },
} satisfies Prisma.WorkCenterInclude;

export type WorkCenterListItem = Prisma.WorkCenterGetPayload<{ include: typeof wcListInclude }>;

export async function listWorkCenters(): Promise<WorkCenterListItem[]> {
  return prisma.workCenter.findMany({
    include: wcListInclude,
    orderBy: { code: "asc" },
  });
}

export async function getWorkCenter(id: string) {
  return prisma.workCenter.findUnique({
    where: { id },
    include: {
      routingOperations: {
        include: {
          routing: {
            include: {
              parentMaterial: { select: { materialNumber: true, name: true } },
            },
          },
        },
      },
    },
  });
}
