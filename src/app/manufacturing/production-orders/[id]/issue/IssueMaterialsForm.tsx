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
import { issueMaterialsAction } from "../../actions";

type Balance = {
  storageLocationId: string;
  warehouseCode: string;
  warehouseName: string;
  locationCode: string;
  available: string;
};

type IssueRow = {
  componentId: string;
  lineNumber: number;
  materialNumber: string;
  materialName: string;
  uomCode: string;
  plannedQuantity: string;
  issuedQuantity: string;
  remaining: string;
  balances: Balance[];
};

type Draft = {
  quantity: string;
  storageLocationId: string;
  notes: string;
};

export function IssueMaterialsForm({
  orderId,
  orderNumber,
  rows,
}: {
  orderId: string;
  orderNumber: string;
  rows: IssueRow[];
}) {
  const [headerNotes, setHeaderNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(
      rows.map((r) => [
        r.componentId,
        {
          // Default qty: leave blank so user explicitly opts in per line
          quantity: "",
          storageLocationId: r.balances[0]?.storageLocationId ?? "",
          notes: "",
        },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(componentId: string, patch: Partial<Draft>) {
    setDrafts({ ...drafts, [componentId]: { ...drafts[componentId], ...patch } });
  }

  function handlePost() {
    setError(null);

    const lines = rows
      .map((r) => {
        const d = drafts[r.componentId];
        const qty = parseFloat(d.quantity);
        if (!Number.isFinite(qty) || qty <= 0) return null;
        if (qty > parseFloat(r.remaining)) {
          throw new Error(
            `L${r.lineNumber} ${r.materialNumber}: ${qty} exceeds remaining ${r.remaining}`,
          );
        }
        if (!d.storageLocationId) {
          throw new Error(`L${r.lineNumber} ${r.materialNumber}: pick a source location`);
        }
        return {
          componentId: r.componentId,
          quantity: qty,
          storageLocationId: d.storageLocationId,
          notes: d.notes.trim() || undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (lines.length === 0) {
      setError("Enter a positive 'Issuing now' for at least one component.");
      return;
    }

    startTransition(async () => {
      try {
        await issueMaterialsAction({
          orderId,
          notes: headerNotes.trim() || undefined,
          lines,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Issue failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={headerNotes}
            onChange={(e) => setHeaderNotes(e.target.value)}
            rows={2}
            placeholder="Shift A pick, kit prep, etc."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components — {orderNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Component</div>
              <div className="col-span-2 text-right">Planned / Issued / Left</div>
              <div className="col-span-2 text-right">Issuing now</div>
              <div className="col-span-3">Source location</div>
            </div>
            {rows.map((r) => {
              const d = drafts[r.componentId];
              const noStock = r.balances.length === 0;
              return (
                <div
                  key={r.componentId}
                  className={`grid grid-cols-12 gap-2 items-center py-2 border-t ${
                    noStock ? "opacity-60" : ""
                  }`}
                >
                  <div className="col-span-1 text-sm">{r.lineNumber}</div>
                  <div className="col-span-4">
                    <div className="text-sm font-medium">{r.materialName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.materialNumber} · {r.uomCode}
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm tabular-nums">
                    <div>{r.plannedQuantity}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.issuedQuantity} / <span className="font-medium">{r.remaining}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    {noStock ? (
                      <span className="text-xs text-destructive">No stock</span>
                    ) : (
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        max={r.remaining}
                        value={d.quantity}
                        onChange={(e) =>
                          update(r.componentId, { quantity: e.target.value })
                        }
                        className="text-right"
                      />
                    )}
                  </div>
                  <div className="col-span-3">
                    {noStock ? (
                      <span className="text-xs text-muted-foreground">
                        — receive material first
                      </span>
                    ) : (
                      <Select
                        value={d.storageLocationId}
                        onValueChange={(v) =>
                          update(r.componentId, { storageLocationId: v ?? "" })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick…" />
                        </SelectTrigger>
                        <SelectContent>
                          {r.balances.map((b) => (
                            <SelectItem key={b.storageLocationId} value={b.storageLocationId}>
                              {b.warehouseCode}/{b.locationCode}
                              <span className="text-muted-foreground">
                                {" "}
                                — {b.available} avail
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="col-span-12 mt-1">
                    {!noStock && (
                      <Input
                        value={d.notes}
                        onChange={(e) => update(r.componentId, { notes: e.target.value })}
                        placeholder="Notes (optional)"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Leave "Issuing now" blank to skip a component. Components with no stock
            anywhere need a goods receipt before they can be issued.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button type="button" onClick={handlePost} disabled={isPending}>
          {isPending ? "Issuing…" : "Post material issue"}
        </Button>
      </div>
    </div>
  );
}
