"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export default function CashfreePayButton({
  invoiceId,
  amount,
  currency,
  onSuccess,
}: {
  invoiceId: string;
  amount: number;
  currency: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      // 1. Create a Cashfree order
      const createRes = await fetch("/api/payments/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const order = await createRes.json();
      if (!createRes.ok) {
        throw new Error(order.error || "Failed to create order");
      }

      // 2. Open Cashfree checkout using the drop-in SDK
      const cashfree = (window as unknown as {
        Cashfree?: new () => {
          checkout: (config: {
            paymentSessionId: string;
            redirectTarget: "_self" | "_blank";
            onSuccess?: (data: unknown) => void;
            onFailure?: (data: unknown) => void;
          }) => void;
        };
      }).Cashfree;

      if (!cashfree) {
        throw new Error(
          "Cashfree SDK not loaded. Please refresh the page and try again.",
        );
      }

      const cf = new cashfree();
      cf.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_self",
        onSuccess: async () => {
          // 3. Verify the payment on the backend
          try {
            const verifyRes = await fetch(
              "/api/payments/cashfree/verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: order.orderId,
                  invoiceId,
                }),
              },
            );
            const result = await verifyRes.json();
            if (result.verified) {
              onSuccess?.();
              // Reload to show updated payment status
              window.location.reload();
            } else {
              setError(
                `Payment verification pending. Status: ${result.paymentStatus}`,
              );
              setLoading(false);
            }
          } catch {
            setError("Payment was made but verification failed. Please refresh.");
            setLoading(false);
          }
        },
        onFailure: (data: unknown) => {
          const msg =
            data && typeof data === "object" && "error" in data
              ? String((data as { error: unknown }).error)
              : "Payment failed. Please try again.";
          setError(msg);
          setLoading(false);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? "Processing..." : `Pay ${currency} ${amount.toFixed(2)} with Cashfree`}
      </button>
      {error && (
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}
