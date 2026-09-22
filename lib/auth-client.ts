"use client";
import { createAuthClient } from "better-auth/react";

/** Same-origin: every call goes to our own /api/auth routes. */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
