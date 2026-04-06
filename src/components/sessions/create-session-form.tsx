"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type MemberOption = {
  id: string;
  name: string;
  phone: string | null;
};

export function CreateSessionForm({
  members,
  action,
}: {
  members: MemberOption[];
  action: (formData: FormData) => void | Promise<void>;
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
    <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
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
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue="PLANNED">
          <option value="PLANNED">PLANNED</option>
          <option value="CANCELLED">CANCELLED</option>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" />
      </div>

      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label htmlFor="memberQuery">Registered members</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="memberQuery"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            list="create-session-available-members"
            placeholder="Type member name"
          />
          <Button type="button" onClick={addMember}>
            Add member
          </Button>
        </div>
        <datalist id="create-session-available-members">
          {availableMembers.map((member) => (
            <option key={member.id} value={member.name}>
              {member.phone || member.id}
            </option>
          ))}
        </datalist>
        <p className="text-sm text-slate-500">
          Search by member name and build the registered list before creating the session.
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
                    <input type="hidden" name="registrationMemberIds" value={member.id} />
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
            No registered members selected.
          </div>
        )}
      </div>

      <div className="md:col-span-2 xl:col-span-3">
        <Button type="submit">Create session</Button>
      </div>
    </form>
  );
}
