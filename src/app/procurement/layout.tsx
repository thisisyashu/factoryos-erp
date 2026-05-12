import Link from "next/link";
import { requireCurrentUser } from "@/lib/current-user";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/app/dev-login/actions";

export const runtime = "nodejs";

export default async function ProcurementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              FactoryOS
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/procurement/purchase-requisitions"
                className="text-muted-foreground hover:text-foreground"
              >
                Purchase Requisitions
              </Link>
              <Link
                href="/procurement/purchase-orders"
                className="text-muted-foreground hover:text-foreground"
              >
                Purchase Orders
              </Link>
              <Link
                href="/procurement/goods-receipts"
                className="text-muted-foreground hover:text-foreground"
              >
                Goods Receipts
              </Link>
              <span className="text-muted-foreground/40">·</span>
              <Link
                href="/inventory"
                className="text-muted-foreground hover:text-foreground"
              >
                Inventory
              </Link>
              <Link
                href="/manufacturing"
                className="text-muted-foreground hover:text-foreground"
              >
                Manufacturing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>{user.name}</span>
            <Badge variant="secondary">{user.role}</Badge>
            <form action={logout}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
