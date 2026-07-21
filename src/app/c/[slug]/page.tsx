import { notFound } from "next/navigation";
import { ProfileCard, toProfileCardData } from "@/components/ProfileCard";
import { prisma } from "@/lib/prisma";

/**
 * 공개 프로필. (인증 불필요 — middleware matcher 에 없음)
 *
 * 아직 완성 전입니다. 지금은 /edit 미리보기와 같은 ProfileCard 를 렌더한다는 것만
 * 확인하는 최소 형태입니다. 페이지 레이아웃·메타데이터·조회 기록(track)·
 * vCard 연결은 다음 단계에서 붙입니다.
 *
 * ProfileCard 를 여기서 복사해 변형하지 마세요. 미리보기와 즉시 어긋납니다.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;

  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: true },
  });

  // RESIGNED 는 링크를 알아도 열리지 않아야 합니다.
  if (!employee || employee.status === "RESIGNED") notFound();

  return (
    <main className="mx-auto w-full max-w-[375px]">
      <ProfileCard data={toProfileCardData(employee, employee.company)} />
    </main>
  );
}
