import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-lg space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">FactoryOS ERP</h1>
            <p className="text-muted-foreground mt-2">Sign in to continue.</p>
          </div>
          <Link href="/dev-login" className={buttonVariants()}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">FactoryOS ERP</h1>
            <p className="text-muted-foreground mt-1">
              Welcome, {user.name}{" "}
              <Badge variant="secondary" className="ml-1">
                {user.role}
              </Badge>
            </p>
          </div>
          <Link
            href="/dev-login"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Switch user
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/procurement/purchase-requisitions"
            className="block border rounded-lg p-6 hover:bg-muted/50 transition"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Procurement
            </div>
            <div className="font-semibold mt-1">Purchase Requisitions</div>
            <div className="text-sm text-muted-foreground mt-2">
              Create and approve internal procurement requests.
            </div>
          </Link>
          <Link
            href="/procurement/purchase-orders"
            className="block border rounded-lg p-6 hover:bg-muted/50 transition"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Procurement
            </div>
            <div className="font-semibold mt-1">Purchase Orders</div>
            <div className="text-sm text-muted-foreground mt-2">
              Outbound orders to suppliers, manual or converted from PRs.
            </div>
          </Link>
          <Link
            href="/procurement/goods-receipts"
            className="block border rounded-lg p-6 hover:bg-muted/50 transition"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Procurement
            </div>
            <div className="font-semibold mt-1">Goods Receipts</div>
            <div className="text-sm text-muted-foreground mt-2">
              Receive against POs and post inventory ledger movements.
            </div>
          </Link>
          <Link
            href="/manufacturing"
            className="block border rounded-lg p-6 hover:bg-muted/50 transition"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Manufacturing
            </div>
            <div className="font-semibold mt-1">Production Orders</div>
            <div className="text-sm text-muted-foreground mt-2">
              BOM-driven production: create orders, run BOM explosion, and snapshot routings.
            </div>
          </Link>
          <Link
            href="/inventory"
            className="block border rounded-lg p-6 hover:bg-muted/50 transition"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Inventory
            </div>
            <div className="font-semibold mt-1">Stock & Ledger</div>
            <div className="text-sm text-muted-foreground mt-2">
              Current stock by location, full movement history, and warehouse views.
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
