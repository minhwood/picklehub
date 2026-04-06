import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  addSessionRegistration,
  adminCheckIn,
  completeSession,
  createExpense,
  removeExpense,
  removeSessionRegistration,
  selfRegisterForSession,
  updateSession,
} from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { getViewMode, requireUser } from "@/lib/auth";
import { getActiveMembers, getSessionDetail } from "@/lib/queries";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const { id } = await params;
  const [session, members] = await Promise.all([
    getSessionDetail(id),
    viewMode === "ADMIN" ? getActiveMembers() : Promise.resolve([]),
  ]);

  if (!session) {
    notFound();
  }

  const registeredMemberIds = new Set(session.registrations.map((item) => item.memberId));
  const checkedInMemberIds = new Set(session.attendances.map((item) => item.memberId));
  const unattendedRegistrations = session.registrations.filter(
    (registration) => !checkedInMemberIds.has(registration.memberId),
  );
  const currentMemberRegistered = !!user.memberId && registeredMemberIds.has(user.memberId);
  const availableMembers = members.filter(
    (member) => !registeredMemberIds.has(member.id),
  );

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/sessions" userLabel={user.member?.name || user.email}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{session.location}</CardTitle>
              <CardDescription>
                {session.date.toLocaleDateString()} • {session.startTime}
                {session.endTime ? ` - ${session.endTime}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
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
                {viewMode === "ADMIN" &&
                session.status !== "COMPLETED" &&
                session.status !== "CANCELLED" ? (
                  <form action={completeSession}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      Complete session
                    </Button>
                  </form>
                ) : null}
              </div>
              {session.note ? <p className="text-sm text-slate-600">{session.note}</p> : null}
              {session.schedule ? (
                <p className="text-sm font-semibold text-emerald-700">
                  Generated from schedule: {session.schedule.title} ({session.schedule.weekday})
                </p>
              ) : null}

              {viewMode === "ADMIN" ? (
                session.status === "COMPLETED" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
                    This session is completed and locked. No further edits are allowed.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <form action={updateSession} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <input type="hidden" name="id" value={session.id} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            name="date"
                            type="date"
                            defaultValue={session.date.toISOString().slice(0, 10)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select id="status" name="status" defaultValue={session.status}>
                            <option value="PLANNED">PLANNED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="startTime">Start</Label>
                          <Input id="startTime" name="startTime" type="time" defaultValue={session.startTime} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endTime">End</Label>
                          <Input id="endTime" name="endTime" type="time" defaultValue={session.endTime || ""} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" name="location" defaultValue={session.location} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="note">Note</Label>
                        <Textarea id="note" name="note" defaultValue={session.note || ""} />
                      </div>
                      <Button type="submit">Update session</Button>
                    </form>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-600">
                    {session.status === "CANCELLED"
                      ? "Cancelled sessions cannot be registered."
                      : session.status === "COMPLETED"
                        ? "This session is completed and locked."
                        : currentMemberRegistered
                          ? "You are registered for this session."
                          : "Register yourself to join this session."}
                  </p>
                  {!currentMemberRegistered &&
                  session.status === "PLANNED" &&
                  user.memberId ? (
                    <form action={selfRegisterForSession}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <Button type="submit">Register session</Button>
                    </form>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>Admin-managed expenses that deduct balance equally from selected paid-by members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {viewMode === "ADMIN" && session.status !== "COMPLETED" ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <ExpenseForm
                    members={members}
                    action={createExpense}
                    fixedSessionId={session.id}
                    submitLabel="Add expense"
                    titleId="expenseTitle"
                    amountId="expenseAmount"
                    noteId="expenseNote"
                  />
                </div>
              ) : null}

              {session.expenses.map((expense) => (
                <div key={expense.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">{expense.title}</p>
                    <p className="font-bold text-slate-950">{formatCents(expense.amount)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Paid by{" "}
                    {expense.payers.map((payer) => payer.member.name).join(", ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {expense.payers.map((payer) => (
                      <Badge key={payer.id}>
                        {payer.member.name}: {formatCents(payer.shareAmount)}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    {viewMode === "ADMIN" && session.status !== "COMPLETED" ? (
                      <form action={removeExpense}>
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Remove expense
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registered members</CardTitle>
              <CardDescription>
                Registered members are expected attendees. If the session completes without check-in, they are unattended.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {viewMode === "ADMIN" && session.status !== "COMPLETED" ? (
                <form action={addSessionRegistration} className="mb-6 space-y-2">
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Label htmlFor="memberQuery">Search and add member</Label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="memberQuery"
                      name="memberQuery"
                      list={`session-available-members-${session.id}`}
                      placeholder="Type member name"
                    />
                    <Button type="submit">Add member</Button>
                  </div>
                  <datalist id={`session-available-members-${session.id}`}>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.phone || member.id}
                      </option>
                    ))}
                  </datalist>
                  <p className="text-sm text-slate-500">
                    Search by member name and add directly to the registered list.
                  </p>
                </form>
              ) : null}

              {session.registrations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.registrations.map((registration) => (
                      <TableRow key={registration.id}>
                        <TableCell className="font-semibold text-slate-950">
                          {registration.member.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              checkedInMemberIds.has(registration.memberId)
                                ? "success"
                                : session.status === "COMPLETED"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {checkedInMemberIds.has(registration.memberId)
                              ? "ATTENDED"
                              : session.status === "COMPLETED"
                                ? "UNATTENDED"
                                : "REGISTERED"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {!checkedInMemberIds.has(registration.memberId) &&
                            session.status !== "CANCELLED" &&
                            session.status !== "COMPLETED" ? (
                              viewMode === "ADMIN" ? (
                                <form action={adminCheckIn}>
                                  <input type="hidden" name="sessionId" value={session.id} />
                                  <input
                                    type="hidden"
                                    name="memberId"
                                    value={registration.memberId}
                                  />
                                  <Button type="submit" size="sm">
                                    Check in
                                  </Button>
                                </form>
                              ) : null
                            ) : null}
                            {viewMode === "ADMIN" && session.status !== "COMPLETED" ? (
                              <form action={removeSessionRegistration}>
                                <input type="hidden" name="sessionId" value={session.id} />
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={registration.memberId}
                                />
                                <Button type="submit" variant="outline" size="sm">
                                  Remove member
                                </Button>
                              </form>
                            ) : null}
                            {viewMode !== "ADMIN" ? (
                              <span className={user.memberId === registration.memberId ? "text-sm font-semibold text-emerald-700" : "text-sm text-slate-400"}>
                                {user.memberId === registration.memberId ? "You" : "Read only"}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No registered members yet.
                </div>
              )}
            </CardContent>
          </Card>

          {session.status === "COMPLETED" ? (
            <Card>
              <CardHeader>
                <CardTitle>Unattended members</CardTitle>
                <CardDescription>
                  Registered members who did not check in before the session was completed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {unattendedRegistrations.length > 0 ? (
                  unattendedRegistrations.map((registration) => (
                    <div
                      key={registration.id}
                      className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                    >
                      {registration.member.name}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    All registered members attended.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
