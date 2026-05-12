import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const routingListInclude = {
  parentMaterial: { select: { id: true, materialNumber: true, name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { operations: true, productionOrders: true } },
} satisfies Prisma.RoutingInclude;

export type RoutingListItem = Prisma.RoutingGetPayload<{ include: typeof routingListInclude }>;

const routingDetailInclude = {
  parentMaterial: {
    select: { id: true, materialNumber: true, name: true, status: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  operations: {
    include: {
      workCenter: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { sequence: "asc" as const },
  },
} satisfies Prisma.RoutingInclude;

export type RoutingDetail = Prisma.RoutingGetPayload<{ include: typeof routingDetailInclude }>;

export async function listRoutings(): Promise<RoutingListItem[]> {
  return prisma.routing.findMany({
    include: routingListInclude,
    orderBy: [
      { parentMaterial: { materialNumber: "asc" } },
      { version: "desc" },
    ],
  });
}

export async function getRouting(id: string): Promise<RoutingDetail | null> {
  return prisma.routing.findUnique({
    where: { id },
    include: routingDetailInclude,
  });
}
