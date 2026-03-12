"use client";

import { useParams } from "next/navigation";
import { Dashboard } from "@/components/analytics/Dashboard";

export default function DashboardPage() {
  const { serverId } = useParams() as { serverId: string };
  return <Dashboard serverId={serverId} />;
}
