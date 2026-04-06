"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";

type MemberOption = {
  id: string;
  name: string;
  phone: string | null;
};

type DraftExpense = {
  id: string;
  title: string;
  amount: number;
  note: string;
  payerIds: string[];
};

export function CreateScheduleForm({
  members,
  action,
}: {
  members: MemberOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<MemberOption[]>([]);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseMemberQuery, setExpenseMemberQuery] = useState("");
  const [selectedExpenseMembers, setSelectedExpenseMembers] = useState<MemberOption[]>([]);
  const [defaultExpenses, setDefaultExpenses] = useState<DraftExpense[]>([]);

  const availableMembers = useMemo(
    () => members.filter((member) => !selectedMembers.some((item) => item.id === member.id)),
    [members, selectedMembers],
  );

  const availableExpenseMembers = useMemo(
    () => members.filter((member) => !selectedExpenseMembers.some((item) => item.id === member.id)),
    [members, selectedExpenseMembers],
  );

  function addMember() {
    const query = memberQuery.trim().toLowerCase();
    if (!query) {
      return;
    }

    const match = availableMembers.find(
      (member) =>
        member.name.toLowerCase() === query || member.id.toLowerCase() === query,
    );

    if (!match) {
      return;
    }

    setSelectedMembers((current) => [...current, match]);
    setMemberQuery("");
  }

  function removeMember(memberId: string) {
    setSelectedMembers((current) => current.filter((member) => member.id !== memberId));
  }

  function addExpenseMember() {
    const query = expenseMemberQuery.trim().toLowerCase();
    if (!query) {
      return;
    }

    const match = availableExpenseMembers.find(
      (member) =>
        member.name.toLowerCase() === query || member.id.toLowerCase() === query,
    );

    if (!match) {
      return;
    }

    setSelectedExpenseMembers((current) => [...current, match]);
    setExpenseMemberQuery("");
  }

  function removeExpenseMember(memberId: string) {
    setSelectedExpenseMembers((current) => current.filter((member) => member.id !== memberId));
  }

  function addDefaultExpense() {
    const normalizedAmount = expenseAmount.trim().replace(/[.,\s]/g, "");
    const amount = Number(normalizedAmount);

    if (!expenseTitle.trim() || !Number.isFinite(amount) || amount <= 0 || selectedExpenseMembers.length === 0) {
      return;
    }

    setDefaultExpenses((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: expenseTitle.trim(),
        amount,
        note: expenseNote.trim(),
        payerIds: selectedExpenseMembers.map((member) => member.id),
      },
    ]);
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseNote("");
    setExpenseMemberQuery("");
    setSelectedExpenseMembers([]);
  }

  function removeDefaultExpense(defaultExpenseId: string) {
    setDefaultExpenses((current) => current.filter((item) => item.id !== defaultExpenseId));
  }

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="title">Schedule title</Label>
        <Input id="title" name="title" placeholder="Tuesday Open Play" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weekday">Weekday</Label>
        <Select id="weekday" name="weekday" defaultValue="TUESDAY">
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
        <Label htmlFor="startTime">Start time</Label>
        <Input id="startTime" name="startTime" type="time" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endTime">End time</Label>
        <Input id="endTime" name="endTime" type="time" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" required />
      </div>
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" />
      </div>

      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="memberQuery">Default registered members</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="memberQuery"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            list="create-schedule-available-members"
            placeholder="Type member name"
          />
          <Button type="button" onClick={addMember}>
            Add member
          </Button>
        </div>
        <datalist id="create-schedule-available-members">
          {availableMembers.map((member) => (
            <option key={member.id} value={member.name}>
              {member.phone || member.id}
            </option>
          ))}
        </datalist>
        <p className="text-sm text-slate-500">
          Search by member name and build the default registered list before creating the schedule.
        </p>
      </div>

      <div className="md:col-span-2 xl:col-span-3">
        {selectedMembers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-semibold text-slate-950">
                    {member.name}
                    <input type="hidden" name="defaultMemberIds" value={member.id} />
                  </TableCell>
                  <TableCell>REGISTERED</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                    >
                      Remove member
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No default registered members selected.
          </div>
        )}
      </div>

      <div className="space-y-4 md:col-span-2 xl:col-span-3">
        <input type="hidden" name="defaultExpensesJson" value={JSON.stringify(defaultExpenses)} />
        <div className="space-y-1">
          <Label>Default expenses</Label>
          <p className="text-sm text-slate-500">
            These expenses will be created automatically whenever this schedule generates a new session.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultExpenseTitle">Default expense title</Label>
                <Input
                  id="defaultExpenseTitle"
                  value={expenseTitle}
                  onChange={(event) => setExpenseTitle(event.target.value)}
                  placeholder="Court rental"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultExpenseAmount">Amount</Label>
                <Input
                  id="defaultExpenseAmount"
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  placeholder="800000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultExpenseMemberQuery">Paid by members</Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="defaultExpenseMemberQuery"
                  value={expenseMemberQuery}
                  onChange={(event) => setExpenseMemberQuery(event.target.value)}
                  list="create-schedule-default-expense-members"
                  placeholder="Type member name"
                />
                <Button type="button" onClick={addExpenseMember}>
                  Add member
                </Button>
              </div>
              <datalist id="create-schedule-default-expense-members">
                {availableExpenseMembers.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.phone || member.id}
                  </option>
                ))}
              </datalist>
            </div>

            {selectedExpenseMembers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExpenseMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-semibold text-slate-950">{member.name}</TableCell>
                      <TableCell>PAID BY</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeExpenseMember(member.id)}
                        >
                          Remove member
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No paid-by members selected.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="defaultExpenseNote">Note</Label>
              <Textarea
                id="defaultExpenseNote"
                value={expenseNote}
                onChange={(event) => setExpenseNote(event.target.value)}
              />
            </div>

            <Button type="button" variant="outline" onClick={addDefaultExpense}>
              Add default expense
            </Button>
          </div>
        </div>

        {defaultExpenses.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaultExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-950">{expense.title}</p>
                    <p className="text-sm text-slate-500">{formatCents(expense.amount)}</p>
                    {expense.note ? <p className="text-sm text-slate-500">{expense.note}</p> : null}
                  </TableCell>
                  <TableCell>
                    {expense.payerIds
                      .map((payerId) => members.find((member) => member.id === payerId)?.name || payerId)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeDefaultExpense(expense.id)}
                    >
                      Remove expense
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            No default expenses selected.
          </div>
        )}
      </div>

      <div className="md:col-span-2 xl:col-span-3">
        <Button type="submit">Create schedule</Button>
      </div>
    </form>
  );
}
