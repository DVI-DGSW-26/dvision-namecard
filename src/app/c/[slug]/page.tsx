import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileCard, toProfileCardData } from "@/components/ProfileCard";
import { prisma } from "@/lib/prisma";

/**
 * 공개 프로필. (인증 불필요 — middleware matcher 에 없음)
 *
 * ProfileCard 를 여기서 복사해 변형하지 마세요. /edit 미리보기와 즉시 어긋납니다.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

/** 페이지와 메타데이터가 같은 요청에서 두 번 조회하지 않도록 결과를 재사용합니다. */
async function getProfile(slug: string) {
  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: true },
  });

  // RESIGNED 는 링크를 알아도 열리지 않아야 합니다.
  if (!employee || employee.status === "RESIGNED") return null;
  return employee;
}

/**
 * 카카오톡·문자로 링크를 보냈을 때 보이는 카드입니다.
 * 이게 없으면 도메인만 덩그러니 뜨고, 명함을 공유하는 서비스에서 그건 치명적입니다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const employee = await getProfile(slug);

  if (!employee) return { title: "찾을 수 없는 명함" };

  const { company } = employee;
  const role = [employee.rank as string, employee.position].filter(Boolean).join(" ");
  const title = `${employee.nameKo} ${role} | ${company.nameKo}`;
  const description = [company.industry, company.tagline].filter(Boolean).join(" · ");

  return {
    title,
    description: description || `${company.nameKo} ${employee.nameKo} 디지털 명함`,
    openGraph: {
      title,
      description: description || undefined,
      type: "profile",
      siteName: company.nameKo,
    },
    twitter: { card: "summary", title, description: description || undefined },
    // 공개 프로필이지만 검색에 뜨는 건 다른 문제입니다. 개인 연락처가 색인되지
    // 않도록 막습니다. 링크를 아는 사람만 보는 것이 이 서비스의 전제입니다.
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const employee = await getProfile(slug);

  if (!employee) notFound();

  return (
    // 회사명·직급은 ProfileCard 안에 이미 있습니다. 여기서 또 적으면 중복입니다.
    <main className="mx-auto flex w-full max-w-[375px] flex-1 flex-col justify-center px-group py-section">
      <ProfileCard data={toProfileCardData(employee, employee.company)} />
    </main>
  );
}
