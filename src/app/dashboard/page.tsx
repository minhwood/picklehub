import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getViewMode, requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getDashboardData, getMemberDashboardData, getSessionsForUser } from "@/lib/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const viewMode = await getViewMode();

  if (viewMode === "ADMIN") {
    const data = await getDashboardData();
    const totalGroupBalance = data.balances.reduce((sum, item) => sum + item.balance, 0);
    const nextSession = data.sessions
      .filter((session) => session.status === "PLANNED")
      .sort((a, b) => {
        const left = new Date(`${a.date.toISOString().slice(0, 10)}T${a.startTime}:00.000Z`).getTime();
        const right = new Date(`${b.date.toISOString().slice(0, 10)}T${b.startTime}:00.000Z`).getTime();
        return left - right;
      })[0];
    const nextSessionLabel = nextSession
      ? `${nextSession.date.toLocaleDateString()} ${nextSession.startTime}`
      : "No planned session";

    return (
      <AppShell role={user.role} viewMode={viewMode} currentPath="/dashboard" userLabel={user.member?.name || user.email}>
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Members" value={String(data.members.length)} />
            <MetricCard label="Next session time" value={nextSessionLabel} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Balance watchlist</CardTitle>
                <CardDescription>Members with the largest outstanding balances.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.balances.slice(0, 6).map((item) => (
                  <div key={item.member!.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-950">{item.member!.name}</p>
                      <p className="text-sm text-slate-500">{item.member!.status}</p>
                    </div>
                    <span className={item.balance < 0 ? "font-bold text-rose-600" : "font-bold text-emerald-700"}>
                      {formatCents(item.balance)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balance summary</CardTitle>
                <CardDescription>Current total balance across the whole group.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Total group balance
                  </p>
                  <p className="mt-3 text-3xl font-black text-slate-950">
                    {formatCents(totalGroupBalance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Latest sessions</CardTitle>
              <CardDescription>Attendance and expense activity at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Link href={`/sessions/${session.id}`} className="block">
                          <p className="font-semibold text-slate-950">{session.location}</p>
                          <p className="text-sm text-slate-600">
                            {session.date.toLocaleDateString()} • {session.startTime}
                            {session.endTime ? ` - ${session.endTime}` : ""}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "COMPLETED"
                              ? "success"
                              : session.status === "CANCELLED"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {session.attendances.length} check-ins • {session.expenses.length} expenses
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

  if (!user.memberId) {
    return (
      <AppShell role={user.role} viewMode={viewMode} currentPath="/dashboard" userLabel={user.member?.name || user.email}>
        <Card>
          <CardHeader>
            <CardTitle>Member dashboard</CardTitle>
            <CardDescription>Your account needs a linked member profile to use member view.</CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  const data = await getMemberDashboardData(user.memberId);
  const latestSessions = await getSessionsForUser(user);
  if (!data) {
    return (
      <AppShell role={user.role} viewMode={viewMode} currentPath="/dashboard" userLabel={user.member?.name || user.email}>
        <Card>
          <CardHeader>
            <CardTitle>Member dashboard</CardTitle>
            <CardDescription>Member data is unavailable.</CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  const nextRegisteredSession = data.member.sessionRegistrations
    .map((item) => item.session)
    .filter((session) => session.status === "PLANNED")
    .sort((a, b) => {
      const left = new Date(`${a.date.toISOString().slice(0, 10)}T${a.startTime}:00.000Z`).getTime();
      const right = new Date(`${b.date.toISOString().slice(0, 10)}T${b.startTime}:00.000Z`).getTime();
      return left - right;
    })[0];

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/dashboard" userLabel={data.member.name}>
      <div className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2">
          <MetricCard label="My balance" value={formatCents(data.balance)} />
          <MetricCard
            label="Next registered session"
            value={nextRegisteredSession ? `${nextRegisteredSession.date.toLocaleDateString()} ${nextRegisteredSession.startTime}` : "No registration yet"}
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Nội quy Group Pickleball</CardTitle>
            <CardDescription>Thông tin chung dành cho thành viên trong group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6 text-slate-700">
            <div>
              <p className="font-semibold text-slate-950">1. Nạp tiền (Top-up)</p>
              <p>
                Mỗi thành viên cần nạp tiền vào quỹ group với số tiền từ 200.000đ – 1.000.000đ/lần.
                Số dư sẽ được sử dụng để thanh toán chi phí sân và các chi phí liên quan.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-950">2. Hủy lịch</p>
              <p>
                Nếu hủy, phải báo trước ít nhất 2 ngày. Trường hợp hủy muộn hoặc không báo, vẫn sẽ bị trừ một khoản phí cố định.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-950">3. Chi phí phát sinh</p>
              <p>
                Các chi phí phụ thu (thuê thêm sân, nước uống, bóng,...) sẽ được tổng hợp và chia đều cho những người tham gia sau khi session kết thúc.
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My recent expenses</CardTitle>
              <CardDescription>Most recent expenses that affected your balance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.member.expensePayers.length > 0 ? (
                data.member.expensePayers.map((payer) => (
                  <div key={payer.id} className="rounded-xl border border-slate-100 px-4 py-3">
                    <p className="font-semibold text-slate-950">{payer.expense.title}</p>
                    <p className="text-sm text-slate-500">
                      {payer.expense.session
                        ? `${payer.expense.session.location} • ${payer.expense.session.date.toLocaleDateString()}`
                        : "No session"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-rose-600">-{formatCents(payer.shareAmount)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No expenses yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest sessions</CardTitle>
              <CardDescription>Upcoming and recent sessions for the group.</CardDescription>
            </CardHeader>
            <CardContent>
              {latestSessions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Your status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestSessions.slice(0, 6).map((session) => {
                      const isRegistered = session.registrations.some((item) => item.memberId === user.memberId);
                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <Link href={`/sessions/${session.id}`} className="block">
                              <p className="font-semibold text-slate-950">{session.location}</p>
                              <p className="text-sm text-slate-500">
                                {session.date.toLocaleDateString()} • {session.startTime}
                              </p>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                session.status === "COMPLETED"
                                  ? "success"
                                  : session.status === "CANCELLED"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                session.checkedIn
                                  ? "success"
                                  : isRegistered
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {session.checkedIn ? "ATTENDED" : isRegistered ? "REGISTERED" : "NOT REGISTERED"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No sessions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
