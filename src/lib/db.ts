import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon's serverless driver uses WebSockets for transactions.
// In Node, that needs a WebSocket implementation; the browser/Edge runtime
// has one built in. Force Node runtime in any route that imports this file:
//   export const runtime = "nodejs";
neonConfig.webSocketConstructor = ws;

declare global {
  var __prisma: PrismaClient | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
  });
}

// Avoid spinning up a new client on every Next.js dev hot reload.
export const prisma = globalThis.__prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;
