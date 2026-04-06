import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const clerkApi = ENV.clerkSecretKey
  ? createClerkClient({ secretKey: ENV.clerkSecretKey })
  : null;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  if (!ENV.clerkSecretKey || !clerkApi) {
    return { req: opts.req, res: opts.res, user: null };
  }

  try {
    const auth = getAuth(opts.req);
    const clerkUserId = auth.userId;
    if (!clerkUserId) {
      return { req: opts.req, res: opts.res, user: null };
    }

    let row: User | null = (await db.getUserByClerkId(clerkUserId)) ?? null;

    if (!row) {
      const clerkUser = await clerkApi.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        email ||
        null;

      await db.upsertUser({
        clerkId: clerkUserId,
        name,
        email,
        loginMethod: "clerk",
        lastSignedIn: new Date(),
        role: clerkUserId === ENV.ownerClerkUserId ? "admin" : "user",
      });
      row = (await db.getUserByClerkId(clerkUserId)) ?? null;
    } else {
      await db.upsertUser({ clerkId: clerkUserId, lastSignedIn: new Date() });
      row = (await db.getUserByClerkId(clerkUserId)) ?? null;
    }

    user = row;
  } catch (err) {
    console.error("[Clerk context]", err);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
