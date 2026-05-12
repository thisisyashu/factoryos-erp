"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import {
  createProductionOrder,
  releaseProductionOrder,
  cancelProductionOrder,
  issueMaterialsToOrder,
  type ProductionOrderListItem,
} from "@/lib/services/production-order";
import type {
  CreateProductionOrderInput,
  IssueMaterialsInput,
} from "@/lib/validators/production-order";

const LIST_PATH = "/manufacturing/production-orders";
const detailPath = (id: string) => `${LIST_PATH}/${id}`;
const INVENTORY_PATHS = ["/inventory", "/inventory/stock", "/inventory/ledger"];

function revalidateAfterIssue(orderId: string) {
  revalidatePath(LIST_PATH);
  revalidatePath(detailPath(orderId));
  for (const p of INVENTORY_PATHS) revalidatePath(p);
}

export async function createProductionOrderAction(
  input: CreateProductionOrderInput,
) {
  const user = await requireCurrentUser();
  const created = await createProductionOrder(input, user.id);
  revalidatePath(LIST_PATH);
  redirect(detailPath(created.id));
}

export async function releasePoFormAction(formData: FormData) {
  const orderId = formData.get("orderId");
  if (typeof orderId !== "string") throw new Error("orderId required");
  const user = await requireCurrentUser();
  await releaseProductionOrder(orderId, user.id);
  revalidatePath(detailPath(orderId));
  revalidatePath(LIST_PATH);
}

export async function cancelPoFormAction(formData: FormData) {
  const orderId = formData.get("orderId");
  const reason = formData.get("reason");
  if (typeof orderId !== "string") throw new Error("orderId required");
  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("Cancellation reason is required");
  }
  const user = await requireCurrentUser();
  await cancelProductionOrder(orderId, user.id, reason.trim());
  revalidatePath(detailPath(orderId));
  revalidatePath(LIST_PATH);
}

export async function issueMaterialsAction(input: IssueMaterialsInput) {
  const user = await requireCurrentUser();
  const result = await issueMaterialsToOrder(input, user.id);
  revalidateAfterIssue(result.id);
  redirect(detailPath(result.id));
}

// Re-export the type so client components can import it without pulling
// the full service module.
export type { ProductionOrderListItem };
