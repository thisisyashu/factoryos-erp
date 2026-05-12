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
import { postGrAction } from "../actions";

type ReceivableLine = {
  id: string;
  lineNumber: number;
  materialNumber: string;
  materialName: string;
  orderedQty: string;
  alreadyReceived: string;
  remaining: string;
  uomId: string;
  uomCode: string;
};

type StorageLocationOption = {
  id: string;
  code: string;
  warehouseCode: string;
  warehouseName: string;
  description: string | null;
};

type LineDraft = {
  receiving: string; // empty string = skip this line
  storageLocationId: string;
  notes: string;
};

export function ReceiveAgainstPoForm({
  poId,
  poNumber,
  lines,
  storageLocations,
}: {
  poId: string;
  poNumber: string;
  lines: ReceivableLine[];
  storageLocations: StorageLocationOption[];
}) {
  const defaultLocation = storageLocations[0]?.id ?? "";

  const [headerNotes, setHeaderNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(
    Object.fromEntries(
      lines.map((l) => [
        l.id,
        // Default: receive all remaining, send to first storage location.
        { receiving: l.remaining, storageLocationId: defaultLocation, notes: "" },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(lineId: string, patch: Partial<LineDraft>) {
    setDrafts({ ...drafts, [lineId]: { ...drafts[lineId], ...patch } });
  }

  function handlePost() {
    setError(null);

    // Build the payload, skipping lines where receiving = 0 / empty.
    const linesToPost = lines
      .map((l) => {
        const d = drafts[l.id];
        const qty = parseFloat(d.receiving);
        if (!Number.isFinite(qty) || qty <= 0) return null;
        const remaining = parseFloat(l.remaining);
        if (qty > remaining) {
          throw new Error(
            `Line ${l.lineNumber} (${l.materialNumber}): receiving ${qty} exceeds remaining ${remaining}`,
          );
        }
        if (!d.storageLocationId) {
          throw new Error(
            `Line ${l.lineNumber} (${l.materialNumber}): pick a storage location`,
          );
        }
        return {
          poLineId: l.id,
          quantity: qty,
          storageLocationId: d.storageLocationId,
          notes: d.notes.trim() || undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (linesToPost.length === 0) {
      setError("Enter a receiving quantity for at least one line.");
      return;
    }

    startTransition(async () => {
      try {
        await postGrAction({
          poId,
          notes: headerNotes.trim() || undefined,
          lines: linesToPost,
        });
        // server action redirects on success
      } catch (e) {
        setError(e instanceof Error ? e.message : "Posting failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Receipt header</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={headerNotes}
            onChange={(e) => setHeaderNotes(e.target.value)}
            rows={2}
            placeholder="Carrier waybill, packing list reference, etc."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lines to receive — {poNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Material</div>
              <div className="col-span-2 text-right">Ordered / Recv</div>
              <div className="col-span-2 text-right">Receiving now</div>
              <div className="col-span-3">Storage location</div>
            </div>
            {lines.map((line) => {
              const d = drafts[line.id];
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-12 gap-2 items-center py-2 border-t"
                >
                  <div className="col-span-1 text-sm">{line.lineNumber}</div>
                  <div className="col-span-4">
                    <div className="text-sm font-medium">{line.materialName}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.materialNumber} · {line.uomCode}
                    </div>
                  </div>
                  <div className="col-span-2 text-right text-sm tabular-nums">
                    <div>{line.orderedQty} ord</div>
                    <div className="text-xs text-muted-foreground">
                      {line.alreadyReceived} recv · {line.remaining} left
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max={line.remaining}
                      value={d.receiving}
                      onChange={(e) => update(line.id, { receiving: e.target.value })}
                      className="text-right"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={d.storageLocationId}
                      onValueChange={(v) =>
                        update(line.id, { storageLocationId: v ?? "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick location…" />
                      </SelectTrigger>
                      <SelectContent>
                        {storageLocations.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.warehouseCode}/{s.code}
                            {s.description && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {s.description}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-12 mt-1">
                    <Input
                      value={d.notes}
                      onChange={(e) => update(line.id, { notes: e.target.value })}
                      placeholder="Notes (optional)"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Set "Receiving now" to 0 (or blank) to skip a line in this receipt — you
            can post it later in another GR.
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
          {isPending ? "Posting…" : "Post goods receipt"}
        </Button>
      </div>
    </div>
  );
}
