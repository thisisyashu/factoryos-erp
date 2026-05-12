import { z } from "zod";

// Quantity / cost fields are Decimal in the DB; we accept number on the wire
// and let Prisma convert. Anything fractional is fine (KG, L, fractional EA).

const positiveDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, "must be a positive number");

const nonNegativeDecimal = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n >= 0, "must be zero or positive");

export const createPurchaseRequisitionLineSchema = z.object({
  materialId: z.string().min(1, "materialId required"),
  unitOfMeasureId: z.string().min(1, "unitOfMeasureId required"),
  quantity: positiveDecimal,
  estimatedCost: nonNegativeDecimal.optional(),
  notes: z.string().max(500).optional(),
});

export const createPurchaseRequisitionSchema = z.object({
  department: z.string().max(100).optional(),
  reason: z.string().max(1000).optional(),
  neededBy: z.coerce.date().optional(),
  lines: z
    .array(createPurchaseRequisitionLineSchema)
    .min(1, "PR must have at least one line"),
});

export const submitPurchaseRequisitionSchema = z.object({
  prId: z.string().min(1),
});

export const approvePurchaseRequisitionSchema = z.object({
  prId: z.string().min(1),
  comments: z.string().max(1000).optional(),
});

export const rejectPurchaseRequisitionSchema = z.object({
  prId: z.string().min(1),
  rejectionReason: z.string().min(1, "rejectionReason required").max(1000),
});

export type CreatePurchaseRequisitionInput = z.infer<typeof createPurchaseRequisitionSchema>;
export type CreatePurchaseRequisitionLineInput = z.infer<typeof createPurchaseRequisitionLineSchema>;
