"use client";
import { use } from "react";
import { BusinessTab, ConnectionsTab, NotificationsTab } from "@/admin/admin-area/Settings";
import { EmailTab } from "@/admin/admin-area/EmailSettings";
import { tabOf } from "@/admin/section-index";
import { Guard } from "@/admin/shell";
import { Empty } from "@/admin/ui";

export default function SettingsPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (!tabOf("settings", tab)) return <Empty title="Unknown tab" />;
  return (
    <Guard perm={`settings.${tab}`}>
      {tab === "email" ? <EmailTab /> : tab === "notifications" ? <NotificationsTab /> : tab === "connections" ? <ConnectionsTab /> : <BusinessTab />}
    </Guard>
  );
}
