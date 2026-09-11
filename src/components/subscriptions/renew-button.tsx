"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { renewSubscription } from "@/app/actions/subscriptions";

export default function RenewButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await renewSubscription(id);
        })
      }
      disabled={pending}
      className="btn-ghost"
      title="Renew for one cycle"
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}
