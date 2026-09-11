"use client";

import { useTransition } from "react";
import { toggleRule } from "@/app/actions/alerts";

export default function ToggleRule({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => { void toggleRule(id); })}
      disabled={pending}
      className={`relative h-5 w-9 rounded-full transition-colors ${active ? "bg-indigo-600" : "bg-gray-300"}`}
      title={active ? "Active — click to disable" : "Inactive — click to enable"}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
}
