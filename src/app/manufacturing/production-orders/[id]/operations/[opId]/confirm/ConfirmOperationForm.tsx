"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmOperationAction } from "../../../../actions";

export function ConfirmOperationForm({
  productionOrderId,
  operationId,
  plannedSetupHours,
  plannedRunHours,
}: {
  productionOrderId: string;
  operationId: string;
  plannedSetupHours: string;
  plannedRunHours: string;
}) {
  // Pre-fill actuals with planned — operator overrides if reality differed.
  const [actualSetupHours, setActualSetupHours] = useState(plannedSetupHours);
  const [actualRunHours, setActualRunHours] = useState(plannedRunHours);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setupVariance =
    parseFloat(actualSetupHours) - parseFloat(plannedSetupHours);
  const runVariance = parseFloat(actualRunHours) - parseFloat(plannedRunHours);
  const setupVarianceOk = Number.isFinite(setupVariance);
  const runVarianceOk = Number.isFinite(runVariance);

  function handleSubmit() {
    setError(null);
    const setup = parseFloat(actualSetupHours);
    const run = parseFloat(actualRunHours);
    if (!Number.isFinite(setup) || setup < 0) {
      setError("Actual setup hours must be ≥ 0");
      return;
    }
    if (!Number.isFinite(run) || run < 0) {
      setError("Actual run hours must be ≥ 0");
      return;
    }
    startTransition(async () => {
      try {
        await confirmOperationAction({
          productionOrderId,
          operationId,
          actualSetupHours: setup,
          actualRunHours: run,
          notes: notes.trim() || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Confirm failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture actuals</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="actualSetup">Actual setup hours</Label>
          <Input
            id="actualSetup"
            type="number"
            step="any"
            min="0"
            value={actualSetupHours}
            onChange={(e) => setActualSetupHours(e.target.value)}
          />
          {setupVarianceOk && setupVariance !== 0 && (
            <p
              className={`text-xs ${setupVariance > 0 ? "text-destructive" : "text-foreground"}`}
            >
              Variance: {setupVariance > 0 ? "+" : ""}
              {setupVariance.toFixed(4)} h vs plan
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="actualRun">Actual run hours</Label>
          <Input
            id="actualRun"
            type="number"
            step="any"
            min="0"
            value={actualRunHours}
            onChange={(e) => setActualRunHours(e.target.value)}
          />
          {runVarianceOk && runVariance !== 0 && (
            <p
              className={`text-xs ${runVariance > 0 ? "text-destructive" : "text-foreground"}`}
            >
              Variance: {runVariance > 0 ? "+" : ""}
              {runVariance.toFixed(4)} h vs plan
            </p>
          )}
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Operator name, downtime, defects, etc."
          />
        </div>
        {error && (
          <div className="md:col-span-2 rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="md:col-span-2 flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Confirming…" : "Confirm operation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
