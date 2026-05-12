import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextPrNumber } from "@/lib/numbering";
import { ForbiddenError } from "@/lib/current-user";
import {
  createPurchaseRequisitionSchema,
  type CreatePurchaseRequisitionInput,
} from "@/lib/validators/purchase-requisition";
import {
  type Prisma,
  PurchaseRequisitionStatus,
  MasterDataStatus,
  UserRole,
} from "@prisma/client";

const prListInclude = {
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.PurchaseRequisitionInclude;

export type PrListItem = Prisma.PurchaseRequisitionGetPayload<{ include: typeof prListInclude }>;

const prDetailInclude = {
  requestedBy: { select: { id: true, name: true, email: true, department: true, role: true } },
  approvedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      material: { select: { id: true, materialNumber: true, name: true, status: true } },
      unitOfMeasure: { select: { id: true, code: true, description: true } },
    },
    orderBy: { lineNumber: "asc" as const },
  },
  convertedPo: { select: { id: true, poNumber: true, status: true } },
} satisfies Prisma.PurchaseRequisitionInclude;

export type PrDetail = Prisma.PurchaseRequisitionGetPayload<{ include: typeof prDetailInclude }>;

// =====================================================================
// Reads
// =====================================================================

export async function listPurchaseRequisitions(
  opts: {
    status?: PurchaseRequisitionStatus;
    requestedById?: string;
    limit?: number;
  } = {},
): Promise<PrListItem[]> {
  return prisma.purchaseRequisition.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.requestedById ? { requestedById: opts.requestedById } : {}),
    },
    include: prListInclude,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

export async function getPurchaseRequisition(id: string): Promise<PrDetail | null> {
  return prisma.purchaseRequisition.findUnique({
    where: { id },
    include: prDetailInclude,
  });
}

export async function getPrAuditTrail(prId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "PurchaseRequisition", entityId: prId },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// =====================================================================
// Mutations — each runs inside a transaction with the audit write
// =====================================================================

export type CreatePurchaseRequisitionOptions = CreatePurchaseRequisitionInput & {
  /** If true, transition DRAFT → SUBMITTED in the same transaction. */
  submit?: boolean;
};

export async function createPurchaseRequisition(
  input: CreatePurchaseRequisitionOptions,
  actorId: string,
): Promise<{ id: string; prNumber: string; status: PurchaseRequisitionStatus }> {
  // Re-validate server-side (the client may be bypassed).
  const parsed = createPurchaseRequisitionSchema.parse(input);

  // Materials must exist and be ACTIVE — Phase 1 master data governance.
  const materialIds = [...new Set(parsed.lines.map((l) => l.materialId))];
  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, status: true, materialNumber: true },
  });
  if (materials.length !== materialIds.length) {
    const found = new Set(materials.map((m) => m.id));
    throw new Error(
      `Material not found: ${materialIds.filter((id) => !found.has(id)).join(", ")}`,
    );
  }
  const inactive = materials.filter((m) => m.status !== MasterDataStatus.ACTIVE);
  if (inactive.length > 0) {
    throw new Error(
      `Materials must be ACTIVE: ${inactive
        .map((m) => `${m.materialNumber} (${m.status})`)
        .join(", ")}`,
    );
  }

  // Validate UoMs.
  const uomIds = [...new Set(parsed.lines.map((l) => l.unitOfMeasureId))];
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { id: { in: uomIds }, isActive: true },
    select: { id: true },
  });
  if (uoms.length !== uomIds.length) throw new Error("One or more UoMs not found or inactive");

  const submit = input.submit === true;

  return prisma.$transaction(async (tx) => {
    // NOTE: nextPrNumber reads outside the tx — small race window. The unique
    // index on prNumber will reject any collision and the user can retry.
    const prNumber = await nextPrNumber();
    const now = new Date();

    const created = await tx.purchaseRequisition.create({
      data: {
        prNumber,
        status: submit ? PurchaseRequisitionStatus.SUBMITTED : PurchaseRequisitionStatus.DRAFT,
        requestedById: actorId,
        department: parsed.department ?? null,
        reason: parsed.reason ?? null,
        neededBy: parsed.neededBy ?? null,
        submittedAt: submit ? now : null,
        lines: {
          create: parsed.lines.map((l, idx) => ({
            lineNumber: idx + 1,
            materialId: l.materialId,
            unitOfMeasureId: l.unitOfMeasureId,
            quantity: l.quantity,
            estimatedCost: l.estimatedCost ?? null,
            notes: l.notes ?? null,
          })),
        },
      },
      select: { id: true, prNumber: true, status: true },
    });

    await writeAudit({
      entityType: "PurchaseRequisition",
      entityId: created.id,
      action: "CREATE",
      actorId,
      after: {
        status: created.status,
        prNumber: created.prNumber,
        lineCount: parsed.lines.length,
      },
      tx,
    });

    if (submit) {
      await writeAudit({
        entityType: "PurchaseRequisition",
        entityId: created.id,
        action: "SUBMIT",
        actorId,
        before: { status: PurchaseRequisitionStatus.DRAFT },
        after: { status: PurchaseRequisitionStatus.SUBMITTED },
        tx,
      });
    }

    return created;
  });
}

export async function submitPurchaseRequisition(prId: string, actorId: string) {
  const pr = await prisma.purchaseRequisition.findUnique({
    where: { id: prId },
    select: {
      id: true,
      status: true,
      requestedById: true,
      _count: { select: { lines: true } },
    },
  });
  if (!pr) throw new Error(`PR ${prId} not found`);
  if (pr.status !== PurchaseRequisitionStatus.DRAFT) {
    throw new Error(`Cannot submit PR in status ${pr.status} (must be DRAFT)`);
  }
  if (pr._count.lines === 0) throw new Error("Cannot submit a PR with zero lines");

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  if (pr.requestedById !== actorId && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError("Only the requester or an admin can submit this PR");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseRequisition.update({
      where: { id: prId },
      data: { status: PurchaseRequisitionStatus.SUBMITTED, submittedAt: new Date() },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseRequisition",
      entityId: prId,
      action: "SUBMIT",
      actorId,
      before: { status: PurchaseRequisitionStatus.DRAFT },
      after: { status: PurchaseRequisitionStatus.SUBMITTED },
      tx,
    });
    return updated;
  });
}

export async function approvePurchaseRequisition(
  prId: string,
  actorId: string,
  comments?: string,
) {
  const pr = await prisma.purchaseRequisition.findUnique({
    where: { id: prId },
    select: { id: true, status: true },
  });
  if (!pr) throw new Error(`PR ${prId} not found`);
  if (pr.status !== PurchaseRequisitionStatus.SUBMITTED) {
    throw new Error(`Cannot approve PR in status ${pr.status} (must be SUBMITTED)`);
  }

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  if (actor.role !== UserRole.APPROVER && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError(`Role ${actor.role} cannot approve PRs`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseRequisition.update({
      where: { id: prId },
      data: {
        status: PurchaseRequisitionStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
      },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseRequisition",
      entityId: prId,
      action: "APPROVE",
      actorId,
      before: { status: PurchaseRequisitionStatus.SUBMITTED },
      after: { status: PurchaseRequisitionStatus.APPROVED },
      metadata: comments ? { comments } : undefined,
      tx,
    });
    return updated;
  });
}

export async function rejectPurchaseRequisition(
  prId: string,
  actorId: string,
  rejectionReason: string,
) {
  const pr = await prisma.purchaseRequisition.findUnique({
    where: { id: prId },
    select: { id: true, status: true },
  });
  if (!pr) throw new Error(`PR ${prId} not found`);
  if (pr.status !== PurchaseRequisitionStatus.SUBMITTED) {
    throw new Error(`Cannot reject PR in status ${pr.status} (must be SUBMITTED)`);
  }

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  if (actor.role !== UserRole.APPROVER && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError(`Role ${actor.role} cannot reject PRs`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseRequisition.update({
      where: { id: prId },
      data: {
        status: PurchaseRequisitionStatus.REJECTED,
        rejectionReason,
        approvedById: actorId,
        approvedAt: new Date(),
      },
      select: { id: true, status: true },
    });
    await writeAudit({
      entityType: "PurchaseRequisition",
      entityId: prId,
      action: "REJECT",
      actorId,
      before: { status: PurchaseRequisitionStatus.SUBMITTED },
      after: { status: PurchaseRequisitionStatus.REJECTED },
      metadata: { rejectionReason },
      tx,
    });
    return updated;
  });
}
