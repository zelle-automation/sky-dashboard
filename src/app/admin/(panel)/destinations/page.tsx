"use client";
import { Guard } from "@/admin/shell";
import { DestinationsPage } from "@/admin/services/destinations";

export default function Page() {
  return <Guard perm="destinations.main"><DestinationsPage /></Guard>;
}
