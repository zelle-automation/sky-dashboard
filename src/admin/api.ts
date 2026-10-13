"use client";
// Browser-side calls to the Express API (/api/admin/*, proxied by Next.js rewrites).
// Every response is { data } or { error }; errors throw ApiError with the server's message.
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(path.startsWith("/api") ? path : `/api/admin${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "sky-admin",
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/admin/login")) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  if (!res.ok) throw new ApiError(res.status, json.error || `Request failed (${res.status})`);
  return (json.data ?? json) as T;
}

/** Paths without a leading /api are relative to /api/admin, e.g. api.get("/bookings?tab=pending"). */
export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => call<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => call<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => call<T>("DELETE", path),
};

/** Uploads one file to the media library and returns its row ({ id, url, ... }). */
export async function uploadFile(file: File, folder = "general") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  return call<{ id: string; url: string; width: number | null; height: number | null }>("POST", "/media", fd);
}

/** Loads `path` (null skips) and re-loads when it changes. `setData` allows optimistic edits. */
export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // Fetch on mount and whenever the path changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
