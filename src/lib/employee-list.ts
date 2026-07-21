import { z } from "zod";
import type { Status } from "@/types";

/**
 * 임직원 목록 조회의 쿼리/응답 계약. API 라우트와 /admin 클라이언트가 함께 씁니다.
 * 한쪽만 고치면 목록이 조용히 어긋나므로 모양을 바꿀 때는 여기부터 고치세요.
 */

/** 목업(1–8 / 142) 기준 한 페이지 행 수. */
export const PAGE_SIZE = 8;

/** CSV 내보내기처럼 전체를 한 번에 받아야 할 때의 상한. */
export const MAX_PAGE_SIZE = 1000;

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  department: z.string().trim().max(50).default(""),
  status: z.enum(["PENDING", "ACTIVE", "RESIGNED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * 목록 한 행. email 은 admin 세션에서만 채워집니다.
 * (member 세션의 용도는 /edit 의 본인 선택이라 연락처를 내려줄 이유가 없습니다.)
 */
export type EmployeeListItem = {
  id: string;
  slug: string;
  nameKo: string;
  department: string | null;
  rank: string;
  email: string | null;
  status: Status;
  updatedAt: string;
};

export type EmployeeListResponse = {
  items: EmployeeListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** 필터 드롭다운용. 현재 DB 에 실제로 존재하는 부서만 내려줍니다. */
  departments: string[];
};

/** URLSearchParams 로 직렬화. 빈 값은 넣지 않아 URL 을 짧게 유지합니다. */
export function toListSearchParams(query: Partial<ListQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.department) params.set("department", query.department);
  if (query.status) params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  return params;
}
