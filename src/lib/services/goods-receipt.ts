import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextGrNumber } from "@/lib/numbering";
import { ForbiddenError } from "@/lib/current-user";
import { postInventoryMovement } from "@/lib/services/inventory";
import {
  receiveGoodsSchema,
  type ReceiveGoodsInput,
} from "@/lib/validators/goods-receipt";
import {
  Prisma,
  GoodsReceiptStatus,
  PurchaseOrderStatus,
  InventoryMovementType,
  UserRole,
} from "@prisma/client";

const grListInclude = {
  po: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      supplier: { select: { supplierNumber: true, legalName: true } },
    },
  },
  receivedBy: { select: { id: true, name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.GoodsReceiptInclude;

export type GrListItem = Prisma.GoodsReceiptGetPayload<{ include: typeof grListInclude }>;

const grDetailInclude = {
  po: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      currency: true,
      supplier: { select: { supplierNumber: true, legalName: true } },
    },
  },
  receivedBy: { select: { id: true, name: true, email: true, role: true } },
  lines: {
    include: {
      material: { select: { id: true, materialNumber: true, name: true } },
      unitOfMeasure: { select: { id: true, code: true } },
      storageLocation: {
        include: {
          warehouse: { select: { code: true, name: true } },
        },
      },
      poLine: { select: { id: true, lineNumber: true, quantity: true } },
    },
    orderBy: { lineNumber: "asc" as const },
  },
} satisfies Prisma.GoodsReceiptInclude;

export type GrDetail = Prisma.GoodsReceiptGetPayload<{ include: typeof grDetailInclude }>;

// =====================================================================
// Reads
// =====================================================================

export async function listGoodsReceipts(
  opts: { status?: GoodsReceiptStatus; poId?: string; limit?: number } = {},
): Promise<GrListItem[]> {
  return prisma.goodsReceipt.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.poId ? { poId: opts.poId } : {}),
    },
    include: grListInclude,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

export async function getGoodsReceipt(id: string): Promise<GrDetail | null> {
  return prisma.goodsReceipt.findUnique({
    where: { id },
    include: grDetailInclude,
  });
}

export async function getGrAuditTrail(grId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "GoodsReceipt", entityId: grId },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * POs that can still receive goods. Used by the new-GR PO picker.
 */
export async function listReceivablePos() {
  return prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
    },
    include: {
      supplier: { select: { supplierNumber: true, legalName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Read PO + lines with remaining quantity, for the receive form.
 */
export async function getPoForReceiving(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: { select: { id: true, supplierNumber: true, legalName: true } },
      lines: {
        include: {
          material: { select: { id: true, materialNumber: true, name: true } },
          unitOfMeasure: { select: { id: true, code: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  return po;
}

// =====================================================================
// Mutations
// =====================================================================

/**
 * Receive goods against a PO and post the GR in a single transaction.
 *
 * Rules:
 *   - PO must be APPROVED, SENT, or PARTIALLY_RECEIVED
 *   - Each input line.poLineId must belong to this PO
 *   - quantity > 0 and ≤ (poLine.quantity − poLine.quantityReceived)  (no over-receipt)
 *   - storageLocation must be active
 *
 * Side effects (all in one tx):
 *   - GR + GR lines created with status POSTED
 *   - Each PO line's quantityReceived incremented
 *   - PO status recomputed → PARTIALLY_RECEIVED or RECEIVED
 *   - One InventoryLedger row + balance upsert per GR line
 *   - Audit entries: GR POST + PO STATUS_CHANGE (if status changed)
 */
export async function postGoodsReceipt(
  input: ReceiveGoodsInput,
  actorId: string,
): Promise<{ id: string; grNumber: string; newPoStatus: PurchaseOrderStatus }> {
  const parsed = receiveGoodsSchema.parse(input);

  // Authorization: REQUESTER, APPROVER, ADMIN can receive (warehouse role
  // would normally do this — for now any non-VIEWER/STEWARD).
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  if (
    actor.role !== UserRole.REQUESTER &&
    actor.role !== UserRole.APPROVER &&
    actor.role !== UserRole.ADMIN
  ) {
    throw new ForbiddenError(`Role ${actor.role} cannot post goods receipts`);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Load PO + lines
    const po = await tx.purchaseOrder.findUnique({
      where: { id: parsed.poId },
      include: { lines: true },
    });
    if (!po) throw new Error(`PO ${parsed.poId} not found`);
    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new Error(
        `Cannot receive against PO in status ${po.status} (must be APPROVED, SENT, or PARTIALLY_RECEIVED)`,
      );
    }

    // 2. Validate input lines reference this PO + within remaining qty
    const poLineById = new Map(po.lines.map((l) => [l.id, l]));
    type ValidatedLine = {
      poLine: (typeof po.lines)[number];
      quantity: Prisma.Decimal;
      storageLocationId: string;
      notes?: string;
    };
    const validated: ValidatedLine[] = [];

    for (const inputLine of parsed.lines) {
      const poLine = poLineById.get(inputLine.poLineId);
      if (!poLine) {
        throw new Error(
          `PO line ${inputLine.poLineId} does not belong to PO ${po.poNumber}`,
        );
      }
      const remaining = poLine.quantity.sub(poLine.quantityReceived);
      const qty = new Prisma.Decimal(inputLine.quantity);
      if (qty.lte(0)) {
        throw new Error(
          `Line ${poLine.lineNumber}: quantity must be greater than 0`,
        );
      }
      if (qty.gt(remaining)) {
        throw new Error(
          `Line ${poLine.lineNumber}: receiving ${qty.toString()} exceeds remaining ${remaining.toString()} (ordered ${poLine.quantity.toString()}, already received ${poLine.quantityReceived.toString()})`,
        );
      }
      validated.push({
        poLine,
        quantity: qty,
        storageLocationId: inputLine.storageLocationId,
        notes: inputLine.notes,
      });
    }

    // 3. Validate all storage locations exist + active
    const storageIds = [...new Set(validated.map((v) => v.storageLocationId))];
    const storages = await tx.storageLocation.findMany({
      where: { id: { in: storageIds }, isActive: true },
      select: { id: true },
    });
    if (storages.length !== storageIds.length) {
      throw new Error("One or more storage locations not found or inactive");
    }

    // 4. Create the GR (status POSTED — single-step receive in Phase 2)
    const grNumber = await nextGrNumber();
    const now = new Date();
    const gr = await tx.goodsReceipt.create({
      data: {
        grNumber,
        status: GoodsReceiptStatus.POSTED,
        poId: po.id,
        receivedById: actorId,
        receivedAt: now,
        notes: parsed.notes ?? null,
        lines: {
          create: validated.map((v, idx) => ({
            lineNumber: idx + 1,
            poLineId: v.poLine.id,
            materialId: v.poLine.materialId,
            quantity: v.quantity,
            unitOfMeasureId: v.poLine.unitOfMeasureId,
            storageLocationId: v.storageLocationId,
            notes: v.notes ?? null,
          })),
        },
      },
      select: { id: true, grNumber: true, lines: { select: { id: true, materialId: true, quantity: true, unitOfMeasureId: true, storageLocationId: true, poLineId: true } } },
    });

    // 5. Increment each PO line's quantityReceived (atomic increments)
    for (const v of validated) {
      await tx.purchaseOrderLine.update({
        where: { id: v.poLine.id },
        data: { quantityReceived: { increment: v.quantity } },
      });
    }

    // 6. Recompute PO status from refreshed line totals
    const refreshedLines = await tx.purchaseOrderLine.findMany({
      where: { poId: po.id },
      select: { quantity: true, quantityReceived: true },
    });
    const allReceived = refreshedLines.every((l) =>
      l.quantityReceived.gte(l.quantity),
    );
    const newPoStatus = allReceived
      ? PurchaseOrderStatus.RECEIVED
      : PurchaseOrderStatus.PARTIALLY_RECEIVED;

    if (newPoStatus !== po.status) {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPoStatus },
      });
      await writeAudit({
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "STATUS_CHANGE",
        actorId,
        before: { status: po.status },
        after: { status: newPoStatus },
        metadata: { triggeredBy: { type: "GoodsReceipt", grNumber } },
        tx,
      });
    }

    // 7. Post one inventory movement per GR line + create one MaterialLot
    //    (Phase 3 chunk 6: every receipt creates a tracked lot for traceability)
    let lotLineSeq = 0;
    for (const grLine of gr.lines) {
      await postInventoryMovement(tx, {
        movementType: InventoryMovementType.GOODS_RECEIPT,
        materialId: grLine.materialId,
        storageLocationId: grLine.storageLocationId,
        quantity: new Prisma.Decimal(grLine.quantity),
        unitOfMeasureId: grLine.unitOfMeasureId,
        referenceType: "GoodsReceipt",
        referenceId: gr.id,
        postedById: actorId,
      });

      lotLineSeq += 1;
      await tx.materialLot.create({
        data: {
          lotNumber: `LOT-${grNumber}-L${lotLineSeq}`,
          materialId: grLine.materialId,
          quantityReceived: new Prisma.Decimal(grLine.quantity),
          quantityRemaining: new Prisma.Decimal(grLine.quantity),
          unitOfMeasureId: grLine.unitOfMeasureId,
          storageLocationId: grLine.storageLocationId,
          sourceType: "GoodsReceipt",
          sourceRefId: gr.id,
          supplierId: po.supplierId,
          receivedAt: now,
        },
      });
    }

    // 8. Audit the GR posting
    await writeAudit({
      entityType: "GoodsReceipt",
      entityId: gr.id,
      action: "POST",
      actorId,
      after: {
        status: GoodsReceiptStatus.POSTED,
        grNumber,
        poNumber: po.poNumber,
        lineCount: validated.length,
      },
      tx,
    });

    return { id: gr.id, grNumber, newPoStatus };
  });
}
