"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Rollback trận này? Rating của tất cả người chơi sẽ được hoàn nguyên.")) {
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Có lỗi xảy ra khi rollback trận.");
      }
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="shrink-0 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
    >
      {isPending ? "Đang xóa…" : "Rollback"}
    </button>
  );
}
