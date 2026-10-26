/**
 * 앱 공용 타입. 명함 서버(dvision-namecard-server)가 돌려주는 모양입니다.
 *
 * 예전 Prisma 모델과 키를 맞춰 두었습니다 — 명함·서명·vCard 를 그리는 코드가 이 타입을
 * 그대로 받습니다. 서버 응답을 바꿀 때는 여기와 명함 서버의 SQL 별칭을 함께 고치세요.
 */
import type { ExecutiveTitleItem, OfficeItem, OrgItem, PartItem } from "@/lib/org";

/**
 * 재직 상태. 인사 시스템이 정하고 명함에서는 바꾸지 않습니다.
 * 인사의 휴직(ON_LEAVE)은 ACTIVE 로 옵니다 — 휴직 중에도 명함은 살아 있습니다.
 */
export type Status = "ACTIVE" | "RESIGNED";

export type Rank = OrgItem;
export type ExecutiveTitle = ExecutiveTitleItem;
export type Position = OrgItem;
export type Team = OrgItem;
export type Part = PartItem;
export type Office = OfficeItem & { companyId: string };

export type Company = {
  id: string;
  nameKo: string;
  nameEn: string;
  tel: string;
  fax: string | null;
  homepageUrl: string | null;
  homepageUrlEn: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  youtubeUrlEn: string | null;
  instagramUrl: string | null;
  brandColor: string;
  tagline: string | null;
  taglineEn: string | null;
  industry: string | null;
  industryEn: string | null;
  certifications: string[];
  certificationsEn: string[];
};

export type Employee = {
  /** 인사 시스템의 직원 id(숫자)를 문자열로 바꾼 값입니다. */
  id: string;
  slug: string;
  role: "MEMBER" | "ADMIN";
  mustChangePassword: boolean;
  /** 비밀번호를 발급받았는지. 해시는 로그인 조회(/auth/lookup)로만 나옵니다. */
  hasPassword: boolean;

  // ── 인사 시스템이 원본인 값. 명함에서 고칠 수 없습니다. ──
  nameKo: string;
  /** 인사의 이름 한 칸을 서버가 나눈 값입니다(vCard N 필드용). */
  familyName: string;
  givenName: string;
  email: string | null;
  telMobile: string | null;
  status: Status;

  // ── 명함이 원본인 값 ──
  nameEn: string | null;
  rankId: string | null;
  executiveTitleId: string | null;
  positionId: string | null;
  teamId: string | null;
  partId: string | null;
  credential: string | null;
  credentialEn: string | null;
  bio: string | null;
  bioEn: string | null;
  telWork: string | null;
  mobilePublic: boolean;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 조직 목록까지 붙여서 읽은 직원.
 *
 * 명함·서명·vCard 는 직위·직책·부서의 "이름" 을 찍습니다. 렌더 쪽 함수들이 전부 이
 * 타입을 받습니다.
 */
export type EmployeeWithOrg = Employee & {
  rank: Rank | null;
  executiveTitle: ExecutiveTitle | null;
  position: Position | null;
  team: Team | null;
  part: Part | null;
};

/**
 * 사업장까지 붙여서 읽은 회사. 명함·서명·vCard 가 주소를 여기서 가져옵니다.
 * 사업장은 관리 화면에서 정한 순서대로 옵니다.
 */
export type CompanyWithOffices = Company & { offices: Office[] };

/** 명함 한 장을 그리는 데 필요한 전부. 서버가 한 번에 돌려줍니다. */
export type EmployeeFull = EmployeeWithOrg & { company: CompanyWithOffices };
