import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getViewMode, requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getMeData } from "@/lib/queries";

export default async function MeBalancePage() {
  const user = await requireUser();
  const viewMode = await getViewMode();
  if (viewMode !== "MEMBER" || !user.memberId) {
    redirect("/dashboard");
  }

  const data = await getMeData(user.memberId);
  if (!data) {
    redirect("/login");
  }

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/me/balance" userLabel={data.member.name}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>My balance</CardTitle>
            <CardDescription>Current total balance with full expense and top-up history below.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-6 py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current balance
              </p>
              <p className={data.balance < 0 ? "mt-3 text-5xl font-black text-rose-600" : "mt-3 text-5xl font-black text-emerald-700"}>
                {formatCents(data.balance)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance history</CardTitle>
            <CardDescription>All balance-affecting entries, including expenses and manual top-ups.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.member.ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.createdAt.toLocaleString()}</TableCell>
                    <TableCell>{entry.type}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell className={entry.amount < 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
                      {formatCents(entry.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
