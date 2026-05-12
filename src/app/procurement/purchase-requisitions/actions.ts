"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import {
  createPurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  rejectPurchaseRequisition,
  type CreatePurchaseRequisitionOptions,
} from "@/lib/services/purchase-requisition";

const LIST_PATH = "/procurement/purchase-requisitions";
const detailPath = (id: string) => `${LIST_PATH}/${id}`;

/**
 * Called from CreatePrForm (client component) — typed input, not FormData.
 */
export async function createPrAction(input: CreatePurchaseRequisitionOptions) {
  const user = await requireCurrentUser();
  const created = await createPurchaseRequisition(input, user.id);
  revalidatePath(LIST_PATH);
  redirect(detailPath(created.id));
}

/**
 * The submit/approve/reject actions are bound to <form action={...}> in the
 * detail page. They take FormData and read prId from a hidden input.
 */
export async function submitPrFormAction(formData: FormData) {
  const prId = formData.get("prId");
  if (typeof prId !== "string") throw new Error("prId required");
  const user = await requireCurrentUser();
  await submitPurchaseRequisition(prId, user.id);
  revalidatePath(detailPath(prId));
  revalidatePath(LIST_PATH);
}

export async function approvePrFormAction(formData: FormData) {
  const prId = formData.get("prId");
  const comments = formData.get("comments");
  if (typeof prId !== "string") throw new Error("prId required");
  const user = await requireCurrentUser();
  await approvePurchaseRequisition(
    prId,
    user.id,
    typeof comments === "string" && comments.trim() ? comments : undefined,
  );
  revalidatePath(detailPath(prId));
  revalidatePath(LIST_PATH);
}

export async function rejectPrFormAction(formData: FormData) {
  const prId = formData.get("prId");
  const reason = formData.get("rejectionReason");
  if (typeof prId !== "string") throw new Error("prId required");
  if (typeof reason !== "string" || !reason.trim()) {
    throw new Error("Rejection reason is required");
  }
  const user = await requireCurrentUser();
  await rejectPurchaseRequisition(prId, user.id, reason.trim());
  revalidatePath(detailPath(prId));
  revalidatePath(LIST_PATH);
}
