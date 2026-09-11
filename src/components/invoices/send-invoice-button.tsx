"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendInvoiceEmail } from "@/app/actions/invoices";

export default function SendInvoiceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSend() {
    setMsg(null);
    startTransition(async () => {
      const res = await sendInvoiceEmail(id);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: "Invoice emailed to customer." });
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleSend} disabled={pending} className="btn-secondary">
        <Send className="h-4 w-4" /> {pending ? "Sending…" : "Email invoice"}
      </button>
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
