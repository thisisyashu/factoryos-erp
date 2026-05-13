import Link from "next/link";
import { requireCurrentUser } from "@/lib/current-user";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/app/dev-login/actions";

export const runtime = "nodejs";

export default async function ManufacturingLayout({
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
                Procurement
              </Link>
              <Link
                href="/inventory"
                className="text-muted-foreground hover:text-foreground"
              >
                Inventory
              </Link>
              <Link href="/manufacturing" className="text-foreground font-medium">
                Manufacturing
              </Link>
              <span className="text-muted-foreground/40">·</span>
              <Link
                href="/manufacturing/production-orders"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Orders
              </Link>
              <Link
                href="/manufacturing/boms"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                BOMs
              </Link>
              <Link
                href="/manufacturing/routings"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Routings
              </Link>
              <Link
                href="/manufacturing/work-centers"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Work Centers
              </Link>
              <Link
                href="/manufacturing/traceability"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Traceability
              </Link>
              <Link
                href="/manufacturing/kpis"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                KPIs
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
