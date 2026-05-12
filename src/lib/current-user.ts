import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { User, UserRole } from "@prisma/client";

// Dev-only session: a single cookie carries the seeded user's id. No password,
// no token signing, no NextAuth. Replace with real auth (NextAuth credentials
// or OAuth) before any deployment that isn't a local demo.

export const DEV_SESSION_COOKIE = "factoryos_dev_user_id";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const userId = store.get(DEV_SESSION_COOKIE)?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.isActive ? user : null;
}

/**
 * For Server Components and Server Actions: redirects to /dev-login if the
 * caller isn't authenticated.
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/dev-login");
  return user;
}

/**
 * For API route handlers: throws an HTTP-shaped error instead of redirecting.
 * Catch in the route, return Response.json({ error }, { status: 401 }).
 */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireUserApi(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requireRole(allowed: UserRole[]): Promise<User> {
  const user = await requireUserApi();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(
      `Role ${user.role} cannot perform this action (requires one of ${allowed.join(", ")})`,
    );
  }
  return user;
}
