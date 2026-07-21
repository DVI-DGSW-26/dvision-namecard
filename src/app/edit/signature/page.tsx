import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderSignature, renderSignatureText } from "@/lib/signature";
import { TopNav } from "@/components/TopNav";
import { SignaturePanel } from "./SignaturePanel";

/**
 * 이메일 서명 복사 + 설치 안내. (쿠키 필요 — middleware 가 보호)
 *
 * 서명 HTML 은 서버에서 만듭니다. renderSignature() 가 NEXT_PUBLIC_BASE_URL 로
 * 절대 URL 을 만들고 사용자 입력을 이스케이프하는데, 이걸 클라이언트로 옮기면
 * 두 벌이 되어 어긋납니다.
 *
 * 대상 직원 선택은 /edit 과 같은 규칙입니다 — ?e=<slug>, 없으면 첫 ACTIVE.
 */

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ e?: string }>;
};

function Notice({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-section py-block">
      <p className="text-caption text-sub-text">내 명함</p>
      <h1 className="mt-tight text-display">{title}</h1>
      <p className="mt-group text-body text-sub-text">{detail}</p>
      <Link href="/edit" className="mt-section inline-block text-caption-bold text-primary">
        프로필 편집으로 가기
      </Link>
    </main>
  );
}

export default async function SignaturePage({ searchParams }: Props) {
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
    return (
      <Notice title="데이터를 불러오지 못했습니다" detail="데이터베이스에 연결하지 못했습니다." />
    );
  }

  if (!employee || !company) {
    return <Notice title="데이터가 아직 없습니다" detail="직원 또는 회사 정보를 찾을 수 없습니다." />;
  }

  let html: string;
  let text: string;
  try {
    html = renderSignature(employee, company);
    text = renderSignatureText(employee, company);
  } catch {
    // renderSignature 는 NEXT_PUBLIC_BASE_URL 이 없으면 던집니다. 메일에 localhost
    // 링크가 박혀 나가는 것보다 여기서 막히는 편이 낫습니다.
    return (
      <Notice
        title="서명을 만들지 못했습니다"
        detail="NEXT_PUBLIC_BASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요."
      />
    );
  }

  const role = session?.role ?? "member";

  return (
    <>
      <TopNav role={role} email={employee.email} current="/edit" />
      <main className="mx-auto w-full max-w-[1000px] px-section py-block">
        <header>
          <p className="text-caption text-sub-text">내 명함</p>
          <h1 className="mt-tight text-display">이메일 서명</h1>
          <p className="mt-sibling text-body text-sub-text">
            아래 서명을 복사해 메일 프로그램에 넣으세요. 프로필을 수정하면 서명 안의 명함
            링크가 가리키는 내용도 함께 바뀝니다.
          </p>
          <Link
            href="/edit"
            className="mt-group inline-block text-caption-bold text-primary hover:text-primary-hover"
          >
            프로필 편집으로 돌아가기
          </Link>
        </header>

        <div className="mt-block">
          <SignaturePanel html={html} text={text} />
        </div>
      </main>
    </>
  );
}
