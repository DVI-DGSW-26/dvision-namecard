"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyFields, certLine, type CompanyFormValues } from "@/components/CompanyFields";
import { Checkbox, Field, FieldRow, Input, SectionHeader, Select } from "@/components/form";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ProfileCard, type ProfileCardData } from "@/components/ProfileCard";
import { ArrowRightIcon, ChevronDownIcon } from "@/components/icons";
import { officeLines, type OrgLists } from "@/lib/org";
import {
  companyProfileSchema,
  employeeProfileSchema,
  fieldErrors,
  formatPhone,
  fullNameKo,
} from "@/lib/validation";
import type { CompanyWithOffices, EmployeeWithOrg } from "@/types";

/**
 * 프로필 편집 폼 + 실시간 미리보기.
 *
 * 미리보기는 ProfileCard 를 그대로 씁니다. 공개 페이지(/c/[slug])와 같은 컴포넌트라
 * 여기서 카드 모양을 손보고 싶어지면 ProfileCard 를 고쳐야 합니다. 이 파일에
 * 카드 마크업을 새로 만들면 두 화면이 즉시 어긋납니다.
 */

/** 폼 state 는 체크박스 하나(mobilePublic)를 빼면 전부 문자열입니다. */
type EmployeeForm = {
  /*
    성·이름을 나눠 들고 있습니다. 표시용 합본(nameKo)은 서버가 만듭니다 —
    화면에서 붙여 보내면 붙이는 규칙이 두 곳이 되고, 그러면 vCard 의 N 필드가
    실제 이름과 갈라지는 예전 문제로 돌아갑니다.
  */
  familyName: string;
  givenName: string;
  nameEn: string;
  /** 직위·직책·부서는 목록에서 고른 항목의 id 입니다. 비어 있으면 "없음". */
  rankId: string;
  executiveTitleId: string;
  positionId: string;
  teamId: string;
  partId: string;
  credential: string;
  credentialEn: string;
  /** 소개 한 줄. 카드의 이름·직함 아래에 나갑니다. */
  bio: string;
  bioEn: string;
  telWork: string;
  telMobile: string;
  /** 휴대폰을 명함에 내보낼지. 유일한 불리언이라 setEmpField 대신 setEmpFlag 로 바꿉니다. */
  mobilePublic: boolean;
  email: string;
};

/**
 * 회사 폼의 모양은 CompanyFields 가 정합니다 — 칸을 그리는 쪽과 값을 담는 쪽이
 * 갈라지면 칸을 하나 늘릴 때 한쪽만 고치게 됩니다. (/admin/company 도 같은 타입)
 */
type CompanyForm = CompanyFormValues;

const str = (value: string | null | undefined) => value ?? "";

export function EditProfileForm({
  role,
  employee,
  company,
  org,
}: {
  role: "member" | "admin";
  employee: EmployeeWithOrg;
  company: CompanyWithOffices;
  /** 직위·직책·부서 선택지. 관리자가 /admin/org 에서 바꾼 목록입니다. */
  org: OrgLists;
}) {
  const isAdmin = role === "admin";

  const initialEmployee = useMemo<EmployeeForm>(
    () => ({
      familyName: employee.familyName,
      givenName: employee.givenName,
      nameEn: str(employee.nameEn),
      rankId: str(employee.rankId),
      executiveTitleId: str(employee.executiveTitleId),
      positionId: str(employee.positionId),
      teamId: str(employee.teamId),
      partId: str(employee.partId),
      credential: str(employee.credential),
      credentialEn: str(employee.credentialEn),
      bio: str(employee.bio),
      bioEn: str(employee.bioEn),
      telWork: str(employee.telWork),
      telMobile: str(employee.telMobile),
      mobilePublic: employee.mobilePublic,
      email: employee.email,
    }),
    [employee],
  );

  const initialCompany = useMemo<CompanyForm>(
    () => ({
      nameKo: company.nameKo,
      nameEn: company.nameEn,
      industry: str(company.industry),
      tagline: str(company.tagline),
      industryEn: str(company.industryEn),
      taglineEn: str(company.taglineEn),
      // Json 컬럼이라 타입이 보장되지 않습니다. 문자열만 골라 한 줄로 붙입니다.
      certifications: certLine(company.certifications),
      certificationsEn: certLine(company.certificationsEn),
      brandColor: company.brandColor,
      tel: company.tel,
      fax: str(company.fax),
      homepageUrl: str(company.homepageUrl),
      homepageUrlEn: str(company.homepageUrlEn),
      linkedinUrl: str(company.linkedinUrl),
      youtubeUrl: str(company.youtubeUrl),
      youtubeUrlEn: str(company.youtubeUrlEn),
      instagramUrl: str(company.instagramUrl),
    }),
    [company],
  );

  const [emp, setEmp] = useState(initialEmployee);
  const [co, setCo] = useState(initialCompany);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  /**
   * 사진 주소. 폼 state 와 나눠 둡니다 — 사진은 저장 버튼을 거치지 않고 그 자리에서
   * 올라가므로, emp 에 섞으면 "저장하지 않은 변경" 으로 잘못 잡힙니다.
   */
  const [photoUrl, setPhotoUrl] = useState(employee.photoUrl);

  // 회원은 회사 정보를 못 바꾸므로 dirty 판정에서도 제외합니다.
  const dirty =
    JSON.stringify(emp) !== JSON.stringify(initialEmployee) ||
    (isAdmin && JSON.stringify(co) !== JSON.stringify(initialCompany));

  const setEmpField = useCallback(
    (key: keyof EmployeeForm, value: string) => setEmp((prev) => ({ ...prev, [key]: value })),
    [],
  );
  /** 체크박스용. 문자열 칸과 섞으면 setEmpField 의 타입이 넓어져 오타를 못 잡습니다. */
  const setEmpFlag = useCallback(
    (key: "mobilePublic", value: boolean) => setEmp((prev) => ({ ...prev, [key]: value })),
    [],
  );
  const setCoField = useCallback(
    (key: keyof CompanyForm, value: string) => setCo((prev) => ({ ...prev, [key]: value })),
    [],
  );

  /* 저장하지 않고 이탈 방지 -------------------------------------------------- */

  // 새로고침·탭 닫기·외부 링크. 브라우저 기본 다이얼로그가 뜹니다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // 앱 내부 이동. App Router 에는 라우트 변경을 가로챌 공식 API 가 없어서
  // 캡처 단계에서 내부 링크 클릭을 직접 잡습니다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank") return;
      // tel:, mailto:, # 등은 페이지를 떠나지 않습니다.
      if (!href.startsWith("/")) return;

      if (!window.confirm("저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [dirty]);

  /* 저장 -------------------------------------------------------------------- */

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setErrors({});

    const employeeParsed = employeeProfileSchema.safeParse(emp);
    const companyParsed = isAdmin ? companyProfileSchema.safeParse(co) : null;

    // 클라이언트에서 먼저 걸러 주지만, 서버도 같은 스키마로 다시 검증합니다.
    const clientErrors = {
      ...(employeeParsed.success ? {} : fieldErrors(employeeParsed.error)),
      ...(companyParsed && !companyParsed.success
        ? Object.fromEntries(
            Object.entries(fieldErrors(companyParsed.error)).map(([k, v]) => [`company.${k}`, v]),
          )
        : {}),
    };

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setSaving(false);
      return;
    }

    try {
      const requests: Promise<Response>[] = [
        fetch(`/api/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(emp),
        }),
      ];
      if (isAdmin) {
        requests.push(
          fetch("/api/company", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(co),
          }),
        );
      }

      const responses = await Promise.all(requests);
      const failed = responses.find((r) => !r.ok);
      if (failed) {
        const payload = await failed.json().catch(() => null);
        if (payload?.errors) setErrors(payload.errors);
        setSaveError(payload?.error ?? "저장하지 못했습니다.");
        return;
      }

      // 저장 성공 — 서버 값을 다시 읽어 dirty 기준을 갱신합니다.
      window.location.reload();
    } catch {
      setSaveError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  /** 고른 팀에 속한 파트만. 팀을 안 골랐으면 빈 배열이라 파트 선택이 잠깁니다. */
  const parts = useMemo(
    () => org.teams.find((team) => team.id === emp.teamId)?.parts ?? [],
    [org.teams, emp.teamId],
  );

  /* 미리보기 ---------------------------------------------------------------- */

  /**
   * 고른 항목의 id 를 명함에 찍히는 이름으로 바꿉니다.
   *
   * 카드는 이름을 받고 폼은 id 를 들고 있어서 여기서 한 번 이어 줍니다. 순서는
   * lib/org.ts 의 roleParts 와 같아야 합니다 — 저장 후 실제 카드와 어긋나지 않도록.
   */
  const previewRoles = useMemo(
    () =>
      [
        org.ranks.find((r) => r.id === emp.rankId)?.name,
        org.executiveTitles.find((t) => t.id === emp.executiveTitleId)?.name,
        org.positions.find((p) => p.id === emp.positionId)?.name,
      ].filter((name): name is string => Boolean(name)),
    [org, emp.rankId, emp.executiveTitleId, emp.positionId],
  );

  // 폼 state 를 카드 데이터로 변환합니다. debounce 없이 매 입력마다 다시 만듭니다.
  const previewData = useMemo<ProfileCardData>(
    () => ({
      slug: employee.slug,
      // 편집 미리보기는 국문 카드만 보여 줍니다. 영문판은 값을 채운 뒤
      // /c/[slug]/en 에서 확인합니다 — 폼 하나에 미리보기 둘을 붙이면
      // 좁은 화면에서 편집할 자리가 남지 않습니다.
      lang: "ko",
      // 서버가 저장할 값과 같은 규칙으로 붙입니다. 미리보기와 실제 카드가 갈리지 않도록.
      nameKo: fullNameKo(emp.familyName, emp.givenName),
      nameEn: emp.nameEn,
      roles: previewRoles,
      credential: emp.credential,
      bio: emp.bio,
      photoUrl,
      telWork: emp.telWork,
      telMobile: emp.telMobile,
      // 체크를 끄면 미리보기에서도 그 자리에서 휴대폰 줄이 사라집니다.
      mobilePublic: emp.mobilePublic,
      email: emp.email,
      company: {
        nameKo: co.nameKo,
        nameEn: co.nameEn,
        industry: co.industry,
        tagline: co.tagline,
        // 홈페이지를 고치면 미리보기 CTA 도 그 자리에서 따라갑니다.
        homepageUrl: co.homepageUrl,
        linkedinUrl: co.linkedinUrl,
        youtubeUrl: co.youtubeUrl,
        instagramUrl: co.instagramUrl,
        // 미리보기 주소는 저장된 사업장 그대로입니다 — 이 폼에서 바꾸는 값이 아닙니다.
        addresses: officeLines(company.offices),
        fax: co.fax,
        tel: co.tel,
        // 폼은 쉼표 한 줄이고 카드는 배열입니다. 저장 스키마와 같은 규칙으로 쪼갭니다.
        certifications: co.certifications
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    }),
    [
      emp,
      co,
      previewRoles,
      employee.slug,
      // 사진을 올리거나 지우면 미리보기가 그 자리에서 따라가야 합니다.
      photoUrl,
      company.offices,
    ],
  );

  const previewUrl = `/c/${employee.slug}`;
  const previewHost =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/+$/, "") ?? "";

  const preview = (
    <div className="flex flex-col gap-group">
      <div className="flex items-start justify-between gap-group">
        <div>
          <p className="text-body-bold">실시간 미리보기</p>
          <p className="mt-tight text-caption text-sub-text">모바일 · 375px</p>
        </div>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-tight text-caption-bold text-primary hover:text-primary-hover"
        >
          새 탭에서 열기
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>

      <div className="w-full max-w-[375px] overflow-hidden rounded-card border border-border">
        {/* PREVIEW 머리띠는 미리보기 전용 장식입니다. ProfileCard 안에 넣으면 공개 페이지에도 찍힙니다. */}
        <p className="border-b border-border bg-sub-bg py-sibling text-center text-caption text-sub-text">
          PREVIEW · {previewHost}
          {previewUrl}
        </p>
        {/*
          다운로드는 끕니다. card.png 는 저장된 값으로 굽는 이미지라, 편집 중에
          누르면 지금 보고 있는 미리보기가 아니라 저장 전 명함이 내려옵니다.
        */}
        <ProfileCard data={previewData} downloadable={false} />
      </div>
    </div>
  );

  /* 렌더 -------------------------------------------------------------------- */

  const err = (key: string) => errors[key];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-section px-group py-section sm:gap-block sm:px-section sm:py-block xl:flex-row xl:items-start">
      {/* 1280px 미만 — 미리보기를 폼 위로 올리고 접기/펴기 */}
      <section className="order-first xl:hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          aria-expanded={previewOpen}
          className="flex w-full items-center justify-between rounded-card border border-border px-group py-group text-body-bold"
        >
          실시간 미리보기
          <ChevronDownIcon
            className={`h-5 w-5 text-sub-text transition-transform ${previewOpen ? "rotate-180" : ""}`}
          />
        </button>
        {previewOpen ? <div className="mt-section">{preview}</div> : null}
      </section>

      <main className="w-full max-w-[1000px] xl:flex-1">
        <header>
          <p className="text-caption text-sub-text">내 명함</p>
          <h1 className="mt-tight text-display">프로필 편집</h1>
          <p className="mt-sibling text-body text-sub-text">
            여기서 저장하면 이미 보낸 메일의 링크에도 즉시 반영됩니다.
          </p>
          {/*
            서명 화면으로 가는 유일한 입구입니다. 저장 안 한 변경이 있으면 위쪽
            클릭 가로채기가 확인 다이얼로그를 띄웁니다 — 내부 경로라 그대로 걸립니다.
          */}
          <a
            href="/edit/signature"
            className="mt-group inline-block text-caption-bold text-primary hover:text-primary-hover"
          >
            이메일 서명 받기 →
          </a>
        </header>

        {/* 01 기본 정보 ------------------------------------------------------ */}
        <section className="mt-block">
          <SectionHeader number="01" title="기본 정보" />

          <div className="flex flex-col gap-section sm:flex-row sm:gap-block">
            {/*
              사진은 폼 저장과 별개로 그 자리에서 올라갑니다. 올린 주소를 여기서
              들고 있어야 미리보기 카드가 곧바로 새 사진을 그립니다.
            */}
            <PhotoPicker employeeId={employee.id} photoUrl={photoUrl} onChange={setPhotoUrl} />

            <div className="flex flex-1 flex-col gap-group">
              {/*
                이름을 성·이름 두 칸으로 받습니다. 한 칸으로 받아 서버에서 쪼개면
                두 글자 성(남궁·선우·제갈)에서 반드시 틀리고, 그 값이 연락처 저장
                파일(vCard)의 이름 칸에 그대로 들어갑니다.
              */}
              <FieldRow>
                <Field
                  label="성"
                  htmlFor="familyName"
                  error={err("familyName")}
                  hint="남궁·선우처럼 두 글자 성은 성 칸에 함께 적습니다."
                >
                  <Input
                    id="familyName"
                    value={emp.familyName}
                    maxLength={10}
                    invalid={Boolean(err("familyName"))}
                    onChange={(e) => setEmpField("familyName", e.target.value)}
                  />
                </Field>
                <Field label="이름" htmlFor="givenName" error={err("givenName")}>
                  <Input
                    id="givenName"
                    value={emp.givenName}
                    maxLength={10}
                    invalid={Boolean(err("givenName"))}
                    onChange={(e) => setEmpField("givenName", e.target.value)}
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                {/*
                  선택 입력이 아닙니다. 안 적으면 영문 명함(/c/[slug]/en)이 만들어지지
                  않습니다 — 예전처럼 한글 이름으로 채우지 않기 때문입니다.
                */}
                <Field label="영문명" htmlFor="nameEn" error={err("nameEn")}>
                  <Input
                    id="nameEn"
                    value={emp.nameEn}
                    maxLength={60}
                    placeholder="Gil-dong Hong"
                    invalid={Boolean(err("nameEn"))}
                    onChange={(e) => setEmpField("nameEn", e.target.value)}
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="직위" htmlFor="rankId" error={err("rankId")}>
                  <Select
                    id="rankId"
                    value={emp.rankId}
                    invalid={Boolean(err("rankId"))}
                    onChange={(e) => setEmpField("rankId", e.target.value)}
                  >
                    <option value="">없음</option>
                    {org.ranks.map((rank) => (
                      <option key={rank.id} value={rank.id}>
                        {rank.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {/* 임원만 갖는 칸입니다. 임원이 아니면 "없음" 그대로 둡니다. */}
                <Field
                  label="임원 직책 (선택)"
                  htmlFor="executiveTitleId"
                  error={err("executiveTitleId")}
                >
                  <Select
                    id="executiveTitleId"
                    value={emp.executiveTitleId}
                    invalid={Boolean(err("executiveTitleId"))}
                    onChange={(e) => setEmpField("executiveTitleId", e.target.value)}
                  >
                    <option value="">없음</option>
                    {org.executiveTitles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                {/* 직책은 직위와 별개입니다. 임원 직책과 함께 가질 수도 있습니다. */}
                <Field label="직책 (선택)" htmlFor="positionId" error={err("positionId")}>
                  <Select
                    id="positionId"
                    value={emp.positionId}
                    invalid={Boolean(err("positionId"))}
                    onChange={(e) => setEmpField("positionId", e.target.value)}
                  >
                    <option value="">없음</option>
                    {org.positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="팀 (선택)" htmlFor="teamId" error={err("teamId")}>
                  <Select
                    id="teamId"
                    value={emp.teamId}
                    invalid={Boolean(err("teamId"))}
                    // 팀을 바꾸면 파트를 비웁니다. 안 그러면 다른 팀의 파트가 남습니다.
                    onChange={(e) => {
                      const teamId = e.target.value;
                      setEmp((prev) => ({ ...prev, teamId, partId: "" }));
                    }}
                  >
                    <option value="">없음</option>
                    {org.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {/* 파트는 고른 팀의 것만 보여 줍니다. 팀을 안 골랐으면 고를 것도 없습니다. */}
                <Field label="파트 (선택)" htmlFor="partId" error={err("partId")}>
                  <Select
                    id="partId"
                    value={emp.partId}
                    disabled={parts.length === 0}
                    invalid={Boolean(err("partId"))}
                    onChange={(e) => setEmpField("partId", e.target.value)}
                  >
                    <option value="">없음</option>
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="자격 / 학위 (선택)" htmlFor="credential" error={err("credential")}>
                  <Input
                    id="credential"
                    placeholder="예: 공학박사"
                    value={emp.credential}
                    invalid={Boolean(err("credential"))}
                    onChange={(e) => setEmpField("credential", e.target.value)}
                  />
                </Field>
                {/*
                  영문 명함(/c/[slug]/en)에 나가는 값입니다. 비우면 영문 카드에서만
                  빠지고 국문 카드는 그대로입니다 — 한글을 대신 넣지 않습니다.
                */}
                <Field
                  label="자격 / 학위 영문 (선택)"
                  htmlFor="credentialEn"
                  error={err("credentialEn")}
                >
                  <Input
                    id="credentialEn"
                    placeholder="예: Ph.D."
                    value={emp.credentialEn}
                    invalid={Boolean(err("credentialEn"))}
                    onChange={(e) => setEmpField("credentialEn", e.target.value)}
                  />
                </Field>
              </FieldRow>

              {/*
                소개 한 줄. 카드의 이름·직함 아래에 나갑니다.

                자격 칸 다음에 두는 이유: 위쪽 칸들이 전부 "목록에서 고르는 값"
                인데 이건 직접 쓰는 값이라, 성격이 같은 자격 옆에 붙여 둡니다.
                80자로 묶인 건 명함이 한 줄로 읽히는 화면이기 때문입니다.
              */}
              <FieldRow>
                <Field
                  label="소개 한 줄 (선택)"
                  htmlFor="bio"
                  error={err("bio")}
                  hint="명함의 이름·직함 아래에 나옵니다. 80자까지."
                >
                  <Input
                    id="bio"
                    maxLength={80}
                    placeholder="예: 더 가볍고 강한 부품으로 미래를 만듭니다"
                    value={emp.bio}
                    invalid={Boolean(err("bio"))}
                    onChange={(e) => setEmpField("bio", e.target.value)}
                  />
                </Field>
                <Field
                  label="소개 한 줄 영문 (선택)"
                  htmlFor="bioEn"
                  error={err("bioEn")}
                  hint="비우면 영문 명함에서 이 줄이 빠집니다."
                >
                  <Input
                    id="bioEn"
                    maxLength={120}
                    placeholder="Lighter, stronger parts for what comes next"
                    value={emp.bioEn}
                    invalid={Boolean(err("bioEn"))}
                    onChange={(e) => setEmpField("bioEn", e.target.value)}
                  />
                </Field>
              </FieldRow>
            </div>
          </div>
        </section>

        {/* 02 연락처 --------------------------------------------------------- */}
        <section className="mt-block border-t border-border pt-block">
          <SectionHeader
            number="02"
            title="연락처"
            description="공개 프로필과 이메일 서명에 함께 표시됩니다."
          />

          <div className="flex flex-col gap-group">
            <FieldRow>
              <Field label="사무실 전화" htmlFor="telWork" error={err("telWork")}>
                <Input
                  id="telWork"
                  inputMode="tel"
                  value={emp.telWork}
                  invalid={Boolean(err("telWork"))}
                  onChange={(e) => setEmpField("telWork", formatPhone(e.target.value))}
                />
              </Field>
              <Field label="휴대전화" htmlFor="telMobile" error={err("telMobile")}>
                <Input
                  id="telMobile"
                  inputMode="tel"
                  value={emp.telMobile}
                  invalid={Boolean(err("telMobile"))}
                  onChange={(e) => setEmpField("telMobile", formatPhone(e.target.value))}
                />
              </Field>
            </FieldRow>

            {/*
              휴대폰 공개 여부. 번호를 적어도 이걸 켜지 않으면 어디에도 안 나갑니다 —
              명함·명함 이미지·이메일 서명·연락처 파일 네 곳이 전부 이 값을 봅니다.
              번호 칸 바로 아래에 두어야 "적었는데 왜 안 나오지" 가 생기지 않습니다.

              번호를 안 적었으면 켤 것이 없으므로 잠급니다. 켜 두고 번호를 지우면
              체크만 남아 공개 중인 것처럼 보입니다.
            */}
            <Checkbox
              id="mobilePublic"
              label="휴대전화를 명함에 공개"
              hint={
                emp.telMobile.trim()
                  ? "끄면 번호가 저장돼 있어도 명함·서명·연락처 파일 어디에도 나가지 않습니다."
                  : "휴대전화 번호를 먼저 입력해 주세요."
              }
              checked={emp.mobilePublic}
              disabled={!emp.telMobile.trim()}
              onChange={(checked) => setEmpFlag("mobilePublic", checked)}
            />

            <Field label="이메일" htmlFor="email" error={err("email")}>
              <Input
                id="email"
                type="email"
                value={emp.email}
                invalid={Boolean(err("email"))}
                onChange={(e) => setEmpField("email", e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* 03 회사 정보 ------------------------------------------------------ */}
        <section className="mt-block border-t border-border pt-block">
          {/*
            관리자에게는 전용 화면(/admin/company)을 알려 줍니다. 여기서도 고칠 수
            있지만, 회사 값을 바꾸러 "내 명함" 으로 들어와야 한다는 걸 아무도
            떠올리지 못합니다. 메뉴에 있는 자리를 알려 주는 게 이 문구의 일입니다.
          */}
          <SectionHeader
            number="03"
            title="회사 정보"
            description={
              isAdmin
                ? "관리자 메뉴의 회사 정보에서도 바꿀 수 있습니다."
                : "관리자만 수정할 수 있습니다."
            }
          />

          <CompanyFields
            values={co}
            error={(field) => err(`company.${field}`)}
            onChange={setCoField}
            disabled={!isAdmin}
            showOfficeHint={isAdmin}
          />
        </section>

        {/*
          저장 바 — 폼 하단 고정. 모바일에서는 안내 문구와 버튼이 한 줄에 들어가지
          않아 세로로 쌓고, 버튼을 화면 폭만큼 늘려 엄지로 누르기 쉽게 합니다.

          md 미만에서는 하단 탭바(h-14)가 화면 바닥을 차지하므로 그만큼 올려 붙입니다.
          bottom-0 으로 두면 저장 버튼이 탭바 뒤에 깔려 눌리지 않습니다.
        */}
        <div className="sticky bottom-14 mt-section border-t border-border bg-bg py-group sm:mt-block md:bottom-0">
          <div className="flex flex-col items-stretch gap-sibling sm:flex-row sm:items-center sm:justify-between sm:gap-group">
            <p className="text-caption text-sub-text">
              {saveError ?? (dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다.")}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="h-12 w-full shrink-0 rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text sm:w-auto"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </main>

      {/* 1280px 이상 — 우측 고정 미리보기 */}
      <aside className="hidden xl:block xl:w-[420px] xl:shrink-0">
        <div className="sticky top-block">{preview}</div>
      </aside>
    </div>
  );
}
