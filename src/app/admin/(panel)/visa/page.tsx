"use client";
import { Guard } from "@/admin/shell";
import { VisaPage } from "@/admin/services/visa";

export default function Page() {
  return <Guard perm="visa.main"><VisaPage /></Guard>;
}
