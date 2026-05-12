import { z } from "zod";

const positiveDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, "must be a positive number");

export const receiveGoodsLineSchema = z.object({
  poLineId: z.string().min(1),
  quantity: positiveDecimal,
  storageLocationId: z.string().min(1, "storageLocationId required"),
  notes: z.string().max(500).optional(),
});

export const receiveGoodsSchema = z.object({
  poId: z.string().min(1),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(receiveGoodsLineSchema)
    .min(1, "At least one line required"),
});

export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
export type ReceiveGoodsLineInput = z.infer<typeof receiveGoodsLineSchema>;
