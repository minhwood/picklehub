import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateScheduleForm } from "@/components/schedules/create-schedule-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getViewMode, requireUser } from "@/lib/auth";
import { createSchedule } from "@/lib/finance";
import { getActiveMembers, getSchedules } from "@/lib/queries";

export default async function SchedulesPage() {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const [schedules, members] = await Promise.all([
    getSchedules(),
    viewMode === "ADMIN" ? getActiveMembers() : Promise.resolve([]),
  ]);

  return (
    <AppShell
      role={user.role}
      viewMode={viewMode}
      currentPath="/schedules"
      userLabel={user.member?.name || user.email}
    >
      <div className="space-y-6">
        {viewMode === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle>Create schedule</CardTitle>
              <CardDescription>
                A weekly repeating schedule creates the closest upcoming session automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateScheduleForm members={members} action={createSchedule} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Schedules</CardTitle>
            <CardDescription>
              Repeating weekly templates that keep the next session ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Defaults</TableHead>
                  <TableHead>Generated sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <Link href={`/schedules/${schedule.id}`} className="block">
                        <p className="font-semibold text-slate-950">{schedule.title}</p>
                        <p className="text-sm text-slate-600">
                          {schedule.weekday} • {schedule.startTime}
                          {schedule.endTime ? ` - ${schedule.endTime}` : ""}
                        </p>
                        <p className="text-sm text-slate-500">{schedule.location}</p>
                        {schedule.note ? <p className="text-sm text-slate-500">{schedule.note}</p> : null}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={schedule.isActive ? "success" : "destructive"}>
                        {schedule.isActive ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {schedule.defaultMembers.length} members • {schedule.defaultExpenses.length} expenses
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {schedule.sessions.length > 0 ? `${schedule.sessions.length}+` : "0"}
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
