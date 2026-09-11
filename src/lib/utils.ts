import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string | { toNumber(): number },
  currency = "INR",
  locale = "en-US",
) {
  let value: number;
  if (typeof amount === "number") value = amount;
  else if (typeof amount === "string") value = parseFloat(amount);
  else value = amount.toNumber();
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string, withTime = false) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function generateInvoiceNumber(prefix = "INV"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${year}${month}-${rand}`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    TRIALING: "bg-sky-100 text-sky-700 border-sky-200",
    PENDING: "bg-amber-100 text-amber-700 border-amber-200",
    PAST_DUE: "bg-orange-100 text-orange-700 border-orange-200",
    EXPIRED: "bg-rose-100 text-rose-700 border-rose-200",
    CANCELLED: "bg-gray-200 text-gray-600 border-gray-300",
    PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
    PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
    OVERDUE: "bg-rose-100 text-rose-700 border-rose-200",
    DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
    SENT: "bg-sky-100 text-sky-700 border-sky-200",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    FAILED: "bg-rose-100 text-rose-700 border-rose-200",
    REFUNDED: "bg-gray-200 text-gray-600 border-gray-300",
    SENT_LOG: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toTitleCase(s: string): string {
  return titleCase(s);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
