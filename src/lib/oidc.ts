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
    };
  } catch {
    return null;
  }
}
