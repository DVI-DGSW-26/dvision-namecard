import { redirect } from "next/navigation";

/**
 * 관리자 진입점. 자체 화면 없이 임직원 관리로 보냅니다.
 *
 * 예전에는 스텁 화면이었는데, TopNav 도 없는 빈 페이지라 여기 닿으면 돌아갈 길이
 * 없었습니다. 관리자가 실제로 쓰는 화면은 /admin/employees 하나뿐이므로 그리로
 * 넘깁니다. 관리자 화면이 여럿이 되면 그때 목차를 두세요.
 *
 * 세션·권한은 middleware(matcher 에 /admin/:path*)가 이미 확인합니다.
 * 여기서 다시 보지 않는 건 검증 지점을 둘로 두지 않기 위해서입니다.
 */
export default function AdminPage() {
  redirect("/admin/employees");
}
