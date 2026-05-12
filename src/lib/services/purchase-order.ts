import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextPoNumber } from "@/lib/numbering";
import { ForbiddenError } from "@/lib/current-user";
import {
  createPurchaseOrderSchema,
  convertPrToPoSchema,
  type CreatePurchaseOrderInput,
  type ConvertPrToPoInput,
} from "@/lib/validators/purchase-order";
import {
  Prisma,
  type PurchaseOrderStatus as POStatus,
  PurchaseOrderStatus,
  PurchaseRequisitionStatus,
  MasterDataStatus,
  UserRole,
} from "@prisma/client";

const poListInclude = {
  supplier: { select: { id: true, supplierNumber: true, legalName: true } },
  requestedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  sourcePr: { select: { id: true, prNumber: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.PurchaseOrderInclude;

export type PoListItem = Prisma.PurchaseOrderGetPayload<{ include: typeof poListInclude }>;

const poDetailInclude = {
  supplier: {
    select: {
      id: true,
      supplierNumber: true,
      legalName: true,
      contactEmail: true,
      currency: true,
      paymentTermsDays: true,
      status: true,
    },
  },
  requestedBy: { select: { id: true, name: true, email: true, role: true } },
  approvedBy: { select: { id: true, name: true } },
  sourcePr: { select: { id: true, prNumber: true, status: true } },
  lines: {
    include: {
      material: { select: { id: true, materialNumber: true, name: true, status: true } },
      unitOfMeasure: { select: { id: true, code: true, description: true } },
    },
    orderBy: { lineNumber: "asc" as const },
  },
  goodsReceipts: {
    select: { id: true, grNumber: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.PurchaseOrderInclude;

export type PoDetail = Prisma.PurchaseOrderGetPayload<{ include: typeof poDetailInclude }>;

// =====================================================================
// Reads
// =====================================================================

export async function listPurchaseOrders(
  opts: {
    status?: POStatus;
    supplierId?: string;
    limit?: number;
  } = {},
): Promise<PoListItem[]> {
  return prisma.purchaseOrder.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
    },
    include: poListInclude,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

export async function getPurchaseOrder(id: string): Promise<PoDetail | null> {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: poDetailInclude,
  });
}

export async function getPoAuditTrail(poId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "PurchaseOrder", entityId: poId },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// =====================================================================
// Mutations
// =====================================================================

export type CreatePurchaseOrderOptions = CreatePurchaseOrderInput & {
  /** If true, transition DRAFT → SUBMITTED in the same transaction. */
  submit?: boolean;
};

async function validateSupplierActive(
  supplierId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const s = await client.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, status: true, supplierNumber: true, currency: true },
  });
  if (!s) throw new Error(`Supplier ${supplierId} not found`);
  if (s.status !== MasterDataStatus.ACTIVE) {
    throw new Error(`Supplier ${s.supplierNumber} must be ACTIVE (currently ${s.status})`);
  }
  return s;
}

async function validateMaterialsActive(
  materialIds: string[],
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const unique = [...new Set(materialIds)];
  const materials = await client.material.findMany({
    where: { id: { in: unique } },
    select: { id: true, status: true, materialNumber: true },
  });
  if (materials.length !== unique.length) {
    const found = new Set(materials.map((m) => m.id));
    throw new Error(
      `Material not found: ${unique.filter((id) => !found.has(id)).join(", ")}`,
    );
  }
  const inactive = materials.filter((m) => m.status !== MasterDataStatus.ACTIVE);
  if (inactive.length > 0) {
    throw new Error(
      `Materials must be ACTIVE: ${inactive.map((m) => `${m.materialNumber} (${m.status})`).join(", ")}`,
    );
  }
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderOptions,
  actorId: string,
): Promise<{ id: string; poNumber: string; status: POStatus }> {
  const parsed = createPurchaseOrderSchema.parse(input);

  const supplier = await validateSupplierActive(parsed.supplierId);
  await validateMaterialsActive(parsed.lines.map((l) => l.materialId));

  const uomIds = [...new Set(parsed.lines.map((l) => l.unitOfMeasureId))];
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { id: { in: uomIds }, isActive: true },
    select: { id: true },
  });
  if (uoms.length !== uomIds.length) throw new Error("One or more UoMs not found or inactive");

  // Compute line totals + grand total in Decimal for exact arithmetic.
  let totalAmount = new Prisma.Decimal(0);
  const poLineData = parsed.lines.map((l, idx) => {
    const lineTotal = new Prisma.Decimal(l.quantity).mul(l.unitPrice);
    totalAmount = totalAmount.add(lineTotal);
    return {
      lineNumber: idx + 1,
      materialId: l.materialId,
      unitOfMeasureId: l.unitOfMeasureId,
      quantity: new Prisma.Decimal(l.quantity),
      unitPrice: new Prisma.Decimal(l.unitPrice),
      lineTotal,
      notes: l.notes ?? null,
    };
  });

  const submit = input.submit === true;

  return prisma.$transaction(async (tx) => {
    const poNumber = await nextPoNumber();
    const now = new Date();

    const po = await tx.purchaseOrder.create({
      data: {
        poNumber,
        status: submit ? PurchaseOrderStatus.SUBMITTED : PurchaseOrderStatus.DRAFT,
        supplierId: parsed.supplierId,
        requestedById: actorId,
        currency: parsed.currency ?? supplier.currency ?? "USD",
        totalAmount,
        notes: parsed.notes ?? null,
        submittedAt: submit ? now : null,
        lines: { create: poLineData },
      },
      select: { id: true, poNumber: true, status: true },
    });

    await writeAudit({
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "CREATE",
      actorId,
      after: {
        status: po.status,
        poNumber: po.poNumber,
        supplierId: parsed.supplierId,
        lineCount: poLineData.length,
        totalAmount: totalAmount.toString(),
      },
      tx,
    });

    if (submit) {
      await writeAudit({
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "SUBMIT",
        actorId,
        before: { status: PurchaseOrderStatus.DRAFT },
        after: { status: PurchaseOrderStatus.SUBMITTED },
        tx,
      });
    }

    return po;
  });
}

export type ConvertPrToPoOptions = ConvertPrToPoInput & { submit?: boolean };

export async function convertPrToPo(
  input: ConvertPrToPoOptions,
  actorId: string,
): Promise<{ id: string; poNumber: string; status: POStatus }> {
  const parsed = convertPrToPoSchema.parse(input);
  const submit = input.submit === true;

  return prisma.$transaction(async (tx) => {
    const pr = await tx.purchaseRequisition.findUnique({
      where: { id: parsed.prId },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (!pr) throw new Error(`PR ${parsed.prId} not found`);
    if (pr.status !== PurchaseRequisitionStatus.APPROVED) {
      throw new Error(
        `PR ${pr.prNumber} must be APPROVED to convert (currently ${pr.status})`,
      );
    }
    // The 1:1 relation enforces this at the DB layer too, but we surface a clean error.
    const existing = await tx.purchaseOrder.findUnique({
      where: { sourcePrId: pr.id },
      select: { poNumber: true },
    });
    if (existing) throw new Error(`PR already converted to PO ${existing.poNumber}`);

    const supplier = await validateSupplierActive(parsed.supplierId, tx);

    const priceByLineId = new Map(parsed.lines.map((l) => [l.prLineId, l.unitPrice]));
    let totalAmount = new Prisma.Decimal(0);
    const poLineData = pr.lines.map((prLine, idx) => {
      const unitPrice = priceByLineId.get(prLine.id);
      if (unitPrice === undefined) {
        throw new Error(`Missing unit price for PR line ${prLine.lineNumber}`);
      }
      const lineTotal = new Prisma.Decimal(prLine.quantity).mul(unitPrice);
      totalAmount = totalAmount.add(lineTotal);
      return {
        lineNumber: idx + 1,
        materialId: prLine.materialId,
        unitOfMeasureId: prLine.unitOfMeasureId,
        quantity: prLine.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        lineTotal,
        notes: prLine.notes,
      };
    });

    const poNumber = await nextPoNumber();
    const now = new Date();

    const po = await tx.purchaseOrder.create({
      data: {
        poNumber,
        status: submit ? PurchaseOrderStatus.SUBMITTED : PurchaseOrderStatus.DRAFT,
        supplierId: parsed.supplierId,
        sourcePrId: pr.id,
        requestedById: actorId,
        currency: parsed.currency ?? supplier.currency ?? "USD",
        totalAmount,
        notes: parsed.notes ?? null,
        submittedAt: submit ? now : null,
        lines: { create: poLineData },
      },
      select: { id: true, poNumber: true, status: true },
    });

    await tx.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: PurchaseRequisitionStatus.CONVERTED_TO_PO },
    });

    await writeAudit({
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "CREATE",
      actorId,
      after: {
        status: po.status,
        poNumber: po.poNumber,
        sourcePrNumber: pr.prNumber,
        supplierId: parsed.supplierId,
        lineCount: poLineData.length,
        totalAmount: totalAmount.toString(),
      },
      tx,
    });

    if (submit) {
      await writeAudit({
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "SUBMIT",
        actorId,
        before: { status: PurchaseOrderStatus.DRAFT },
        after: { status: PurchaseOrderStatus.SUBMITTED },
        tx,
      });
    }

    await writeAudit({
      entityType: "PurchaseRequisition",
      entityId: pr.id,
      action: "CONVERT_TO_PO",
      actorId,
      before: { status: PurchaseRequisitionStatus.APPROVED },
      after: { status: PurchaseRequisitionStatus.CONVERTED_TO_PO },
      metadata: { poNumber: po.poNumber, poId: po.id },
      tx,
    });

    return po;
  });
}

async function loadActor(actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  return actor;
}

export async function submitPurchaseOrder(poId: string, actorId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: {
      id: true,
      status: true,
      requestedById: true,
      _count: { select: { lines: true } },
    },
  });
  if (!po) throw new Error(`PO ${poId} not found`);
  if (po.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error(`Cannot submit PO in status ${po.status} (must be DRAFT)`);
  }
  if (po._count.lines === 0) throw new Error("Cannot submit a PO with zero lines");

  const actor = await loadActor(actorId);
  if (po.requestedById !== actorId && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError("Only the requester or an admin can submit this PO");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.SUBMITTED, submittedAt: new Date() },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseOrder",
      entityId: poId,
      action: "SUBMIT",
      actorId,
      before: { status: PurchaseOrderStatus.DRAFT },
      after: { status: PurchaseOrderStatus.SUBMITTED },
      tx,
    });
    return updated;
  });
}

export async function approvePurchaseOrder(
  poId: string,
  actorId: string,
  comments?: string,
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true },
  });
  if (!po) throw new Error(`PO ${poId} not found`);
  if (po.status !== PurchaseOrderStatus.SUBMITTED) {
    throw new Error(`Cannot approve PO in status ${po.status} (must be SUBMITTED)`);
  }

  const actor = await loadActor(actorId);
  if (actor.role !== UserRole.APPROVER && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError(`Role ${actor.role} cannot approve POs`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
      },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseOrder",
      entityId: poId,
      action: "APPROVE",
      actorId,
      before: { status: PurchaseOrderStatus.SUBMITTED },
      after: { status: PurchaseOrderStatus.APPROVED },
      metadata: comments ? { comments } : undefined,
      tx,
    });
    return updated;
  });
}

export async function sendPurchaseOrder(poId: string, actorId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true },
  });
  if (!po) throw new Error(`PO ${poId} not found`);
  if (po.status !== PurchaseOrderStatus.APPROVED) {
    throw new Error(`Cannot send PO in status ${po.status} (must be APPROVED)`);
  }
  const actor = await loadActor(actorId);
  if (
    actor.role !== UserRole.REQUESTER &&
    actor.role !== UserRole.APPROVER &&
    actor.role !== UserRole.ADMIN
  ) {
    throw new ForbiddenError(`Role ${actor.role} cannot send POs`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.SENT, sentAt: new Date() },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseOrder",
      entityId: poId,
      action: "SEND",
      actorId,
      before: { status: PurchaseOrderStatus.APPROVED },
      after: { status: PurchaseOrderStatus.SENT },
      tx,
    });
    return updated;
  });
}

// Read used by the convert form
export async function getPrForConversion(prId: string) {
  return prisma.purchaseRequisition.findUnique({
    where: { id: prId },
    select: {
      id: true,
      prNumber: true,
      status: true,
      reason: true,
      department: true,
      neededBy: true,
      lines: {
        include: {
          material: { select: { id: true, materialNumber: true, name: true } },
          unitOfMeasure: { select: { id: true, code: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
}
