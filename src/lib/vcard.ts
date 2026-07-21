import type { Company, Employee } from "@/types";

/**
 * vCard 3.0 생성.
 *
 * 3.0 을 쓰는 이유: 아이폰·안드로이드 기본 연락처가 모두 안정적으로 읽습니다.
 * 줄바꿈은 반드시 CRLF 입니다 — LF 만 쓰면 일부 클라이언트가 파일을 통째로 거부합니다.
 */

/** 값 안의 특수문자 이스케이프. 역슬래시를 가장 먼저 처리해야 이중 이스케이프가 안 생깁니다. */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * 75옥텟 초과 줄을 접습니다(line folding).
 *
 * 기준이 글자 수가 아니라 바이트 수라, 한글(3바이트)이 섞이면 25자만 넘어도 접어야 합니다.
 * 멀티바이트 문자 중간에서 자르면 글자가 깨지므로 코드포인트 단위로 누적합니다.
 * 이어지는 줄은 반드시 공백 한 칸으로 시작해야 합니다.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  // 첫 줄은 75, 이어지는 줄은 앞에 붙는 공백 한 칸을 빼고 74 까지 담습니다.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += size;
  }
  if (current) chunks.push(current);

  return chunks.join("\r\n ");
}

/** 값이 있는 문자열만 남깁니다. 공백만 있는 값도 없는 것으로 취급합니다. */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (!url) {
    // 연락처에 localhost 링크가 저장되면 상대방 폰에 그대로 남습니다. 차라리 실패시킵니다.
    throw new Error("NEXT_PUBLIC_BASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  }
  return url.replace(/\/+$/, "");
}

export function buildVCard(employee: Employee, company: Company): string {
  // mobilePublic 이 false 면 번호가 있어도 내보내지 않습니다.
  const mobile = employee.mobilePublic ? present(employee.telMobile) : null;

  // 직급(대리·과장)과 직책(팀장·본부장)은 다른 값입니다. 둘 다 있으면 이어 붙입니다.
  const title = [present(employee.rank as string), present(employee.position)]
    .filter(Boolean)
    .join(" ");

  const lines: (string | null)[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",

    // N 은 성과 이름을 분리해야 연락처 앱이 정렬·검색을 제대로 합니다.
    // nameKo 를 쪼개면 두 글자 성(남궁·선우)에서 틀리므로 분리 저장된 컬럼만 씁니다.
    `N:${escapeValue(employee.familyName)};${escapeValue(employee.givenName)};;;`,
    `FN:${escapeValue(employee.nameKo)}`,

    `ORG:${escapeValue(company.nameKo)}`,
    title ? `TITLE:${escapeValue(title)}` : null,

    present(employee.telWork) ? `TEL;TYPE=WORK,VOICE:${escapeValue(employee.telWork!)}` : null,
    mobile ? `TEL;TYPE=CELL,VOICE:${escapeValue(mobile)}` : null,
    present(company.fax) ? `TEL;TYPE=WORK,FAX:${escapeValue(company.fax!)}` : null,

    `EMAIL;TYPE=INTERNET,WORK:${escapeValue(employee.email)}`,

    // ADR 은 7칸이 세미콜론으로 고정입니다. 한국 주소는 통째로 street 칸에 넣습니다.
    present(company.address) ? `ADR;TYPE=WORK:;;${escapeValue(company.address)};;;;` : null,

    `URL:${escapeValue(`${baseUrl()}/c/${employee.slug}`)}`,

    present(employee.credential) ? `NOTE:${escapeValue(employee.credential!)}` : null,

    "END:VCARD",
  ];

  return (
    lines
      .filter((line): line is string => line !== null)
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
