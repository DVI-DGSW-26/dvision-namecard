import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileCard, toProfileCardData } from "@/components/ProfileCard";
import { LANG_LABEL, LANGS, cardName, cardPath, type Lang } from "@/lib/lang";
import { roleParts } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { companyOfficesInclude, employeeOrgInclude } from "@/types";

/**
 * 공개 프로필의 알맹이. /c/[slug](국문)과 /c/[slug]/en(영문)이 함께 씁니다.
 *
 * 두 라우트가 각자 화면을 그리면 한쪽만 고치는 순간 갈라집니다. 라우트 파일은
 * 언어만 정해서 넘기고, 조회·메타데이터·렌더는 전부 여기 한 벌만 둡니다.
 */

/** 페이지와 메타데이터가 같은 요청에서 두 번 조회하지 않도록 결과를 재사용합니다. */
export async function getProfile(slug: string) {
  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: { include: companyOfficesInclude }, ...employeeOrgInclude },
  });

  // RESIGNED 는 링크를 알아도 열리지 않아야 합니다.
  if (!employee || employee.status === "RESIGNED") return null;
  return employee;
}

/**
 * 카카오톡·문자로 링크를 보냈을 때 보이는 카드입니다.
 * 이게 없으면 도메인만 덩그러니 뜨고, 명함을 공유하는 서비스에서 그건 치명적입니다.
 */
export async function profileMetadata(slug: string, lang: Lang): Promise<Metadata> {
  const employee = await getProfile(slug);

  const notFoundTitle = lang === "en" ? "Card not found" : "찾을 수 없는 명함";
  if (!employee) return { title: notFoundTitle };

  // 영문명이 없으면 영문 카드는 아직 없는 것입니다. 페이지가 404 를 그리므로
  // 제목도 404 여야 합니다 — 여기만 이름을 채우면 공유 미리보기에는 카드가
  // 있는 것처럼 뜨고, 눌러 들어가면 404 인 링크가 돌아다닙니다.
  const name = cardName(employee, lang);
  if (!name) return { title: notFoundTitle };

  const { company } = employee;
  const en = lang === "en";
  const companyName = en ? company.nameEn : company.nameKo;
  const role = roleParts(employee, lang).join(" ");

  // 직위·직책이 하나도 없으면 이름과 회사명 사이에 공백이 두 칸 남습니다.
  const title = [name, role].filter(Boolean).join(" ") + ` | ${companyName}`;
  const description = [
    en ? company.industryEn : company.industry,
    en ? company.taglineEn : company.tagline,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title,
    description: description || `${companyName} ${name}`,
    openGraph: {
      title,
      description: description || undefined,
      type: "profile",
      siteName: companyName,
    },
    twitter: { card: "summary", title, description: description || undefined },
    // 공개 프로필이지만 검색에 뜨는 건 다른 문제입니다. 개인 연락처가 색인되지
    // 않도록 막습니다. 링크를 아는 사람만 보는 것이 이 서비스의 전제입니다.
    robots: { index: false, follow: false },
  };
}

/**
 * 언어 토글.
 *
 * 주소가 갈리므로 <Link> 로 실제 이동합니다 — 외국 거래처에 영문 카드 링크를
 * 그대로 보낼 수 있어야 하고, 그 주소가 명함 이미지 주소와도 짝이 맞아야 합니다.
 *
 * 각 언어 이름을 자기 언어로 적습니다. "영어/한국어" 로 적으면 한국어를 못 읽는
 * 사람이 자기가 갈 곳을 못 찾습니다.
 *
 * 갈 수 있는 언어만 내밉니다. 영문명을 안 채운 사람은 영문 카드가 404 라,
 * English 를 걸어 두면 눌렀을 때 카드가 사라집니다. 고를 게 하나뿐이면 토글
 * 자체가 사라집니다 — 안 눌리는 버튼 하나만 남는 것보다 없는 편이 낫습니다.
 */
function LangToggle({ slug, current, langs }: { slug: string; current: Lang; langs: Lang[] }) {
  if (langs.length < 2) return null;

  return (
    <nav
      aria-label={current === "en" ? "Language" : "언어"}
      className="mx-auto mb-group flex w-full max-w-[375px] justify-end gap-tight"
    >
      {langs.map((lang) => {
        const active = lang === current;
        return (
          <Link
            key={lang}
            href={cardPath(slug, lang)}
            // 각 이름이 자기 언어로 적혀 있으므로 글자마다 언어를 밝힙니다. 영문
            // 카드 안에서 "한국어" 가 영어로 읽히면 스크린리더가 뭉갭니다.
            lang={lang}
            aria-current={active ? "true" : undefined}
            // 활성 표시는 색이 아니라 굵기와 테두리로 합니다. primary 예산은 CTA 몫입니다.
            className={[
              "rounded-card border px-group py-tight text-caption",
              active
                ? "border-text text-caption-bold text-text"
                : "border-border text-sub-text hover:text-text",
            ].join(" ")}
          >
            {LANG_LABEL[lang]}
          </Link>
        );
      })}
    </nav>
  );
}

export async function ProfileView({ slug, lang }: { slug: string; lang: Lang }) {
  const employee = await getProfile(slug);

  if (!employee) notFound();

  // 영문명을 안 채운 사람의 영문 카드는 없습니다. 한글 이름을 얹어 그리면
  // 영문 명함 한가운데 한글이 박힌 채로 거래처에 전달됩니다.
  if (!cardName(employee, lang)) notFound();

  // 실제로 열리는 언어만 토글에 올립니다.
  const langs = LANGS.filter((value) => cardName(employee, value));

  return (
    /*
      회사명·직위는 ProfileCard 안에 이미 있습니다. 여기서 또 적으면 중복입니다.

      카드 껍데기(테두리·모서리·그림자)는 이 페이지가 그립니다. ProfileCard 는
      내용만 담당한다는 규칙이라, 껍데기를 그 안에 넣으면 /edit 미리보기가
      이미 두르고 있는 테두리와 겹쳐 이중선이 됩니다.

      바닥을 회색으로 깔지 않으면 흰 카드가 흰 화면에 묻혀 형태가 사라집니다.
    */
    <main
      /*
        문서의 lang 은 app/layout.tsx 에 "ko" 로 박혀 있습니다. 루트 레이아웃은
        어느 언어의 카드가 열렸는지 알 수 없어서(App Router 는 자식이 <html> 을
        다시 열 수 없습니다) 여기서 카드 범위에만 언어를 다시 선언합니다.
        lang 은 아무 요소에나 붙일 수 있고, 읽는 쪽은 가장 가까운 선언을 따릅니다.

        눈에 보이는 한글은 아니지만 영문 카드에서는 이것도 한국어입니다 —
        선언이 틀리면 스크린리더가 영문 이름을 한국어 음성으로 읽고,
        브라우저 번역이 "이미 한국어" 로 보고 그냥 지나갑니다.
      */
      lang={lang}
      className="flex flex-1 flex-col justify-center bg-sub-bg px-group py-section"
    >
      <LangToggle slug={slug} current={lang} langs={langs} />
      <div className="mx-auto w-full max-w-[375px] overflow-hidden rounded-card border border-border bg-bg shadow-sm">
        <ProfileCard data={toProfileCardData(employee, employee.company, lang)} />
      </div>
    </main>
  );
}
