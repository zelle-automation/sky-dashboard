"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/admin/api";
import { Btn, ErrorNote, Field, Input } from "@/admin/ui";

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email, password });
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="panel login-card" onSubmit={submit}>
      <div className="brand">
        <div className="brand-mark">S</div>
        <div><b>SKY HOLIDAYS</b><small>Control deck</small></div>
      </div>
      <div>
        <div className="eyebrow">Staff sign in</div>
        <h1 style={{ fontSize: 34 }}>Welcome <em>back</em></h1>
      </div>
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <ErrorNote error={error} />
      <Btn type="submit" variant="gold" busy={busy} style={{ justifyContent: "center" }}>Sign in</Btn>
    </form>
  );
}
