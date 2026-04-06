import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "pickleball_session";
const VIEW_MODE_COOKIE_NAME =
  process.env.VIEW_MODE_COOKIE_NAME || "pickleball_view_mode";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export type AppViewMode = "ADMIN" | "MEMBER";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          member: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.authSession.delete({ where: { id: session.id } });
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session.user;
});

export async function signIn(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.authSession.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return user;
}

export async function signOut() {
  "use server";
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(VIEW_MODE_COOKIE_NAME);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) {
    redirect(user.role === "ADMIN" ? "/dashboard" : "/me");
  }
  return user;
}

export async function getViewMode() {
  const user = await requireUser();
  if (user.role !== Role.ADMIN) {
    return "MEMBER" as AppViewMode;
  }

  const cookieStore = await cookies();
  const mode = cookieStore.get(VIEW_MODE_COOKIE_NAME)?.value;
  return mode === "MEMBER" ? "MEMBER" : "ADMIN";
}

export async function requireAdminView() {
  const user = await requireRole(Role.ADMIN);
  const viewMode = await getViewMode();
  if (viewMode !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

export async function switchViewMode(formData: FormData) {
  "use server";
  const user = await requireRole(Role.ADMIN);
  const nextMode = String(formData.get("mode") || "ADMIN");
  const redirectTo = String(formData.get("redirectTo") || "/dashboard");
  const cookieStore = await cookies();

  cookieStore.set(VIEW_MODE_COOKIE_NAME, nextMode === "MEMBER" ? "MEMBER" : "ADMIN", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(redirectTo || (user.role === Role.ADMIN ? "/dashboard" : "/me"));
}
