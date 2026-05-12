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
import { convertPrToPoAction } from "../actions";

type SupplierOption = {
  id: string;
  supplierNumber: string;
  legalName: string;
  currency: string | null;
  paymentTermsDays: number | null;
};

type PrLine = {
  id: string;
  lineNumber: number;
  materialNumber: string;
  materialName: string;
  quantity: string;
  uomCode: string;
  estimatedCost: string;
};

export function ConvertPrToPoForm({
  prId,
  prNumber,
  prLines,
  suppliers,
}: {
  prId: string;
  prNumber: string;
  prLines: PrLine[];
  suppliers: SupplierOption[];
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(prLines.map((l) => [l.id, l.estimatedCost])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );
  const effectiveCurrency =
    currency.trim() || selectedSupplier?.currency || "USD";

  const total = prLines.reduce((sum, l) => {
    const q = parseFloat(l.quantity);
    const p = parseFloat(prices[l.id] ?? "0");
    return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  function handleSubmit(submit: boolean) {
    setError(null);
    if (!supplierId) {
      setError("Select a supplier");
      return;
    }
    for (const l of prLines) {
      const p = parseFloat(prices[l.id] ?? "");
      if (!Number.isFinite(p) || p < 0) {
        setError(`Line ${l.lineNumber} (${l.materialNumber}): unit price required (≥ 0)`);
        return;
      }
    }

    startTransition(async () => {
      try {
        await convertPrToPoAction({
          prId,
          supplierId,
          currency: currency.trim() || undefined,
          notes: notes.trim() || undefined,
          submit,
          lines: prLines.map((l) => ({
            prLineId: l.id,
            unitPrice: parseFloat(prices[l.id] ?? "0"),
          })),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Conversion failed");
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
        <CardHeader>
          <CardTitle>Lines from {prNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Material</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-1">UoM</div>
              <div className="col-span-3 text-right">Unit price</div>
            </div>
            {prLines.map((l) => {
              const q = parseFloat(l.quantity);
              const p = parseFloat(prices[l.id] ?? "");
              const lineTotal =
                Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
              return (
                <div
                  key={l.id}
                  className="grid grid-cols-12 gap-2 items-center py-2 border-t"
                >
                  <div className="col-span-1 text-sm">{l.lineNumber}</div>
                  <div className="col-span-5">
                    <div className="text-sm font-medium">{l.materialName}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.materialNumber}
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm">{l.quantity}</div>
                  <div className="col-span-1 text-sm">{l.uomCode}</div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={prices[l.id] ?? ""}
                      onChange={(e) =>
                        setPrices({ ...prices, [l.id]: e.target.value })
                      }
                      className="text-right"
                    />
                    {lineTotal > 0 && (
                      <div className="text-xs text-muted-foreground text-right mt-0.5">
                        ={" "}
                        {lineTotal.toLocaleString("en-US", {
                          style: "currency",
                          currency: effectiveCurrency,
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="text-right text-sm pt-3 border-t">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold text-base">
                {total.toLocaleString("en-US", {
                  style: "currency",
                  currency: effectiveCurrency,
                })}
              </span>
            </div>
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
          {isPending ? "Saving…" : "Save PO as draft"}
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isPending}
        >
          {isPending ? "Submitting…" : "Save & submit PO"}
        </Button>
      </div>
    </div>
  );
}
