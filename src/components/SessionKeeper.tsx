"use client";

import { useEffect } from "react";
import { SSO_EXP_COOKIE, SSO_REFRESH_PATH, SSO_RENEW_BEFORE_SECONDS } from "@/lib/oidc";

/**
 * SSO 세션을 끝나기 전에 갱신합니다. (규칙은 lib/oidc.ts 의 SSO 로그인 유지 설명)
 *
 * 세션은 15분짜리라, 화면을 열어 둔 채 일하다 저장하면 그사이 끝나 있을 수 있습니다.
 * 끝나기 5분 전에 /api/auth/refresh 를 부릅니다. 갱신은 그 경로에서만 일어납니다.
 *
 * 탭을 여러 개 열어 두면 탭마다 갱신하려 들지만, refresh token 은 한 번만 쓸 수
 * 있습니다. Web Locks 로 한 탭씩 차례로 들어가게 하고, 들어가서 만료 시각을 다시
 * 읽어 다른 탭이 이미 갱신했으면 그냥 나옵니다. 서버도 넉넉히 남은 세션은 Keycloak 에
 * 묻지 않습니다.
 *
 * 화면이 보일 때만 갱신합니다. 아무도 보지 않는 탭이 SSO 세션을 끝없이 붙들지 않게
 * 하려는 것입니다. 다시 보이면 그때 바로 확인합니다.
 *
 * 공용 비밀번호로 들어온 세션에는 만료 시각 쿠키가 없어 아무 일도 하지 않습니다.
 */

/** 서로 다른 탭이 같은 순간에 깨지 않도록 조금씩 흩습니다 */
const JITTER_MS = 20_000;
/** 서버에 닿지 못했을 때 다시 해 보는 간격 */
const RETRY_MS = 60_000;

function sessionExpiry(): number {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SSO_EXP_COOKIE}=(\\d+)`));
  return match ? Number(match[1]) : 0;
}

const dueSoon = (exp: number) => exp - Date.now() / 1000 <= SSO_RENEW_BEFORE_SECONDS;

export function SessionKeeper() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function schedule(delay?: number) {
      clearTimeout(timer);
      const exp = sessionExpiry();
      if (stopped || !exp) return;
      const wait = delay ?? Math.max(0, (exp - SSO_RENEW_BEFORE_SECONDS) * 1000 - Date.now()) + Math.random() * JITTER_MS;
      timer = setTimeout(() => void renew(), wait);
    }

    async function attempt() {
      // 다른 탭이 이미 갱신했으면 만료 시각이 밀려 있습니다
      if (!dueSoon(sessionExpiry())) return schedule();

      const res = await fetch(SSO_REFRESH_PATH, { method: "POST" }).catch(() => null);
      if (res?.status === 401) {
        // 갱신이 거절됐습니다(세션은 서버가 지웠습니다). 버튼 없이 통합 로그인으로 —
        // 게이트가 화면 없이 넘기고, 방금 다녀온 직후라면 거기서 멈추고 안내합니다.
        stopped = true;
        const here = window.location.pathname + window.location.search;
        window.location.assign(`/gate?next=${encodeURIComponent(here)}`);
        return;
      }
      schedule(res?.ok ? undefined : RETRY_MS);
    }

    async function renew() {
      if (stopped || document.visibilityState !== "visible" || !sessionExpiry()) return;
      if (navigator.locks) await navigator.locks.request("dvi-sso-refresh", attempt);
      else await attempt();
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (dueSoon(sessionExpiry())) void renew();
      else schedule();
    }

    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
