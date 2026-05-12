"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import {
  createPurchaseOrder,
  convertPrToPo,
  submitPurchaseOrder,
  approvePurchaseOrder,
  sendPurchaseOrder,
  type CreatePurchaseOrderOptions,
  type ConvertPrToPoOptions,
} from "@/lib/services/purchase-order";

const LIST_PATH = "/procurement/purchase-orders";
const detailPath = (id: string) => `${LIST_PATH}/${id}`;
const PR_LIST_PATH = "/procurement/purchase-requisitions";
const prDetailPath = (id: string) => `${PR_LIST_PATH}/${id}`;

/** Manual PO creation (no source PR). Called from CreatePoForm client. */
export async function createPoAction(input: CreatePurchaseOrderOptions) {
  const user = await requireCurrentUser();
  const created = await createPurchaseOrder(input, user.id);
  revalidatePath(LIST_PATH);
  redirect(detailPath(created.id));
}

/** Convert an APPROVED PR into a new PO. Called from ConvertPrToPoForm client. */
export async function convertPrToPoAction(input: ConvertPrToPoOptions) {
  const user = await requireCurrentUser();
  const created = await convertPrToPo(input, user.id);
  // Revalidate both PR + PO lists/details since both change.
  revalidatePath(LIST_PATH);
  revalidatePath(PR_LIST_PATH);
  revalidatePath(prDetailPath(input.prId));
  redirect(detailPath(created.id));
}

/** State-change form actions (FormData → primitive) */

export async function submitPoFormAction(formData: FormData) {
  const poId = formData.get("poId");
  if (typeof poId !== "string") throw new Error("poId required");
  const user = await requireCurrentUser();
  await submitPurchaseOrder(poId, user.id);
  revalidatePath(detailPath(poId));
  revalidatePath(LIST_PATH);
}

export async function approvePoFormAction(formData: FormData) {
  const poId = formData.get("poId");
  const comments = formData.get("comments");
  if (typeof poId !== "string") throw new Error("poId required");
  const user = await requireCurrentUser();
  await approvePurchaseOrder(
    poId,
    user.id,
    typeof comments === "string" && comments.trim() ? comments : undefined,
  );
  revalidatePath(detailPath(poId));
  revalidatePath(LIST_PATH);
}

export async function sendPoFormAction(formData: FormData) {
  const poId = formData.get("poId");
  if (typeof poId !== "string") throw new Error("poId required");
  const user = await requireCurrentUser();
  await sendPurchaseOrder(poId, user.id);
  revalidatePath(detailPath(poId));
  revalidatePath(LIST_PATH);
}
