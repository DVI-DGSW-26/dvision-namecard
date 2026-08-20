"use client";

import { useState } from "react";
import { copyRichText } from "@/lib/clipboard";
import type { Lang } from "@/lib/lang";
import { markSignatureCopied } from "@/lib/signature-freshness";

/**
 * 서명 미리보기 + 복사 + 설치 안내.
 *
 * html 은 서버에서 renderSignature() 로 만든 문자열입니다. 사용자 입력은 그 안에서
 * 이미 이스케이프됐고(lib/signature.ts), 클라이언트가 다시 조립하지 않습니다.
 * 여기서 문자열을 이어 붙이기 시작하면 이스케이프 책임이 두 곳으로 쪼개집니다.
 *
 * 국문·영문은 서명이 통째로 다릅니다(가리키는 명함 이미지도 /c/[slug]/card.png 와
 * /c/[slug]/en/card.png 로 갈립니다). 그래서 한 벌을 받아 화면에서 바꿔치기하지
 * 않고, 서버가 만들어 둔 완성본을 언어 수만큼 받아 그중 하나를 복사합니다.
 */

export type SignatureVariant = {
  lang: Lang;
  html: string;
  text: string;
};

/**
 * 탭에 적는 말.
 *
 * lib/lang.ts 의 LANG_LABEL(한국어 · English)을 쓰지 않습니다. 저건 공개 카드에서
 * 각자 자기 언어로 적어 못 읽는 쪽이 안 생기게 하려는 이름이고, 여기는 직원만 보는
 * 한국어 화면입니다. "English 서명 복사" 보다 "영문 서명 복사" 가 읽힙니다.
 */
const TAB_LABEL: Record<Lang, string> = {
  ko: "국문",
  en: "영문",
};

/**
 * 메일 클라이언트별 설치 안내.
 *
 * settingsUrl 은 "설정 화면까지" 만 데려다줍니다. 서명 편집기 자체를 가리키는 깊은
 * 주소는 넣지 않았습니다 — Microsoft 가 서명 위치를 `메일 > 작성 및 회신` 에서
 * `계정 > 서명` 으로 옮긴 전례가 있고, 그런 주소는 바뀌어도 404 가 아니라 엉뚱한
 * 화면으로 조용히 데려갑니다. 그러면 안내가 틀렸다는 걸 아무도 모릅니다.
 *
 * 데스크톱 앱은 웹 주소로 열 방법이 없어 단계 안내만 둡니다.
 */
const GUIDES = [
  {
    // 사내 메일이 전부 Gmail 이라 맨 위에 두고 기본으로 펼칩니다. (openGuide 초기값과 맞춰야 함)
    id: "gmail",
    label: "Gmail",
    settingsUrl: "https://mail.google.com/mail/u/0/#settings/general",
    steps: [
      "위의 서명 복사 버튼을 먼저 누르세요.",
      "설정 열기 를 눌러 새 탭에서 Gmail 설정(기본설정)을 엽니다.",
      "아래로 스크롤해 서명 항목에서 새로 만들기 로 서명을 추가",
      "편집 영역을 클릭하고 붙여넣기 (Windows Ctrl+V · Mac ⌘+V)",
      "서명 기본값 에서 새 메일용 · 답장/전달용 서명을 각각 지정",
      "맨 아래 변경사항 저장 을 꼭 클릭 (이걸 안 누르면 저장되지 않습니다)",
    ],
    note: "휴대폰 Gmail 앱의 서명은 이것과 별개이고 서식 없는 글자만 됩니다. 색·링크가 살아 있는 이 서명은 PC(웹)에서 넣으세요.",
  },
  {
    id: "outlook",
    label: "Outlook (데스크톱 앱)",
    settingsUrl: null,
    steps: [
      "파일 → 옵션 → 메일 → 서명 클릭",
      "새로 만들기 로 서명을 하나 만들고 이름을 지정",
      "편집 영역에 붙여넣기 (Ctrl+V)",
      "새 메시지 / 회신 및 전달 에 방금 만든 서명을 지정",
    ],
    note: null,
  },
  {
    id: "outlook-web",
    label: "Outlook (웹)",
    settingsUrl: "https://outlook.office.com/mail/options/",
    steps: [
      "설정에서 계정 → 서명 으로 이동 (예전 버전은 메일 → 작성 및 회신)",
      "새 서명 을 만들고 편집 영역에 붙여넣기",
      "새 메시지용 / 회신 및 전달용 서명을 각각 지정 후 저장",
    ],
    note: null,
  },
  {
    id: "naver",
    label: "네이버 메일",
    settingsUrl: "https://mail.naver.com/",
    steps: [
      "환경설정 → 기본 설정 → 서명/이름 관리",
      "서명 사용 을 켜고 편집 영역에 붙여넣기",
      "확인 을 눌러 저장",
    ],
    note: null,
  },
] as const;

export function SignaturePanel({
  employeeId,
  /** 만들 수 있는 언어만 순서대로. 국문이 항상 첫 번째입니다(lib/lang.ts 의 LANGS). */
  variants,
}: {
  employeeId: string;
  variants: SignatureVariant[];
}) {
  const [status, setStatus] = useState<"idle" | "ok" | "plain" | "error">("idle");
  const [lang, setLang] = useState<Lang>(variants[0].lang);
  // 사내 메일이 전부 Gmail 이라 Gmail 안내를 기본으로 펼칩니다. (GUIDES 첫 항목과 맞춤)
  const [openGuide, setOpenGuide] = useState<string>("gmail");

  // 영문명을 지운 뒤 남아 있던 화면에서 en 이 선택돼 있을 수 있어 첫 번째로 떨어뜨립니다.
  const current = variants.find((variant) => variant.lang === lang) ?? variants[0];
  const multi = variants.length > 1;

  async function handleCopy() {
    const result = await copyRichText(current.html, current.text);
    setStatus(result === "ok" ? "ok" : result === "unsupported" ? "plain" : "error");

    /*
      서식까지 제대로 들어간 경우에만 "복사했다" 고 기록합니다.

      unsupported 는 평문만 들어간 것이라 서명으로 못 씁니다. 여기서 기록해 버리면
      낡음 배너가 사라져서, 정작 서명이 깨진 사람에게 아무도 다시 하라고 말하지
      않게 됩니다. (lib/signature-freshness.ts)

      국문·영문 중 어느 쪽을 복사해도 같은 자리에 기록합니다. 언어별로 나눠 세면
      한쪽만 쓰는 사람(대부분입니다)이 평생 안 쓸 언어 때문에 배너를 달고 다닙니다.
      대신 둘 다 넣어 둔 사람은 한쪽만 바꾸고 넘어갈 수 있어, 아래 안내로 짚습니다.
    */
    if (result === "ok") markSignatureCopied(employeeId);
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
          {/* 이 화면의 목적이 복사 하나라, 좁은 화면에서는 폭을 다 씁니다. */}
          <button
            type="button"
            onClick={handleCopy}
            className="h-12 w-full rounded-card bg-primary px-block text-body-bold text-white transition-colors hover:bg-primary-hover sm:w-auto"
          >
            {multi ? `${TAB_LABEL[current.lang]} 서명 복사` : "서명 복사"}
          </button>
        </div>

        {/*
          고를 게 하나뿐이면 탭을 안 그립니다 — 안 눌리는 버튼 하나만 남는 것보다
          왜 영문이 없는지 알려 주는 편이 낫습니다. 공개 카드의 언어 토글과 같은 규칙입니다.

          role="tablist" 대신 눌림 상태(aria-pressed)를 쓰는 버튼입니다. 탭 역할을
          제대로 쓰려면 좌우 화살표 이동까지 붙여야 하는데, 여기서 바뀌는 건 아래
          미리보기와 복사 대상 하나뿐이라 그만한 장치가 필요 없습니다.
        */}
        {multi ? (
          <div role="group" aria-label="서명 언어" className="mt-section flex flex-wrap gap-tight">
            {variants.map((variant) => {
              const active = variant.lang === current.lang;
              return (
                <button
                  key={variant.lang}
                  type="button"
                  // 언어를 바꾸면 "복사했습니다" 는 방금 고른 서명 이야기가 아닙니다.
                  onClick={() => {
                    setLang(variant.lang);
                    setStatus("idle");
                  }}
                  aria-pressed={active}
                  // 활성 표시는 색이 아니라 굵기와 테두리로 냅니다. primary 예산은 복사 버튼 몫입니다.
                  className={[
                    "rounded-card border px-group py-tight text-caption transition-colors",
                    active
                      ? "border-text text-caption-bold text-text"
                      : "border-border text-sub-text hover:text-text",
                  ].join(" ")}
                >
                  {TAB_LABEL[variant.lang]} 서명
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-section text-caption text-sub-text">
            프로필 편집에서 영문명을 채우면 영문 서명 탭이 생깁니다.
          </p>
        )}

        <p className="mt-group text-caption text-sub-text">{message}</p>

        {/*
          서버가 만든 서명 HTML 을 그대로 렌더합니다. 이 문자열은 renderSignature() 가
          이스케이프까지 끝낸 결과라 여기서 추가 처리하지 않습니다.

          바깥에 흰 배경과 테두리를 두는 건 미리보기 장식일 뿐입니다. 복사되는 것은
          div 안쪽 문자열이지 이 테두리가 아닙니다.
        */}
        <div className="mt-section overflow-x-auto rounded-card border border-border bg-bg p-group sm:p-section">
          <div dangerouslySetInnerHTML={{ __html: current.html }} />
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
                  <div className="border-t border-border px-group py-section sm:px-block">
                    {/*
                      복사 → 설정 열기 순서로 눌러야 합니다. 설정은 새 탭에서 열리므로
                      클립보드 내용은 그대로 유지됩니다.
                    */}
                    {guide.settingsUrl ? (
                      <a
                        href={guide.settingsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-1 mb-2 rounded-card border border-black px-group py-sibling text-caption-bold text-primary hover:border-text"
                      >
                        설정 열기 (새 탭) →
                      </a>
                    ) : null}
                    <ol className="flex mt-3 list-decimal flex-col gap-sibling pl-group text-body text-sub-text">
                      {guide.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {guide.note ? (
                      <p className="mt-section text-caption text-sub-text">{guide.note}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {multi ? (
          <p className="mt-section text-caption text-sub-text">
            국문과 영문을 둘 다 쓰시려면 메일 프로그램에서 서명을 두 개 만들고, 위 탭을
            바꿔 가며 각각 복사해 붙여넣으세요. 프로필을 고친 뒤에는 두 개 다 교체해야
            합니다.
          </p>
        ) : null}

        <p className="mt-section text-caption text-sub-text">
          회신·전달할 때도 서명이 유지되는지 한 번 확인해 보세요. 메일 클라이언트가 서식을
          지우는 경우가 가장 많이 발견되는 지점입니다.
        </p>
      </section>
    </div>
  );
}
