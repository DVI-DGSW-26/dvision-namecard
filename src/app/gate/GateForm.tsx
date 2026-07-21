"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/form";

/**
 * 공용 비밀번호 입력 폼.
 *
 * 인증에 성공하면 ?next 로 돌아갑니다. 이 값은 사용자가 주소창에서 바꿀 수 있으므로
 * 내부 경로인지 반드시 확인하고 씁니다. 확인 없이 넘기면 오픈 리다이렉트가 됩니다.
 */

/** `/edit` 같은 내부 경로만 통과시킵니다. `//evil.com` 은 브라우저가 외부로 해석합니다. */
function safeNext(next: string | null): string {
  if (!next) return "/edit";
  if (!next.startsWith("/") || next.startsWith("//")) return "/edit";
  return next;
}

export function GateForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "로그인하지 못했습니다.");
        return;
      }

      // 세션 쿠키가 생겼으니 서버 컴포넌트를 다시 그려야 합니다.
      router.replace(safeNext(next));
      router.refresh();
    } catch {
      setError("네트워크 오류로 로그인하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-section">
      <Field label="비밀번호" htmlFor="password" error={error ?? undefined}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          invalid={Boolean(error)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <button
        type="submit"
        disabled={!password || submitting}
        className="h-12 w-full rounded-card bg-primary text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
      >
        {submitting ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
