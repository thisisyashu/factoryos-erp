"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPoAction } from "../actions";

type SupplierOption = {
  id: string;
  supplierNumber: string;
  legalName: string;
  currency: string | null;
  paymentTermsDays: number | null;
};

type MaterialOption = {
  id: string;
  materialNumber: string;
  name: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  standardCost: string | null;
};

type UomOption = { id: string; code: string; description: string };

type LineDraft = {
  key: string;
  materialId: string;
  unitOfMeasureId: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

let LINE_KEY = 0;
function emptyLine(uomId: string): LineDraft {
  return {
    key: `line-${++LINE_KEY}`,
    materialId: "",
    unitOfMeasureId: uomId,
    quantity: "",
    unitPrice: "",
    notes: "",
  };
}

export function CreatePoForm({
  suppliers,
  materials,
  uoms,
}: {
  suppliers: SupplierOption[];
  materials: MaterialOption[];
  uoms: UomOption[];
}) {
  const fallbackUomId = uoms[0]?.id ?? "";
  const [supplierId, setSupplierId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(fallbackUomId)]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const effectiveCurrency =
    currency.trim() || selectedSupplier?.currency || "USD";

  function addLine() {
    setLines([...lines, emptyLine(fallbackUomId)]);
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function onMaterialChange(idx: number, materialId: string) {
    const mat = materials.find((m) => m.id === materialId);
    updateLine(idx, {
      materialId,
      unitOfMeasureId: mat?.unitOfMeasureId || lines[idx].unitOfMeasureId,
      unitPrice:
        lines[idx].unitPrice === "" && mat?.standardCost
          ? mat.standardCost
          : lines[idx].unitPrice,
    });
  }

  const totalAmount = lines.reduce((sum, l) => {
    const q = parseFloat(l.quantity);
    const p = parseFloat(l.unitPrice);
    return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  function handleSubmit(submit: boolean) {
    setError(null);
    if (!supplierId) {
      setError("Select a supplier");
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.materialId) {
        setError(`Line ${i + 1}: select a material`);
        return;
      }
      if (!l.unitOfMeasureId) {
        setError(`Line ${i + 1}: select a unit of measure`);
        return;
      }
      const q = parseFloat(l.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        setError(`Line ${i + 1}: quantity must be greater than 0`);
        return;
      }
      const p = parseFloat(l.unitPrice);
      if (!Number.isFinite(p) || p < 0) {
        setError(`Line ${i + 1}: unit price must be zero or positive`);
        return;
      }
    }

    startTransition(async () => {
      try {
        await createPoAction({
          supplierId,
          currency: currency.trim() || undefined,
          notes: notes.trim() || undefined,
          submit,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            unitOfMeasureId: l.unitOfMeasureId,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
            notes: l.notes.trim() || undefined,
          })),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create PO");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an ACTIVE supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.supplierNumber} — {s.legalName}
                    {s.currency && (
                      <span className="text-muted-foreground"> ({s.currency})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSupplier?.paymentTermsDays && (
              <p className="text-xs text-muted-foreground">
                Net {selectedSupplier.paymentTermsDays} days
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder={selectedSupplier?.currency || "USD"}
              maxLength={3}
            />
          </div>
          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Special instructions to the supplier (optional)"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lines</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, idx) => (
            <div
              key={line.key}
              className="grid grid-cols-12 gap-2 items-end pb-3 border-b last:border-b-0 last:pb-0"
            >
              <div className="col-span-12 md:col-span-5 space-y-1">
                {idx === 0 && <Label>Material</Label>}
                <Select
                  value={line.materialId}
                  onValueChange={(v) => onMaterialChange(idx, v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material…" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.materialNumber} — {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3 md:col-span-2 space-y-1">
                {idx === 0 && <Label>Quantity</Label>}
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-3 md:col-span-2 space-y-1">
                {idx === 0 && <Label>UoM</Label>}
                <Select
                  value={line.unitOfMeasureId}
                  onValueChange={(v) => updateLine(idx, { unitOfMeasureId: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UoM" />
                  </SelectTrigger>
                  <SelectContent>
                    {uoms.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5 md:col-span-2 space-y-1">
                {idx === 0 && <Label>Unit price</Label>}
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                />
              </div>
              <div className="col-span-1 space-y-1">
                {idx === 0 && <Label>&nbsp;</Label>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                  title="Remove line"
                  className="w-full"
                >
                  ×
                </Button>
              </div>
              <div className="col-span-12 space-y-1">
                <Input
                  value={line.notes}
                  onChange={(e) => updateLine(idx, { notes: e.target.value })}
                  placeholder="Notes (optional)"
                />
              </div>
            </div>
          ))}
          <div className="text-right text-sm pt-2 border-t">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold text-base">
              {totalAmount.toLocaleString("en-US", {
                style: "currency",
                currency: effectiveCurrency || "USD",
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save as draft"}
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
        >
          {isPending ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
    </div>
  );
}
