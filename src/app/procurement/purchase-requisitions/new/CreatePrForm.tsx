"use client";

import { useState, useTransition } from "react";
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
import { createPrAction } from "../actions";

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
  estimatedCost: string;
  notes: string;
};

let LINE_KEY = 0;
function emptyLine(uomId: string): LineDraft {
  return {
    key: `line-${++LINE_KEY}`,
    materialId: "",
    unitOfMeasureId: uomId,
    quantity: "",
    estimatedCost: "",
    notes: "",
  };
}

export function CreatePrForm({
  materials,
  uoms,
  defaultDepartment,
}: {
  materials: MaterialOption[];
  uoms: UomOption[];
  defaultDepartment: string;
}) {
  const fallbackUomId = uoms[0]?.id ?? "";
  const [department, setDepartment] = useState(defaultDepartment);
  const [reason, setReason] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(fallbackUomId)]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      // Pre-fill estimated cost from standard cost if empty
      estimatedCost:
        lines[idx].estimatedCost === "" && mat?.standardCost
          ? mat.standardCost
          : lines[idx].estimatedCost,
    });
  }

  function handleSubmit(submit: boolean) {
    setError(null);

    if (lines.length === 0) {
      setError("At least one line required");
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
    }

    startTransition(async () => {
      try {
        await createPrAction({
          department: department.trim() || undefined,
          reason: reason.trim() || undefined,
          neededBy: neededBy ? new Date(neededBy) : undefined,
          submit,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            unitOfMeasureId: l.unitOfMeasureId,
            quantity: parseFloat(l.quantity),
            estimatedCost: l.estimatedCost ? parseFloat(l.estimatedCost) : undefined,
            notes: l.notes.trim() || undefined,
          })),
        });
        // server action redirects on success — never returns here
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create PR");
      }
    });
  }

  const totalEstimated = lines.reduce((sum, l) => {
    const q = parseFloat(l.quantity);
    const c = parseFloat(l.estimatedCost);
    return sum + (Number.isFinite(q) && Number.isFinite(c) ? q * c : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Engineering"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="neededBy">Needed by</Label>
            <Input
              id="neededBy"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>
          <div className="md:col-span-3 space-y-1">
            <Label htmlFor="reason">Business reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this needed?"
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
              <div className="col-span-4 md:col-span-2 space-y-1">
                {idx === 0 && <Label>Quantity</Label>}
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
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
              <div className="col-span-3 md:col-span-2 space-y-1">
                {idx === 0 && <Label>Est. cost / unit</Label>}
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={line.estimatedCost}
                  onChange={(e) => updateLine(idx, { estimatedCost: e.target.value })}
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
          {totalEstimated > 0 && (
            <div className="text-right text-sm text-muted-foreground">
              Estimated total:{" "}
              <span className="font-medium text-foreground">
                ${totalEstimated.toFixed(2)}
              </span>
            </div>
          )}
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
