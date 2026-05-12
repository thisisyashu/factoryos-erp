import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { nextProductionOrderNumber } from "@/lib/numbering";
import { ForbiddenError } from "@/lib/current-user";
import { postInventoryMovement } from "@/lib/services/inventory";
import {
  createProductionOrderSchema,
  issueMaterialsSchema,
  type CreateProductionOrderInput,
  type IssueMaterialsInput,
} from "@/lib/validators/production-order";
import {
  Prisma,
  ProductionOrderStatus,
  MasterDataStatus,
  BillOfMaterialsStatus,
  RoutingStatus,
  InventoryMovementType,
  UserRole,
} from "@prisma/client";

const poListInclude = {
  parentMaterial: { select: { id: true, materialNumber: true, name: true } },
  unitOfMeasure: { select: { code: true } },
  bom: { select: { bomNumber: true, version: true } },
  routing: { select: { routingNumber: true, version: true } },
  createdBy: { select: { name: true } },
  _count: { select: { components: true, operations: true } },
} satisfies Prisma.ProductionOrderInclude;

export type ProductionOrderListItem = Prisma.ProductionOrderGetPayload<{
  include: typeof poListInclude;
}>;

const poDetailInclude = {
  parentMaterial: {
    select: { id: true, materialNumber: true, name: true, type: true },
  },
  unitOfMeasure: { select: { code: true, description: true } },
  bom: { select: { id: true, bomNumber: true, version: true, status: true } },
  routing: {
    select: { id: true, routingNumber: true, version: true, status: true },
  },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  releasedBy: { select: { id: true, name: true } },
  components: {
    include: {
      material: {
        select: { id: true, materialNumber: true, name: true, status: true },
      },
      unitOfMeasure: { select: { code: true } },
    },
    orderBy: { lineNumber: "asc" as const },
  },
  operations: {
    include: {
      workCenter: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { sequence: "asc" as const },
  },
} satisfies Prisma.ProductionOrderInclude;

export type ProductionOrderDetail = Prisma.ProductionOrderGetPayload<{
  include: typeof poDetailInclude;
}>;

// =====================================================================
// Reads
// =====================================================================

export async function listProductionOrders(
  opts: { status?: ProductionOrderStatus; limit?: number } = {},
): Promise<ProductionOrderListItem[]> {
  return prisma.productionOrder.findMany({
    where: { ...(opts.status ? { status: opts.status } : {}) },
    include: poListInclude,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

export async function getProductionOrder(
  id: string,
): Promise<ProductionOrderDetail | null> {
  return prisma.productionOrder.findUnique({
    where: { id },
    include: poDetailInclude,
  });
}

export async function getProductionOrderAuditTrail(poId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "ProductionOrder", entityId: poId },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// =====================================================================
// Mutations
// =====================================================================

/**
 * Create a Production Order in DRAFT status.
 *
 * Snapshot semantics: at create time we copy the current ACTIVE BOM into
 * `ProductionOrderComponent` rows and the current ACTIVE Routing into
 * `ProductionOrderOperation` rows. Even if the master data changes later,
 * this order keeps its original requirements — that's the audit-trail
 * promise of an ERP production order.
 *
 * BOM explosion: for each component line,
 *     plannedQuantity = bomLineQty × orderQuantity × (1 + scrapPercent/100)
 * Routing explosion: for each operation,
 *     plannedSetupHours = routingOp.setupTimeHours
 *     plannedRunHours   = routingOp.runTimeHoursPerUnit × orderQuantity
 *
 * All math runs in Prisma.Decimal — no JS floating-point drift.
 */
export async function createProductionOrder(
  input: CreateProductionOrderInput,
  actorId: string,
): Promise<{ id: string; orderNumber: string; status: ProductionOrderStatus }> {
  const parsed = createProductionOrderSchema.parse(input);

  // 1. Parent material must exist and be ACTIVE
  const parent = await prisma.material.findUnique({
    where: { id: parsed.parentMaterialId },
    include: { unitOfMeasure: { select: { id: true, code: true } } },
  });
  if (!parent) throw new Error(`Parent material ${parsed.parentMaterialId} not found`);
  if (parent.status !== MasterDataStatus.ACTIVE) {
    throw new Error(
      `Parent material ${parent.materialNumber} must be ACTIVE (currently ${parent.status})`,
    );
  }

  // 2. Find ACTIVE BOM
  const bom = await prisma.billOfMaterials.findFirst({
    where: { parentMaterialId: parent.id, status: BillOfMaterialsStatus.ACTIVE },
    include: {
      lines: {
        include: {
          componentMaterial: {
            select: { id: true, status: true, materialNumber: true },
          },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });
  if (!bom) throw new Error(`No ACTIVE BOM found for ${parent.materialNumber}`);
  if (bom.lines.length === 0)
    throw new Error(`BOM ${bom.bomNumber} has no lines`);

  // 3. Every component must be ACTIVE
  const inactive = bom.lines.filter(
    (l) => l.componentMaterial.status !== MasterDataStatus.ACTIVE,
  );
  if (inactive.length > 0) {
    throw new Error(
      `BOM ${bom.bomNumber} has inactive components: ${inactive
        .map((l) => `${l.componentMaterial.materialNumber} (${l.componentMaterial.status})`)
        .join(", ")}`,
    );
  }

  // 4. Routing is optional
  const routing = await prisma.routing.findFirst({
    where: { parentMaterialId: parent.id, status: RoutingStatus.ACTIVE },
    include: { operations: { orderBy: { sequence: "asc" } } },
  });

  // 5. BOM explosion (Decimal math)
  const orderQty = new Prisma.Decimal(parsed.quantity);
  const componentData = bom.lines.map((l, idx) => {
    const scrapMultiplier = new Prisma.Decimal(1).add(
      new Prisma.Decimal(l.scrapPercent).div(100),
    );
    const planned = new Prisma.Decimal(l.quantity).mul(orderQty).mul(scrapMultiplier);
    return {
      lineNumber: idx + 1,
      materialId: l.componentMaterialId,
      unitOfMeasureId: l.unitOfMeasureId,
      plannedQuantity: planned,
      notes: l.notes,
    };
  });

  // 6. Routing snapshot
  const operationData = (routing?.operations ?? []).map((op) => ({
    sequence: op.sequence,
    description: op.description,
    workCenterId: op.workCenterId,
    plannedSetupHours: op.setupTimeHours,
    plannedRunHours: new Prisma.Decimal(op.runTimeHoursPerUnit).mul(orderQty),
  }));

  // 7. Transactional create
  return prisma.$transaction(async (tx) => {
    const orderNumber = await nextProductionOrderNumber();

    const order = await tx.productionOrder.create({
      data: {
        orderNumber,
        status: ProductionOrderStatus.DRAFT,
        parentMaterialId: parent.id,
        quantity: orderQty,
        unitOfMeasureId: parent.unitOfMeasure.id,
        bomId: bom.id,
        routingId: routing?.id ?? null,
        plannedStartDate: parsed.plannedStartDate ?? null,
        plannedEndDate: parsed.plannedEndDate ?? null,
        notes: parsed.notes ?? null,
        createdById: actorId,
        components: { create: componentData },
        operations: { create: operationData },
      },
      select: { id: true, orderNumber: true, status: true },
    });

    await writeAudit({
      entityType: "ProductionOrder",
      entityId: order.id,
      action: "CREATE",
      actorId,
      after: {
        status: order.status,
        orderNumber: order.orderNumber,
        parentMaterial: parent.materialNumber,
        quantity: orderQty.toString(),
        bom: bom.bomNumber,
        routing: routing?.routingNumber ?? null,
        componentCount: componentData.length,
        operationCount: operationData.length,
      },
      tx,
    });

    return order;
  });
}

// =====================================================================
// Release / cancel / issue (Chunk 3)
// =====================================================================

async function loadActor(actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ForbiddenError("Actor not found");
  return actor;
}

type AggregatorClient =
  | typeof prisma
  | Prisma.TransactionClient;

async function getInventoryOnHandTotal(
  materialId: string,
  client: AggregatorClient = prisma,
): Promise<Prisma.Decimal> {
  const result = await client.inventoryBalance.aggregate({
    where: { materialId },
    _sum: { quantityOnHand: true },
  });
  return result._sum.quantityOnHand ?? new Prisma.Decimal(0);
}

async function getReservedByOthers(
  materialId: string,
  excludeOrderId: string | null,
  client: AggregatorClient = prisma,
): Promise<Prisma.Decimal> {
  const result = await client.productionOrderComponent.aggregate({
    where: {
      materialId,
      ...(excludeOrderId ? { productionOrderId: { not: excludeOrderId } } : {}),
      productionOrder: {
        status: {
          notIn: [
            ProductionOrderStatus.CANCELLED,
            ProductionOrderStatus.CLOSED,
            ProductionOrderStatus.COMPLETED,
          ],
        },
      },
    },
    _sum: { reservedQuantity: true },
  });
  return result._sum.reservedQuantity ?? new Prisma.Decimal(0);
}

export type ComponentAvailability = {
  componentId: string;
  lineNumber: number;
  materialId: string;
  materialNumber: string;
  materialName: string;
  uomCode: string;
  plannedQuantity: string;
  issuedQuantity: string;
  reservedByThisOrder: string;
  inventoryOnHand: string;
  reservedByOthers: string;
  availableForThisOrder: string;
  shortage: string;
  isShort: boolean;
};

/**
 * For each component on the order, compute:
 *   availableForThisOrder = totalOnHand − reservedByOtherActiveOrders
 *   shortage              = max(0, plannedQuantity − availableForThisOrder)
 *
 * Used by the detail page card AND by releaseProductionOrder for the
 * release-time gate.
 */
export async function getMaterialAvailability(
  orderId: string,
): Promise<ComponentAvailability[]> {
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      components: {
        include: {
          material: { select: { id: true, materialNumber: true, name: true } },
          unitOfMeasure: { select: { code: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  const out: ComponentAvailability[] = [];
  for (const c of order.components) {
    const onHand = await getInventoryOnHandTotal(c.materialId);
    const reservedByOthers = await getReservedByOthers(c.materialId, order.id);
    const availableForThisOrder = onHand.sub(reservedByOthers);
    const shortageRaw = c.plannedQuantity.sub(availableForThisOrder);
    const isShort = shortageRaw.gt(0);
    out.push({
      componentId: c.id,
      lineNumber: c.lineNumber,
      materialId: c.materialId,
      materialNumber: c.material.materialNumber,
      materialName: c.material.name,
      uomCode: c.unitOfMeasure.code,
      plannedQuantity: c.plannedQuantity.toString(),
      issuedQuantity: c.issuedQuantity.toString(),
      reservedByThisOrder: c.reservedQuantity.toString(),
      inventoryOnHand: onHand.toString(),
      reservedByOthers: reservedByOthers.toString(),
      availableForThisOrder: availableForThisOrder.toString(),
      shortage: isShort ? shortageRaw.toString() : "0",
      isShort,
    });
  }
  return out;
}

/**
 * Release a DRAFT production order:
 *   - blocks if any component is short
 *   - else sets reservedQuantity = plannedQuantity per component
 *   - flips status DRAFT → RELEASED
 *   - audits
 */
export async function releaseProductionOrder(
  orderId: string,
  actorId: string,
): Promise<{ id: string; status: ProductionOrderStatus }> {
  const actor = await loadActor(actorId);
  if (actor.role !== UserRole.APPROVER && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError(`Role ${actor.role} cannot release production orders`);
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        components: {
          include: { material: { select: { materialNumber: true } } },
        },
      },
    });
    if (!order) throw new Error(`Production order ${orderId} not found`);
    if (order.status !== ProductionOrderStatus.DRAFT) {
      throw new Error(
        `Can only release DRAFT orders (currently ${order.status})`,
      );
    }

    // Availability check per component (within tx)
    type Shortage = {
      lineNumber: number;
      materialNumber: string;
      needed: string;
      available: string;
      short: string;
    };
    const shortages: Shortage[] = [];
    for (const c of order.components) {
      const onHand = await getInventoryOnHandTotal(c.materialId, tx);
      const reservedByOthers = await getReservedByOthers(c.materialId, order.id, tx);
      const available = onHand.sub(reservedByOthers);
      if (available.lt(c.plannedQuantity)) {
        shortages.push({
          lineNumber: c.lineNumber,
          materialNumber: c.material.materialNumber,
          needed: c.plannedQuantity.toString(),
          available: available.toString(),
          short: c.plannedQuantity.sub(available).toString(),
        });
      }
    }
    if (shortages.length > 0) {
      const summary = shortages
        .map((s) => `${s.materialNumber} (need ${s.needed}, have ${s.available}, short ${s.short})`)
        .join("; ");
      throw new Error(`Cannot release — material shortages: ${summary}`);
    }

    // Reserve all components
    for (const c of order.components) {
      await tx.productionOrderComponent.update({
        where: { id: c.id },
        data: { reservedQuantity: c.plannedQuantity },
      });
    }

    const updated = await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        status: ProductionOrderStatus.RELEASED,
        releasedAt: new Date(),
        releasedById: actorId,
      },
      select: { id: true, status: true },
    });

    await writeAudit({
      entityType: "ProductionOrder",
      entityId: orderId,
      action: "RELEASE",
      actorId,
      before: { status: ProductionOrderStatus.DRAFT },
      after: {
        status: ProductionOrderStatus.RELEASED,
        reservedComponents: order.components.length,
      },
      tx,
    });

    return updated;
  });
}

/**
 * Cancel a DRAFT or RELEASED order. Releases reservations.
 * Cannot cancel after IN_PROGRESS — material has already moved.
 */
export async function cancelProductionOrder(
  orderId: string,
  actorId: string,
  reason: string,
): Promise<{ id: string; status: ProductionOrderStatus }> {
  if (!reason || !reason.trim()) {
    throw new Error("Cancellation reason is required");
  }
  const actor = await loadActor(actorId);
  if (actor.role !== UserRole.APPROVER && actor.role !== UserRole.ADMIN) {
    throw new ForbiddenError(`Role ${actor.role} cannot cancel production orders`);
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new Error(`Production order ${orderId} not found`);
    if (
      order.status !== ProductionOrderStatus.DRAFT &&
      order.status !== ProductionOrderStatus.RELEASED
    ) {
      throw new Error(
        `Can only cancel DRAFT or RELEASED orders (currently ${order.status})`,
      );
    }

    if (order.status === ProductionOrderStatus.RELEASED) {
      await tx.productionOrderComponent.updateMany({
        where: { productionOrderId: orderId },
        data: { reservedQuantity: 0 },
      });
    }

    const updated = await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: ProductionOrderStatus.CANCELLED },
      select: { id: true, status: true },
    });

    await writeAudit({
      entityType: "ProductionOrder",
      entityId: orderId,
      action: "CANCEL",
      actorId,
      before: { status: order.status },
      after: { status: ProductionOrderStatus.CANCELLED },
      metadata: { reason: reason.trim() },
      tx,
    });

    return updated;
  });
}

/**
 * Issue raw materials to a RELEASED or IN_PROGRESS order:
 *   - validates each line's quantity ≤ remaining (planned − issued)
 *   - validates each source location has enough stock
 *   - posts negative MATERIAL_ISSUE inventory ledger entries (reuses Phase 2)
 *   - increments issuedQuantity, decrements reservedQuantity per component
 *   - flips RELEASED → IN_PROGRESS on first issue (sets startedAt)
 *   - audits both the issue + the status change (if any)
 */
export async function issueMaterialsToOrder(
  input: IssueMaterialsInput,
  actorId: string,
): Promise<{
  id: string;
  orderNumber: string;
  newStatus: ProductionOrderStatus;
  issuedLineCount: number;
}> {
  const parsed = issueMaterialsSchema.parse(input);

  const actor = await loadActor(actorId);
  if (
    actor.role !== UserRole.REQUESTER &&
    actor.role !== UserRole.APPROVER &&
    actor.role !== UserRole.ADMIN
  ) {
    throw new ForbiddenError(`Role ${actor.role} cannot issue materials`);
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: parsed.orderId },
      include: {
        components: {
          include: { material: { select: { materialNumber: true } } },
        },
      },
    });
    if (!order) throw new Error(`Production order ${parsed.orderId} not found`);
    if (
      order.status !== ProductionOrderStatus.RELEASED &&
      order.status !== ProductionOrderStatus.IN_PROGRESS
    ) {
      throw new Error(
        `Can only issue against RELEASED or IN_PROGRESS orders (currently ${order.status})`,
      );
    }

    const componentById = new Map(order.components.map((c) => [c.id, c]));

    type Validated = {
      component: (typeof order.components)[number];
      quantity: Prisma.Decimal;
      storageLocationId: string;
      notes?: string;
    };
    const validated: Validated[] = [];

    for (const line of parsed.lines) {
      const c = componentById.get(line.componentId);
      if (!c) {
        throw new Error(
          `Component ${line.componentId} does not belong to order ${order.orderNumber}`,
        );
      }
      const qty = new Prisma.Decimal(line.quantity);
      const remaining = c.plannedQuantity.sub(c.issuedQuantity);
      if (qty.gt(remaining)) {
        throw new Error(
          `Component L${c.lineNumber} ${c.material.materialNumber}: issuing ${qty.toString()} exceeds remaining ${remaining.toString()} (planned ${c.plannedQuantity.toString()}, already issued ${c.issuedQuantity.toString()})`,
        );
      }
      // Check stock at the source location
      const balance = await tx.inventoryBalance.findUnique({
        where: {
          materialId_storageLocationId: {
            materialId: c.materialId,
            storageLocationId: line.storageLocationId,
          },
        },
      });
      if (!balance || balance.quantityOnHand.lt(qty)) {
        throw new Error(
          `Component L${c.lineNumber} ${c.material.materialNumber}: insufficient stock at source location (need ${qty.toString()}, have ${balance?.quantityOnHand.toString() ?? "0"})`,
        );
      }
      validated.push({
        component: c,
        quantity: qty,
        storageLocationId: line.storageLocationId,
        notes: line.notes,
      });
    }

    // Post movements + update components
    for (const v of validated) {
      await postInventoryMovement(tx, {
        movementType: InventoryMovementType.MATERIAL_ISSUE,
        materialId: v.component.materialId,
        storageLocationId: v.storageLocationId,
        quantity: v.quantity.neg(),
        unitOfMeasureId: v.component.unitOfMeasureId,
        referenceType: "ProductionOrder",
        referenceId: order.id,
        postedById: actorId,
        notes: v.notes,
      });
      await tx.productionOrderComponent.update({
        where: { id: v.component.id },
        data: {
          issuedQuantity: { increment: v.quantity },
          reservedQuantity: { decrement: v.quantity },
        },
      });
    }

    // Status flip on first issue
    let newStatus: ProductionOrderStatus = order.status;
    if (order.status === ProductionOrderStatus.RELEASED) {
      newStatus = ProductionOrderStatus.IN_PROGRESS;
      await tx.productionOrder.update({
        where: { id: order.id },
        data: { status: newStatus, startedAt: new Date() },
      });
      await writeAudit({
        entityType: "ProductionOrder",
        entityId: order.id,
        action: "STATUS_CHANGE",
        actorId,
        before: { status: ProductionOrderStatus.RELEASED },
        after: { status: ProductionOrderStatus.IN_PROGRESS },
        metadata: { triggeredBy: { type: "MaterialIssue" } },
        tx,
      });
    }

    await writeAudit({
      entityType: "ProductionOrder",
      entityId: order.id,
      action: "ISSUE_MATERIALS",
      actorId,
      metadata: {
        notes: parsed.notes ?? null,
        lines: validated.map((v) => ({
          componentLineNumber: v.component.lineNumber,
          materialNumber: v.component.material.materialNumber,
          quantity: v.quantity.toString(),
          storageLocationId: v.storageLocationId,
        })),
      },
      tx,
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      newStatus,
      issuedLineCount: validated.length,
    };
  });
}

/**
 * Used by the issue page: per-component balances at every storage location
 * that has stock for that component's material.
 */
export async function getOrderComponentSourceBalances(orderId: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      components: {
        include: {
          material: { select: { id: true, materialNumber: true, name: true } },
          unitOfMeasure: { select: { code: true } },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  const componentsWithStock = await Promise.all(
    order.components.map(async (c) => {
      const balances = await prisma.inventoryBalance.findMany({
        where: { materialId: c.materialId, quantityOnHand: { gt: 0 } },
        include: {
          storageLocation: {
            include: { warehouse: { select: { code: true, name: true } } },
          },
        },
      });
      return { component: c, balances };
    }),
  );

  return { order, componentsWithStock };
}
