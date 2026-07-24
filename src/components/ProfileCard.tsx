import {
  DownloadIcon,
  GlobeIcon,
  InstagramIcon,
  LinkedInIcon,
  UserIcon,
  YouTubeIcon,
} from "./icons";
import { brand } from "@/config/brand";
import { CARD_TEXT, cardPath, requireCardName, type Lang } from "@/lib/lang";
import { officeLines, roleParts } from "@/lib/org";
import type { CompanyWithOffices, EmployeeWithOrg } from "@/types";

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
  /** 명함 이미지(/c/[slug]/card.png) 주소를 만드는 데 씁니다. */
  slug: string;
  /**
   * 이 카드가 어느 언어인지.
   *
   * 값(이름·직위·주소)은 toProfileCardData 가 이미 골라 담아 옵니다. 이 필드는
   * 화면이 스스로 그리는 말(라벨·안내)과 이미지 주소를 고르는 데만 씁니다.
   */
  lang: Lang;
  nameKo: string;
  /** 영문명. 비어 있으면 줄째로 빠집니다 — 선택 입력이라 안 적은 사람이 많습니다. */
  nameEn?: string | null;
  /**
   * 명함에 한 줄로 찍히는 역할 조각들 — 직위 · 임원 직책 · 직책 순서입니다.
   *
   * 세 값을 따로 받지 않고 이미 걸러진 배열로 받습니다. 조립 규칙(어떤 순서로,
   * 없는 값은 어떻게)을 lib/org.ts 의 roleParts 한 곳에만 두기 위해서입니다.
   */
  roles: string[];
  credential?: string | null;
  /**
   * 본인 소개 한 줄. 이름·직함 아래에 나갑니다.
   *
   * 언어에 맞는 값이 이미 골라져 들어옵니다 — 영문 카드는 bioEn, 비어 있으면 null.
   */
  bio?: string | null;
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
    linkedinUrl?: string | null;
    /** 채널이 아니라 회사 소개 영상입니다. */
    youtubeUrl?: string | null;
    instagramUrl?: string | null;
    /**
     * 사업장 주소들 — 이미 `(43011) 대구시 …` 로 조립된 줄입니다.
     *
     * 본사와 R&D센터처럼 여러 곳이면 전부 한 줄씩 찍습니다. 조립 규칙은
     * lib/org.ts 의 officeLines 한 곳에만 둡니다.
     */
    addresses: string[];
    /** 회사 대표번호. 직원 사무실 번호(telWork)가 없을 때 대신 나갑니다. */
    tel?: string | null;
    /** 팩스는 개인 번호가 아니라 회사 공용입니다. */
    fax?: string | null;
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
  return externalHref(url);
}

/**
 * 스킴이 없는 주소에 https 를 붙입니다.
 *
 * 회사 정보는 자유 입력이라 "instagram.com/dvi_ind" 처럼 저장된 값이 섞입니다.
 * 그대로 href 에 넣으면 브라우저가 상대 경로로 읽어 /c/instagram.com/... 으로 갑니다.
 */
function externalHref(raw: string): string {
  const url = raw.trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Json 컬럼 → 문자열 배열.
 *
 * 인증 목록은 Json 이라 타입이 보장되지 않습니다(직접 UPDATE 한 값, 예전 형식).
 * 카드는 문자열만 그리므로 여기서 좁혀서 넘깁니다.
 */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * DB 레코드 → 카드 데이터. /c/[slug] 와 /c/[slug]/en 이 함께 씁니다.
 *
 * 언어별로 값을 고르는 규칙이 전부 여기 모여 있습니다. 화면 컴포넌트는 이미
 * 고른 값을 받기만 하므로, 국문·영문 카드가 서로 다른 규칙으로 갈라지지 않습니다.
 *
 * 영문 값이 비면 그 줄을 뺍니다. 한글로 대신 채우지 않습니다 — 영문 명함에
 * 한글이 섞이면 안 만든 것만 못합니다. 이름도 예외가 아닙니다: 영문명이 없으면
 * 그 사람의 영문 카드는 아직 없는 것이고, 페이지가 먼저 404 로 막습니다.
 */
export function toProfileCardData(
  employee: EmployeeWithOrg,
  company: CompanyWithOffices,
  lang: Lang = "ko",
): ProfileCardData {
  const en = lang === "en";
  /** 영문 카드에서 빈 값을 null 로 눌러 담습니다. 화면이 빈 문자열을 그리지 않도록. */
  const pick = (value?: string | null) => value?.trim() || null;

  return {
    slug: employee.slug,
    lang,
    // 영문 카드인데 영문명이 없으면 던집니다. 여기까지 왔다는 건 라우트의 404
    // 가드가 빠졌다는 뜻이라, 한글 이름으로 덮고 넘어가면 안 됩니다.
    nameKo: requireCardName(employee, lang),
    // 국문 카드는 한글 이름 아래 영문명을 함께 보여 줍니다. 영문 카드에서는
    // 위에서 이미 영문명을 이름 자리에 올렸으므로 같은 값을 두 번 찍지 않습니다.
    nameEn: en ? null : employee.nameEn,
    roles: roleParts(employee, lang),
    credential: en ? pick(employee.credentialEn) : employee.credential,
    bio: en ? pick(employee.bioEn) : employee.bio,
    photoUrl: employee.photoUrl,
    telWork: employee.telWork,
    telMobile: employee.telMobile,
    mobilePublic: employee.mobilePublic,
    email: employee.email,
    company: {
      // 영문 카드는 회사명도 영문입니다. nameEn 은 필수 컬럼이라 항상 값이 있습니다.
      nameKo: en ? company.nameEn : company.nameKo,
      nameEn: company.nameEn,
      industry: en ? pick(company.industryEn) : company.industry,
      tagline: en ? pick(company.taglineEn) : company.tagline,
      // 영문 홈페이지가 따로 있으면 그쪽으로 보냅니다. 없으면 국문이라도 겁니다 —
      // 회사 사이트로 가는 길이 아예 사라지는 것보다 낫습니다.
      homepageUrl: en ? company.homepageUrlEn?.trim() || company.homepageUrl : company.homepageUrl,
      linkedinUrl: company.linkedinUrl,
      // 영문 소개 영상이 따로 있으면 그걸 걸고, 없으면 국문 영상이라도 겁니다 —
      // 영상은 말이 안 통해도 볼 거리가 되므로 링크를 없애는 것보다 낫습니다.
      youtubeUrl: en ? company.youtubeUrlEn?.trim() || company.youtubeUrl : company.youtubeUrl,
      instagramUrl: company.instagramUrl,
      addresses: officeLines(company.offices, lang),
      tel: company.tel,
      fax: company.fax,
      // 영문 카드는 영문 인증 목록만 씁니다. 비면 뱃지 줄이 통째로 빠집니다 —
      // "IATF 16949" 처럼 원래 영문인 항목이 많다고 국문 목록을 그대로 쓰면,
      // 한글 인증명이 하나 추가되는 날 영문 명함에 그대로 나갑니다.
      certifications: stringList(en ? company.certificationsEn : company.certifications),
    },
  };
}

/**
 * 내려받을 때 붙는 파일명.
 *
 * slug(hong)가 아니라 이름으로 저장합니다 — "홍길동 명함.png". 명함을 여러 장
 * 받아 두면 파일명이 그 사람을 가리켜야 나중에 찾을 수 있는데, slug 는 성만
 * 로마자로 줄인 값이라(홍길동·홍민지 → hong·hong2) 누구 명함인지 알아볼 수 없습니다.
 *
 * "명함" 이라는 말도 카드 언어를 따릅니다 — 영문 카드를 받은 외국 거래처의
 * 내려받기 폴더에 한글 파일명이 떨어지면 읽지도, 검색하지도 못합니다.
 * 문구는 서명 이미지의 alt 와 같은 CARD_TEXT.cardOf 한 곳에서 옵니다.
 *
 * 이름은 자유 입력이라 파일명에 못 쓰는 글자가 섞일 수 있어 걷어냅니다.
 * 걷어내고 나면 빈 문자열이 되는 경우(이름이 전부 특수문자)를 대비해 slug 로 떨어집니다.
 */
function downloadName(name: string, slug: string, lang: Lang): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim();
  return `${CARD_TEXT[lang].cardOf(safe || slug)}.png`;
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

/**
 * 연락처 한 줄. `라벨 ———— 값` 형태로, 값이 없으면 줄째로 빠집니다.
 *
 * 아이콘 버튼을 이 줄로 바꾼 이유: 명함은 "번호를 눈으로 확인하는" 화면입니다.
 * 아이콘만 있으면 저장하기 전에는 번호도 주소도 읽을 수 없었습니다.
 * 누를 수 있는 값(전화·메일)은 줄 전체가 링크라 탭하면 그대로 걸립니다.
 */
function InfoRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;

  const inner = (
    <>
      <span className="shrink-0 text-caption text-sub-text">{label}</span>
      {/* 이메일·주소는 좁은 화면에서 넘칩니다. 잘라내면 정보가 사라지므로 줄바꿈시킵니다. */}
      <span className="text-body break-all text-right">{value}</span>
    </>
  );

  const className = "flex items-center justify-between gap-group py-sibling";

  return (
    <li className="border-b border-border last:border-b-0">
      {href ? (
        <a href={href} className={`${className} transition-colors hover:bg-sub-bg`}>
          {inner}
        </a>
      ) : (
        <div className={className}>{inner}</div>
      )}
    </li>
  );
}

export function ProfileCard({
  data,
  downloadable = true,
}: {
  data: ProfileCardData;
  /**
   * 신원 블록을 명함 이미지 다운로드 링크로 쓸지.
   *
   * /edit 미리보기는 끕니다. card.png 는 **저장된** 값으로 서버에서 굽는 이미지라,
   * 편집 중에 눌러 받으면 눈앞의 미리보기와 다른 명함이 내려옵니다. 미리보기의
   * 약속은 "공개 카드와 똑같이 보인다" 이므로 모양은 그대로 두고 동작만 뗍니다.
   */
  downloadable?: boolean;
}) {
  const { company } = data;
  // 화면이 스스로 그리는 말(라벨·안내)은 여기서 한 번에 고릅니다. DB 값은 이미
  // 언어에 맞춰 들어온 상태입니다 — toProfileCardData 가 골라 담습니다.
  const t = CARD_TEXT[data.lang];

  // 직위 · 임원 직책 · 직책 · 자격을 한 줄로. 없는 항목은 통째로 빠지고 구분자가
  // 혼자 남지 않도록 배열로 모아 join 합니다. (서명 조립 규칙과 같은 방식)
  const roleText = [...data.roles, data.credential?.trim()].filter(Boolean).join(" · ");

  // 값 고르는 규칙은 lib/signature.ts 의 resolveFields 와 같아야 합니다.
  // 여기만 따로 정하면 카드에 보이는 번호와 서명·vCard 의 번호가 갈립니다.
  const tel = data.telWork?.trim() || company.tel?.trim() || null;
  // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다.
  const mobile = data.mobilePublic ? data.telMobile?.trim() || null : null;
  const fax = company.fax?.trim() || null;
  const email = data.email?.trim() || null;
  const addresses = company.addresses.filter((line) => line.trim());

  /**
   * 아이콘 줄에 실제로 걸 링크만 추립니다.
   *
   * 값이 빈 SNS 는 통째로 빠집니다 — 회사가 하나를 접었을 때 아이콘만 남아
   * 아무 데도 안 가는 것보다 없는 게 낫습니다. 홈페이지는 비어 있어도
   * homepageHref 가 브랜드 기본 주소로 떨어뜨려서 항상 남습니다.
   */
  const links = [
    { key: "linkedin", label: t.linkedin, raw: company.linkedinUrl, Icon: LinkedInIcon },
    { key: "youtube", label: t.youtube, raw: company.youtubeUrl, Icon: YouTubeIcon },
    { key: "instagram", label: t.instagram, raw: company.instagramUrl, Icon: InstagramIcon },
    { key: "homepage", label: t.homepage, raw: company.homepageUrl ?? "", Icon: GlobeIcon },
  ]
    .filter((item) => item.key === "homepage" || item.raw?.trim())
    .map((item) => ({
      ...item,
      href: item.key === "homepage" ? homepageHref(item.raw) : externalHref(item.raw!),
    }));

  const hasCompanyBlock =
    company.industry || company.tagline || addresses.length > 0 || company.certifications.length > 0;

  /*
    신원 블록은 가운데 정렬입니다. 명함은 훑어보는 화면이라 사진 → 이름 → 소속이
    한 축에 놓여야 눈이 한 번에 내려갑니다. 왼쪽 정렬이면 원형 사진만 축에서
    벗어나 보입니다.

    블록 전체가 명함 이미지(card.png) 다운로드 링크입니다. 같은 이미지가
    이메일 서명에 붙어 나가므로, 카드를 받은 사람도 그 한 장을 그대로
    저장할 수 있습니다. (downloadable=false 면 모양만 같고 링크는 빠집니다)
  */
  const identity = (
    <>
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
      {/*
        영문명은 한글 이름 바로 아래입니다. 역할 줄 밑에 두면 "홍길동 / 수석매니저 /
        Gil-dong Hong" 이 되어 이름과 영문명이 갈라집니다. 둘은 같은 값이라 붙여 둡니다.

        h1 에 넣지 않는 이유: 스크린리더가 제목을 "홍길동 Gil-dong Hong" 한 덩어리로
        읽고, 검색·공유 미리보기에도 두 이름이 붙어 나갑니다.
      */}
      {data.nameEn?.trim() ? (
        <p className="mt-tight text-body text-sub-text">{data.nameEn.trim()}</p>
      ) : null}
      {roleText ? <p className="mt-tight text-body text-sub-text">{roleText}</p> : null}
      {/*
        소개 한 줄. 직함 아래, 회사 워드마크 위입니다 — "이 사람이 누구인가" 를
        말하는 줄들끼리 붙여 두어야 눈이 한 번에 내려갑니다.

        회사 태그라인과 자리가 다릅니다. 저건 카드 아래 회사 블록에 있고 전 직원이
        같은 문장이지만, 이건 본인이 적는 값이라 사람마다 다릅니다.
      */}
      {data.bio?.trim() ? (
        <p className="mt-sibling max-w-[280px] text-caption text-sub-text">{data.bio.trim()}</p>
      ) : null}
      <p className="mt-sibling flex items-center justify-center gap-tight">
        <Wordmark />
        <span className="text-caption-bold text-text">{company.nameKo}</span>
      </p>

      {/* 누르는 자리라는 표시가 없으면 아무도 안 누릅니다. */}
      <span className="mt-group inline-flex items-center gap-tight text-caption text-primary">
        <DownloadIcon className="h-4 w-4" />
        {t.saveCard}
      </span>
    </>
  );

  const identityClassName =
    "flex flex-col items-center px-section pt-section pb-group text-center";

  return (
    <article className="bg-bg text-text">
      {downloadable ? (
        /*
          download 속성이 필요합니다. card.png 라우트는 이미지를 inline 으로
          내려주기 때문에, 이게 없으면 다운로드가 아니라 이미지 페이지로 이동합니다.

          aria-label 이 없으면 링크 이름이 블록 안 글자를 전부 이어 붙인
          "홍길동 부장 · DVISION … 눌러서 명함 이미지 저장" 이 됩니다. 이름은 h1 로
          따로 읽히니 여기서는 행동만 말합니다. (안쪽 h1 은 그대로 제목으로 남습니다)
        */
        <a
          href={cardPath(data.slug, data.lang, "card.png")}
          // nameKo 에는 이미 카드 언어에 맞는 이름이 들어 있습니다 —
          // toProfileCardData 가 골라 담습니다. 여기서 언어를 다시 따지면
          // 고르는 규칙이 두 곳으로 갈라집니다.
          download={downloadName(data.nameKo, data.slug, data.lang)}
          aria-label={t.saveCard}
          className={`${identityClassName} transition-colors hover:bg-sub-bg`}
        >
          {identity}
        </a>
      ) : (
        <div className={identityClassName}>{identity}</div>
      )}

      <div className="px-section pb-section">
        {/*
          명함에 인쇄되는 값들을 그대로 한 번 더 보여 줍니다. 저장하지 않고
          번호만 확인하고 끝내는 사람이 대부분이라, 이게 카드의 본문입니다.
        */}
        <ul className="border-t border-border">
          <InfoRow label={t.phone} value={tel} href={tel ? `tel:${tel}` : undefined} />
          <InfoRow label={t.mobile} value={mobile} href={mobile ? `tel:${mobile}` : undefined} />
          {/* 팩스는 걸 수 있는 번호가 아니라 링크를 걸지 않습니다. */}
          <InfoRow label={t.fax} value={fax} />
          <InfoRow label={t.email} value={email} href={email ? `mailto:${email}` : undefined} />
        </ul>

        {/*
          회사로 가는 통로 — 링크드인 · 유튜브 · 인스타그램 · 홈페이지.

          예전에는 "회사 홈페이지 바로가기" 전체폭 버튼 하나였습니다. 갈 곳이 넷이
          되면서 버튼을 넷으로 늘리면 카드 절반이 버튼이 되므로 아이콘 줄로 바꿨습니다.

          아이콘만 있으면 스크린리더가 읽을 게 없어서 각각 aria-label 을 답니다.
          손가락으로 눌러야 하므로 아이콘(20px)보다 넉넉한 44px 판을 줍니다.
          카드가 닫히지 않도록 전부 새 탭으로 엽니다.
        */}
        <ul className="mt-group flex items-center justify-center gap-group">
          {links.map(({ key, label, href, Icon }) => (
            <li key={key}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className="flex h-11 w-11 items-center justify-center rounded-card text-sub-text transition-colors hover:text-primary"
              >
                <Icon className="h-6 w-6" />
              </a>
            </li>
          ))}
        </ul>
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

          {/* 주소는 회사 값이라 회사 블록에 둡니다. 명함 뒷면의 마지막 줄과 같은 자리입니다. */}
          {/* 사업장이 둘 이상이면 줄을 나눠 전부 찍습니다. (본사 · R&D센터) */}
          {addresses.map((line) => (
            <p key={line} className="mt-sibling text-caption text-sub-text">
              {line}
            </p>
          ))}

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
