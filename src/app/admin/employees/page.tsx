import { redirect } from "next/navigation";
import { EmployeeTable } from "@/components/EmployeeTable";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth";

/**
 * 임직원 관리. (admin 세션 필요 — middleware 가 보호)
 *
 * middleware 가 이미 막아주지만, 세션을 여기서 다시 읽는 김에 role 도 확인합니다.
 * matcher 를 손대다 /admin 이 빠지는 사고가 나도 페이지가 열리지 않게 하기 위함입니다.
 *
 * 표는 클라이언트에서 /api/employees 를 호출합니다. 검색·필터·페이지가 전부 조작
 * 대상이라 서버에서 한 번 그려도 첫 입력에서 곧바로 다시 받아와야 합니다.
 */
export default async function AdminEmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=/admin/employees");
  if (session.role !== "admin") redirect("/edit");

  return (
    <AppShell role={session.role} current="/admin/employees" title="임직원 관리">
      {/* 목록형 화면이라 폭 제한 없이 본문 전체를 씁니다(폼·상세형만 960px). */}
      <div className="w-full p-4 md:p-6">
        <EmployeeTable />
      </div>
    </AppShell>
  );
}
