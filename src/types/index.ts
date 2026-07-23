/**
 * 앱 공용 타입.
 *
 * Prisma 7 은 모델 타입을 `CompanyModel` 처럼 Model 접미사로 내보냅니다.
 * 앱 코드 전반에서 짧은 이름을 쓰기 위해 여기서 한 번만 별칭을 답니다.
 */
import type {
  CompanyModel,
  EmployeeModel,
  ExecutiveTitleModel,
  OfficeModel,
  PositionModel,
  RankModel,
} from "@/generated/prisma/models";

export type {
  CompanyModel as Company,
  OfficeModel as Office,
  EmployeeModel as Employee,
  ExecutiveTitleModel as ExecutiveTitle,
  PositionModel as Position,
  RankModel as Rank,
  ProfileViewModel as ProfileView,
} from "@/generated/prisma/models";

export type { Status } from "@/generated/prisma/enums";

/**
 * 조직 목록까지 붙여서 읽은 직원.
 *
 * 명함·서명·vCard 는 직위와 직책의 "이름" 을 찍습니다. Employee 만으로는 rankId
 * 같은 id 밖에 없어서, 이 세 관계를 include 해서 읽어야 합니다. 렌더 쪽 함수들이
 * 전부 이 타입을 받으므로, include 를 빠뜨리면 컴파일에서 걸립니다.
 */
export type EmployeeWithOrg = EmployeeModel & {
  rank: RankModel | null;
  executiveTitle: ExecutiveTitleModel | null;
  position: PositionModel | null;
};

/** 위 타입을 얻기 위한 Prisma include. 조회하는 쪽마다 다시 적지 않도록 모아 둡니다. */
export const employeeOrgInclude = {
  rank: true,
  executiveTitle: true,
  position: true,
} as const;

/**
 * 사업장까지 붙여서 읽은 회사.
 *
 * 명함·서명·vCard 는 주소를 회사에서 가져오는데, 주소가 Office 표로 빠지면서
 * Company 만으로는 그릴 수 없게 됐습니다. 이 세 곳이 전부 이 타입을 받습니다.
 */
export type CompanyWithOffices = CompanyModel & { offices: OfficeModel[] };

/**
 * 사업장은 관리 화면에서 정한 순서대로 나옵니다. 명함에 찍히는 순서이기도 합니다.
 *
 * `as const` 를 붙이지 않는 이유: orderBy 배열이 readonly 가 되면 Prisma 의
 * 인자 타입(변경 가능한 배열)에 맞지 않아 include 자체가 거부됩니다.
 */
export const companyOfficesInclude = {
  offices: { orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }] },
};
