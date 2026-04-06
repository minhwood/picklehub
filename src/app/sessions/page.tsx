import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSession } from "@/lib/finance";
import { getViewMode, requireUser } from "@/lib/auth";
import { getActiveMembers, getSessionsForUser } from "@/lib/queries";

export default async function SessionsPage() {
  const user = await requireUser();
  const viewMode = await getViewMode();
  const [sessions, members] = await Promise.all([
    getSessionsForUser(user),
    viewMode === "ADMIN" ? getActiveMembers() : Promise.resolve([]),
  ]);

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/sessions" userLabel={user.member?.name || user.email}>
      <div className="space-y-6">
        {viewMode === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle>Create session</CardTitle>
              <CardDescription>
                Manual sessions still work beside schedule-generated sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateSessionForm members={members} action={createSession} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>All session instances in a compact list view.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  {viewMode === "MEMBER" ? <TableHead>Your status</TableHead> : null}
                  <TableHead>Counts</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
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
                    {viewMode === "MEMBER" ? (
                      <TableCell>
                        <Badge
                          variant={
                            session.checkedIn
                              ? "success"
                              : session.registrations.some((item) => item.memberId === user.memberId)
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {session.checkedIn
                            ? "ATTENDED"
                            : session.registrations.some((item) => item.memberId === user.memberId)
                              ? "REGISTERED"
                              : "NOT REGISTERED"}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-sm text-slate-500">
                      {session.registrations.length} registered • {session.attendances.length} check-ins • {session.expenses.length} expenses
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {session.schedule ? session.schedule.title : "Manual"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {session.status}
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
