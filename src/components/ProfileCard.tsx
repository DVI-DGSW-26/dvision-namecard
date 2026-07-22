import { MailIcon, MessageIcon, PhoneIcon, UserIcon } from "./icons";
import { brand } from "@/config/brand";
import type { Company, Employee } from "@/types";

/**
 * 공개 프로필 카드 — 앱 전체에서 이 컴포넌트 하나만 존재합니다.
 *
 *   /c/[slug]      → DB 값으로 렌더
 *   /edit 미리보기 → 폼 state 로 렌더
 *
 * 두 벌로 나누면 반드시 어긋나므로, 새 화면이 필요하더라도 복사하지 말고
 * props 를 넓히세요. 데이터 출처가 달라도 렌더 경로는 하나여야 합니다.
 *
 * 이 컴포넌트는 카드 "내용"만 그립니다. /edit 의 `PREVIEW · dvi-ind.com/c/...`
 * 머리띠처럼 미리보기에만 있는 장식은 감싸는 쪽에서 붙이세요. 여기 넣으면
 * 실제 공개 페이지에도 PREVIEW 가 찍혀 나갑니다.
 */

export type ProfileCardData = {
  nameKo: string;
  rank: string;
  /** 직책(팀장·본부장). 직급과 별개이고 선택 입력입니다. */
  position?: string | null;
  credential?: string | null;
  photoUrl?: string | null;
  telWork?: string | null;
  telMobile?: string | null;
  mobilePublic: boolean;
  email?: string | null;
  company: {
    nameKo: string;
    nameEn: string;
    industry?: string | null;
    tagline?: string | null;
    /** 스킴 없이 "dvi-ind.com" 으로 들어와도 됩니다. 카드가 붙여서 씁니다. */
    homepageUrl?: string | null;
    certifications: string[];
  };
};

/**
 * 홈페이지 주소를 링크로 쓸 수 있는 형태로 만듭니다.
 *
 * /edit 는 자유 입력이라 "dvi-ind.com" 처럼 스킴 없이 저장된 값이 섞입니다.
 * 그대로 href 에 넣으면 브라우저가 상대 경로로 읽어 /c/dvi-ind.com 으로 갑니다.
 * 값이 비면 브랜드 기본 주소로 떨어져 CTA 가 사라지지 않게 합니다.
 */
function homepageHref(raw?: string | null): string {
  const url = raw?.trim();
  if (!url) return brand.homepage;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** DB 레코드 → 카드 데이터. /c/[slug] 쪽 어댑터입니다. */
export function toProfileCardData(employee: Employee, company: Company): ProfileCardData {
  return {
    nameKo: employee.nameKo,
    rank: employee.rank,
    position: employee.position,
    credential: employee.credential,
    photoUrl: employee.photoUrl,
    telWork: employee.telWork,
    telMobile: employee.telMobile,
    mobilePublic: employee.mobilePublic,
    email: employee.email,
    company: {
      nameKo: company.nameKo,
      nameEn: company.nameEn,
      industry: company.industry,
      tagline: company.tagline,
      homepageUrl: company.homepageUrl,
      // certifications 는 Json 컬럼이라 타입이 보장되지 않습니다. 문자열만 통과시킵니다.
      certifications: Array.isArray(company.certifications)
        ? company.certifications.filter((c): c is string => typeof c === "string")
        : [],
    },
  };
}

/** 회사 워드마크. 로고 이미지가 아직 없어 텍스트로 그립니다. D 만 primary. */
function Wordmark() {
  return (
    <span className="text-caption-bold">
      <span className="text-primary">D</span>
      <span className="text-text">VISION</span>
    </span>
  );
}

function ActionButton({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const disabled = !href;
  return (
    <div className="flex flex-1 flex-col items-center gap-tight">
      {/* 값이 없으면 링크가 아니라 비활성 표시로 렌더합니다. href="" 인 <a> 는 페이지를 새로고침시킵니다. */}
      {disabled ? (
        <span
          aria-disabled
          className="flex h-11 w-full items-center justify-center rounded-card border border-border text-border"
        >
          {children}
        </span>
      ) : (
        <a
          href={href}
          className="flex h-11 w-full items-center justify-center rounded-card border border-border text-text transition-colors hover:border-text"
        >
          {children}
        </a>
      )}
      <span className={`text-caption ${disabled ? "text-border" : "text-sub-text"}`}>{label}</span>
    </div>
  );
}

export function ProfileCard({ data }: { data: ProfileCardData }) {
  const { company } = data;

  // 직급 · 직책 · 자격을 한 줄로. 없는 항목은 통째로 빠지고 구분자가 혼자 남지 않도록
  // 배열로 모아 join 합니다. (서명 조립 규칙과 같은 방식)
  const roleText = [data.rank, data.position?.trim(), data.credential?.trim()]
    .filter(Boolean)
    .join(" · ");

  const tel = data.telWork?.trim() || null;
  // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다. (서명 규칙과 동일)
  const mobile = data.mobilePublic ? data.telMobile?.trim() || null : null;
  const email = data.email?.trim() || null;

  const hasCompanyBlock =
    company.industry || company.tagline || company.certifications.length > 0;

  return (
    <article className="bg-bg text-text">
      {/*
        신원 블록은 가운데 정렬입니다. 명함은 훑어보는 화면이라 사진 → 이름 → 소속이
        한 축에 놓여야 눈이 한 번에 내려갑니다. 왼쪽 정렬이면 원형 사진만 축에서
        벗어나 보입니다.
      */}
      <div className="flex flex-col items-center p-section text-center">
        {/* 사진 — 업로드는 아직 구현 전이라 placeholder 를 그립니다. */}
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-sub-bg">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 업로드 도메인이 정해지기 전이라 next/image 설정을 미룹니다.
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-10 w-10 text-sub-text" />
          )}
        </div>

        <h1 className="mt-group text-display">{data.nameKo}</h1>
        {roleText ? <p className="mt-tight text-body text-sub-text">{roleText}</p> : null}
        <p className="mt-sibling flex items-center justify-center gap-tight">
          <Wordmark />
          <span className="text-caption-bold text-text">{company.nameKo}</span>
        </p>

        {/*
          CTA — 화면에서 primary 를 채워 쓰는 유일한 요소입니다.
          명함을 받은 사람이 다음에 하는 행동은 "회사가 뭐 하는 곳인지 보기" 라서
          회사 홈페이지로 보냅니다. 카드는 닫히지 않도록 새 탭으로 엽니다.
        */}
        <a
          href={homepageHref(company.homepageUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-section flex h-12 w-full items-center justify-center rounded-card bg-primary text-body-bold text-white transition-colors hover:bg-primary-hover"
        >
          홈페이지 바로가기
        </a>

        <div className="mt-group flex w-full gap-sibling">
          <ActionButton href={tel ? `tel:${tel}` : null} label="전화">
            <PhoneIcon className="h-5 w-5" />
          </ActionButton>
          <ActionButton href={mobile ? `sms:${mobile}` : null} label="문자">
            <MessageIcon className="h-5 w-5" />
          </ActionButton>
          <ActionButton href={email ? `mailto:${email}` : null} label="메일">
            <MailIcon className="h-5 w-5" />
          </ActionButton>
        </div>
      </div>

      {/*
        회사 블록은 회색 바닥에 얹어 신원 블록과 층을 나눕니다. 선 하나로만 나누면
        흰 면이 계속 이어져서 카드가 아니라 문서처럼 보입니다. 색이 아니라 명도로
        나누는 것이라 primary 예산과는 무관합니다.
      */}
      {hasCompanyBlock ? (
        <div className="border-t border-border bg-sub-bg p-section text-center">
          {company.industry ? <h2 className="text-title">{company.industry}</h2> : null}
          {company.tagline ? (
            <p className="mt-tight text-caption text-sub-text">{company.tagline}</p>
          ) : null}

          {company.certifications.length > 0 ? (
            <ul className="mt-group flex flex-wrap justify-center gap-sibling">
              {company.certifications.map((cert) => (
                // 회색 바닥이라 칩은 흰 면으로 띄웁니다. 배경이 같으면 테두리만 남아 흐릿합니다.
                <li
                  key={cert}
                  className="rounded-card border border-border bg-bg px-sibling py-tight text-caption whitespace-nowrap"
                >
                  {cert}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
