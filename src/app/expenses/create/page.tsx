import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createExpense, removeExpense } from "@/lib/finance";
import { getViewMode, requireAdminView } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getExpenseFormData } from "@/lib/queries";

export default async function ExpenseCreatePage() {
  const user = await requireAdminView();
  const viewMode = await getViewMode();
  const { members, recentExpenses } = await getExpenseFormData();

  return (
    <AppShell role={user.role} viewMode={viewMode} currentPath="/expenses/create" userLabel={user.member?.name || user.email}>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create expense</CardTitle>
            <CardDescription>
              Standalone expense only. If you want an expense linked to a session, add it from the session detail page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              members={members}
              action={createExpense}
              submitLabel="Create expense"
              titleId="expense-title"
              amountId="expense-amount"
              noteId="expense-note"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent expenses</CardTitle>
            <CardDescription>Recently created standalone and session-linked expenses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentExpenses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No expenses yet.
              </div>
            ) : (
              recentExpenses.map((expense) => (
                <div key={expense.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{expense.title}</p>
                      <p className="text-sm text-slate-500">
                        {expense.session
                          ? `${expense.session.location} • ${expense.session.date.toLocaleDateString()}`
                          : "No session"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Paid by {expense.payers.map((payer) => payer.member.name).join(", ")}
                      </p>
                    </div>
                    <p className="font-bold text-slate-950">{formatCents(expense.amount)}</p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <form action={removeExpense}>
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Remove expense
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
