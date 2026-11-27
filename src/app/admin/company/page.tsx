import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth";
import { apiOrNull } from "@/lib/api";
import type { CompanyWithOffices } from "@/types";
import { CompanyEditor } from "./CompanyEditor";

/**
 * 회사 정보 관리. (admin 세션 필요 — middleware 가 보호)
 *
 * middleware 가 이미 막아주지만 세션을 여기서 다시 읽고 role 도 확인합니다.
 * matcher 를 손대다 /admin 이 빠지는 사고가 나도 페이지가 열리지 않게 하기 위함입니다.
 * (임직원 관리·조직 관리와 같은 방식)
 */
export const dynamic = "force-dynamic";

export default async function AdminCompanyPage() {
  const session = await getSession();
  if (!session) redirect("/gate?next=/admin/company");
  if (session.role !== "admin") redirect("/edit");

  // Company 는 1행만 존재합니다. 명함 서버의 첫 마이그레이션(V2__seed)이 만듭니다.
  const company = await apiOrNull<CompanyWithOffices>("/company");

  return (
    <AppShell role={session.role} current="/admin/company" title="회사 정보">
      <div className="mx-auto w-full max-w-[960px] p-4 md:p-6">
        {company ? (
          <CompanyEditor company={company} />
        ) : (
          // 명함 서버 마이그레이션이 회사 1행을 넣습니다. 여기 오면 서버 DB 를 확인해야 합니다.
          <div className="py-block text-center">
            <h2 className="text-base font-semibold">회사 정보가 없습니다</h2>
            <p className="mt-group text-sm text-fg-muted">
              명함 서버의 DB 마이그레이션이 적용됐는지 확인해 주세요.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
