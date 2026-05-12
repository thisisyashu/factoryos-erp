import { prisma } from "@/lib/db";

// Document number format: <PREFIX>-<YEAR>-<6-digit sequence>
// Example: PR-2026-000001
//
// Generation strategy: read the highest existing number for the current year,
// add 1. This is fine for low-volume dev/demo use but races under concurrent
// inserts. For production, replace with a Postgres SEQUENCE per prefix, or a
// dedicated NumberSeries table updated inside the same transaction as the
// document insert. See: https://www.postgresql.org/docs/current/sql-createsequence.html

const SEQ_PAD = 6;

function thisYear(): string {
  return String(new Date().getUTCFullYear());
}

function buildNumber(prefix: string, year: string, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(SEQ_PAD, "0")}`;
}

function parseSeq(num: string): number {
  const m = num.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function nextPrNumber(): Promise<string> {
  const year = thisYear();
  const latest = await prisma.purchaseRequisition.findFirst({
    where: { prNumber: { startsWith: `PR-${year}-` } },
    orderBy: { prNumber: "desc" },
    select: { prNumber: true },
  });
  return buildNumber("PR", year, (latest ? parseSeq(latest.prNumber) : 0) + 1);
}

export async function nextPoNumber(): Promise<string> {
  const year = thisYear();
  const latest = await prisma.purchaseOrder.findFirst({
    where: { poNumber: { startsWith: `PO-${year}-` } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  return buildNumber("PO", year, (latest ? parseSeq(latest.poNumber) : 0) + 1);
}

export async function nextGrNumber(): Promise<string> {
  const year = thisYear();
  const latest = await prisma.goodsReceipt.findFirst({
    where: { grNumber: { startsWith: `GR-${year}-` } },
    orderBy: { grNumber: "desc" },
    select: { grNumber: true },
  });
  return buildNumber("GR", year, (latest ? parseSeq(latest.grNumber) : 0) + 1);
}

export async function nextProductionOrderNumber(): Promise<string> {
  const year = thisYear();
  const latest = await prisma.productionOrder.findFirst({
    where: { orderNumber: { startsWith: `PRO-${year}-` } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  return buildNumber("PRO", year, (latest ? parseSeq(latest.orderNumber) : 0) + 1);
}
