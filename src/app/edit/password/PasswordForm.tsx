"use client";

import { useState } from "react";
import { Field, Input } from "@/components/form";
import { fieldErrors, passwordChangeSchema } from "@/lib/validation";

/**
 * 비밀번호 변경 폼.
 *
 * 초기 비밀번호로 처음 들어온 사람은 middleware 가 이 화면으로 보냅니다. 그래서
 * 안내 문구가 두 갈래입니다 — 처음 온 사람에게는 왜 여기 있는지, 그냥 바꾸러 온
 * 사람에게는 무엇을 하는 화면인지.
 */
export function PasswordForm({ forced }: { forced: boolean }) {
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    newPasswordConfirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const set = (key: keyof typeof values, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = passwordChangeSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.errors) setErrors(payload.errors);
        setMessage(payload?.error ?? "바꾸지 못했습니다.");
        return;
      }

      // 세션 쿠키가 새로 발급됐습니다. 새로 받은 쿠키로 이동해야 강제 리다이렉트가 풀립니다.
      window.location.href = "/edit";
    } catch {
      setMessage("네트워크 오류로 바꾸지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[420px]">
      <header>
        <p className="text-caption text-sub-text">내 계정</p>
        <h1 className="mt-tight text-display">비밀번호 변경</h1>
        <p className="mt-sibling text-body text-sub-text">
          {forced
            ? "관리자가 발급한 초기 비밀번호로 로그인했습니다. 본인만 아는 비밀번호로 바꿔야 계속 쓸 수 있습니다."
            : "새 비밀번호로 바꿉니다. 바꾼 뒤에는 이 기기의 로그인은 그대로 유지됩니다."}
        </p>
      </header>

      <div className="mt-block flex flex-col gap-group">
        <Field label="현재 비밀번호" htmlFor="currentPassword" error={errors.currentPassword}>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            invalid={Boolean(errors.currentPassword)}
            onChange={(e) => set("currentPassword", e.target.value)}
          />
        </Field>

        <Field
          label="새 비밀번호"
          htmlFor="newPassword"
          error={errors.newPassword}
          hint="10자 이상. 외우기 쉬운 문장이 짧고 복잡한 값보다 안전합니다."
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            invalid={Boolean(errors.newPassword)}
            onChange={(e) => set("newPassword", e.target.value)}
          />
        </Field>

        <Field label="새 비밀번호 확인" htmlFor="newPasswordConfirm" error={errors.newPasswordConfirm}>
          <Input
            id="newPasswordConfirm"
            type="password"
            autoComplete="new-password"
            value={values.newPasswordConfirm}
            invalid={Boolean(errors.newPasswordConfirm)}
            onChange={(e) => set("newPasswordConfirm", e.target.value)}
          />
        </Field>

        {message ? <p className="text-caption text-sub-text">{message}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
        >
          {saving ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </button>
      </div>
    </form>
  );
}
