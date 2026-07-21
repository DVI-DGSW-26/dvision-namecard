/**
 * 서식이 유지되는 클립보드 복사.
 *
 * 이메일 서명은 반드시 text/html 로 복사해야 합니다. 평문으로 넣으면 메일 작성창에
 * `<table role="presentation"...` 이 글자 그대로 붙습니다.
 *
 * text/plain 을 함께 넣는 이유: 붙여넣는 곳이 서식을 못 받는 자리(메모장, 슬랙
 * 코드블록)일 때 클라이언트가 이쪽을 골라 씁니다. 두 벌을 같이 넣어야 어디에
 * 붙이든 말이 되는 결과가 나옵니다.
 */

export type CopyResult = "ok" | "unsupported" | "denied";

/**
 * HTML 과 평문을 한 번에 클립보드에 씁니다.
 *
 * navigator.clipboard.write 는 https 또는 localhost 에서만 동작하고, 사용자 제스처
 * 안에서 호출해야 합니다. 버튼 onClick 밖(예: setTimeout)에서 부르면 거부됩니다.
 */
export async function copyRichText(html: string, text: string): Promise<CopyResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return "unsupported";

  // ClipboardItem 이 없는 브라우저(구형 사파리 등)는 평문만이라도 넣습니다.
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    try {
      await navigator.clipboard.writeText(text);
      // 서식 없이 들어갔으므로 성공으로 보고하지 않습니다. 호출부가 안내를 띄웁니다.
      return "unsupported";
    } catch {
      return "denied";
    }
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return "ok";
  } catch {
    return "denied";
  }
}
