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
