import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMemberBalance, updateMember, upsertMemberUser } from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { getViewMode, requireAdminView } from "@/lib/auth";
import { getMemberDetail } from "@/lib/queries";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminView();
  const viewMode = await getViewMode();
  const { id } = await params;
  const member = await getMemberDetail(id);

  if (!member) {
    notFound();
  }

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/members" userLabel={user.member?.name || user.email}>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{member.name}</CardTitle>
            <CardDescription>Member profile and editable status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={member.status === "ACTIVE" ? "success" : "destructive"}>
                {member.status}
              </Badge>
              <Badge>{member.user?.role || "MEMBER"}</Badge>
            </div>
            <p className={member.balance < 0 ? "text-3xl font-black text-rose-600" : "text-3xl font-black text-emerald-700"}>
              {formatCents(member.balance)}
            </p>
            <form action={updateMember} className="space-y-4">
              <input type="hidden" name="id" value={member.id} />
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={member.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={member.phone || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input id="avatarUrl" name="avatarUrl" defaultValue={member.avatarUrl || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={member.status}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Update member
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account and role</CardTitle>
              <CardDescription>
                Admin can create a login for this member or change the assigned role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={upsertMemberUser} className="space-y-4">
                <input type="hidden" name="memberId" value={member.id} />
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={member.user?.email || ""}
                    placeholder="member@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    id="role"
                    name="role"
                    defaultValue={member.user?.role || "MEMBER"}
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {member.user ? "New password" : "Initial password"}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={
                      member.user
                        ? "Leave blank to keep current password"
                        : "Required for new account"
                    }
                  />
                </div>
                <Button type="submit" className="w-full">
                  {member.user ? "Update account" : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balance history</CardTitle>
              <CardDescription>Immutable financial history affecting this member balance.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addMemberBalance} className="mb-6 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="memberId" value={member.id} />
                <div className="space-y-2">
                  <Label htmlFor="amount">Add balance</Label>
                  <Input id="amount" name="amount" placeholder="200000" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note</Label>
                  <Input id="note" name="note" placeholder="Opening balance" />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full md:w-auto">
                    Save
                  </Button>
                </div>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.ledgerEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.createdAt.toLocaleDateString()}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell className={entry.amount < 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
                        {formatCents(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.attendances.map((attendance) => (
                <div key={attendance.id} className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="font-semibold text-slate-950">{attendance.session.location}</p>
                  <p className="text-sm text-slate-500">
                    {attendance.session.date.toLocaleDateString()} • {attendance.session.startTime}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
