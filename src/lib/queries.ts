import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  const [members, sessions, ledgerEntries] = await Promise.all([
    prisma.member.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findMany({
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: {
        attendances: true,
        expenses: true,
      },
      take: 6,
    }),
    prisma.ledgerEntry.groupBy({
      by: ["memberId"],
      _sum: { amount: true },
    }),
  ]);

  const memberMap = new Map(members.map((member) => [member.id, member]));
  const balances = ledgerEntries
    .map((entry) => ({
      member: memberMap.get(entry.memberId),
      balance: entry._sum.amount || 0,
    }))
    .filter((entry) => entry.member)
    .sort((a, b) => a.balance - b.balance);

  return {
    members,
    sessions,
    balances,
  };
}

export async function getMemberDashboardData(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
      },
      attendances: {
        include: {
          session: true,
        },
        orderBy: { checkedInAt: "desc" },
        take: 5,
      },
      sessionRegistrations: {
        include: {
          session: {
            include: {
              schedule: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
      expensePayers: {
        include: {
          expense: {
            include: {
              session: true,
            },
          },
        },
        orderBy: {
          expense: {
            createdAt: "desc",
          },
        },
        take: 5,
      },
    },
  });

  if (!member) {
    return null;
  }

  const balance = member.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    member,
    balance,
  };
}

export async function getMembersWithBalances() {
  const [members, grouped] = await Promise.all([
    prisma.member.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        user: true,
      },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["memberId"],
      _sum: { amount: true },
    }),
  ]);

  const balanceMap = new Map(grouped.map((item) => [item.memberId, item._sum.amount || 0]));

  return members.map((member) => ({
    ...member,
    balance: balanceMap.get(member.id) || 0,
  }));
}

export async function getMemberDetail(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      user: true,
      attendances: {
        include: {
          session: true,
        },
        orderBy: { checkedInAt: "desc" },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
      },
      expensePayers: {
        include: {
          expense: true,
        },
      },
    },
  });

  if (!member) {
    return null;
  }

  const balance = member.ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    ...member,
    balance,
  };
}

export async function getSessionsForUser(user: {
  role: Role;
  memberId?: string | null;
}) {
  const sessions = await prisma.session.findMany({
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    include: {
      schedule: true,
      registrations: {
        include: {
          member: true,
        },
      },
      attendances: {
        include: {
          member: true,
        },
      },
      expenses: true,
    },
  });

  return sessions.map((session) => ({
    ...session,
    checkedIn: user.memberId
      ? session.attendances.some((attendance) => attendance.memberId === user.memberId)
      : false,
  }));
}

export async function getSessionDetail(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      schedule: true,
      registrations: {
        include: {
          member: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
      attendances: {
        include: {
          member: true,
        },
        orderBy: [{ checkedInAt: "asc" }],
      },
      expenses: {
        include: {
          payers: {
            include: {
              member: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getExpenseFormData() {
  const [sessions, members, recentExpenses] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      include: {
        expenses: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    }),
    prisma.member.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      include: {
        session: true,
        payers: {
          include: {
            member: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { sessions, members, recentExpenses };
}

export async function getExpensesForMember(memberId: string) {
  return prisma.expensePayer.findMany({
    where: {
      memberId,
    },
    include: {
      expense: {
        include: {
          session: true,
          payers: {
            include: {
              member: true,
            },
          },
        },
      },
      member: true,
    },
    orderBy: {
      expense: {
        createdAt: "desc",
      },
    },
  });
}

export async function getSchedules() {
  return prisma.schedule.findMany({
    orderBy: [{ isActive: "desc" }, { weekday: "asc" }, { startTime: "asc" }],
    include: {
      defaultMembers: {
        include: {
          member: true,
        },
      },
      sessions: {
        orderBy: { date: "desc" },
        take: 3,
      },
      defaultExpenses: {
        include: {
          payers: true,
        },
      },
    },
  });
}

export async function getScheduleDetail(scheduleId: string) {
  return prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      defaultMembers: {
        include: {
          member: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
      defaultExpenses: {
        include: {
          payers: {
            include: {
              member: true,
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      sessions: {
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
      },
    },
  });
}

export async function getActiveMembers() {
  return prisma.member.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

export async function getLedgerData() {
  const [entries, grouped, members] = await Promise.all([
    prisma.ledgerEntry.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        member: true,
      },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["memberId"],
      _sum: { amount: true },
    }),
    prisma.member.findMany(),
  ]);

  const memberMap = new Map(members.map((member) => [member.id, member]));
  const balances = grouped
    .map((item) => ({
      member: memberMap.get(item.memberId),
      balance: item._sum.amount || 0,
    }))
    .filter((item) => item.member);

  return { entries, balances };
}


export async function getMeData(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      attendances: {
        include: {
          session: true,
        },
        orderBy: { checkedInAt: "desc" },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!member) {
    return null;
  }

  return {
    member,
    balance: member.ledgerEntries.reduce((sum, item) => sum + item.amount, 0),
  };
}

// ─── Match filtering ─────────────────────────────────────────────────────────

export interface MatchFilters {
  playerIds?: string[]
  dateFrom?: Date
  dateTo?: Date
}

export async function getMatchesFiltered(filters: MatchFilters = {}) {
  const { playerIds, dateFrom, dateTo } = filters

  const where: NonNullable<Parameters<typeof prisma.match.findMany>[0]>["where"] = {}

  if (playerIds && playerIds.length > 0) {
    where.AND = playerIds.map((id) => ({
      OR: [{ winnerIds: { has: id } }, { loserIds: { has: id } }],
    }))
  }

  if (dateFrom || dateTo) {
    where.playedAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    }
  }

  const hasFilter = (playerIds && playerIds.length > 0) || dateFrom || dateTo
  const matches = await prisma.match.findMany({
    where,
    orderBy: { playedAt: "desc" },
    take: hasFilter ? 100 : 50,
  })

  const allPlayerIds = [
    ...new Set(matches.flatMap((m) => [...m.winnerIds, ...m.loserIds])),
  ]
  const members = await prisma.member.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true },
  })
  const memberMap = new Map(members.map((m) => [m.id, m]))

  return matches.map((m) => ({
    ...m,
    ratingChanges: m.ratingChanges as Record<string, number>,
    winners: m.winnerIds.map((id) => memberMap.get(id)?.name ?? "?"),
    losers: m.loserIds.map((id) => memberMap.get(id)?.name ?? "?"),
  }))
}

// ─── Member match history for performance section ────────────────────────────

export async function getMemberMatchHistory(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      rating: true,
      eloWins: true,
      eloLosses: true,
      totalMatches: true,
      singlesMatches: true,
      doublesMatches: true,
    },
  })
  if (!member) return null

  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { winnerIds: { has: memberId } },
        { loserIds: { has: memberId } },
      ],
    },
    orderBy: { playedAt: "asc" },
  })

  // Enrich with opponent names
  const allPlayerIds = [
    ...new Set(matches.flatMap((m) => [...m.winnerIds, ...m.loserIds])),
  ]
  const members = await prisma.member.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, name: true },
  })
  const memberMap = new Map(members.map((m) => [m.id, m]))

  // Reconstruct rating timeline
  const enriched = matches.map((m) => {
    const changes = m.ratingChanges as Record<string, number>
    const delta = changes[memberId] ?? 0
    const isWinner = m.winnerIds.includes(memberId)
    const mySide = isWinner ? m.winnerIds : m.loserIds
    const oppSide = isWinner ? m.loserIds : m.winnerIds
    return {
      id: m.id,
      matchType: m.matchType as "SINGLES" | "DOUBLES",
      playedAt: m.playedAt,
      scoreWinner: m.scoreWinner,
      scoreLoser: m.scoreLoser,
      result: isWinner ? ("win" as const) : ("loss" as const),
      delta,
      // Teammates: same side excluding self
      teammates: mySide.filter((id) => id !== memberId).map((id) => memberMap.get(id)?.name ?? "?"),
      // Opponents: other side
      opponents: oppSide.map((id) => memberMap.get(id)?.name ?? "?"),
    }
  })

  // Build rating points (oldest → newest), include result for chart coloring
  const totalDelta = enriched.reduce((sum, m) => sum + m.delta, 0)
  const startRating = member.rating - totalDelta
  let acc = startRating
  const ratingPoints = enriched.map((m) => {
    acc += m.delta
    return { date: m.playedAt, rating: acc, result: m.result }
  })

  return {
    stats: member,
    matches: [...enriched].reverse(), // newest first for the log table
    ratingPoints,
  }
}
