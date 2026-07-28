"use client";

import { useRef, useState } from "react";
import { UserIcon } from "@/components/icons";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/photo-limits";

/**
 * 프로필 사진 올리기·지우기.
 *
 * 폼의 저장 버튼과 따로 도는 이유: 사진은 파일이라 나머지 칸(JSON)과 같은 요청에
 * 실을 수 없고, 올리자마자 결과를 보여 줘야 잘린 모양을 확인할 수 있습니다.
 * 그래서 고르는 즉시 올리고, 성공하면 그 자리에서 새 사진으로 바꿉니다.
 *
 * 서버가 512px 정사각형 webp 로 잘라 저장합니다 — 자르기와 형식은 전부 서버가
 * 정합니다. 여기서 손대는 건 상한을 넘는 파일의 픽셀 수뿐입니다.
 */

/**
 * 브라우저에서 줄일 때 쓰는 한 변의 최대 길이.
 *
 * 서버가 어차피 512px 로 다시 자르므로 이보다 클 이유가 없고, 이만큼 남겨 두면
 * 나중에 더 큰 사진 자리가 생겨도 다시 올려받지 않아도 됩니다.
 */
const SHRINK_TO = 2048;

/**
 * 상한을 넘는 사진을 캔버스로 한 번 줄입니다. 못 줄이면 null.
 *
 * imageOrientation 을 주는 건 EXIF 회전 정보 때문입니다. 캔버스에 그린 그림에는
 * 그 표시가 남지 않아서, 여기서 적용하지 않으면 서버의 rotate() 가 되돌릴 것이
 * 없어 누운 얼굴이 그대로 저장됩니다.
 */
async function shrink(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, SHRINK_TO / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return null;

    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    // 브라우저가 못 여는 형식입니다. 부르는 쪽이 원본 그대로 두고 상한에 걸립니다.
    return null;
  }
}

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

  async function upload(picked: File) {
    setBusy(true);
    setError(null);
    try {
      /*
        상한을 넘는 파일만 브라우저에서 줄입니다. 폰 원본 사진은 대개 여기 걸리는데,
        그대로 보내면 배포(Vercel)에서 우리 코드가 돌기도 전에 413 이 나가고,
        그 응답은 JSON 이 아니라 화면에 이유가 남지 않습니다.
      */
      const file = picked.size > MAX_UPLOAD_BYTES ? ((await shrink(picked)) ?? picked) : picked;
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`사진이 너무 큽니다. ${MAX_UPLOAD_LABEL} 이하로 줄여서 올려 주세요.`);
        return;
      }

      const form = new FormData();
      form.append("photo", file);

      const response = await fetch(`/api/employees/${employeeId}/photo`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // 서버가 JSON 을 못 준 경우(413·라우트가 뜨지 못한 500)에는 상태 코드라도
        // 남깁니다. 이유 없는 "올리지 못했습니다" 만 뜨면 어디를 봐야 할지 알 수 없습니다.
        setError(
          payload?.errors?.photo ?? payload?.error ?? `올리지 못했습니다. (서버 응답 ${response.status})`,
        );
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
        /*
          HEIC 를 목록에 적지 않는 게 중요합니다. 적어 두면 아이폰이 원본 HEIC 를
          그대로 넘기는데 서버가 그걸 열지 못하고, 빼 두면 사파리가 고르는 순간
          JPEG 으로 바꿔서 줍니다. (lib/photo-limits.ts)
        */
        accept={ACCEPT_ATTRIBUTE}
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
