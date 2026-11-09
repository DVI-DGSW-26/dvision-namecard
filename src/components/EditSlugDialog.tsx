"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, Input } from "@/components/form";
import { employeeAdminSchema, fieldErrors } from "@/lib/validation";
import type { Status } from "@/types";

/**
 * 공개 주소(slug) 변경 모달.
 *
 * AddEmployeeDialog 와 같은 네이티브 <dialog> 방식입니다 — showModal() 이 포커스
 * 트랩·Esc 닫기·배경 비활성화를 전부 해 줍니다.
 *
 * 주소를 바꾸면 이전 주소로 나간 링크(메일 서명·카카오톡)는 전부 깨집니다.
 * 되돌릴 수 없는 변경이라 저장 버튼 위에 그 사실을 적어 둡니다.
 */

type Props = {
  /** null 이면 닫힌 상태입니다. 열 때 대상 직원을 통째로 넘깁니다. */
  target: {
    id: string;
    nameKo: string;
    slug: string;
    status: Status;
    role: "MEMBER" | "ADMIN";
  } | null;
  onClose: () => void;
  onSaved: () => void;
};

export function EditSlugDialog({ target, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[min(400px,calc(100vw-2rem))] rounded-2xl border border-edge bg-surface p-0 text-fg shadow-xl backdrop:bg-black/40"
    >
      {/* target 이 바뀌면 폼 상태를 새로 만들도록 key 를 답니다. */}
      {target ? <SlugForm key={target.id} target={target} onClose={onClose} onSaved={onSaved} /> : null}
    </dialog>
  );
}

function SlugForm({
  target,
  onClose,
  onSaved,
}: {
  target: NonNullable<Props["target"]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formId = useId();
  const [slug, setSlug] = useState(target.slug);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setErrors({});

    // 상태·권한은 바꾸지 않지만 스키마가 세 값을 함께 받으므로 현재 값을 그대로 실어 보냅니다.
    const payload = { slug, status: target.status, role: target.role };

    const parsed = employeeAdminSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/employees/${target.id}/admin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.errors) setErrors(body.errors);
        setSaveError(body?.error ?? (body?.errors ? null : "저장하지 못했습니다."));
        return;
      }
      onSaved();
      onClose();
    } catch {
      setSaveError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-section p-section">
      <div>
        <h2 className="text-xl font-semibold">공개 주소 변경</h2>
        <p className="mt-tight text-xs text-fg-muted">{target.nameKo}</p>
      </div>

      <Field
        label="주소"
        htmlFor={`${formId}-slug`}
        error={errors.slug}
        hint={`/c/${slug || "…"}`}
      >
        <Input
          id={`${formId}-slug`}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          invalid={Boolean(errors.slug)}
          autoComplete="off"
        />
      </Field>

      <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn-fg">
        주소를 바꾸면 이전 주소로 나간 링크는 전부 열리지 않습니다. 이미 보낸 메일 서명의
        명함 링크도 포함됩니다.
      </p>

      {saveError ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          {saveError}
        </p>
      ) : null}

      <div className="flex justify-end gap-sibling">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-md border border-line-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg px-4 text-sm font-semibold"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving || slug === target.slug}
          className="h-10 rounded-md bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-faint"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
