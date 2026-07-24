"use client";

import { Field, FieldRow, Input } from "@/components/form";
import { formatPhone } from "@/lib/validation";

/**
 * 회사 정보 입력 칸 한 벌.
 *
 * 두 화면이 함께 씁니다 — /admin/company(관리자 전용 편집)와 /edit 의 회사 정보
 * 섹션(회원에게는 읽기 전용). 마크업을 두 벌로 두면 칸을 하나 추가할 때 한쪽만
 * 고쳐 놓고 "넣었다" 고 믿게 됩니다. 실제로 인증 영문 칸이 그렇게 한쪽에만 생겨서
 * 관리자가 못 찾았습니다.
 *
 * 값과 저장은 부르는 쪽이 가집니다. 이 컴포넌트는 그리기만 합니다 — /edit 은
 * 직원 정보와 함께 한 번에 저장하고, /admin/company 는 회사 정보만 저장하므로
 * 저장 로직까지 여기 넣으면 둘 중 하나는 반드시 어긋납니다.
 */

/** 폼 state 는 전부 문자열입니다. 배열·숫자 변환은 companyProfileSchema 가 합니다. */
export type CompanyFormValues = {
  nameKo: string;
  nameEn: string;
  industry: string;
  tagline: string;
  industryEn: string;
  taglineEn: string;
  /** 쉼표로 구분한 한 줄. 저장할 때 스키마가 배열로 바꿉니다. */
  certifications: string;
  /** 영문 카드가 쓰는 인증 목록. 국문 목록으로 떨어지지 않습니다. */
  certificationsEn: string;
  /** 명함 이미지의 강조색. `#931B82` 형식입니다. */
  brandColor: string;
  tel: string;
  fax: string;
  homepageUrl: string;
  homepageUrlEn: string;
  linkedinUrl: string;
  youtubeUrl: string;
  youtubeUrlEn: string;
  instagramUrl: string;
};

/** Json 인증 목록 → 쉼표 한 줄. 두 화면이 같은 규칙으로 값을 채우도록 여기 둡니다. */
export const certLine = (value: unknown) =>
  Array.isArray(value) ? value.filter((c): c is string => typeof c === "string").join(", ") : "";

type Props = {
  values: CompanyFormValues;
  /**
   * 필드 이름으로 에러 문구를 돌려줍니다.
   *
   * 접두사는 부르는 쪽이 정합니다 — /edit 은 직원 폼과 섞이므로 `company.nameKo`,
   * /admin/company 는 회사뿐이라 `nameKo` 입니다.
   */
  error: (field: keyof CompanyFormValues) => string | undefined;
  onChange: (field: keyof CompanyFormValues, value: string) => void;
  /** 회원에게 보여줄 때 씁니다. fieldset 째 잠급니다. */
  disabled?: boolean;
  /** 주소 관리 위치 안내. 수정 권한이 있는 사람에게만 의미가 있습니다. */
  showOfficeHint?: boolean;
};

export function CompanyFields({ values, error, onChange, disabled, showOfficeHint }: Props) {
  const co = values;
  const err = error;
  const set = onChange;

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-group">
      <FieldRow>
        <Field label="회사명" htmlFor="co-nameKo" error={err("nameKo")}>
          <Input
            id="co-nameKo"
            value={co.nameKo}
            invalid={Boolean(err("nameKo"))}
            onChange={(e) => set("nameKo", e.target.value)}
          />
        </Field>
        <Field label="영문명" htmlFor="co-nameEn" error={err("nameEn")}>
          <Input
            id="co-nameEn"
            value={co.nameEn}
            invalid={Boolean(err("nameEn"))}
            onChange={(e) => set("nameEn", e.target.value)}
          />
        </Field>
      </FieldRow>

      {/*
        영문 칸은 영문 명함(/c/[slug]/en)에만 나갑니다. 비우면 영문 카드에서
        그 줄이 빠집니다 — 한글로 대신 채우지 않습니다.
      */}
      <FieldRow>
        <Field label="사업 분야 (선택)" htmlFor="co-industry" error={err("industry")}>
          <Input
            id="co-industry"
            value={co.industry}
            invalid={Boolean(err("industry"))}
            onChange={(e) => set("industry", e.target.value)}
          />
        </Field>
        <Field label="사업 분야 영문 (선택)" htmlFor="co-industryEn" error={err("industryEn")}>
          <Input
            id="co-industryEn"
            placeholder="Aluminium Extrusion · Precision Machining"
            value={co.industryEn}
            invalid={Boolean(err("industryEn"))}
            onChange={(e) => set("industryEn", e.target.value)}
          />
        </Field>
      </FieldRow>

      {/*
        주소 칸은 여기 없습니다. 사업장이 본사·R&D센터 둘이라 한 칸에 넣을 수 없고,
        /admin/org 의 '사업장' 탭에서 관리합니다. 명함에는 등록된 사업장이 전부 찍힙니다.
      */}
      {showOfficeHint ? (
        <p className="text-caption text-sub-text">
          주소는{" "}
          <a href="/admin/org" className="text-caption-bold text-primary">
            조직 관리 → 사업장
          </a>
          에서 관리합니다. 등록된 사업장이 명함에 전부 표시됩니다.
        </p>
      ) : null}

      <FieldRow>
        <Field
          label="태그라인 (선택)"
          htmlFor="co-tagline"
          error={err("tagline")}
          hint="명함 하단 회사 블록에 사업 분야와 함께 두 줄로 나옵니다."
        >
          <Input
            id="co-tagline"
            value={co.tagline}
            placeholder="예: 자동차 경량 부품 전문"
            invalid={Boolean(err("tagline"))}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </Field>
        <Field label="태그라인 영문 (선택)" htmlFor="co-taglineEn" error={err("taglineEn")}>
          <Input
            id="co-taglineEn"
            placeholder="Lightweight Automotive Components"
            value={co.taglineEn}
            invalid={Boolean(err("taglineEn"))}
            onChange={(e) => set("taglineEn", e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field
          label="인증 (선택)"
          htmlFor="co-certifications"
          error={err("certifications")}
          hint="쉼표로 구분해 적습니다. 명함에 뱃지로 하나씩 나옵니다."
        >
          <Input
            id="co-certifications"
            value={co.certifications}
            placeholder="IATF 16949, ISO 9001"
            invalid={Boolean(err("certifications"))}
            onChange={(e) => set("certifications", e.target.value)}
          />
        </Field>
        {/*
          국문 칸을 그대로 복사해 쓰는 자리가 아닙니다. 규격 이름이라 대개
          같은 값이 들어가지만, 한글 인증명을 국문 칸에만 추가하는 날
          영문 명함이 따라가지 않도록 목록을 갈라 둡니다.
        */}
        <Field
          label="인증 영문 (선택)"
          htmlFor="co-certificationsEn"
          error={err("certificationsEn")}
          hint="비우면 영문 명함에서 뱃지 줄이 빠집니다."
        >
          <Input
            id="co-certificationsEn"
            value={co.certificationsEn}
            placeholder="IATF 16949, ISO 9001"
            invalid={Boolean(err("certificationsEn"))}
            onChange={(e) => set("certificationsEn", e.target.value)}
          />
        </Field>
      </FieldRow>

      {/*
        명함 색.

        웹 카드가 아니라 **명함 이미지(card.png)** 의 이름·연락처 라벨 색입니다.
        웹 카드는 디자인 토큰(text-primary)을 쓰기 때문에 여기서 바꿔도 화면 카드와
        편집 미리보기는 그대로입니다. 그 사실을 안내에 적어 두지 않으면 "바꿨는데
        아무 일도 안 일어난다" 로 읽힙니다.

        색 상자와 글자 칸을 함께 두는 이유: 상자만 있으면 회사가 정한 값(#931B82)을
        정확히 넣을 수 없고, 글자 칸만 있으면 지금 무슨 색인지 눈으로 알 수 없습니다.
      */}
      <Field
        label="명함 색"
        htmlFor="co-brandColor"
        error={err("brandColor")}
        hint="명함 이미지와 이메일 서명의 이름·라벨 색입니다. 화면 카드 색은 바뀌지 않습니다."
      >
        <div className="flex items-center gap-sibling">
          <input
            type="color"
            aria-label="색 고르기"
            disabled={disabled}
            // 형식이 깨진 값이 들어 있으면 색 상자가 검정으로 떨어집니다. 기본색을 보여 줍니다.
            value={/^#[0-9A-Fa-f]{6}$/.test(co.brandColor) ? co.brandColor : "#931B82"}
            onChange={(e) => set("brandColor", e.target.value.toUpperCase())}
            className="h-12 w-14 shrink-0 cursor-pointer rounded-card border border-border bg-bg p-tight disabled:cursor-default"
          />
          <Input
            id="co-brandColor"
            value={co.brandColor}
            placeholder="#931B82"
            maxLength={7}
            invalid={Boolean(err("brandColor"))}
            onChange={(e) => set("brandColor", e.target.value)}
          />
        </div>
      </Field>

      <FieldRow>
        {/*
          대표번호는 개인 사무실 번호가 없는 직원의 명함에 대신 나갑니다.
          그래서 선택이 아니라 필수입니다 — 비우면 그 직원 카드에서 전화가 사라집니다.
        */}
        <Field
          label="대표번호"
          htmlFor="co-tel"
          error={err("tel")}
          hint="사무실 번호를 안 적은 직원의 명함에 이 번호가 나갑니다."
        >
          <Input
            id="co-tel"
            inputMode="tel"
            value={co.tel}
            invalid={Boolean(err("tel"))}
            onChange={(e) => set("tel", formatPhone(e.target.value))}
          />
        </Field>
        {/* 팩스는 회사 공용 번호입니다. 이메일 서명·vCard 가 이 값(Company.fax)을 씁니다. */}
        <Field label="팩스 (선택)" htmlFor="co-fax" error={err("fax")}>
          <Input
            id="co-fax"
            inputMode="tel"
            value={co.fax}
            invalid={Boolean(err("fax"))}
            onChange={(e) => set("fax", formatPhone(e.target.value))}
          />
        </Field>
      </FieldRow>

      {/*
        공개 카드 아래 아이콘 줄에 걸리는 주소들. 비우면 그 아이콘이 통째로
        빠집니다 — 아무 데도 안 가는 아이콘이 남는 것보다 없는 편이 낫습니다.
        스킴(https://)은 없어도 됩니다. 카드가 붙여서 엽니다.
      */}
      <FieldRow>
        <Field label="홈페이지 (선택)" htmlFor="co-homepageUrl" error={err("homepageUrl")}>
          <Input
            id="co-homepageUrl"
            value={co.homepageUrl}
            placeholder="dvi-ind.com"
            invalid={Boolean(err("homepageUrl"))}
            onChange={(e) => set("homepageUrl", e.target.value)}
          />
        </Field>
        <Field
          label="홈페이지 영문 (선택)"
          htmlFor="co-homepageUrlEn"
          error={err("homepageUrlEn")}
          hint="비우면 영문 명함도 국문 홈페이지를 겁니다."
        >
          <Input
            id="co-homepageUrlEn"
            value={co.homepageUrlEn}
            placeholder="dvi-ind.com/en/"
            invalid={Boolean(err("homepageUrlEn"))}
            onChange={(e) => set("homepageUrlEn", e.target.value)}
          />
        </Field>
        <Field label="링크드인 (선택)" htmlFor="co-linkedinUrl" error={err("linkedinUrl")}>
          <Input
            id="co-linkedinUrl"
            value={co.linkedinUrl}
            placeholder="linkedin.com/company/…"
            invalid={Boolean(err("linkedinUrl"))}
            onChange={(e) => set("linkedinUrl", e.target.value)}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="인스타그램 (선택)" htmlFor="co-instagramUrl" error={err("instagramUrl")}>
          <Input
            id="co-instagramUrl"
            value={co.instagramUrl}
            placeholder="instagram.com/…"
            invalid={Boolean(err("instagramUrl"))}
            onChange={(e) => set("instagramUrl", e.target.value)}
          />
        </Field>
        <Field
          label="유튜브 (선택)"
          htmlFor="co-youtubeUrl"
          error={err("youtubeUrl")}
          hint="채널이 아니라 회사 소개 영상 주소를 넣습니다."
        >
          <Input
            id="co-youtubeUrl"
            value={co.youtubeUrl}
            placeholder="youtu.be/…"
            invalid={Boolean(err("youtubeUrl"))}
            onChange={(e) => set("youtubeUrl", e.target.value)}
          />
        </Field>
      </FieldRow>

      <Field
        label="유튜브 영문 (선택)"
        htmlFor="co-youtubeUrlEn"
        error={err("youtubeUrlEn")}
        hint="영문 소개 영상. 비우면 영문 명함도 국문 영상을 겁니다."
      >
        <Input
          id="co-youtubeUrlEn"
          value={co.youtubeUrlEn}
          placeholder="youtu.be/…"
          invalid={Boolean(err("youtubeUrlEn"))}
          onChange={(e) => set("youtubeUrlEn", e.target.value)}
        />
      </Field>
    </fieldset>
  );
}
