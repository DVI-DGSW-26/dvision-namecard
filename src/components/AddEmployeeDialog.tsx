"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, Input, Select } from "@/components/form";
import { EMPTY_ORG_LISTS, type OrgLists } from "@/lib/org";
import { baseSlug } from "@/lib/slug";
import { employeeCreateSchema, fieldErrors } from "@/lib/validation";

/**
 * 직원 추가 모달.
 *
 * 네이티브 <dialog> 를 씁니다. showModal() 이 포커스 트랩·Esc 닫기·배경 비활성화를
 * 전부 해주기 때문에, 직접 만든 오버레이보다 접근성 결함이 생길 여지가 적습니다.
 *
 * 새 직원은 서버가 PENDING(초대중)으로 만듭니다. 여기서는 관리자가 아는 값
 * (성·이름·이메일·직위·부서)만 받고, 나머지는 본인이 /edit 에서 채웁니다.
 * 직책은 서버가 '팀원' 으로 넣습니다.
 */

const EMPTY = {
  familyName: "",
  givenName: "",
  email: "",
  rankId: "",
  teamId: "",
  partId: "",
  slug: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** 저장에 성공하면 호출합니다. 목록을 다시 불러오는 용도입니다. */
  onCreated: () => void;
};

export function AddEmployeeDialog({ open, onClose, onCreated }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // open prop 을 실제 dialog 상태와 맞춥니다. showModal/close 는 DOM 조작이라
  // effect 가 제자리입니다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      // Esc 로 닫아도 부모 state 가 따라오도록 네이티브 close 를 그대로 전달합니다.
      onClose={onClose}
      // p-0 은 브라우저 기본 dialog 여백 제거용입니다. 실제 여백은 안쪽 form 의 p-section.
      // backdrop 은 토큰 정의서의 Shape·Effect 절이 잘려 있어 임시값입니다.
      className="w-[min(560px,calc(100vw-2rem))] rounded-card border border-border bg-bg p-0 text-text backdrop:bg-text/40"
    >
      {/* 닫히면 언마운트되므로 다음에 열 때 입력값·에러가 저절로 비워집니다. */}
      {open ? (
        <AddEmployeeForm onClose={onClose} onCreated={onCreated} />
      ) : null}
    </dialog>
  );
}

function AddEmployeeForm({ onClose, onCreated }: Omit<Props, "open">) {
  const formId = useId();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /*
    직위·부서 선택지는 열릴 때 받아 옵니다. 관리자가 조직 관리에서 방금 바꾼
    목록이 바로 반영되어야 해서, 부모가 들고 있는 값을 넘겨받지 않습니다.
  */
  const [org, setOrg] = useState<OrgLists>(EMPTY_ORG_LISTS);
  useEffect(() => {
    let alive = true;
    fetch("/api/org")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data) setOrg(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const parts = org.teams.find((team) => team.id === values.teamId)?.parts ?? [];

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  // 성을 입력하는 즉시 자동 생성될 주소를 보여줍니다. 서버가 최종 결정하며,
  // 이미 쓰는 주소면 뒤에 숫자가 붙을 수 있습니다.
  const autoSlug = values.familyName.trim()
    ? baseSlug({ familyName: values.familyName, givenName: values.givenName })
    : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setErrors({});

    // 클라이언트에서 먼저 걸러 주지만, 서버도 같은 스키마로 다시 검증합니다.
    const parsed = employeeCreateSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.errors) setErrors(payload.errors);
        // 필드 에러만 온 경우엔 각 칸 아래에 이미 표시되므로 상단 문구를 비워 둡니다.
        setSaveError(payload?.error ?? (payload?.errors ? null : "저장하지 못했습니다."));
        return;
      }

      onCreated();
      onClose();
    } catch {
      setSaveError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby={`${formId}-title`}
      className="flex flex-col gap-section p-section"
    >
      <div>
        <h2 id={`${formId}-title`} className="text-title">
          직원 추가
        </h2>
        <p className="mt-tight text-caption text-sub-text">
          초대중 상태로 등록됩니다. 나머지 정보는 본인이 내 명함에서 채웁니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-group sm:grid-cols-2">
        <Field label="성" htmlFor={`${formId}-family`} error={errors.familyName}>
          <Input
            id={`${formId}-family`}
            value={values.familyName}
            onChange={(event) => set("familyName")(event.target.value)}
            invalid={Boolean(errors.familyName)}
            autoComplete="off"
          />
        </Field>
        <Field label="이름" htmlFor={`${formId}-given`} error={errors.givenName}>
          <Input
            id={`${formId}-given`}
            value={values.givenName}
            onChange={(event) => set("givenName")(event.target.value)}
            invalid={Boolean(errors.givenName)}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field label="이메일" htmlFor={`${formId}-email`} error={errors.email}>
        <Input
          id={`${formId}-email`}
          type="email"
          value={values.email}
          onChange={(event) => set("email")(event.target.value)}
          invalid={Boolean(errors.email)}
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-1 gap-group sm:grid-cols-2">
        <Field label="직위" htmlFor={`${formId}-rank`} error={errors.rankId}>
          <Select
            id={`${formId}-rank`}
            value={values.rankId}
            onChange={(event) => set("rankId")(event.target.value)}
            invalid={Boolean(errors.rankId)}
          >
            <option value="">없음</option>
            {org.ranks.map((rank) => (
              <option key={rank.id} value={rank.id}>
                {rank.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="팀" htmlFor={`${formId}-team`} error={errors.teamId}>
          <Select
            id={`${formId}-team`}
            value={values.teamId}
            // 팀을 바꾸면 파트를 비웁니다. 안 그러면 다른 팀의 파트가 남습니다.
            onChange={(event) =>
              setValues((previous) => ({ ...previous, teamId: event.target.value, partId: "" }))
            }
            invalid={Boolean(errors.teamId)}
          >
            <option value="">없음</option>
            {org.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="파트" htmlFor={`${formId}-part`} error={errors.partId}>
        <Select
          id={`${formId}-part`}
          value={values.partId}
          disabled={parts.length === 0}
          onChange={(event) => set("partId")(event.target.value)}
          invalid={Boolean(errors.partId)}
        >
          <option value="">없음</option>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="공개 주소"
        htmlFor={`${formId}-slug`}
        error={errors.slug}
        hint={
          values.slug
            ? `/c/${values.slug}`
            : autoSlug
              ? `비워 두면 /c/${autoSlug} 로 만듭니다.`
              : "성에서 자동으로 만들 수 없으면 직접 입력해 주세요."
        }
      >
        <Input
          id={`${formId}-slug`}
          value={values.slug}
          onChange={(event) => set("slug")(event.target.value)}
          invalid={Boolean(errors.slug)}
          placeholder={autoSlug ?? "영문 소문자와 숫자"}
          autoComplete="off"
        />
      </Field>

      {/* 에러도 색이 아니라 문구로 알립니다. 빨강을 추가하면 팔레트가 늘어납니다. */}
      {saveError ? (
        <p
          role="alert"
          className="rounded-card bg-sub-bg px-group py-sibling text-caption text-text"
        >
          {saveError}
        </p>
      ) : null}

      <div className="flex justify-end gap-sibling">
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-card border border-border px-group text-body transition-colors hover:border-text"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-12 rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover disabled:bg-sub-bg disabled:text-sub-text"
        >
          {saving ? "추가하는 중…" : "추가"}
        </button>
      </div>
    </form>
  );
}
