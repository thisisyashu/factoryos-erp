import { z } from "zod";

const positiveDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, "must be a positive number");

const nonNegativeDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n >= 0, "must be zero or positive");

// Manual PO creation
export const createPurchaseOrderLineSchema = z.object({
  materialId: z.string().min(1, "materialId required"),
  unitOfMeasureId: z.string().min(1, "unitOfMeasureId required"),
  quantity: positiveDecimal,
  unitPrice: nonNegativeDecimal,
  notes: z.string().max(500).optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "supplierId required"),
  currency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
  lines: z
    .array(createPurchaseOrderLineSchema)
    .min(1, "PO must have at least one line"),
});

// PR → PO conversion
export const convertPrToPoLineSchema = z.object({
  prLineId: z.string().min(1),
  unitPrice: nonNegativeDecimal,
});

export const convertPrToPoSchema = z.object({
  prId: z.string().min(1),
  supplierId: z.string().min(1),
  currency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(convertPrToPoLineSchema).min(1),
});

// State changes (no payload beyond id; some carry comments)
export const approvePurchaseOrderSchema = z.object({
  poId: z.string().min(1),
  comments: z.string().max(1000).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreatePurchaseOrderLineInput = z.infer<typeof createPurchaseOrderLineSchema>;
export type ConvertPrToPoInput = z.infer<typeof convertPrToPoSchema>;
