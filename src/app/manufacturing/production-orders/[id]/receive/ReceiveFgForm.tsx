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
import { receiveFgAction } from "../../actions";

type StorageOption = {
  id: string;
  code: string;
  warehouseCode: string;
  warehouseName: string;
};

export function ReceiveFgForm({
  productionOrderId,
  orderNumber,
  uomCode,
  remaining,
  storageLocations,
}: {
  productionOrderId: string;
  orderNumber: string;
  uomCode: string;
  remaining: string;
  storageLocations: StorageOption[];
}) {
  const [quantity, setQuantity] = useState<string>(remaining);
  const [scrapped, setScrapped] = useState<string>("0");
  const [storageLocationId, setStorageLocationId] = useState<string>(
    storageLocations[0]?.id ?? "",
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const q = parseFloat(quantity);
  const s = parseFloat(scrapped);
  const totalNew = (Number.isFinite(q) ? q : 0) + (Number.isFinite(s) ? s : 0);
  const remainingNum = parseFloat(remaining);
  const willComplete = Number.isFinite(totalNew) && totalNew >= remainingNum;
  const overReceipt = totalNew > remainingNum + 1e-9;
  const noQty = totalNew <= 0;
  const yieldPct =
    Number.isFinite(q) && Number.isFinite(s) && q + s > 0
      ? (q / (q + s)) * 100
      : null;

  function handleSubmit() {
    setError(null);
    if (overReceipt) {
      setError(`Total ${totalNew} exceeds remaining ${remaining}`);
      return;
    }
    if (noQty) {
      setError("Either completed or scrapped must be > 0");
      return;
    }
    if (q > 0 && !storageLocationId) {
      setError("Pick a storage location to put the good FG into");
      return;
    }
    startTransition(async () => {
      try {
        await receiveFgAction({
          productionOrderId,
          quantity: q,
          scrappedQuantity: s,
          storageLocationId: q > 0 ? storageLocationId : undefined,
          notes: notes.trim() || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Receipt failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt for {orderNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="quantity">
              Good FG to receive ({uomCode})
            </Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Posts a positive PRODUCTION_RECEIPT entry to inventory.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="scrapped">Scrap ({uomCode})</Label>
            <Input
              id="scrapped"
              type="number"
              step="any"
              min="0"
              value={scrapped}
              onChange={(e) => setScrapped(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recorded against the order, not added to inventory.
            </p>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>Storage location for good FG</Label>
            <Select
              value={storageLocationId}
              onValueChange={(v) => setStorageLocationId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a location…" />
              </SelectTrigger>
              <SelectContent>
                {storageLocations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.warehouseCode}/{s.code}
                    <span className="text-muted-foreground"> — {s.warehouseName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Lot reference, inspection signoff, etc."
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <div>
            Total being received now: <strong className="tabular-nums">{Number.isFinite(totalNew) ? totalNew : 0} {uomCode}</strong>{" "}
            of remaining <span className="tabular-nums">{remaining} {uomCode}</span>
          </div>
          {yieldPct != null && (
            <div className="text-muted-foreground">
              This receipt's yield: <strong className="text-foreground">{yieldPct.toFixed(1)}%</strong>{" "}
              ({q} good / {q + s} total)
            </div>
          )}
          {willComplete && !overReceipt && (
            <div className="text-foreground font-medium">
              ✓ This receipt will COMPLETE the order.
            </div>
          )}
          {overReceipt && (
            <div className="text-destructive font-medium">
              ✗ Total exceeds remaining — reduce one of the quantities.
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || overReceipt || noQty}
          >
            {isPending ? "Posting…" : willComplete ? "Receive & complete" : "Receive"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
