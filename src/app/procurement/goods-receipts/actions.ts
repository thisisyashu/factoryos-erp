"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/current-user";
import { postGoodsReceipt } from "@/lib/services/goods-receipt";
import type { ReceiveGoodsInput } from "@/lib/validators/goods-receipt";

const LIST_PATH = "/procurement/goods-receipts";
const detailPath = (id: string) => `${LIST_PATH}/${id}`;

export async function postGrAction(input: ReceiveGoodsInput) {
  const user = await requireCurrentUser();
  const result = await postGoodsReceipt(input, user.id);
  revalidatePath(LIST_PATH);
  revalidatePath("/procurement/purchase-orders");
  revalidatePath(`/procurement/purchase-orders/${input.poId}`);
  redirect(detailPath(result.id));
}
