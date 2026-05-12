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
import { createProductionOrderAction } from "../actions";

type MaterialOption = {
  id: string;
  materialNumber: string;
  name: string;
  type: string;
  uomCode: string;
};

export function CreateProductionOrderForm({
  materials,
}: {
  materials: MaterialOption[];
}) {
  const [parentMaterialId, setParentMaterialId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [plannedStartDate, setPlannedStartDate] = useState<string>("");
  const [plannedEndDate, setPlannedEndDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === parentMaterialId) ?? null,
    [materials, parentMaterialId],
  );

  function handleSubmit() {
    setError(null);
    if (!parentMaterialId) {
      setError("Pick a material to produce");
      return;
    }
    const q = parseFloat(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    if (
      plannedStartDate &&
      plannedEndDate &&
      new Date(plannedStartDate) > new Date(plannedEndDate)
    ) {
      setError("Planned end date must be on or after planned start date");
      return;
    }

    startTransition(async () => {
      try {
        await createProductionOrderAction({
          parentMaterialId,
          quantity: q,
          plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : undefined,
          plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : undefined,
          notes: notes.trim() || undefined,
        });
        // server action redirects to detail on success
      } catch (e) {
        setError(e instanceof Error ? e.message : "Create failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Order details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label>Material to produce</Label>
            <Select
              value={parentMaterialId}
              onValueChange={(v) => setParentMaterialId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a material…" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.materialNumber} — {m.name}
                    <span className="text-muted-foreground"> ({m.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMaterial && (
              <p className="text-xs text-muted-foreground">
                Quantity will be in <span className="font-mono">{selectedMaterial.uomCode}</span>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity to produce</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
            />
          </div>
          <div />
          <div className="space-y-1">
            <Label htmlFor="plannedStartDate">Planned start</Label>
            <Input
              id="plannedStartDate"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plannedEndDate">Planned end</Label>
            <Input
              id="plannedEndDate"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Project Halo, Q3 build, etc."
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/40 p-4 text-sm space-y-2">
        <div className="font-medium">What happens when you create this order?</div>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>The system finds the ACTIVE BOM for the picked material.</li>
          <li>
            BOM explosion runs: <span className="font-mono">plannedQty = bomLineQty × orderQty × (1 + scrap%/100)</span>{" "}
            for every component.
          </li>
          <li>
            The ACTIVE Routing is snapshotted: each operation captures the work
            center + planned setup hours + planned run hours.
          </li>
          <li>Order lands in DRAFT status. Release happens in the next chunk.</li>
        </ol>
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Creating…" : "Create production order"}
        </Button>
      </div>
    </div>
  );
}
