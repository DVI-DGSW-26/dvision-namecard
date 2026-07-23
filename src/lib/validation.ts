import { z } from "zod";

/**
 * 폼 검증 스키마. 클라이언트와 서버가 같은 규칙을 씁니다.
 *
 * 폼 인풋은 값이 항상 문자열이라("" 포함) 숫자 필드는 preprocess 로 정규화합니다.
 * 이걸 클라이언트에서만 하면 API 를 직접 호출했을 때 규칙이 뚫립니다.
 */

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

/**
 * 조직 목록(직위 · 임원 직책 · 직책)에서 고른 항목의 id.
 *
 * 목록이 테이블이라 값이 아니라 id 를 받습니다. 여기서는 "빈 값이면 null" 만 보고,
 * 그런 id 가 실제로 있는지는 DB 외래키가 판정합니다 — 앱에서 한 번 더 조회해
 * 확인하면 그 사이에 지워지는 경쟁을 못 막으면서 쿼리만 늘어납니다.
 */
const orgRef = z.preprocess(emptyToNull, z.string().max(40).nullable());

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
  /**
   * 영문명은 필수입니다.
   *
   * 선택 입력이던 시절에는 안 적은 사람의 영문 카드가 한글 이름으로 떨어졌습니다.
   * 그 폴백을 없앤 지금은 안 적으면 영문 카드가 아예 404 라, 여기서 받아 두지
   * 않으면 "영문 카드가 없는 사람" 이 계속 생깁니다.
   *
   * 컬럼은 여전히 nullable 입니다 — 이미 비어 있는 직원들이 있고, 그들은 다음에
   * 프로필을 저장할 때 채우게 됩니다. 그 전까지는 국문 카드만 열립니다.
   */
  nameEn: z
    .string()
    .trim()
    .min(1, "영문명을 입력해 주세요. 영문 명함에 쓰입니다.")
    .max(60, "영문명은 60자 이내로 입력해 주세요."),
  // 직위 · 임원 직책 · 직책은 전부 목록에서 고릅니다. 셋 다 비워 둘 수 있습니다 —
  // 관리자가 목록에서 항목을 지우면 그 칸이 비는데, 그 상태로도 저장은 돼야 합니다.
  rankId: orgRef,
  executiveTitleId: orgRef,
  positionId: orgRef,
  // 자격은 선택 입력입니다. 비우면 null 로 저장되고 카드·서명에서 통째로 빠집니다.
  credential: optionalText(40, "자격 · 학위"),
  // 영문 카드(/c/[slug]/en)가 쓰는 값. 비우면 영문 카드에서만 빠집니다.
  credentialEn: optionalText(40, "자격 · 학위 영문"),
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
  rankId: orgRef,
  // 부서는 팀·파트 2단계입니다. 관리자가 직원을 만들 때 정해 두면 본인이 안 골라도 됩니다.
  teamId: orgRef,
  partId: orgRef,
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

/**
 * 공개 주소(slug). 직원 추가와 관리자 수정이 같은 규칙을 씁니다.
 *
 * 소문자·숫자만 받는 이유: /c/[slug] 에 그대로 들어가는 값이라 대문자나 한글이 섞이면
 * 메신저·메일 클라이언트가 URL 을 다르게 인코딩해 링크가 갈립니다.
 */
const slugRule = z
  .string()
  .trim()
  .min(1, "주소를 입력해 주세요.")
  .regex(/^[a-z0-9]+$/, "주소는 영문 소문자와 숫자만 쓸 수 있습니다.")
  .max(30, "주소가 너무 깁니다.");

/**
 * 관리자만 바꿀 수 있는 값 — 노출 여부(status)와 공개 주소(slug).
 *
 * 프로필 스키마(employeeProfileSchema)와 나눠 둔 이유: 저 스키마는 본인도 쓰기 때문에
 * 거기에 status 를 넣는 순간 직원이 자기 계정을 스스로 활성화할 수 있게 됩니다.
 */
export const employeeAdminSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "RESIGNED"], { message: "상태를 선택해 주세요." }),
  slug: slugRule,
});

/**
 * 여러 명 한꺼번에 처리.
 *
 * 상한을 두는 이유: 화면의 "이 페이지 전체 선택" 은 페이지 밖 선택을 유지하므로
 * 넘어오는 id 가 얼마든지 길어질 수 있습니다. 한 요청이 DB 를 오래 잡지 않게 막습니다.
 */
export const employeeBulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    ids: z.array(z.string().max(40)).min(1, "대상을 선택해 주세요.").max(500, "한 번에 500명까지 처리할 수 있습니다."),
    status: z.enum(["PENDING", "ACTIVE", "RESIGNED"], { message: "상태를 선택해 주세요." }),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.string().max(40)).min(1, "대상을 선택해 주세요.").max(500, "한 번에 500명까지 처리할 수 있습니다."),
  }),
]);
export type EmployeeCreateValues = z.output<typeof employeeCreateSchema>;

/**
 * 인증 뱃지 한 줄 → 문자열 배열. 국문·영문 칸이 같은 규칙을 씁니다.
 *
 * 두 칸에 각자 적어 두면 한쪽만 고치는 순간 개수 제한이나 길이 제한이 갈립니다.
 */
const certificationList = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : value,
  z
    .array(z.string().max(30, "인증 이름은 30자 이내로 입력해 주세요."))
    .max(6, "인증은 6개까지 넣을 수 있습니다."),
);

export const companyProfileSchema = z.object({
  nameKo: z.string().trim().min(1, "회사명을 입력해 주세요.").max(60, "회사명이 너무 깁니다."),
  nameEn: z.string().trim().min(1, "영문 회사명을 입력해 주세요.").max(80, "영문 회사명이 너무 깁니다."),
  industry: optionalText(60, "사업 분야"),
  tagline: optionalText(60, "태그라인"),
  // 영문 카드가 쓰는 값. 비우면 영문 카드에서 그 줄이 빠집니다 —
  // 한글을 대신 넣지 않습니다. 영문 명함에 한글이 섞이면 안 만든 것만 못합니다.
  industryEn: optionalText(60, "사업 분야 영문"),
  taglineEn: optionalText(60, "태그라인 영문"),
  /**
   * 인증 뱃지 — 명함 하단의 "IATF 16949" · "ISO 9001".
   *
   * 폼에서는 쉼표로 구분한 한 줄로 받고 여기서 배열로 바꿉니다. 항목마다 칸을
   * 만들면 추가·삭제 버튼이 붙어 회사 정보 섹션이 목록 편집기가 됩니다 —
   * 두세 개짜리 값에 그만한 화면을 쓸 이유가 없습니다.
   *
   * DB 는 Json 컬럼이라 무엇이든 들어갑니다. 카드는 문자열만 그리므로
   * 여기서 문자열 배열로 좁혀서 저장합니다.
   */
  certifications: certificationList,
  /**
   * 영문 인증 뱃지. 영문 카드가 이 값만 씁니다.
   *
   * 국문 값으로 떨어지지 않습니다. "IATF 16949" 처럼 원래 영문인 항목이 대부분이라
   * 그냥 써도 될 것 같지만, "품질경영시스템 인증" 한 줄이 추가되는 순간 영문
   * 명함에 한글이 박힙니다. 다른 영문 칸과 같은 규칙 — 비면 그 줄이 빠집니다.
   */
  certificationsEn: certificationList,
  // 주소는 여기 없습니다 — 사업장이 여러 곳(본사·R&D센터)이라 Office 표로 빠졌고,
  // /admin/org 의 '사업장' 탭에서 관리합니다.
  /**
   * 회사 대표번호. 개인 사무실 번호(Employee.telWork)가 없는 직원의 명함·서명에
   * 대신 나갑니다. 그래서 비울 수 없습니다 — 비면 그 직원 카드에 전화가 사라집니다.
   */
  tel: z
    // emptyToNull 을 태우지 않습니다. 빈 값이 null 이 되면 zod 기본 문구
    // ("expected string, received null")가 그대로 화면에 나옵니다.
    .string({ message: "대표번호를 입력해 주세요." })
    .trim()
    .min(1, "대표번호를 입력해 주세요.")
    .regex(/^[0-9-]+$/, "전화번호는 숫자와 하이픈만 입력할 수 있습니다.")
    .max(20, "전화번호가 너무 깁니다."),
  // 팩스는 회사 공용 번호입니다. 명함 카드·서명·vCard 가 모두 이 값을 씁니다.
  // (개인 전화는 Employee.telWork/telMobile 로 따로 있습니다.)
  fax: phone,
  // 공개 카드 아래 아이콘 줄. 스킴 없이 넣어도 카드가 https 를 붙여 엽니다.
  homepageUrl: optionalText(120, "홈페이지"),
  // 영문 홈페이지. 비우면 영문 카드도 국문 홈페이지를 겁니다.
  homepageUrlEn: optionalText(120, "홈페이지 영문"),
  linkedinUrl: optionalText(200, "링크드인"),
  // 채널이 아니라 회사 소개 영상 주소입니다. 공유 링크(youtu.be/…)가 그대로 들어옵니다.
  youtubeUrl: optionalText(200, "유튜브"),
  // 영문 소개 영상. 비우면 영문 카드도 국문 영상을 겁니다.
  youtubeUrlEn: optionalText(200, "유튜브 영문"),
  instagramUrl: optionalText(200, "인스타그램"),
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
