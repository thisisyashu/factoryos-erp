import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { loginAsUser, logout } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  const [users, current] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { role: "asc" },
      select: { id: true, name: true, email: true, role: true, department: true },
    }),
    getCurrentUser(),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dev login</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click a user to start a session. No password — this is dev-only.
        </p>
      </div>

      {current && (
        <div className="rounded-md border bg-muted/40 p-4 flex items-center justify-between">
          <div className="text-sm">
            Currently signed in as <strong>{current.name}</strong>{" "}
            <span className="text-muted-foreground">({current.email})</span>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      )}

      <ul className="divide-y border rounded-md">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-muted-foreground">
                {u.email}
                {u.department && <> · {u.department}</>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{u.role}</Badge>
              <form action={loginAsUser}>
                <input type="hidden" name="userId" value={u.id} />
                <Button type="submit" size="sm">
                  Sign in
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
