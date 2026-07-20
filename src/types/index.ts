/**
 * 앱 공용 타입.
 *
 * Prisma 7 은 모델 타입을 `CompanyModel` 처럼 Model 접미사로 내보냅니다.
 * 앱 코드 전반에서 짧은 이름을 쓰기 위해 여기서 한 번만 별칭을 답니다.
 */
export type {
  CompanyModel as Company,
  EmployeeModel as Employee,
  ProfileViewModel as ProfileView,
} from "@/generated/prisma/models";

export type { Rank, Status } from "@/generated/prisma/enums";
