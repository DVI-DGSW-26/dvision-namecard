import type { Metadata } from "next";
import { ProfileView, profileMetadata } from "./profile";

/**
 * 공개 프로필 — 국문. (인증 불필요 — middleware matcher 에 없음)
 *
 * 알맹이는 ./profile.tsx 에 있습니다. 영문판(/c/[slug]/en)과 같은 코드를 씁니다 —
 * 여기서 복사해 변형하면 두 언어가 조용히 갈라집니다.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return profileMetadata(slug, "ko");
}

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  return <ProfileView slug={slug} lang="ko" />;
}
