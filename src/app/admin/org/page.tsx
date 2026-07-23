import { redirect } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { OrgManager } from "@/components/OrgManager";
import { TopNav } from "@/components/TopNav";
import { getSession } from "@/lib/auth";
import { readOrgLists } from "@/lib/org-store";

/**
 * 조직 관리 — 직위 · 임원 직책 · 직책 · 부서. (admin 세션 필요 — middleware 가 보호)
 *
 * 목록을 서버에서 한 번 읽어 내려줍니다. 첫 화면이 빈 상태로 깜빡이지 않게 하기
 * 위해서고, 이후 추가·수정·삭제는 클라이언트가 /api/org 로 처리합니다.
 *
 * middleware 가 이미 막아주지만 여기서 role 을 다시 봅니다 — /admin/employees 와
 * 같은 이유입니다. matcher 를 손대다 빠져도 페이지가 열리지 않아야 합니다.
 */
export const dynamic = "force-dynamic";

export default async function AdminOrgPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=/admin/org");
  if (session.role !== "admin") redirect("/edit");

  const lists = await readOrgLists();

  return (
    <>
      <TopNav role={session.role} current="/admin/org" />
      <main className="mx-auto w-full max-w-[1000px] px-group py-section sm:px-section sm:py-block">
        <header className="mb-block">
          <p className="text-caption text-sub-text">관리자</p>
          <h1 className="mt-tight text-display">조직 관리</h1>
          <p className="mt-sibling text-body text-sub-text">
            여기서 바꾼 목록이 프로필 편집의 선택 상자에 그대로 나옵니다.
          </p>
        </header>
        <OrgManager initial={lists} />
      </main>
      <BottomTabBar role={session.role} current="/admin/org" />
    </>
  );
}
