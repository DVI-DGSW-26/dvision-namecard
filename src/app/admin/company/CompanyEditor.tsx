"use client";

import { useCallback, useMemo, useState } from "react";
import { CompanyFields, certLine, type CompanyFormValues } from "@/components/CompanyFields";
import { companyProfileSchema, fieldErrors } from "@/lib/validation";
import type { CompanyWithOffices } from "@/types";

/**
 * 회사 정보 편집. (admin 전용 — 페이지와 middleware 가 이미 막습니다)
 *
 * /edit 의 회사 정보 섹션과 같은 칸(CompanyFields)을 씁니다. 다른 건 저장 범위뿐이라
 * — 저기는 직원 정보와 함께, 여기는 회사만 — 칸 자체를 다시 만들지 않습니다.
 *
 * 이 화면이 따로 있는 이유: 회사 값은 관리자만 바꾸는데 편집 칸이 "내 명함" 안쪽에만
 * 있어서, 관리자가 /admin 아래를 아무리 뒤져도 찾지 못했습니다. 값 하나 채우는 일로
 * 개발자를 부르게 되면 그 기능은 없는 것과 같습니다.
 */

const str = (value: string | null | undefined) => value ?? "";

export function CompanyEditor({ company }: { company: CompanyWithOffices }) {
  const initial = useMemo<CompanyFormValues>(
    () => ({
      nameKo: company.nameKo,
      nameEn: company.nameEn,
      industry: str(company.industry),
      tagline: str(company.tagline),
      industryEn: str(company.industryEn),
      taglineEn: str(company.taglineEn),
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

  const [values, setValues] = useState<CompanyFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const onChange = useCallback((field: keyof CompanyFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // 고치는 중에 빨간 줄이 남아 있으면 뭘 고쳐야 하는지 헷갈립니다.
    setMessage(null);
  }, []);

  async function handleSave() {
    const parsed = companyProfileSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setMessage("입력값을 확인해 주세요.");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        // 서버 검증이 클라이언트보다 엄격할 수 있습니다. 그때도 칸마다 표시합니다.
        if (body?.errors) setErrors(body.errors);
        setMessage(body?.error ?? "저장하지 못했습니다.");
        return;
      }

      setMessage("저장했습니다. 전 직원 명함에 반영됩니다.");
      // 저장된 값이 곧 기준값이 되도록 새로 그립니다 — 서버가 정규화한 값
      // (전화번호 형식 등)까지 반영하려면 다시 읽는 편이 정확합니다.
      window.location.reload();
    } catch {
      setMessage("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/*
        SectionHeader 는 번호가 붙는 폼 내부 섹션용이라 여기서는 쓰지 않습니다.
        단독 화면이므로 이메일 서명 페이지와 같은 머리말 형식을 씁니다.
      */}
      <header>
        <p className="text-caption text-sub-text">관리자</p>
        <h1 className="mt-tight text-display">회사 정보</h1>
        <p className="mt-sibling text-body text-sub-text">
          여기서 바꾼 값은 전 직원의 명함·이메일 서명에 함께 반영됩니다.
        </p>
      </header>

      <div className="mt-block">
        <CompanyFields
          values={values}
          error={(field) => errors[field]}
          onChange={onChange}
          showOfficeHint
        />
      </div>

      {/* 저장 바 — /edit 과 같은 자리, 같은 동작. 하단 탭바에 가리지 않게 올려 붙입니다. */}
      <div className="sticky bottom-14 mt-section border-t border-border bg-bg py-group sm:mt-block md:bottom-0">
        <div className="flex flex-col items-stretch gap-sibling sm:flex-row sm:items-center sm:justify-between sm:gap-group">
          <p className="text-caption text-sub-text">
            {message ?? (dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다.")}
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
    </>
  );
}
