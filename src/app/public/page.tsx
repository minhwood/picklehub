import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { getDashboardData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PublicDashboardPage() {
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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Public View</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Pickleball Hub</h1>
            <p className="mt-2 text-sm text-slate-600">Shared group snapshot with balances and latest session activity.</p>
          </div>
          <Link href="/login" className="text-sm font-semibold text-emerald-700">
            Sign in
          </Link>
        </header>

        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2">
            <MetricCard label="Total group balance" value={formatCents(totalGroupBalance)} />
            <MetricCard label="Next session time" value={nextSessionLabel} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Nội quy Group Pickleball</CardTitle>
              <CardDescription>Thông tin chung dành cho tất cả thành viên.</CardDescription>
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

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Latest sessions</CardTitle>
                <CardDescription>Most recent group sessions and their activity.</CardDescription>
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
                          <p className="font-semibold text-slate-950">{session.location}</p>
                          <p className="text-sm text-slate-600">
                            {session.date.toLocaleDateString()} • {session.startTime}
                            {session.endTime ? ` - ${session.endTime}` : ""}
                          </p>
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

            <Card>
              <CardHeader>
                <CardTitle>Balance watchlist</CardTitle>
                <CardDescription>Members with the largest outstanding balances.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.balances.slice(0, 6).map((item) => (
                  <div key={item.member!.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
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
          </section>
        </div>
      </div>
    </main>
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
