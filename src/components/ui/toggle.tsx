import { cn } from "@/lib/utils";

export function Toggle({
  id,
  name,
  defaultChecked,
  label,
}: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
    >
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
      </div>
      <span className="relative inline-flex items-center">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500" />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            "peer-checked:translate-x-5",
          )}
        />
      </span>
    </label>
  );
}
