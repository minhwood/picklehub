export function parseMoneyToCents(input: string) {
  const normalized = input.trim().replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Amount must be a valid whole-number VND value.");
  }

  return Number(normalized);
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(cents);
}

export function splitAmountEvenly(totalAmount: number, participantIds: string[]) {
  if (participantIds.length === 0) {
    throw new Error("At least one participant is required.");
  }

  const uniqueIds = [...new Set(participantIds)].sort();
  const baseShare = Math.floor(totalAmount / uniqueIds.length);
  let remainder = totalAmount - baseShare * uniqueIds.length;

  return uniqueIds.map((memberId) => {
    const shareAmount = baseShare + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return { memberId, shareAmount };
  });
}
