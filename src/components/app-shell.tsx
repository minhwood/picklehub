import Link from "next/link";
import { Role } from "@prisma/client";
import { AppViewMode, signOut, switchViewMode } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function AppShell({
  role,
  viewMode,
  currentPath,
  userLabel,
  children,
}: {
  role: Role;
  viewMode: AppViewMode;
  currentPath: string;
  userLabel: string;
  children: React.ReactNode;
}) {
  const links =
    viewMode === "ADMIN"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/members", label: "Members" },
          { href: "/schedules", label: "Schedules" },
          { href: "/sessions", label: "Sessions" },
          { href: "/expenses/create", label: "Expenses" },
        ]
      : [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/sessions", label: "Sessions" },
          { href: "/me/balance", label: "Balance" },
        ];

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="text-lg font-black tracking-tight text-slate-950">
              Pickleball Hub
            </Link>
            <div className="flex items-center gap-3">
              {role === "ADMIN" ? (
                <form action={switchViewMode}>
                  <input type="hidden" name="redirectTo" value="/dashboard" />
                  <input type="hidden" name="mode" value={viewMode === "ADMIN" ? "MEMBER" : "ADMIN"} />
                  <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    {viewMode === "ADMIN" ? "Switch to member view" : "Switch to admin view"}
                  </button>
                </form>
              ) : null}
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-900">{userLabel}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {role} · {viewMode} VIEW
                </p>
              </div>
              <form action={signOut}>
                <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Logout
                </button>
              </form>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  currentPath.startsWith(link.href)
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
