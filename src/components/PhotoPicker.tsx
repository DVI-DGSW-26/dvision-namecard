"use client";

import { useRef, useState } from "react";
import { UserIcon } from "@/components/icons";

/**
 * 프로필 사진 올리기·지우기.
 *
 * 폼의 저장 버튼과 따로 도는 이유: 사진은 파일이라 나머지 칸(JSON)과 같은 요청에
 * 실을 수 없고, 올리자마자 결과를 보여 줘야 잘린 모양을 확인할 수 있습니다.
 * 그래서 고르는 즉시 올리고, 성공하면 그 자리에서 새 사진으로 바꿉니다.
 *
 * 서버가 512px 정사각형 webp 로 잘라 저장합니다 — 여기서는 어떤 파일이든 그대로
 * 보냅니다. 브라우저에서 미리 줄이면 기기마다 결과가 달라집니다.
 */

type Props = {
  employeeId: string;
  /** 현재 사진 주소. 없으면 사람 아이콘을 그립니다. */
  photoUrl: string | null;
  onChange: (photoUrl: string | null) => void;
};

export function PhotoPicker({ employeeId, photoUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);

      const response = await fetch(`/api/employees/${employeeId}/photo`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.errors?.photo ?? payload?.error ?? "올리지 못했습니다.");
        return;
      }
      onChange(payload.photoUrl);
    } catch {
      setError("네트워크 오류로 올리지 못했습니다.");
    } finally {
      setBusy(false);
      // 같은 파일을 다시 고를 수 있게 비웁니다. 값이 남아 있으면 change 가 안 옵니다.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/employees/${employeeId}/photo`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "지우지 못했습니다.");
        return;
      }
      onChange(null);
    } catch {
      setError("네트워크 오류로 지우지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-tight">
      <span className="text-caption text-sub-text">프로필 사진</span>

      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-sub-bg">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 내주는 이미지라 next/image 의 최적화가 필요 없습니다.
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-10 w-10 text-sub-text" />
        )}
      </div>

      {/*
        input 을 숨기고 버튼으로 여는 이유: 파일 입력의 기본 모양은 브라우저마다
        다르고 이 화면의 다른 버튼과 전혀 다르게 생겼습니다.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
        }}
      />

      <div className="mt-sibling flex flex-wrap gap-tight">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-9 rounded-card border border-border px-group text-caption-bold text-text disabled:text-sub-text"
        >
          {busy ? "처리 중…" : photoUrl ? "변경" : "사진 올리기"}
        </button>
        {photoUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="h-9 rounded-card border border-border px-group text-caption text-sub-text disabled:text-sub-text"
          >
            지우기
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="max-w-24 text-caption text-text">
          {error}
        </p>
      ) : null}

      {/* 저장 버튼과 따로 도는 걸 알려 줍니다. 안 그러면 저장 전에 닫아도 되는지 모릅니다. */}
      <p className="text-caption text-sub-text">사진은 고르는 즉시 저장됩니다.</p>
    </div>
  );
}
