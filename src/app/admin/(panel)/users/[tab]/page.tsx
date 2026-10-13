"use client";
import { use } from "react";
import { RolesTab } from "@/admin/admin-area/RolesTab";
import { UsersTab } from "@/admin/admin-area/UsersTab";
import { tabOf } from "@/admin/section-index";
import { Guard } from "@/admin/shell";
import { Empty } from "@/admin/ui";

export default function UsersPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (!tabOf("users", tab)) return <Empty title="Unknown tab" />;
  return <Guard perm={`users.${tab}`}>{tab === "roles" ? <RolesTab /> : <UsersTab />}</Guard>;
}
