import type { Metadata } from "next";
import { ProfileView, profileMetadata } from "../profile";

/**
 * 공개 프로필 — 영문. (인증 불필요)
 *
 * 국문(/c/[slug])과 같은 코드를 씁니다. 언어만 다릅니다.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return profileMetadata(slug, "en");
}

export default async function ProfileEnPage({ params }: Props) {
  const { slug } = await params;
  return <ProfileView slug={slug} lang="en" />;
}
