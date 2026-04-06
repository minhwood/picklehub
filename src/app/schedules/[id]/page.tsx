import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { Textarea } from "@/components/ui/textarea";
import { getViewMode, requireUser } from "@/lib/auth";
import {
  addScheduleDefaultMember,
  addScheduleDefaultExpense,
  removeScheduleDefaultMember,
  removeScheduleDefaultExpense,
  updateSchedule,
} from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { getActiveMembers, getScheduleDetail } from "@/lib/queries";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const { id } = await params;
  const [schedule, members] = await Promise.all([
    getScheduleDetail(id),
    viewMode === "ADMIN" ? getActiveMembers() : Promise.resolve([]),
  ]);

  if (!schedule) {
    notFound();
  }

  const defaultMemberIds = new Set(schedule.defaultMembers.map((item) => item.memberId));
  const availableMembers = members.filter((member) => !defaultMemberIds.has(member.id));

  return (
    <AppShell
      role={user.role}
      viewMode={viewMode}
      currentPath="/schedules"
      userLabel={user.member?.name || user.email}
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{schedule.title}</CardTitle>
            <CardDescription>
              Update the repeating template. Completing generated sessions will still create the next one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={schedule.isActive ? "success" : "destructive"}>
                {schedule.isActive ? "ACTIVE" : "INACTIVE"}
              </Badge>
              <Badge>{schedule.weekday}</Badge>
            </div>

            {viewMode === "ADMIN" ? (
              <form action={updateSchedule} className="space-y-4">
                <input type="hidden" name="id" value={schedule.id} />
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={schedule.title} required />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="weekday">Weekday</Label>
                    <Select id="weekday" name="weekday" defaultValue={schedule.weekday}>
                      <option value="SUNDAY">SUNDAY</option>
                      <option value="MONDAY">MONDAY</option>
                      <option value="TUESDAY">TUESDAY</option>
                      <option value="WEDNESDAY">WEDNESDAY</option>
                      <option value="THURSDAY">THURSDAY</option>
                      <option value="FRIDAY">FRIDAY</option>
                      <option value="SATURDAY">SATURDAY</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" defaultValue={schedule.location} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start time</Label>
                    <Input id="startTime" name="startTime" type="time" defaultValue={schedule.startTime} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End time</Label>
                    <Input id="endTime" name="endTime" type="time" defaultValue={schedule.endTime || ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note</Label>
                  <Textarea id="note" name="note" defaultValue={schedule.note || ""} />
                </div>
                <Toggle
                  id="isActive"
                  name="isActive"
                  defaultChecked={schedule.isActive}
                  label="Schedule is active"
                />
                <Button type="submit" className="w-full">
                  Update schedule
                </Button>
              </form>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p>{schedule.location}</p>
                {schedule.note ? <p>{schedule.note}</p> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated sessions</CardTitle>
            <CardDescription>
              Sessions already created from this schedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedule.sessions.length > 0 ? (
              schedule.sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="block rounded-xl border border-slate-100 px-4 py-3 transition hover:border-emerald-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">
                      {session.date.toLocaleDateString()} • {session.startTime}
                      {session.endTime ? ` - ${session.endTime}` : ""}
                    </p>
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
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{session.location}</p>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No sessions generated yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default expenses</CardTitle>
            <CardDescription>
              These expenses will be added automatically whenever this schedule creates a new session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === "ADMIN" ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <ExpenseForm
                  members={members}
                  action={addScheduleDefaultExpense}
                  hiddenFields={[{ name: "scheduleId", value: schedule.id }]}
                  submitLabel="Add default expense"
                  titleId="default-expense-title"
                  amountId="default-expense-amount"
                  noteId="default-expense-note"
                />
              </div>
            ) : null}

            {schedule.defaultExpenses.length > 0 ? (
              schedule.defaultExpenses.map((expense) => (
                <div key={expense.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">{expense.title}</p>
                    <p className="font-bold text-slate-950">{formatCents(expense.amount)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Paid by {expense.payers.map((payer) => payer.member.name).join(", ")}
                  </p>
                  {expense.note ? <p className="mt-2 text-sm text-slate-500">{expense.note}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {expense.payers.map((payer) => (
                      <Badge key={payer.id}>
                        {payer.member.name}: {formatCents(payer.shareAmount)}
                      </Badge>
                    ))}
                  </div>
                  {viewMode === "ADMIN" ? (
                    <div className="mt-4 flex justify-end">
                      <form action={removeScheduleDefaultExpense}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <input type="hidden" name="defaultExpenseId" value={expense.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Remove expense
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No default expenses.
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Default registered members</CardTitle>
            <CardDescription>
              These members will be automatically registered on newly generated sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {viewMode === "ADMIN" ? (
            <form action={addScheduleDefaultMember} className="mb-6 space-y-2">
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <Label htmlFor="memberQuery">Search and add member</Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="memberQuery"
                  name="memberQuery"
                  list={`schedule-available-members-${schedule.id}`}
                  placeholder="Type member name"
                />
                <Button type="submit">Add member</Button>
              </div>
              <datalist id={`schedule-available-members-${schedule.id}`}>
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.phone || member.id}
                  </option>
                ))}
              </datalist>
              <p className="text-sm text-slate-500">
                Search by member name and add directly to the default registered list.
              </p>
            </form>
            ) : null}

            {schedule.defaultMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.defaultMembers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-slate-950">
                        {item.member.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">REGISTERED</Badge>
                      </TableCell>
                      <TableCell>
                        {viewMode === "ADMIN" ? (
                          <form action={removeScheduleDefaultMember}>
                            <input type="hidden" name="scheduleId" value={schedule.id} />
                            <input type="hidden" name="memberId" value={item.memberId} />
                            <Button type="submit" variant="outline" size="sm">
                              Remove member
                            </Button>
                          </form>
                        ) : (
                          <span className="text-sm text-slate-400">Read only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No default registered members.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
