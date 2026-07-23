import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveEditTarget } from "@/lib/current-employee";
import { readOrgLists } from "@/lib/org-store";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TopNav } from "@/components/TopNav";
import { EditProfileForm } from "./EditProfileForm";

/**
 * 프로필 편집. (쿠키 필요 — middleware 가 보호)
 *
 * 대상은 게이트에서 사내 이메일로 확인한 본인입니다. 관리자만 ?e=<slug> 로
 * 다른 사람을 열 수 있습니다. (lib/current-employee.ts)
 */

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ e?: string }>;
};

function Notice({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-group py-section sm:px-section sm:py-block">
      <p className="text-caption text-sub-text">내 명함</p>
      <h1 className="mt-tight text-display">{title}</h1>
      <p className="mt-group text-body text-sub-text">{detail}</p>
      {action ? (
        <Link href={action.href} className="mt-section inline-block text-caption-bold text-primary">
          {action.label}
        </Link>
      ) : null}
    </main>
  );
}

export default async function EditPage({ searchParams }: Props) {
  const { e } = await searchParams;
  const result = await resolveEditTarget(e);

  if (result.kind === "no-session") redirect("/gate?next=%2Fedit");

  if (result.kind === "db-error") {
    return (
      <Notice
        title="데이터를 불러오지 못했습니다"
        detail="데이터베이스에 연결하지 못했습니다. .env 의 DATABASE_URL 을 확인하세요."
      />
    );
  }

  if (result.kind === "no-self") {
    return (
      <Notice
        title="등록된 명함이 없습니다"
        detail="아직 직원이 등록되지 않았습니다. 임직원 관리에서 직원을 추가한 뒤 다시 로그인하세요."
        action={{ href: "/admin/employees", label: "임직원 관리로 가기" }}
      />
    );
  }

  if (result.kind === "not-found") {
    return (
      <Notice
        title="명함을 찾을 수 없습니다"
        detail="직원 또는 회사 정보를 찾을 수 없습니다. 다시 로그인해 보세요."
        action={{ href: "/gate", label: "로그인 화면으로" }}
      />
    );
  }

  const { role, employee, company, viewingOther } = result;
  // 선택 상자에 넣을 조직 목록. 관리자가 /admin/org 에서 바꾼 값이 그대로 옵니다.
  const org = await readOrgLists();

  return (
    <>
      <TopNav role={role} email={employee.email} current="/edit" />
      {/* 관리자가 남의 명함을 열었을 때, 본인 것으로 착각하고 고치는 일이 없도록 표시합니다. */}
      {viewingOther ? (
        <div className="border-b border-border bg-sub-bg">
          {/* 좁은 화면에서는 안내 문구가 길어 링크가 밀려나므로 줄을 나눕니다. */}
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-group gap-y-tight px-group py-sibling sm:px-section">
            <p className="text-caption text-sub-text">
              다른 임직원의 명함을 보고 있습니다 — {employee.nameKo} ({employee.email})
            </p>
            <Link href="/edit" className="text-caption-bold text-primary">
              내 명함으로
            </Link>
          </div>
        </div>
      ) : null}
      <EditProfileForm role={role} employee={employee} company={company} org={org} />
      <BottomTabBar role={role} current="/edit" />
    </>
  );
}
