"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { saveTokens } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login({ email, password });
      saveTokens(result.tokens);
      router.push("/worlds");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "連線失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-md">
      <h1 className="mb-6 text-center text-3xl font-bold text-foam">登入</h1>
      <form className="panel space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="email">
            電子郵件
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            密碼
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "登入中…" : "登入"}
        </button>
        <p className="text-center text-sm text-slate-400">
          還沒有帳號？{" "}
          <Link href="/register" className="text-gold hover:underline">
            建立帳號
          </Link>
        </p>
      </form>
    </main>
  );
}
