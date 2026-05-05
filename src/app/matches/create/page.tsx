import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminView, getViewMode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateMatchForm } from "./create-match-form";

export default async function CreateMatchPage() {
  const user = await requireAdminView();
  const viewMode = await getViewMode();

  const members = await prisma.member.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, rating: true, totalMatches: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      role={user.role}
      viewMode={viewMode}
      currentPath="/matches"
      userLabel={user.member?.name || user.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Ghi trận mới</h1>
          <p className="mt-1 text-sm text-slate-500">
            ELO sẽ được cập nhật ngay sau khi lưu.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin trận</CardTitle>
            <CardDescription>
              Điền đầy đủ người chơi và tỉ số. Winner score luôn là 15.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateMatchForm members={members} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
