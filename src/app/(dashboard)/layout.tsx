import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DashboardShell from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <DashboardShell>{children}</DashboardShell>;
}
