"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, FieldRow, Input, SectionHeader, Select } from "@/components/form";
import { ProfileCard, type ProfileCardData } from "@/components/ProfileCard";
import { ArrowRightIcon, ChevronDownIcon, UserIcon } from "@/components/icons";
import {
  RANKS,
  companyProfileSchema,
  employeeProfileSchema,
  fieldErrors,
  formatPhone,

} from "@/lib/validation";
import type { Company, Employee } from "@/types";

/**
 * 프로필 편집 폼 + 실시간 미리보기.
 *
 * 미리보기는 ProfileCard 를 그대로 씁니다. 공개 페이지(/c/[slug])와 같은 컴포넌트라
 * 여기서 카드 모양을 손보고 싶어지면 ProfileCard 를 고쳐야 합니다. 이 파일에
 * 카드 마크업을 새로 만들면 두 화면이 즉시 어긋납니다.
 */

/** 폼 state 는 전부 문자열입니다. 숫자 변환은 zod 스키마가 담당합니다. */
type EmployeeForm = {
  nameKo: string;
  nameEn: string;
  rank: string;
  position: string;
  credential: string;
  telWork: string;
  telMobile: string;
  email: string;
};

type CompanyForm = {
  nameKo: string;
  nameEn: string;
  industry: string;
  address: string;
  homepageUrl: string;
};

const str = (value: string | null | undefined) => value ?? "";

export function EditProfileForm({
  role,
  employee,
  company,
}: {
  role: "member" | "admin";
  employee: Employee;
  company: Company;
}) {
  const isAdmin = role === "admin";

  const initialEmployee = useMemo<EmployeeForm>(
    () => ({
      nameKo: employee.nameKo,
      nameEn: str(employee.nameEn),
      rank: employee.rank,
      position: str(employee.position),
      credential: str(employee.credential),
      telWork: str(employee.telWork),
      telMobile: str(employee.telMobile),
      email: employee.email,
    }),
    [employee],
  );

  const initialCompany = useMemo<CompanyForm>(
    () => ({
      nameKo: company.nameKo,
      nameEn: company.nameEn,
      industry: str(company.industry),
      address: company.address,
      homepageUrl: str(company.homepageUrl),
    }),
    [company],
  );

  const [emp, setEmp] = useState(initialEmployee);
  const [co, setCo] = useState(initialCompany);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // 회원은 회사 정보를 못 바꾸므로 dirty 판정에서도 제외합니다.
  const dirty =
    JSON.stringify(emp) !== JSON.stringify(initialEmployee) ||
    (isAdmin && JSON.stringify(co) !== JSON.stringify(initialCompany));

  const setEmpField = useCallback(
    (key: keyof EmployeeForm, value: string) => setEmp((prev) => ({ ...prev, [key]: value })),
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

  /* 미리보기 ---------------------------------------------------------------- */

  // 폼 state 를 카드 데이터로 변환합니다. debounce 없이 매 입력마다 다시 만듭니다.
  const previewData = useMemo<ProfileCardData>(
    () => ({
      nameKo: emp.nameKo,
      rank: emp.rank,
      position: emp.position,
      credential: emp.credential,
      photoUrl: employee.photoUrl,
      telWork: emp.telWork,
      telMobile: emp.telMobile,
      mobilePublic: employee.mobilePublic,
      email: emp.email,
      company: {
        nameKo: co.nameKo,
        nameEn: co.nameEn,
        industry: co.industry,
        tagline: company.tagline,
        certifications: Array.isArray(company.certifications)
          ? company.certifications.filter((c): c is string => typeof c === "string")
          : [],
      },
    }),
    [emp, co, employee.photoUrl, employee.mobilePublic, company.tagline, company.certifications],
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
        <ProfileCard data={previewData} />
      </div>
    </div>
  );

  /* 렌더 -------------------------------------------------------------------- */

  const err = (key: string) => errors[key];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-block px-section py-block xl:flex-row xl:items-start">
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
            <div className="flex flex-col gap-tight">
              <span className="text-caption text-sub-text">프로필 사진</span>
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-sub-bg">
                <UserIcon className="h-10 w-10 text-sub-text" />
              </div>
              {/* 업로드는 이번 범위 밖입니다. 클릭해도 아무 일도 일어나지 않습니다. */}
              <button
                type="button"
                className="mt-sibling h-9 rounded-card border border-border px-group text-caption-bold text-text"
              >
                변경
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-group">
              <FieldRow>
                <Field label="이름" htmlFor="nameKo" error={err("nameKo")}>
                  <Input
                    id="nameKo"
                    value={emp.nameKo}
                    maxLength={20}
                    invalid={Boolean(err("nameKo"))}
                    onChange={(e) => setEmpField("nameKo", e.target.value)}
                  />
                </Field>
                <Field label="영문명 (선택)" htmlFor="nameEn" error={err("nameEn")}>
                  <Input
                    id="nameEn"
                    value={emp.nameEn}
                    invalid={Boolean(err("nameEn"))}
                    onChange={(e) => setEmpField("nameEn", e.target.value)}
                  />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="직급" htmlFor="rank" error={err("rank")}>
                  <Select
                    id="rank"
                    value={emp.rank}
                    invalid={Boolean(err("rank"))}
                    onChange={(e) => setEmpField("rank", e.target.value)}
                  >
                    {RANKS.map((rank) => (
                      <option key={rank} value={rank}>
                        {rank}
                      </option>
                    ))}
                  </Select>
                </Field>
                {/* 직책은 직급과 별개입니다. 같은 부장이어도 팀장일 수도, 아닐 수도 있습니다. */}
                <Field label="직책 (선택)" htmlFor="position" error={err("position")}>
                  <Input
                    id="position"
                    placeholder="예: 기술영업팀장"
                    value={emp.position}
                    invalid={Boolean(err("position"))}
                    onChange={(e) => setEmpField("position", e.target.value)}
                  />
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
          <SectionHeader
            number="03"
            title="회사 정보"
            description={isAdmin ? undefined : "관리자만 수정할 수 있습니다."}
          />

          <fieldset disabled={!isAdmin} className="flex flex-col gap-group">
            <FieldRow>
              <Field label="회사명" htmlFor="co-nameKo" error={err("company.nameKo")}>
                <Input
                  id="co-nameKo"
                  value={co.nameKo}
                  invalid={Boolean(err("company.nameKo"))}
                  onChange={(e) => setCoField("nameKo", e.target.value)}
                />
              </Field>
              <Field label="영문명" htmlFor="co-nameEn" error={err("company.nameEn")}>
                <Input
                  id="co-nameEn"
                  value={co.nameEn}
                  invalid={Boolean(err("company.nameEn"))}
                  onChange={(e) => setCoField("nameEn", e.target.value)}
                />
              </Field>
            </FieldRow>

            <Field label="사업 분야 (선택)" htmlFor="co-industry" error={err("company.industry")}>
              <Input
                id="co-industry"
                value={co.industry}
                invalid={Boolean(err("company.industry"))}
                onChange={(e) => setCoField("industry", e.target.value)}
              />
            </Field>

            <Field label="주소" htmlFor="co-address" error={err("company.address")}>
              <Input
                id="co-address"
                value={co.address}
                invalid={Boolean(err("company.address"))}
                onChange={(e) => setCoField("address", e.target.value)}
              />
            </Field>

            <FieldRow>
              <Field label="홈페이지 (선택)" htmlFor="co-homepageUrl" error={err("company.homepageUrl")}>
                <Input
                  id="co-homepageUrl"
                  value={co.homepageUrl}
                  invalid={Boolean(err("company.homepageUrl"))}
                  onChange={(e) => setCoField("homepageUrl", e.target.value)}
                />
              </Field>
            </FieldRow>
          </fieldset>
        </section>

        {/* 저장 바 — 폼 하단 고정 */}
        <div className="sticky bottom-0 mt-block border-t border-border bg-bg py-group">
          <div className="flex items-center justify-between gap-group">
            <p className="text-caption text-sub-text">
              {saveError ?? (dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다.")}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="h-12 rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
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
