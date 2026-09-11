"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export default function DeleteButton({
  onDelete,
  confirmMessage = "Are you sure you want to delete this? This action cannot be undone.",
  label,
}: {
  onDelete: () => Promise<{ error?: string }>;
  confirmMessage?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    if (!window.confirm(confirmMessage)) return;
    setError("");
    startTransition(async () => {
      const res = await onDelete();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={handleDelete}
        disabled={pending}
        className="btn-ghost text-rose-600 hover:bg-rose-50"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
        {label && <span>{label}</span>}
      </button>
      {error && <span className="mt-1 text-xs text-rose-600">{error}</span>}
    </div>
  );
}
