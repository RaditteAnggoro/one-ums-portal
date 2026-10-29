import { notFound } from "next/navigation";

const routes = new Set([
  "dashboard",
  "help",
  "settings/notifications",
  "settings/companies",
  "settings/maintenance",
  "updates",
  "about",
  "messages",
  "deliveries",
  "channels",
  "workflows",
  "approvals",
  "templates",
  "sources",
  "finance/usage",
  "finance/allocation",
  "finance/reconciliation",
  "settings/providers",
  "settings/applications",
  "settings/audit",
]);
export default async function Screen({
  params,
}: {
  params: Promise<{
    screen: string[];
  }>;
}) {
  const { screen } = await params;
  if (!routes.has(screen.join("/"))) notFound();
  return null;
}
