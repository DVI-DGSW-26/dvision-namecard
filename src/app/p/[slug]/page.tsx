type Props = {
  // Next 15+ 부터 params 는 Promise 입니다.
  params: Promise<{ slug: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  return <main>프로필: {slug} (스텁)</main>;
}
