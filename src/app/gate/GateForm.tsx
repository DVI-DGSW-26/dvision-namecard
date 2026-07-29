"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/form";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/icons";

/**
 * 공용 비밀번호 입력 폼.
 *
 * next 는 page.tsx 에서 safeRedirect 로 이미 걸러진 값만 받습니다. 여기서 다시
 * 검증하지 않는 건 그래서입니다 — 검증 지점을 둘로 두면 한쪽만 고쳐 놓고
 * 안전하다고 믿게 됩니다.
 */
export function GateForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 입력한 값을 눈으로 확인하기 위한 것이므로 폼 안에만 두고 저장하지 않습니다.
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    로그인은 두 단계이고, 둘 다 기다리는 시간입니다.

      1. 확인   — /api/gate 에 묻고 세션 쿠키를 받습니다. (checking)
      2. 들어가기 — 목적지(/edit·/admin)를 서버에서 그려 옵니다. (navigating)

    예전에는 1번만 표시했습니다. 2번이 시작되면 버튼이 원래대로 돌아오는데 화면은
    아직 로그인 폼이라, 누른 사람 눈에는 "로딩이 되다가 만" 것으로 보였습니다.
    2번이 더 긴 쪽인데(목적지가 DB 를 여러 번 왕복합니다) 그 구간이 통째로 표시
    밖에 있었던 셈입니다.

    그래서 2번을 transition 으로 감쌉니다 — 이동이 실제로 끝날 때까지 navigating
    이 켜져 있어서, 표시가 화면 전환까지 이어집니다.
  */
  const [checking, setChecking] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const busy = checking || navigating;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "로그인하지 못했습니다.");
        setChecking(false);
        return;
      }

      /*
       * 세션 쿠키가 생겼으니 서버 컴포넌트를 다시 그려야 합니다.
       *
       * replace() 하나로 끝납니다. 예전에는 뒤에 refresh() 를 한 번 더 불렀는데,
       * 그러면 방금 받아 온 목적지를 서버에서 한 번 더 그립니다 — /edit 은 DB 를
       * 여러 번 왕복하는 화면이라 로그인 체감 시간이 그대로 두 배가 됐습니다.
       * 목적지(/edit·/admin)는 전부 동적 라우트라 클라이언트 캐시에 재사용될
       * 항목이 남지 않습니다. 정적 페이지를 목적지로 추가하게 되면 그때 다시 보세요.
       *
       * checking 을 여기서 끄지 않습니다. 껐다가 navigating 이 켜지는 사이에 한 틱이
       * 비면 버튼이 "들어가기" 로 깜빡였다가 다시 잠깁니다.
       */
      startNavigation(() => {
        router.replace(next);
      });
    } catch {
      setError("네트워크 오류로 로그인하지 못했습니다.");
      setChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-section">
      {/*
        이메일은 "누구인지" 를 받는 칸입니다. 비밀번호는 회사 전체가 같은 값이라
        그것만으로는 신원을 알 수 없습니다.
      */}
      <Field label="사내 이메일" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="hong@dvi-ind.com"
          autoFocus
          value={email}
          invalid={Boolean(error)}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      {/* 에러는 두 칸 중 어디가 틀렸는지 알려주지 않으므로 아래쪽에 한 번만 띄웁니다. */}
      <Field label="비밀번호" htmlFor="password" error={error ?? undefined}>
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          invalid={Boolean(error)}
          onChange={(e) => setPassword(e.target.value)}
          action={
            <button
              type="button"
              // 폼 안의 버튼이라 type 을 지정하지 않으면 submit 이 되어, 보기를 누른 순간
              // 로그인 시도가 나갑니다.
              onClick={() => setShowPassword((shown) => !shown)}
              // 상태를 텍스트로도 알립니다 — 아이콘만으로는 화면 낭독기에서 구분되지 않습니다.
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={showPassword}
              className="flex h-11 w-11 items-center justify-center rounded-card text-sub-text transition-colors hover:text-text"
            >
              {showPassword ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
        />
      </Field>

      {/*
        로그인 유지. 사내 이메일과 공용 비밀번호를 매번 치는 건 모바일에서 특히 번거롭습니다.
        기본값은 꺼짐입니다 — 공용 PC 에서 켜진 채로 들어오면 다음 사람이 그대로 이어받습니다.
      */}
      <label className="flex min-h-11 items-center gap-sibling text-caption text-sub-text">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        로그인 유지 (30일)
      </label>

      {/*
        누르는 동안 버튼이 하는 말.

        글자만 바꾸면(들어가기 → 확인 중…) 멈춘 화면인지 도는 중인지 구분이 안 되고,
        두 단계를 같은 문구로 두면 "확인 중" 이 몇 초씩 머물러 멈춘 것처럼 보입니다.
        그래서 도는 고리를 같이 두고 문구도 단계마다 바꿉니다 — 문구가 한 번 바뀌는
        것만으로 "진행 중" 이 전달됩니다.

        aria-busy 와 아래 live 영역은 화면 낭독기 몫입니다. 버튼 안 글자가 바뀌어도
        포커스가 버튼에 있으면 다시 읽어 주지 않습니다.
      */}
      <button
        type="submit"
        disabled={!email || !password || busy}
        aria-busy={busy}
        className="flex h-12 w-full items-center justify-center gap-sibling rounded-card bg-primary text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
      >
        {busy ? (
          <>
            <SpinnerIcon className="h-5 w-5 animate-spin" />
            {navigating ? "들어가는 중…" : "확인 중…"}
          </>
        ) : (
          "들어가기"
        )}
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {navigating ? "로그인 확인됨. 화면을 여는 중입니다." : checking ? "로그인 확인 중입니다." : ""}
      </p>
    </form>
  );
}
