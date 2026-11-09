import { redirect } from "next/navigation";
import { OrgManager } from "@/components/OrgManager";
import { AppShell } from "@/components/AppShell";
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
    <AppShell role={session.role} current="/admin/org" title="조직 관리">
      <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
        <header className="mb-group">
          <p className="text-sm text-fg-muted">
            여기서 바꾼 목록이 프로필 편집의 선택 상자에 그대로 나옵니다.
          </p>
        </header>
        <OrgManager initial={lists} />
      </div>
    </AppShell>
  );
}
