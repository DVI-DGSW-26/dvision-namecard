import { z } from "zod";

import type { Lang } from "@/lib/lang";

/**
 * 조직 목록(직위 · 임원 직책 · 직책)의 공용 계약.
 *
 * 목록은 DB 테이블입니다 — 관리자가 /admin/org 에서 바꿉니다. 그래서 앱 어디에도
 * "매니저" 같은 값을 상수로 박아 두지 않습니다. 화면은 전부 이 모듈의 타입으로
 * 받은 목록을 그립니다.
 *
 * API 라우트와 관리 화면이 함께 쓰므로, 모양을 바꿀 때는 여기부터 고치세요.
 */

/** 세 목록의 공통 모양. */
export type OrgItem = {
  id: string;
  name: string;
  /** 영문 명함용 표기. 아직 안 정한 항목은 빈 문자열입니다. */
  nameEn: string;
  sortOrder: number;
};

/** 임원 직책만 영문이 두 벌입니다 — 약어(CEO)와 정식 명칭(Chief Executive Officer). */
export type ExecutiveTitleItem = OrgItem & { nameEnFull: string };

/** 부서 — 파트는 반드시 한 팀에 속합니다. */
export type PartItem = OrgItem & { teamId: string };
export type TeamItem = OrgItem & { parts: PartItem[] };

/**
 * 사업장 — 본사 · R&D센터. nameEn 대신 우편번호와 주소를 갖습니다.
 *
 * 다른 목록과 모양이 다르지만 같은 편집 화면·같은 쓰기 라우트를 씁니다.
 * 이름(name)은 관리 화면에서 구분하는 용도고 명함에는 주소만 나갑니다.
 */
export type OfficeItem = {
  id: string;
  name: string;
  postalCode: string;
  address: string;
  /** 영문 명함용. 비면 영문 카드에서 그 줄이 빠집니다. */
  addressEn: string | null;
  sortOrder: number;
};

export type OrgLists = {
  ranks: OrgItem[];
  executiveTitles: ExecutiveTitleItem[];
  positions: OrgItem[];
  teams: TeamItem[];
  offices: OfficeItem[];
};

export const EMPTY_ORG_LISTS: OrgLists = {
  ranks: [],
  executiveTitles: [],
  positions: [],
  teams: [],
  offices: [],
};

/**
 * URL 조각이자 OrgLists 의 키입니다. 둘을 같게 두면 라우트에서 분기가 사라집니다.
 *
 * parts 는 목록 키가 아니라 팀 안에 중첩돼 있지만(teams[].parts), 편집은 항목
 * 단위라 쓰기 라우트에는 별도 kind 로 존재합니다.
 */
export const ORG_KINDS = [
  "ranks",
  "executiveTitles",
  "positions",
  "teams",
  "parts",
  "offices",
] as const;

export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  ranks: "직위",
  executiveTitles: "임원 직책",
  positions: "직책",
  teams: "팀",
  parts: "파트",
  offices: "사업장",
};

export function isOrgKind(value: string): value is OrgKind {
  return (ORG_KINDS as readonly string[]).includes(value);
}

/**
 * 새로 만든 직원에게 기본으로 붙는 직책.
 *
 * 이름으로 찾습니다 — 목록이 테이블이라 고정 id 가 없고, 관리자가 이 항목을
 * 지웠을 수도 있습니다. 못 찾으면 직책 없이 만들고 나중에 고르게 둡니다.
 */
export const DEFAULT_POSITION_NAME = "팀원";

/**
 * 목록 항목 입력값.
 *
 * 영문은 비워 둘 수 있습니다. 관리자가 한글 명칭부터 만들어 놓고 영문은 나중에
 * 채우는 흐름을 막을 이유가 없습니다 — 영문 명함은 값이 있는 항목만 씁니다.
 */
export const orgItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(30, "이름은 30자 이내로 입력해 주세요."),
  nameEn: z.string().trim().max(60, "영문 표기는 60자 이내로 입력해 주세요.").default(""),
  nameEnFull: z.string().trim().max(80, "정식 명칭은 80자 이내로 입력해 주세요.").default(""),
  sortOrder: z.coerce
    .number({ message: "순서는 숫자로 입력해 주세요." })
    .int("순서는 정수로 입력해 주세요.")
    .min(0, "순서는 0 이상이어야 합니다.")
    .max(9999, "순서가 너무 큽니다."),
  /** 파트에만 있습니다. 다른 목록에서는 무시됩니다. */
  teamId: z.string().trim().max(40).default(""),
  /** 사업장에만 있습니다. 다른 목록에서는 무시됩니다. */
  postalCode: z
    .string()
    .trim()
    .max(10, "우편번호가 너무 깁니다.")
    .default(""),
  address: z.string().trim().max(120, "주소는 120자 이내로 입력해 주세요.").default(""),
  /** 사업장에만 있습니다. 비면 영문 명함에서 그 줄이 빠집니다. */
  addressEn: z.string().trim().max(160, "영문 주소는 160자 이내로 입력해 주세요.").default(""),
});

export type OrgItemInput = z.input<typeof orgItemSchema>;

/**
 * 명함·서명에 찍히는 사업장 한 줄 — `(43011) 대구시 달성군 …`.
 *
 * 우편번호가 없으면 괄호만 남지 않도록 주소만 내보냅니다.
 */
export function officeLine(
  office: { postalCode: string; address: string; addressEn?: string | null },
  lang: Lang = "ko",
): string {
  // 영문 주소는 우편번호가 끝에 오는 표기가 표준이라 적힌 그대로 내보냅니다.
  // 국문처럼 앞에 괄호로 붙이면 "(41585) 51, Homam-ro …" 가 되어 어색합니다.
  if (lang === "en") return office.addressEn?.trim() ?? "";

  const address = office.address.trim();
  const postalCode = office.postalCode.trim();
  if (!address) return "";
  return postalCode ? `(${postalCode}) ${address}` : address;
}

/** 값이 있는 사업장만 줄 문자열로. 카드·서명·vCard 가 같은 규칙을 쓰도록 여기 한 곳에 둡니다. */
export function officeLines(
  offices: { postalCode: string; address: string; addressEn?: string | null }[],
  lang: Lang = "ko",
): string[] {
  return offices.map((office) => officeLine(office, lang)).filter(Boolean);
}

/** 부서 표기 — "경영관리 · 회계/재무". 팀만 있으면 팀만 나옵니다. */
export function departmentText(employee: {
  team?: { name: string } | null;
  part?: { name: string } | null;
}): string {
  return [employee.team?.name, employee.part?.name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * 명함·서명·vCard 에 찍히는 역할 문구의 재료.
 *
 * 직위 · 임원 직책 · 직책 순서로 늘어놓습니다. 세 값 모두 비어 있을 수 있어서
 * 이어 붙이는 쪽에서 매번 filter 를 반복하지 않도록 여기서 한 번만 걸러 줍니다.
 */
export function roleParts(
  employee: {
    rank?: { name: string; nameEn: string } | null;
    executiveTitle?: { name: string; nameEn: string } | null;
    position?: { name: string; nameEn: string } | null;
  },
  lang: Lang = "ko",
): string[] {
  const pick = (item?: { name: string; nameEn: string } | null) =>
    lang === "en" ? item?.nameEn : item?.name;

  // 영문 표기를 안 채운 항목은 그 조각만 빠집니다. 한글로 대신 넣으면
  // "Chief Manager · 팀장" 처럼 섞인 줄이 나옵니다.
  return [pick(employee.rank), pick(employee.executiveTitle), pick(employee.position)]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}
