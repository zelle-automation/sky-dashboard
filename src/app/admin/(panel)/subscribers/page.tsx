"use client";
import { SubscribersPage } from "@/admin/admin-area/Subscribers";
import { Guard } from "@/admin/shell";

export default function Page() {
  return <Guard perm="subscribers.main"><SubscribersPage /></Guard>;
}
