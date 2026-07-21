import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopNav } from "@/components/TopNav";
import { EditProfileForm } from "./EditProfileForm";

/**
 * 프로필 편집. (쿠키 필요 — middleware 가 보호)
 *
 * 공용 비밀번호 구조라 세션만으로는 "본인"을 특정할 수 없습니다. 지금은 ?e=<slug>
 * 로 대상을 지정하고, 없으면 첫 ACTIVE 직원을 씁니다. 임직원 선택 UI 는 이번
 * 작업 범위 밖이라 넣지 않았습니다.
 */

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ e?: string }>;
};

/** DB 가 아직 준비되지 않았을 때 크래시 대신 다음에 할 일을 보여줍니다. */
function SetupNotice({ detail }: { detail: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-section py-block">
      <p className="text-caption text-sub-text">내 명함</p>
      <h1 className="mt-tight text-display">데이터가 아직 없습니다</h1>
      <p className="mt-group text-body text-sub-text">{detail}</p>
      <ol className="mt-section flex list-decimal flex-col gap-sibling pl-group text-body text-sub-text">
        <li>Neon 연결 문자열을 .env 의 DATABASE_URL 에 넣기</li>
        <li>
          <code className="text-body-bold text-text">pnpm db:push</code>
        </li>
        <li>
          <code className="text-body-bold text-text">pnpm db:seed</code>
        </li>
      </ol>
    </main>
  );
}

export default async function EditPage({ searchParams }: Props) {
  const session = await getSession();
  const { e } = await searchParams;

  let employee: Awaited<ReturnType<typeof prisma.employee.findFirst>> = null;
  let company: Awaited<ReturnType<typeof prisma.company.findFirst>> = null;

  try {
    employee = e
      ? await prisma.employee.findUnique({ where: { slug: e } })
      : await prisma.employee.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
        });
    company = await prisma.company.findFirst();
  } catch {
    return <SetupNotice detail="데이터베이스에 연결하지 못했습니다." />;
  }

  if (!employee || !company) {
    return <SetupNotice detail="직원 또는 회사 정보를 찾을 수 없습니다." />;
  }

  // middleware 가 세션 없이는 여기까지 못 오게 막지만, 타입상 null 이 가능합니다.
  const role = session?.role ?? "member";

  return (
    <>
      <TopNav role={role} email={employee.email} current="/edit" />
      <EditProfileForm role={role} employee={employee} company={company} />
    </>
  );
}
