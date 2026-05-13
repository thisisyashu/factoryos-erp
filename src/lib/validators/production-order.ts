import { z } from "zod";

const positiveDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, "must be a positive number");

export const createProductionOrderSchema = z.object({
  parentMaterialId: z.string().min(1, "parentMaterialId required"),
  quantity: positiveDecimal,
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;

export const issueMaterialLineSchema = z.object({
  componentId: z.string().min(1),
  quantity: positiveDecimal,
  storageLocationId: z.string().min(1, "storageLocationId required"),
  notes: z.string().max(500).optional(),
});

export const issueMaterialsSchema = z.object({
  orderId: z.string().min(1),
  notes: z.string().max(1000).optional(),
  lines: z.array(issueMaterialLineSchema).min(1, "At least one component line required"),
});

export type IssueMaterialsInput = z.infer<typeof issueMaterialsSchema>;

const nonNegativeDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n >= 0, "must be zero or positive");

export const confirmOperationSchema = z.object({
  productionOrderId: z.string().min(1),
  operationId: z.string().min(1),
  actualSetupHours: nonNegativeDecimal,
  actualRunHours: nonNegativeDecimal,
  notes: z.string().max(1000).optional(),
});

export const skipOperationSchema = z.object({
  productionOrderId: z.string().min(1),
  operationId: z.string().min(1),
  reason: z.string().min(1, "reason required").max(500),
});

export type ConfirmOperationInput = z.infer<typeof confirmOperationSchema>;
export type SkipOperationInput = z.infer<typeof skipOperationSchema>;

export const receiveFinishedGoodsSchema = z
  .object({
    productionOrderId: z.string().min(1),
    quantity: nonNegativeDecimal, // FG units (good)
    scrappedQuantity: nonNegativeDecimal.optional().default(0),
    storageLocationId: z.string().optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (v) => v.quantity > 0 || (v.scrappedQuantity ?? 0) > 0,
    "either quantity or scrappedQuantity must be > 0",
  )
  .refine(
    (v) => !(v.quantity > 0) || (v.storageLocationId && v.storageLocationId.length > 0),
    "storageLocationId required when receiving good FG",
  );

// Use z.input so callers can omit fields with defaults (e.g. scrappedQuantity).
// The service's .parse() applies the default to make output strict.
export type ReceiveFinishedGoodsInput = z.input<typeof receiveFinishedGoodsSchema>;
