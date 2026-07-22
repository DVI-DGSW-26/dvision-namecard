import { z } from "zod";

/**
 * 폼 검증 스키마. 클라이언트와 서버가 같은 규칙을 씁니다.
 *
 * 폼 인풋은 값이 항상 문자열이라("" 포함) 숫자 필드는 preprocess 로 정규화합니다.
 * 이걸 클라이언트에서만 하면 API 를 직접 호출했을 때 규칙이 뚫립니다.
 */

export const RANKS = [
  "사원",
  "주임",
  "대리",
  "과장",
  "차장",
  "부장",
  "이사",
  "대표이사",
] as const;

/**
 * 빈 문자열·공백만 있는 값을 null 로 바꿉니다. 선택 입력 칸을 비웠을 때의 정상 경로입니다.
 *
 * 키 자체가 없는 경우(undefined)도 null 로 봅니다. 뒤에 붙는 .nullable() 은 null 만
 * 허용하고 undefined 는 막기 때문에, 이걸 안 하면 "선택" 필드를 생략한 요청이
 * `expected string, received undefined` 로 422 가 납니다.
 */
const emptyToNull = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const optionalText = (max: number, label: string) =>
  z.preprocess(emptyToNull, z.string().max(max, `${label}은(는) ${max}자 이내로 입력해 주세요.`).nullable());

/** 숫자와 하이픈만. 자동 포맷팅은 formatPhone 이 담당하고 여기서는 형식만 봅니다. */
const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^[0-9-]+$/, "전화번호는 숫자와 하이픈만 입력할 수 있습니다.")
    .max(20, "전화번호가 너무 깁니다.")
    .nullable(),
);

export const employeeProfileSchema = z.object({
  nameKo: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(20, "이름은 20자 이내로 입력해 주세요."),
  nameEn: optionalText(60, "영문명"),
  rank: z.enum(RANKS, { message: "직급을 선택해 주세요." }),
  // 직책·자격은 선택 입력입니다. 비우면 null 로 저장되고 카드·서명에서 통째로 빠집니다.
  position: optionalText(30, "직책"),
  credential: optionalText(40, "자격 · 학위"),
  telWork: phone,
  telMobile: phone,
  email: z.preprocess(
    emptyToNull,
    z.email({ message: "이메일 형식이 올바르지 않습니다." }),
  ),
});

/**
 * 직원 추가(관리자 전용).
 *
 * nameKo 를 받지 않고 성·이름을 따로 받습니다. vCard N 필드(`류;영균;;;`)가 둘을
 * 나눠 요구하는데, 합쳐 받은 뒤 서버에서 쪼개면 두 글자 성(남궁·선우·제갈)에서
 * 반드시 틀립니다. nameKo 는 서버가 둘을 이어 붙여 만듭니다.
 */
export const employeeCreateSchema = z.object({
  familyName: z.string().trim().min(1, "성을 입력해 주세요.").max(10, "성이 너무 깁니다."),
  givenName: z.string().trim().min(1, "이름을 입력해 주세요.").max(10, "이름이 너무 깁니다."),
  email: z.preprocess(emptyToNull, z.email({ message: "이메일 형식이 올바르지 않습니다." })),
  rank: z.enum(RANKS, { message: "직급을 선택해 주세요." }),
  department: optionalText(30, "부서"),
  /**
   * 공개 URL(/c/[slug])에 그대로 들어갑니다. 비우면 성에서 자동 생성합니다.
   * 표에 없는 성이라 자동 생성이 안 되면 서버가 이 필드로 에러를 돌려줍니다.
   */
  slug: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^[a-z0-9]+$/, "주소는 영문 소문자와 숫자만 쓸 수 있습니다.")
      .max(30, "주소가 너무 깁니다.")
      .nullable(),
  ),
});

export type EmployeeCreateInput = z.input<typeof employeeCreateSchema>;
export type EmployeeCreateValues = z.output<typeof employeeCreateSchema>;

export const companyProfileSchema = z.object({
  nameKo: z.string().trim().min(1, "회사명을 입력해 주세요.").max(60, "회사명이 너무 깁니다."),
  nameEn: z.string().trim().min(1, "영문 회사명을 입력해 주세요.").max(80, "영문 회사명이 너무 깁니다."),
  industry: optionalText(60, "사업 분야"),
  address: z.string().trim().min(1, "주소를 입력해 주세요.").max(120, "주소가 너무 깁니다."),
  // 팩스는 회사 공용 번호입니다. 명함 카드·서명·vCard 가 모두 이 값을 씁니다.
  // (개인 전화는 Employee.telWork/telMobile 로 따로 있습니다.)
  fax: phone,
  homepageUrl: optionalText(120, "홈페이지"),
});

export type EmployeeProfileInput = z.input<typeof employeeProfileSchema>;
export type EmployeeProfileValues = z.output<typeof employeeProfileSchema>;
export type CompanyProfileInput = z.input<typeof companyProfileSchema>;
export type CompanyProfileValues = z.output<typeof companyProfileSchema>;

/**
 * 한국 전화번호 자동 하이픈.
 *
 * 입력 중에도 호출되므로 자릿수가 모자란 상태를 정상으로 취급합니다.
 * 02 는 지역번호가 2자리, 나머지는 3자리입니다.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  const groups = digits.startsWith("02")
    ? digits.length <= 9
      ? [2, 3, 4]
      : [2, 4, 4]
    : digits.length <= 10
      ? [3, 3, 4]
      : [3, 4, 4];

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  return parts.join("-");
}

/** zod 에러를 필드명 → 첫 메시지 맵으로 눌러 담습니다. 폼에서 바로 쓰기 위한 형태입니다. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in result)) result[key] = issue.message;
  }
  return result;
}
