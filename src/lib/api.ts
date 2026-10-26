import { buildSlug } from "@/lib/slug";
import type { EmployeeFull } from "@/types";

/**
 * 명함 서버(dvision-namecard-server 저장소, Spring) 호출.
 *
 * 예전에는 Next 가 Prisma 로 DB 를 직접 읽었습니다. 이제 직원 이름·이메일·휴대폰·재직
 * 상태는 인사 시스템이 원본이고, 명함 서버가 인사 스키마와 명함 스키마를 함께 읽어
 * 예전 Prisma 와 같은 모양으로 돌려줍니다. 화면 코드는 모양이 같아서 그대로입니다.
 *
 * 서버 전용입니다. 키가 브라우저 번들에 들어가지 않도록 클라이언트 컴포넌트에서
 * import 하지 마세요. (NEXT_PUBLIC_ 이 아니라서 들어가더라도 빈 값이지만)
 */

/** 명함 서버가 2xx 가 아닌 답을 했습니다. status 로 갈라 화면 문구를 정합니다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** 서버가 붙인 사유. duplicate(unique) · reference(외래키) · last_admin. */
    readonly code: string | null,
  ) {
    super(`명함 서버 오류 ${status}${code ? ` (${code})` : ""}`);
  }
}

function baseUrl(): string {
  const url = process.env.NAMECARD_API_URL;
  if (!url) throw new Error("NAMECARD_API_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  return url.replace(/\/+$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Internal-Key", process.env.NAMECARD_API_KEY ?? "");
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  // 캐시는 부르는 쪽(unstable_cache · react cache)이 정합니다. fetch 단에서 또 캐시하면
  // 저장 직후에도 옛 값이 나옵니다.
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(res.status, body?.code ?? null);
  }
  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}

/** 404 를 null 로 바꿉니다. "없음" 이 정상 결과인 조회(slug · 이메일)에 씁니다. */
export async function apiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/**
 * 명함이 아직 없는 재직자에게 명함(공개 주소)을 만들어 줍니다.
 *
 * 인사에 입사자가 등록되면 명함 쪽에는 아직 행이 없습니다. 관리자가 따로 추가하지 않아도
 * 되도록, 목록을 열거나 본인이 로그인할 때 여기서 채웁니다. 주소(slug)는 성으로 만들고
 * (lib/slug.ts), 표에 없는 성이면 e<인사 id> 로 둡니다 — 관리자가 나중에 바꿉니다.
 */
export async function ensureCards(): Promise<void> {
  const missing = await api<{ id: string; familyName: string; givenName: string }[]>(
    "/employees/without-card",
  );
  if (missing.length === 0) return;

  const taken = new Set(await api<string[]>("/slugs"));
  const cards = missing.map((e) => {
    const slug =
      buildSlug({ familyName: e.familyName }, taken) ??
      buildSlug({ familyName: e.givenName }, taken) ??
      `e${e.id}`;
    taken.add(slug);
    return { employeeId: e.id, slug };
  });
  try {
    await api("/cards", json("POST", cards));
  } catch (cause) {
    // 두 요청이 동시에 같은 주소를 골랐습니다. 서버가 한 묶음을 통째로 되돌리므로
    // 반쯤 만들어진 상태는 없고, 다음 호출이 다시 채웁니다.
    if (!(cause instanceof ApiError && cause.status === 409)) throw cause;
  }
}

type WithDates = { createdAt: string | Date; updatedAt: string | Date };

/**
 * 직원 한 명 + 회사. JSON 으로 온 시각을 Date 로 되돌립니다 — 서명(lib/signature.ts)과
 * 편집 화면이 예전 Prisma 처럼 Date 를 받습니다.
 */
export async function getEmployee(path: string): Promise<EmployeeFull | null> {
  const employee = await apiOrNull<EmployeeFull & WithDates>(path);
  if (!employee) return null;
  return { ...employee, createdAt: new Date(employee.createdAt), updatedAt: new Date(employee.updatedAt) };
}

export const employeeBySlug = (slug: string) => getEmployee(`/employees/by-slug/${encodeURIComponent(slug)}`);
export const employeeById = (id: string) => getEmployee(`/employees/${encodeURIComponent(id)}`);
