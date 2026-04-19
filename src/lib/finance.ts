import {
  CheckedInBy,
  LedgerEntryType,
  MemberStatus,
  Prisma,
  PrismaClient,
  Role,
  ScheduleWeekday,
  SessionStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseMoneyToCents, splitAmountEvenly } from "@/lib/money";

async function assertAdmin() {
  const { requireRole } = await import("@/lib/auth");
  await requireRole(Role.ADMIN);
}

async function assertAuthenticated() {
  const { requireUser } = await import("@/lib/auth");
  return requireUser();
}

const WEEKDAY_TO_INDEX: Record<ScheduleWeekday, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

type DbClient = Prisma.TransactionClient | PrismaClient;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function hasTimePassed(date: Date, startTime: string) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const targetMinutes = hours * 60 + minutes;
  return currentMinutes > targetMinutes;
}

function computeNextScheduledDate(
  schedule: {
    weekday: ScheduleWeekday;
    startTime: string;
  },
  fromDate: Date,
  options?: { inclusive?: boolean },
) {
  const base = startOfUtcDay(fromDate);
  const currentWeekday = base.getUTCDay();
  const targetWeekday = WEEKDAY_TO_INDEX[schedule.weekday];

  let daysAhead = (targetWeekday - currentWeekday + 7) % 7;
  if (
    daysAhead === 0 &&
    (options?.inclusive
      ? hasTimePassed(fromDate, schedule.startTime)
      : true)
  ) {
    daysAhead = 7;
  }

  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + daysAhead);
  return next;
}

async function ensureUpcomingSessionForSchedule(
  db: DbClient,
  schedule: {
    id: string;
    title: string;
    weekday: ScheduleWeekday;
    startTime: string;
    endTime: string | null;
    location: string;
    note: string | null;
    isActive: boolean;
  },
  fromDate: Date,
  options?: { inclusive?: boolean },
) {
  if (!schedule.isActive) {
    return;
  }

  const targetDate = computeNextScheduledDate(schedule, fromDate, options);
  const existingSession = await db.session.findFirst({
    where: {
      scheduleId: schedule.id,
      date: targetDate,
      status: {
        not: SessionStatus.CANCELLED,
      },
    },
  });

  if (existingSession) {
    return existingSession;
  }

  const [defaultMembers, defaultExpenses] = await Promise.all([
    db.scheduleDefaultMember.findMany({
      where: { scheduleId: schedule.id },
      select: { memberId: true },
    }),
    db.scheduleDefaultExpense.findMany({
      where: { scheduleId: schedule.id },
      include: {
        payers: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const session = await db.session.create({
    data: {
      scheduleId: schedule.id,
      date: targetDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      location: schedule.location,
      note: schedule.note || `Generated from schedule: ${schedule.title}`,
      status: SessionStatus.PLANNED,
      registrations: {
        createMany: {
          data: defaultMembers.map((member) => ({
            memberId: member.memberId,
          })),
        },
      },
    },
  });

  for (const defaultExpense of defaultExpenses) {
    await createExpenseRecord(db, {
      sessionId: session.id,
      title: defaultExpense.title,
      amount: defaultExpense.amount,
      note: defaultExpense.note,
      shares: defaultExpense.payers.map((payer) => ({
        memberId: payer.memberId,
        shareAmount: payer.shareAmount,
      })),
    });
  }

  return session;
}

async function createExpenseRecord(
  db: DbClient,
  input: {
    sessionId: string | null;
    title: string;
    amount: number;
    note: string | null;
    shares: { memberId: string; shareAmount: number }[];
  },
) {
  const expense = await db.expense.create({
    data: {
      sessionId: input.sessionId,
      title: input.title,
      amount: input.amount,
      note: input.note,
      payers: {
        createMany: {
          data: input.shares.map((share) => ({
            memberId: share.memberId,
            shareAmount: share.shareAmount,
          })),
        },
      },
    },
  });

  await db.ledgerEntry.createMany({
    data: input.shares.map((share) => ({
      memberId: share.memberId,
      type: LedgerEntryType.EXPENSE,
      amount: -share.shareAmount,
      referenceType: "expense",
      referenceId: expense.id,
      description: `Expense share paid: ${input.title}`,
    })),
  });

  return expense;
}

function parseScheduleDefaultExpenses(formData: FormData) {
  const raw = String(formData.get("defaultExpensesJson") || "").trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Default expenses payload is invalid.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Default expenses payload is invalid.");
  }

  return parsed.map((item) => {
    const candidate = item as {
      title?: unknown;
      amount?: unknown;
      note?: unknown;
      payerIds?: unknown;
    };

    if (
      !candidate ||
      typeof candidate.title !== "string" ||
      typeof candidate.amount !== "number" ||
      !Array.isArray(candidate.payerIds)
    ) {
      throw new Error("Default expenses payload is invalid.");
    }

    const title = candidate.title.trim();
    const amount = candidate.amount;
    const note = typeof candidate.note === "string" ? candidate.note.trim() : "";
    const payerIds = [...new Set(candidate.payerIds.map((value) => String(value)).filter(Boolean))];

    if (!title || amount <= 0 || payerIds.length === 0) {
      throw new Error("Each default expense requires title, amount, and at least one paid-by member.");
    }

    return {
      title,
      amount,
      note: note || null,
      payerIds,
    };
  });
}

export async function createMember(formData: FormData) {
  "use server";
  await assertAdmin();

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const avatarUrl = String(formData.get("avatarUrl") || "").trim();

  if (!name) {
    throw new Error("Member name is required.");
  }

  await prisma.member.create({
    data: {
      name,
      phone: phone || null,
      avatarUrl: avatarUrl || null,
    },
  });

  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function updateMember(formData: FormData) {
  "use server";
  await assertAdmin();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const avatarUrl = String(formData.get("avatarUrl") || "").trim();
  const status = String(formData.get("status") || "ACTIVE");

  if (!id || !name) {
    throw new Error("Member id and name are required.");
  }

  await prisma.member.update({
    where: { id },
    data: {
      name,
      phone: phone || null,
      avatarUrl: avatarUrl || null,
      status: status === "INACTIVE" ? MemberStatus.INACTIVE : MemberStatus.ACTIVE,
    },
  });

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function upsertMemberUser(formData: FormData) {
  "use server";
  await assertAdmin();

  const memberId = String(formData.get("memberId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "MEMBER");
  const password = String(formData.get("password") || "").trim();

  if (!memberId || !email) {
    throw new Error("Member and email are required.");
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { user: true },
  });

  if (!member) {
    throw new Error("Member not found.");
  }

  const existingEmailOwner = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmailOwner && existingEmailOwner.memberId !== memberId) {
    throw new Error("That email is already assigned to another user.");
  }

  const nextRole = role === "ADMIN" ? Role.ADMIN : Role.MEMBER;

  if (member.user) {
    await prisma.user.update({
      where: { id: member.user.id },
      data: {
        email,
        role: nextRole,
        ...(password
          ? { passwordHash: await bcrypt.hash(password, 10) }
          : {}),
      },
    });
  } else {
    if (!password) {
      throw new Error("Password is required when creating a new user account.");
    }

    await prisma.user.create({
      data: {
        memberId,
        email,
        role: nextRole,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  }

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
}

export async function createSession(formData: FormData) {
  "use server";
  await assertAdmin();

  const date = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const location = String(formData.get("location") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const status = String(formData.get("status") || "PLANNED");
  const registrationMemberIds = formData
    .getAll("registrationMemberIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (!date || !startTime || !location) {
    throw new Error("Date, start time, and location are required.");
  }

  await prisma.session.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      startTime,
      endTime: endTime || null,
      location,
      note: note || null,
      status:
        status === "COMPLETED"
          ? SessionStatus.COMPLETED
          : status === "CANCELLED"
            ? SessionStatus.CANCELLED
            : SessionStatus.PLANNED,
      registrations: {
        createMany: {
          data: [...new Set(registrationMemberIds)].map((memberId) => ({
            memberId,
          })),
        },
      },
    },
  });

  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function createSchedule(formData: FormData) {
  "use server";
  await assertAdmin();

  const title = String(formData.get("title") || "").trim();
  const weekday = String(formData.get("weekday") || "MONDAY") as ScheduleWeekday;
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const location = String(formData.get("location") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const defaultMemberIds = [...new Set(
    formData
      .getAll("defaultMemberIds")
      .map((value) => String(value))
      .filter(Boolean),
  )];
  const defaultExpenses = parseScheduleDefaultExpenses(formData);

  if (!title || !startTime || !location) {
    throw new Error("Title, weekday, start time, and location are required.");
  }

  const allExpensePayerIds = [...new Set(defaultExpenses.flatMap((expense) => expense.payerIds))];
  if (allExpensePayerIds.length > 0) {
    const validPayers = await prisma.member.findMany({
      where: {
        id: { in: allExpensePayerIds },
        status: MemberStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (validPayers.length !== allExpensePayerIds.length) {
      throw new Error("All default expense paid-by members must be active members.");
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      title,
      weekday,
      startTime,
      endTime: endTime || null,
      location,
      note: note || null,
      defaultMembers: {
        createMany: {
          data: defaultMemberIds.map((memberId) => ({
            memberId,
          })),
        },
      },
      defaultExpenses: {
        create: defaultExpenses.map((expense) => ({
          title: expense.title,
          amount: expense.amount,
          note: expense.note,
          payers: {
            createMany: {
              data: splitAmountEvenly(expense.amount, expense.payerIds).map((share) => ({
                memberId: share.memberId,
                shareAmount: share.shareAmount,
              })),
            },
          },
        })),
      },
    },
  });

  await ensureUpcomingSessionForSchedule(prisma, schedule, new Date(), {
    inclusive: true,
  });

  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function updateSchedule(formData: FormData) {
  "use server";
  await assertAdmin();

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const weekday = String(formData.get("weekday") || "MONDAY") as ScheduleWeekday;
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const location = String(formData.get("location") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const isActive = String(formData.get("isActive") || "") === "on";

  if (!id || !title || !startTime || !location) {
    throw new Error("Schedule id, title, weekday, start time, and location are required.");
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      title,
      weekday,
      startTime,
      endTime: endTime || null,
      location,
      note: note || null,
      isActive,
    },
  });

  if (isActive) {
    await ensureUpcomingSessionForSchedule(prisma, schedule, new Date(), {
      inclusive: true,
    });
  }

  revalidatePath(`/schedules/${id}`);
  revalidatePath("/schedules");
  revalidatePath("/sessions");
}

export async function addScheduleDefaultExpense(formData: FormData) {
  "use server";
  await assertAdmin();

  const scheduleId = String(formData.get("scheduleId") || "");
  const title = String(formData.get("title") || "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") || ""));
  const payerIds = [...new Set(
    formData
      .getAll("payerIds")
      .map((value) => String(value))
      .filter(Boolean),
  )];
  const note = String(formData.get("note") || "").trim();

  if (!scheduleId || !title || payerIds.length === 0) {
    throw new Error("Schedule, title, and at least one paid-by member are required.");
  }
  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) {
    throw new Error("Schedule not found.");
  }

  const payers = await prisma.member.findMany({
    where: {
      id: { in: payerIds },
      status: MemberStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (payers.length !== payerIds.length) {
    throw new Error("All paid-by members must be active members.");
  }

  await prisma.scheduleDefaultExpense.create({
    data: {
      scheduleId,
      title,
      amount,
      note: note || null,
      payers: {
        createMany: {
          data: splitAmountEvenly(amount, payerIds).map((share) => ({
            memberId: share.memberId,
            shareAmount: share.shareAmount,
          })),
        },
      },
    },
  });

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

export async function removeScheduleDefaultExpense(formData: FormData) {
  "use server";
  await assertAdmin();

  const scheduleId = String(formData.get("scheduleId") || "");
  const defaultExpenseId = String(formData.get("defaultExpenseId") || "");

  if (!scheduleId || !defaultExpenseId) {
    throw new Error("Schedule and default expense are required.");
  }

  await prisma.scheduleDefaultExpense.delete({
    where: { id: defaultExpenseId },
  });

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

export async function updateSessionRegistrations(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionId = String(formData.get("sessionId") || "");
  const registrationMemberIds = [...new Set(
    formData
      .getAll("registrationMemberIds")
      .map((value) => String(value))
      .filter(Boolean),
  )];

  if (!sessionId) {
    throw new Error("Session is required.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.status === SessionStatus.COMPLETED) {
      throw new Error("Completed sessions cannot be edited.");
    }

    await tx.sessionRegistration.deleteMany({
      where: { sessionId },
    });

    if (registrationMemberIds.length > 0) {
      await tx.sessionRegistration.createMany({
        data: registrationMemberIds.map((memberId) => ({
          sessionId,
          memberId,
        })),
      });
    }
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
}

export async function removeScheduleDefaultMember(formData: FormData) {
  "use server";
  await assertAdmin();

  const scheduleId = String(formData.get("scheduleId") || "");
  const memberId = String(formData.get("memberId") || "");

  if (!scheduleId || !memberId) {
    throw new Error("Schedule and member are required.");
  }

  await prisma.scheduleDefaultMember.deleteMany({
    where: {
      scheduleId,
      memberId,
    },
  });

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

export async function addScheduleDefaultMember(formData: FormData) {
  "use server";
  await assertAdmin();

  const scheduleId = String(formData.get("scheduleId") || "");
  const memberQuery = String(formData.get("memberQuery") || "").trim();

  if (!scheduleId || !memberQuery) {
    throw new Error("Schedule and member are required.");
  }

  const directMatch = await prisma.member.findFirst({
    where: {
      status: MemberStatus.ACTIVE,
      OR: [{ id: memberQuery }, { name: memberQuery }],
    },
  });

  const member =
    directMatch ||
    (await prisma.member
      .findMany({
        where: {
          status: MemberStatus.ACTIVE,
        },
        orderBy: { name: "asc" },
      })
      .then((items) =>
        items.find((item) => item.name.toLowerCase() === memberQuery.toLowerCase()) ||
        null,
      ));

  if (!member) {
    throw new Error("Active member not found.");
  }

  await prisma.scheduleDefaultMember.create({
    data: {
      scheduleId,
      memberId: member.id,
    },
  });

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
}

export async function removeSessionRegistration(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionId = String(formData.get("sessionId") || "");
  const memberId = String(formData.get("memberId") || "");

  if (!sessionId || !memberId) {
    throw new Error("Session and member are required.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.status === SessionStatus.COMPLETED) {
      throw new Error("Completed sessions cannot be edited.");
    }

    const expenseCount = await tx.expense.count({
      where: { sessionId },
    });

    const existingAttendance = await tx.attendance.findFirst({
      where: {
        sessionId,
        memberId,
      },
    });

    if (expenseCount > 0 && existingAttendance) {
      throw new Error(
        "Cannot remove a checked-in member after expenses have been recorded for this session.",
      );
    }

    if (existingAttendance) {
      await tx.attendance.delete({
        where: { id: existingAttendance.id },
      });
    }

    await tx.sessionRegistration.deleteMany({
      where: {
        sessionId,
        memberId,
      },
    });
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
}

export async function addSessionRegistration(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionId = String(formData.get("sessionId") || "");
  const memberQuery = String(formData.get("memberQuery") || "").trim();

  if (!sessionId || !memberQuery) {
    throw new Error("Session and member are required.");
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new Error("Session not found.");
  }
  if (session.status === SessionStatus.COMPLETED) {
    throw new Error("Completed sessions cannot be edited.");
  }

  const directMatch = await prisma.member.findFirst({
    where: {
      status: MemberStatus.ACTIVE,
      OR: [{ id: memberQuery }, { name: memberQuery }],
    },
  });

  const member =
    directMatch ||
    (await prisma.member
      .findMany({
        where: {
          status: MemberStatus.ACTIVE,
        },
        orderBy: { name: "asc" },
      })
      .then((items) =>
        items.find((item) => item.name.toLowerCase() === memberQuery.toLowerCase()) ||
        null,
      ));

  if (!member) {
    throw new Error("Active member not found.");
  }

  await prisma.sessionRegistration.create({
    data: {
      sessionId,
      memberId: member.id,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
}

export async function selfRegisterForSession(formData: FormData) {
  "use server";
  const user = await assertAuthenticated();

  if (!user.memberId) {
    throw new Error("Your account is not linked to a member.");
  }

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) {
    throw new Error("Session is required.");
  }

  await prisma.$transaction(async (tx) => {
    const [session, member, existingRegistration] = await Promise.all([
      tx.session.findUnique({ where: { id: sessionId } }),
      tx.member.findUnique({ where: { id: user.memberId! } }),
      tx.sessionRegistration.findFirst({
        where: {
          sessionId,
          memberId: user.memberId!,
        },
      }),
    ]);

    if (!session) {
      throw new Error("Session not found.");
    }
    if (session.status !== SessionStatus.PLANNED) {
      throw new Error("Only planned sessions can be registered.");
    }
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new Error("Only active members can register.");
    }
    if (existingRegistration) {
      throw new Error("You are already registered for this session.");
    }

    await tx.sessionRegistration.create({
      data: {
        sessionId,
        memberId: user.memberId!,
      },
    });
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function updateSession(formData: FormData) {
  "use server";
  await assertAdmin();

  const id = String(formData.get("id") || "");
  const date = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const location = String(formData.get("location") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const status = String(formData.get("status") || "PLANNED");

  if (!id || !date || !startTime || !location) {
    throw new Error("Session id, date, start time, and location are required.");
  }

  const nextStatus =
    status === "CANCELLED"
        ? SessionStatus.CANCELLED
        : SessionStatus.PLANNED;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.session.findUnique({
      where: { id },
      include: { schedule: true },
    });

    if (!existing) {
      throw new Error("Session not found.");
    }
    if (existing.status === SessionStatus.COMPLETED) {
      throw new Error("Completed sessions cannot be edited.");
    }

    const expenseCount = await tx.expense.count({ where: { sessionId: id } });
    if (nextStatus === "CANCELLED" && expenseCount > 0) {
      throw new Error("Sessions with recorded expenses cannot be cancelled.");
    }

    await tx.session.update({
      where: { id },
      data: {
        date: new Date(`${date}T00:00:00.000Z`),
        startTime,
        endTime: endTime || null,
        location,
        note: note || null,
        status: nextStatus,
      },
    });
  });

  revalidatePath(`/sessions/${id}`);
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function completeSession(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) {
    throw new Error("Session is required.");
  }

  await prisma.$transaction(
    async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { schedule: true },
      });

      if (!session) {
        throw new Error("Session not found.");
      }
      if (session.status === SessionStatus.COMPLETED) {
        throw new Error("Session is already completed.");
      }
      if (session.status === SessionStatus.CANCELLED) {
        throw new Error("Cancelled sessions cannot be completed.");
      }

      await tx.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.COMPLETED },
      });

      if (session.schedule) {
        await ensureUpcomingSessionForSchedule(tx, session.schedule, session.date, {
          inclusive: false,
        });
      }
    },
    {
      // Completing a session may also generate the next one with default expenses.
      // On higher-latency production DBs this can exceed Prisma's 5s default timeout.
      maxWait: 10_000,
      timeout: 20_000,
    },
  );

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function adminCheckIn(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionId = String(formData.get("sessionId") || "");
  const memberId = String(formData.get("memberId") || "");

  if (!sessionId || !memberId) {
    throw new Error("Session and member are required.");
  }

  const [session, member, registration] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.sessionRegistration.findFirst({
      where: {
        sessionId,
        memberId,
      },
    }),
  ]);

  if (!session || session.status === SessionStatus.CANCELLED) {
    throw new Error("Cannot check in to a cancelled or missing session.");
  }
  if (session.status === SessionStatus.COMPLETED) {
    throw new Error("Completed sessions cannot be edited.");
  }

  if (!member || member.status !== MemberStatus.ACTIVE) {
    throw new Error("Only active members can be checked in.");
  }

  if (!registration) {
    throw new Error("Only registered members can be checked in.");
  }

  await prisma.attendance.create({
    data: {
      sessionId,
      memberId,
      checkedInBy: CheckedInBy.ADMIN,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
}

export async function selfCheckIn(formData: FormData) {
  "use server";
  const user = await assertAuthenticated();

  if (user.role !== Role.MEMBER || !user.memberId) {
    throw new Error("Only members can self check-in.");
  }

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) {
    throw new Error("Session is required.");
  }

  const [session, member, registration] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.member.findUnique({ where: { id: user.memberId } }),
    prisma.sessionRegistration.findFirst({
      where: {
        sessionId,
        memberId: user.memberId,
      },
    }),
  ]);

  if (!session || session.status === SessionStatus.CANCELLED) {
    throw new Error("Cannot check in to a cancelled or missing session.");
  }
  if (session.status === SessionStatus.COMPLETED) {
    throw new Error("Completed sessions cannot be edited.");
  }

  if (!member || member.status !== MemberStatus.ACTIVE) {
    throw new Error("Inactive members cannot check in.");
  }

  if (!registration) {
    throw new Error("Only registered members can self check-in.");
  }

  await prisma.attendance.create({
    data: {
      sessionId,
      memberId: user.memberId,
      checkedInBy: CheckedInBy.SELF,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/me");
}

export async function createExpense(formData: FormData) {
  "use server";
  await assertAdmin();

  const sessionIdValue = String(formData.get("sessionId") || "").trim();
  const sessionId = sessionIdValue || null;
  const title = String(formData.get("title") || "").trim();
  const amount = parseMoneyToCents(String(formData.get("amount") || ""));
  const payerIds = [...new Set(
    formData
      .getAll("payerIds")
      .map((value) => String(value))
      .filter(Boolean),
  )];
  const note = String(formData.get("note") || "").trim();

  if (!title || payerIds.length === 0) {
    throw new Error("Title and at least one paid-by member are required.");
  }

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  await prisma.$transaction(async (tx) => {
    if (sessionId) {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.status === SessionStatus.CANCELLED) {
        throw new Error("Cannot add expenses to a cancelled or missing session.");
      }
      if (session.status === SessionStatus.COMPLETED) {
        throw new Error("Completed sessions cannot be edited.");
      }
    }

    const payers = await tx.member.findMany({
      where: {
        id: { in: payerIds },
        status: MemberStatus.ACTIVE,
      },
    });
    if (payers.length !== payerIds.length) {
      throw new Error("All paid-by members must be active members.");
    }

    await createExpenseRecord(tx, {
      sessionId,
      title,
      amount,
      note: note || null,
      shares: splitAmountEvenly(amount, payerIds),
    });
  });

  if (sessionId) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  revalidatePath("/expenses/create");
  revalidatePath("/sessions");
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function removeExpense(formData: FormData) {
  "use server";
  await assertAdmin();

  const expenseId = String(formData.get("expenseId") || "");
  if (!expenseId) {
    throw new Error("Expense is required.");
  }

  let sessionId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: {
        payers: true,
        session: true,
      },
    });

    if (!expense) {
      throw new Error("Expense not found.");
    }
    sessionId = expense.sessionId;

    if (expense.session?.status === SessionStatus.COMPLETED) {
      throw new Error("Expenses for completed sessions cannot be removed.");
    }

    await tx.ledgerEntry.deleteMany({
      where: {
        referenceType: "expense",
        referenceId: expense.id,
      },
    });

    await tx.expense.delete({
      where: { id: expenseId },
    });
  });

  revalidatePath("/expenses/create");
  revalidatePath("/sessions");
  if (sessionId) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  revalidatePath("/members");
  revalidatePath("/dashboard");
}

export async function addMemberBalance(formData: FormData) {
  "use server";
  await assertAdmin();

  const memberId = String(formData.get("memberId") || "");
  const amount = parseMoneyToCents(String(formData.get("amount") || ""));
  const note = String(formData.get("note") || "").trim();

  if (!memberId) {
    throw new Error("Member is required.");
  }

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new Error("Member not found.");
  }

  await prisma.ledgerEntry.create({
    data: {
      memberId,
      type: LedgerEntryType.ADJUSTMENT,
      amount,
      referenceType: "adjustment",
      referenceId: crypto.randomUUID(),
      description: note || `Manual balance adjustment for ${member.name}`,
    },
  });

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
}
