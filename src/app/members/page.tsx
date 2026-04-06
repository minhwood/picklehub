import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createMember } from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { getViewMode, requireAdminView } from "@/lib/auth";
import { getMembersWithBalances } from "@/lib/queries";

export default async function MembersPage() {
  const user = await requireAdminView();
  const viewMode = await getViewMode();
  const members = await getMembersWithBalances();

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/members" userLabel={user.member?.name || user.email}>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage the single group roster and current balances.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-semibold text-slate-950">{member.name}</TableCell>
                    <TableCell>
                      <Badge variant={member.status === "ACTIVE" ? "success" : "destructive"}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{member.user ? member.user.role : "No account"}</TableCell>
                    <TableCell className={member.balance < 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
                      {formatCents(member.balance)}
                    </TableCell>
                    <TableCell>
                      <Link className="text-sm font-semibold text-emerald-700" href={`/members/${member.id}`}>
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create member</CardTitle>
            <CardDescription>Inactive members cannot be checked into new sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input id="avatarUrl" name="avatarUrl" />
              </div>
              <Button type="submit" className="w-full">
                Add member
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
