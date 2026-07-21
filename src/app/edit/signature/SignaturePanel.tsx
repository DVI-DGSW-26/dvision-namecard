"use client";

import { useState } from "react";
import { copyRichText } from "@/lib/clipboard";

/**
 * 서명 미리보기 + 복사 + 설치 안내.
 *
 * html 은 서버에서 renderSignature() 로 만든 문자열입니다. 사용자 입력은 그 안에서
 * 이미 이스케이프됐고(lib/signature.ts), 클라이언트가 다시 조립하지 않습니다.
 * 여기서 문자열을 이어 붙이기 시작하면 이스케이프 책임이 두 곳으로 쪼개집니다.
 */

const GUIDES = [
  {
    id: "outlook",
    label: "Outlook (데스크톱)",
    steps: [
      "파일 → 옵션 → 메일 → 서명 클릭",
      "새로 만들기 로 서명을 하나 만들고 이름을 지정",
      "편집 영역에 붙여넣기 (Ctrl+V)",
      "새 메시지 / 회신 및 전달 에 방금 만든 서명을 지정",
    ],
  },
  {
    id: "outlook-web",
    label: "Outlook (웹)",
    steps: [
      "설정(톱니) → 메일 → 작성 및 회신",
      "전자 메일 서명 편집기에 붙여넣기",
      "새 메시지용 / 회신 및 전달용 서명을 각각 선택 후 저장",
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    steps: [
      "설정(톱니) → 모든 설정 보기 → 기본설정 탭",
      "서명 항목에서 새로 만들기",
      "편집 영역에 붙여넣기 (Ctrl+V)",
      "아래 서명 기본값 에서 새 메일 / 답장에 각각 지정 후 맨 아래 변경사항 저장",
    ],
  },
  {
    id: "naver",
    label: "네이버 메일",
    steps: [
      "환경설정 → 기본 설정 → 서명/이름 관리",
      "서명 사용 을 켜고 편집 영역에 붙여넣기",
      "확인 을 눌러 저장",
    ],
  },
] as const;

export function SignaturePanel({ html, text }: { html: string; text: string }) {
  const [status, setStatus] = useState<"idle" | "ok" | "plain" | "error">("idle");
  const [openGuide, setOpenGuide] = useState<string>("outlook");

  async function handleCopy() {
    const result = await copyRichText(html, text);
    setStatus(result === "ok" ? "ok" : result === "unsupported" ? "plain" : "error");
  }

  const message = {
    idle: "복사한 뒤 메일 설정의 서명 편집기에 붙여넣으세요.",
    ok: "복사했습니다. 메일 설정의 서명 편집기에 붙여넣으세요.",
    plain: "이 브라우저는 서식 복사를 지원하지 않아 텍스트만 복사했습니다. Chrome 이나 Edge 를 쓰면 서식이 유지됩니다.",
    error: "복사하지 못했습니다. 아래 미리보기를 직접 드래그해 복사하세요.",
  }[status];

  return (
    <div className="flex flex-col gap-block">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-group">
          <div>
            <h2 className="text-title">미리보기</h2>
            <p className="mt-tight text-caption text-sub-text">
              실제 메일에 붙는 모습입니다. 값을 바꾸려면 프로필 편집에서 수정하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="h-12 rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover"
          >
            서명 복사
          </button>
        </div>

        <p className="mt-group text-caption text-sub-text">{message}</p>

        {/*
          서버가 만든 서명 HTML 을 그대로 렌더합니다. 이 문자열은 renderSignature() 가
          이스케이프까지 끝낸 결과라 여기서 추가 처리하지 않습니다.

          바깥에 흰 배경과 테두리를 두는 건 미리보기 장식일 뿐입니다. 복사되는 것은
          div 안쪽 문자열이지 이 테두리가 아닙니다.
        */}
        <div className="mt-section overflow-x-auto rounded-card border border-border bg-bg p-section">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>

      <section className="border-t border-border pt-block">
        <h2 className="text-title">설치 방법</h2>
        <p className="mt-tight text-caption text-sub-text">
          쓰시는 메일 프로그램을 골라 따라 하세요.
        </p>

        <div className="mt-section flex flex-col gap-sibling">
          {GUIDES.map((guide) => {
            const open = openGuide === guide.id;
            return (
              <div key={guide.id} className="rounded-card border border-border">
                <button
                  type="button"
                  onClick={() => setOpenGuide(open ? "" : guide.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between px-group py-group text-left text-body-bold"
                >
                  {guide.label}
                  <span className="text-caption text-sub-text">{open ? "닫기" : "열기"}</span>
                </button>
                {open ? (
                  <ol className="flex list-decimal flex-col gap-sibling border-t border-border px-block py-section pl-block text-body text-sub-text">
                    {guide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-section text-caption text-sub-text">
          회신·전달할 때도 서명이 유지되는지 한 번 확인해 보세요. 메일 클라이언트가 서식을
          지우는 경우가 가장 많이 발견되는 지점입니다.
        </p>
      </section>
    </div>
  );
}
