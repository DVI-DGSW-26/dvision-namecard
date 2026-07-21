import { MailIcon, MessageIcon, PhoneIcon, UserIcon } from "./icons";
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
    certifications: string[];
    foundedYear?: number | null;
    employeeCount?: number | null;
    equipmentCount?: number | null;
  };
};

/** DB 레코드 → 카드 데이터. /c/[slug] 쪽 어댑터입니다. */
export function toProfileCardData(employee: Employee, company: Company): ProfileCardData {
  return {
    nameKo: employee.nameKo,
    rank: employee.rank,
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
      // certifications 는 Json 컬럼이라 타입이 보장되지 않습니다. 문자열만 통과시킵니다.
      certifications: Array.isArray(company.certifications)
        ? company.certifications.filter((c): c is string => typeof c === "string")
        : [],
      foundedYear: company.foundedYear,
      employeeCount: company.employeeCount,
      equipmentCount: company.equipmentCount,
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

/**
 * 지표 한 칸.
 *
 * value 는 이미 포맷된 문자열입니다. 연도(1998)에 3자리 구분을 넣으면 1,998 이 되므로
 * 포맷 여부는 호출부가 항목별로 정합니다.
 */
function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="flex flex-col gap-tight">
      <p className="text-title text-text">
        {value}
        {unit ? <span className="text-caption text-sub-text"> {unit}</span> : null}
      </p>
      <p className="text-caption text-sub-text">{label}</p>
    </div>
  );
}

export function ProfileCard({ data }: { data: ProfileCardData }) {
  const { company } = data;

  // 직급과 자격·학위는 한 줄. 자격이 없으면 구분자가 혼자 남지 않게 배열로 조립합니다.
  const roleText = [data.rank, data.credential?.trim()].filter(Boolean).join(" · ");

  const tel = data.telWork?.trim() || null;
  // mobilePublic 이 false 면 번호가 있어도 공개하지 않습니다. (서명 규칙과 동일)
  const mobile = data.mobilePublic ? data.telMobile?.trim() || null : null;
  const email = data.email?.trim() || null;

  const count = (n: number) => n.toLocaleString("ko-KR");

  const stats = [
    // 연도는 3자리 구분 없이 그대로. (1998 이지 1,998 이 아닙니다)
    company.foundedYear ? { value: String(company.foundedYear), label: "설립" } : null,
    company.employeeCount ? { value: count(company.employeeCount), unit: "명", label: "임직원" } : null,
    company.equipmentCount ? { value: count(company.equipmentCount), unit: "대", label: "설비" } : null,
  ].filter((s): s is { value: string; unit?: string; label: string } => s !== null);

  const hasCompanyBlock =
    company.industry || company.tagline || company.certifications.length > 0 || stats.length > 0;

  return (
    <article className="bg-bg text-text">
      <div className="p-section">
        {/* 사진 — 업로드는 아직 구현 전이라 placeholder 를 그립니다. */}
        <div className="mb-group flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-sub-bg">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 업로드 도메인이 정해지기 전이라 next/image 설정을 미룹니다.
            <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-8 w-8 text-sub-text" />
          )}
        </div>

        <h1 className="text-display">{data.nameKo}</h1>
        {roleText ? <p className="mt-tight text-body text-sub-text">{roleText}</p> : null}
        <p className="mt-tight flex items-center gap-tight">
          <Wordmark />
          <span className="text-caption-bold text-text">{company.nameKo}</span>
        </p>

        {/* CTA — 화면에서 primary 를 채워 쓰는 유일한 요소입니다. */}
        <a
          href="./vcard"
          className="mt-group flex h-12 w-full items-center justify-center rounded-card bg-primary text-body-bold text-white transition-colors hover:bg-primary-hover"
        >
          연락처 저장
        </a>

        <div className="mt-group flex gap-sibling">
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

      {hasCompanyBlock ? (
        <div className="border-t border-border p-section">
          {company.industry ? <h2 className="text-title">{company.industry}</h2> : null}
          {company.tagline ? (
            <p className="mt-tight text-caption text-sub-text">{company.tagline}</p>
          ) : null}

          {company.certifications.length > 0 ? (
            <ul className="mt-group flex flex-wrap gap-sibling">
              {company.certifications.map((cert) => (
                <li
                  key={cert}
                  className="rounded-card border border-border px-sibling py-tight text-caption whitespace-nowrap"
                >
                  {cert}
                </li>
              ))}
            </ul>
          ) : null}

          {stats.length > 0 ? (
            <div className="mt-block flex gap-block">
              {stats.map((stat) => (
                <Stat key={stat.label} {...stat} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
