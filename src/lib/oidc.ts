import { SignJWT, jwtVerify } from "jose";

/**
 * oidc.ts — 사내 통합 로그인(Keycloak) 연동 조각
 *
 * 다른 사내 서비스(행사 아카이브·서비스 허브·탈탈)와 같은 방식입니다:
 * Authorization Code + PKCE(S256), 엔드포인트는 discovery 문서에서 읽습니다.
 *   realm 주소:  https://api.dvi-ind.com/dauth/realms/dvi
 *
 * jose 와 Web Crypto 만 쓰므로 Edge·Node 어느 런타임에서도 동작합니다.
 */

/** 로그인 진행 중(state·nonce·verifier)에만 쓰는 임시 쿠키 */
export const SSO_PENDING_COOKIE = "dvi_sso_pending";

/**
 * SSO 로그인 유지 — refresh_token 으로 짧은 세션을 계속 연장합니다.
 *
 * 쿠키 유효기간만 늘리면 퇴사·권한 변경이 그 기간 동안 반영되지 않습니다. 그래서
 * SSO 로 들어온 세션(dvi_session)은 15분짜리로 발급하고, 끝나기 전에 Keycloak 에
 * 갱신을 받아 다시 15분을 붙입니다. 갱신이 실패하면 세션을 지우고 통합 로그인으로 보냅니다.
 *
 * Keycloak 의 refresh token 은 한 번만 쓸 수 있습니다. 두 요청이 동시에 갱신하면
 * 하나는 실패하고 세션이 끊기므로, 갱신은 /api/auth/refresh 한 곳에서만 합니다.
 */
export const SSO_REFRESH_COOKIE = "dvi_rt";
/** refresh token 은 갱신 경로에만 실려 갑니다. 다른 요청·화면 스크립트에는 보이지 않습니다. */
export const SSO_REFRESH_PATH = "/api/auth/refresh";
/**
 * SSO 세션이 끝나는 시각(초). 토큰이 아니라 시각만 담습니다 — 화면이 갱신할 때를 잡고,
 * proxy 가 "갱신으로 이어 갈 수 있는 세션인지" 를 아는 데 씁니다. refresh token 과 같이 끝납니다.
 */
export const SSO_EXP_COOKIE = "dvi_sso_exp";
/** 통합 로그인에서 방금 돌아왔다는 표시. 이 사이 또 실패하면 다시 보내지 않고 멈춥니다. */
export const SSO_BACK_COOKIE = "dvi_sso_back";

/** SSO 세션 길이. 퇴사·권한 변경이 늦어도 이 시간 안에 반영됩니다. */
export const SSO_SESSION_SECONDS = 15 * 60;
/** 세션이 이만큼 남았을 때부터 갱신합니다. 그 전에 온 갱신 요청은 Keycloak 에 묻지 않습니다. */
export const SSO_RENEW_BEFORE_SECONDS = 5 * 60;
/** 로그인하고 돌아와서 이 시간 안에 또 실패하면 무한 반복으로 보고 멈춥니다. */
export const SSO_BACK_SECONDS = 60;
/** refresh_expires_in 이 없거나 0(오프라인 토큰)일 때 쓰는 refresh token 수명 */
export const SSO_REFRESH_FALLBACK_SECONDS = 12 * 60 * 60;

export interface DiscoveryDoc {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

export async function discover(issuer: string): Promise<DiscoveryDoc> {
  const url = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`통합 로그인 설정을 읽지 못했습니다 (${res.status})`);
  const meta = (await res.json()) as DiscoveryDoc;
  if (!meta.authorization_endpoint || !meta.token_endpoint) {
    throw new Error("통합 로그인 설정에 필요한 주소가 없습니다.");
  }
  return meta;
}

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomString(bytes = 48): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return toB64url(b);
}

/** PKCE — verifier 를 SHA-256 해시해 challenge 로 만듭니다 (S256) */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toB64url(new Uint8Array(digest));
}

/**
 * JWT 본문을 읽습니다.
 * 토큰 엔드포인트에서 TLS 로 직접 받은 것이라 서명 재검증은 하지 않습니다.
 * 대신 호출부에서 iss · aud · nonce · exp 를 반드시 확인합니다.
 */
export interface TokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

export function decodeJwt(token: string): TokenClaims {
  const payload = String(token || "").split(".")[1];
  if (!payload) throw new Error("토큰 형식이 올바르지 않습니다.");
  return JSON.parse(new TextDecoder().decode(fromB64url(payload))) as TokenClaims;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  return new TextEncoder().encode(secret);
}

export interface SsoPending {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  /** authentication_expired 로 한 번 다시 시작한 로그인인지 (다시 시작은 한 번만) */
  retried?: boolean;
}

/** 로그인 진행 상태를 서명해 임시 쿠키 값으로 만듭니다. 10분만 유효합니다. */
export async function signPending(pending: SsoPending): Promise<string> {
  return new SignJWT({ ...pending })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function verifyPending(token: string | undefined): Promise<SsoPending | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.verifier !== "string"
    ) {
      return null;
    }
    return {
      state: payload.state,
      nonce: payload.nonce,
      verifier: payload.verifier,
      next: typeof payload.next === "string" ? payload.next : "/edit",
      retried: payload.retried === true,
    };
  } catch {
    return null;
  }
}
