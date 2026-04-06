"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type MemberOption = {
  id: string;
  name: string;
  phone: string | null;
};

export function ExpenseForm({
  members,
  action,
  fixedSessionId,
  hiddenFields,
  submitLabel,
  titleId,
  amountId,
  noteId,
}: {
  members: MemberOption[];
  action: (formData: FormData) => void | Promise<void>;
  fixedSessionId?: string;
  hiddenFields?: { name: string; value: string }[];
  submitLabel: string;
  titleId: string;
  amountId: string;
  noteId: string;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<MemberOption[]>([]);

  const availableMembers = useMemo(
    () => members.filter((member) => !selectedMembers.some((item) => item.id === member.id)),
    [members, selectedMembers],
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

  return (
    <form action={action} className="space-y-4">
      {fixedSessionId ? <input type="hidden" name="sessionId" value={fixedSessionId} /> : null}
      {hiddenFields?.map((field) => (
        <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input id={titleId} name="title" placeholder="Court rental" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={amountId}>Amount</Label>
          <Input id={amountId} name="amount" placeholder="800000" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${titleId}-memberQuery`}>Paid by members</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id={`${titleId}-memberQuery`}
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            list={`${titleId}-available-members`}
            placeholder="Type member name"
          />
          <Button type="button" onClick={addMember}>
            Add member
          </Button>
        </div>
        <datalist id={`${titleId}-available-members`}>
          {availableMembers.map((member) => (
            <option key={member.id} value={member.name}>
              {member.phone || member.id}
            </option>
          ))}
        </datalist>
        <p className="text-sm text-slate-500">
          Search by member name and build the paid-by list before saving.
        </p>
      </div>

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
                  <input type="hidden" name="payerIds" value={member.id} />
                </TableCell>
                <TableCell>PAID BY</TableCell>
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
          No paid-by members selected.
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={noteId}>Note</Label>
        <Textarea id={noteId} name="note" />
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
