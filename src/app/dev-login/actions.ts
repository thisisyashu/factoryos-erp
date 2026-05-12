"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DEV_SESSION_COOKIE } from "@/lib/current-user";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function loginAsUser(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    throw new Error("userId is required");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new Error("User not found or inactive");
  }
  const store = await cookies();
  store.set(DEV_SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(DEV_SESSION_COOKIE);
  redirect("/dev-login");
}
