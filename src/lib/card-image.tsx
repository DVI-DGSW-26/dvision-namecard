import { unstable_cache } from "next/cache";
import { ImageResponse } from "next/og";
import { CARDS_TAG, cardTag } from "@/lib/card-cache";
import { cardName, type Lang } from "@/lib/lang";
import { departmentText, officeLine, roleParts } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { companyOfficesInclude, employeeOrgInclude } from "@/types";

/**
 * 명함을 PNG 한 장으로 렌더합니다. 이메일 서명이 이 이미지를 그대로 씁니다.
 *
 * 모양은 인쇄 명함 최종 시안(가로형)을 그대로 옮긴 것입니다. 종이와 화면이 서로 다른
 * 명함이면 같은 사람의 명함이 두 벌이 됩니다 — 값만 DB 에서 오고 배치는 시안이 정합니다.
 *
 * 왜 이미지인가: 이름의 넓은 자간, 좌우 두 단 격자, 로고 잠금 위치를 메일 클라이언트
 * (특히 Gmail·Outlook)에서 HTML 로 재현할 수 없습니다. 카드 전체를 서버에서 구우면
 * 어디서 열어도 인쇄물과 같은 한 장이 나옵니다.
 * (대신 이미지라 글자·링크는 눌리지 않습니다. 서명 HTML 이 이미지 전체를 명함 링크로 감쌉니다.)
 *
 * next/og(Satori)는 flexbox 하위 집합만 지원합니다. grid·gap 없이 flex 로만 짜세요.
 * prisma·폰트 fetch 때문에 Node 런타임이어야 합니다 — 라우트에서 runtime 을 지정합니다.
 *
 * 국문·영문 라우트가 이 파일 하나를 함께 씁니다. 언어별로 파일을 나누면 레이아웃을
 * 한쪽만 고치는 순간 같은 명함이 두 모양이 됩니다.
 */

/**
 * 캔버스 — 인쇄 명함과 같은 9:5(90x50mm) 입니다.
 *
 * 서명 HTML 은 이 이미지를 400px 로 줄여서 답니다(signature.ts 의 CARD_DISPLAY_WIDTH).
 * 표시 폭 그대로 구우면 고해상도 화면에서 글자가 뭉개지므로 2.25배로 굽고 줄입니다.
 * 좌표는 전부 이 캔버스 기준입니다.
 *
 * 글자 크기를 정할 때는 0.44 를 곱해 보세요 — 그게 서명에서 실제로 읽히는 크기입니다.
 * 인쇄 시안의 글자 크기를 그대로 옮기면 안 됩니다. 종이는 300dpi 라 작은 글자가 읽히지만
 * 400px 로 줄어든 화면에서는 시안 20px 짜리 주소가 8.9px 이 되어 안 읽힙니다.
 * 배치는 시안을 따르되 글자 크기는 이 0.44 를 통과하는 값으로 둡니다.
 */
const W = 900;
const H = 500;

const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/packages/pretendard/dist/public/static";

/**
 * 폰트는 한 프로세스에 한 번만 받습니다.
 *
 * 예전에는 요청마다 jsdelivr 에서 otf 두 개를 새로 받았습니다. 캐시가 걸린 지금은
 * 미스일 때만 도는 자리지만, 그래도 사람마다 다시 받을 이유가 없습니다.
 * 실패한 약속을 그대로 들고 있으면 그 프로세스가 영영 폰트를 못 받으므로,
 * 실패하면 비워서 다음 요청이 다시 시도하게 합니다.
 */
let fonts: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;

function loadFonts(): Promise<[ArrayBuffer, ArrayBuffer]> {
  fonts ??= Promise.all([
    fetch(`${PRETENDARD}/Pretendard-Regular.otf`).then((r) => r.arrayBuffer()),
    fetch(`${PRETENDARD}/Pretendard-SemiBold.otf`).then((r) => r.arrayBuffer()),
  ]).catch((error) => {
    fonts = null;
    throw error;
  }) as Promise<[ArrayBuffer, ArrayBuffer]>;

  return fonts;
}

/** brandColor 검증. 형식이 깨졌으면 기본 브랜드색. (signature.ts 의 safeColor 와 같은 규칙) */
function safeColor(value: string | null | undefined): string {
  if (value && /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) return value;
  return "#931B82";
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Json 컬럼(인증 목록) → 문자열 배열. ProfileCard 의 stringList 와 같은 규칙입니다.
 *
 * Json 이라 타입이 보장되지 않습니다(직접 UPDATE 한 값, 예전 형식). 카드는 문자열만
 * 그리므로 여기서 좁힙니다.
 */
function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

/**
 * 넘치는 줄 줄이기.
 *
 * satori 에는 "칸에 맞춰 글자 줄이기" 가 없고, 넘친 글자는 잘리지도 않고 카드 밖으로
 * 그냥 나갑니다. 값은 전부 본인이 /edit 에서 적는 것이라 길이를 정할 수 없습니다 —
 * 직위·임원 직책·직책·부서를 다 가진 사람, 긴 영문 주소, 긴 메일 주소가 그렇습니다.
 *
 * 그래서 폭을 어림해서 크기를 미리 낮춥니다. 한글 한 글자는 약 1em, 나머지는 약
 * 0.55em 으로 봅니다. 정확한 값은 폰트만 아는 것이라 넉넉하게 잡습니다.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function widthEm(text: string): number {
  return [...text].reduce((width, ch) => width + (HANGUL.test(ch) ? 1 : 0.55), 0);
}

/** em 폭이 max 픽셀에 들어가는 글자 크기. base 보다 키우지는 않습니다. */
function fitSize(em: number, max: number, base: number, min: number): number {
  if (em <= 0) return base;
  return Math.max(min, Math.min(base, Math.floor(max / em)));
}

/** 여러 줄이 같은 크기로 서야 하는 블록(연락처 한 단, 주소)의 크기. */
function fitLines(lines: string[], max: number, base: number, min: number): number {
  return fitSize(Math.max(0, ...lines.map(widthEm)), max, base, min);
}

/** 역할 줄 — 조각 사이 세로 막대 한 개가 대략 1.05em(막대 + 좌우 여백)입니다. */
function roleSize(parts: string[], base: number): number {
  const em = parts.reduce((sum, part) => sum + widthEm(part), 0) + (parts.length - 1) * 1.05;
  // 오른쪽 단이 쓸 수 있는 폭 — 단 시작(486)부터 오른쪽 여백(860)까지.
  return fitSize(em, 374, base, 17);
}

/**
 * 역할 줄 — 조각 사이에 세로 막대를 세웁니다. ("팀장 | 기술지원")
 *
 * `parts.join(" | ")` 로 끝내지 않는 이유: satori 는 연속 공백을 접기 때문에
 * 시안만큼 막대 좌우를 벌릴 수 없습니다. 막대를 따로 그리고 margin 을 줍니다.
 */
function RoleLine({ parts, size, color }: { parts: string[]; size: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, color }}>
      {parts.map((part, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center" }}>
          {index > 0 ? <div style={{ display: "flex", margin: "0 11px" }}>|</div> : null}
          <div style={{ display: "flex" }}>{part}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * PNG 를 구워 base64 로 돌려줍니다. 퇴사자·없는 slug 는 null 입니다.
 *
 * unstable_cache 는 JSON 으로 저장하므로 ArrayBuffer 를 그대로 담을 수 없습니다.
 * base64 로 바꿔서 넣고 꺼낼 때 되돌립니다. (600x340 PNG 라 수십 KB 수준입니다)
 *
 * notFound() 를 여기서 부르지 않는 이유: 캐시 안에서 던지면 "없음" 이라는 결과가
 * 예외로 저장돼 다음 요청에서 되살아납니다. 없음은 null 로 돌려주고 판단은 밖에서 합니다.
 */
async function renderCard(slug: string, lang: Lang): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { slug },
    include: { company: { include: companyOfficesInclude }, ...employeeOrgInclude },
    // 관계마다 SELECT 를 따로 보내지 않고 한 번에 조인합니다. (schema.prisma 의 relationJoins)
    relationLoadStrategy: "join",
  });
  if (!employee || employee.status === "RESIGNED") return null;

  const { company } = employee;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";
  const en = lang === "en";

  const brand = safeColor(company.brandColor);
  const INK = "#212121";

  /*
    이름 자리.

    영문 카드는 영문명을 이름 자리에 올립니다. 영문명이 없으면 이미지를 굽지
    않습니다(null → 라우트가 404). 한글 이름으로 떨어뜨리면 영문 명함 한가운데
    한글이 박히고, 그 이미지가 이메일 서명에 붙어 그대로 나갑니다.

    국문 카드는 한글 이름 아래 영문명을 보조 줄로 답니다. 영문 카드에서는 위에서
    이미 영문명을 올렸으므로 같은 값을 두 번 찍지 않도록 비웁니다.
  */
  const name = cardName(employee, lang);
  if (!name) return null;
  const subName = en ? null : present(employee.nameEn);

  /*
    역할 줄 — "팀장 | 기술지원".

    직위·임원 직책·직책에 부서를 이어 붙입니다. 시안이 직함과 소속을 한 줄에
    나란히 두고 있어서, 부서를 빼면 오른쪽 단이 반쪽이 됩니다.

    국문 카드는 국문 줄 아래에 영문 줄을 함께 답니다(시안이 두 줄입니다). 영문
    표기를 안 채운 조각은 그 조각만 빠지고, 전부 비면 영문 줄이 통째로 빠집니다.
  */
  const roleLine = (target: Lang) =>
    [
      ...roleParts(employee, target),
      departmentText(employee, target),
      present(target === "en" ? employee.credentialEn : employee.credential),
    ].filter(Boolean) as string[];

  const role = roleLine(lang);
  const roleSub = en ? [] : roleLine("en");

  const tel = present(employee.telWork) ?? present(company.tel);
  const mobile = employee.mobilePublic ? present(employee.telMobile) : null;
  const fax = present(company.fax);
  const email = present(employee.email);

  /*
    사업장 — 시안의 마지막 두 줄입니다. 사업장 이름(본사/공장 · R&D센터)이
    주소 앞 라벨로 붙습니다.

    영문 카드에는 라벨이 없습니다. Office 에 영문 이름 칸이 없어서, 넣으면 영문
    명함에 "본사/공장" 이 한글로 박힙니다. 주소만 내보내고 라벨은 뺍니다.
  */
  const offices = company.offices
    .map((office) => ({ label: en ? null : present(office.name), line: officeLine(office, lang) }))
    .filter((office) => office.line);

  // 라벨이 붙는 국문 카드는 그만큼 주소가 쓸 폭이 줄어듭니다.
  // 125 는 제일 긴 라벨("R&D센터" — 27px 에서 약 99px)과 주소 사이가 붙지 않는 폭입니다.
  const officeLabelWidth = 125;
  const officeWidth = W - 45 - 40 - (en ? 0 : officeLabelWidth);

  /*
    주소 크기 — 한 줄이 아니라 "두 줄까지 접히는 것" 을 전제로 정합니다.

    한 줄에 욱여넣으려 들면 영문 주소가 무너집니다. 영문은 우편번호와 Republic of Korea
    까지 한 줄이라 48em 가까이 되는데, 이걸 815 폭 한 줄에 맞추면 16px(서명에서 7.1px)이
    되어 안 읽힙니다. 그래서 폭 예산을 두 줄치로 주고, 넘치는 줄은 접습니다.

    접기는 아래 주소 div 의 width 가 합니다 — satori 는 폭이 정해진 칸 안에서만 줄을
    바꿉니다. width 를 빼면 접히는 대신 카드 밖으로 그냥 나갑니다. 같이 움직이는 값입니다.

    국문은 한 줄이 25.4em 이라 이 예산 안에서 base(25) 그대로 한 줄에 들어갑니다.
  */
  const officeSize = fitLines(
    offices.map((office) => office.line),
    officeWidth * 2,
    25,
    20,
  );

  /** 접힌 줄까지 센 주소 줄 수 — 주소 블록이 위로 얼마나 자라는지 알아야 연락처가 비킵니다. */
  const officeLineCount = offices.reduce(
    (count, office) => count + Math.max(1, Math.ceil((widthEm(office.line) * officeSize) / officeWidth)),
    0,
  );

  const certifications = stringList(en ? company.certificationsEn : company.certifications);

  /*
    연락처 두 단 — 왼쪽은 본인(휴대폰·메일), 오른쪽은 회사(대표번호·팩스)입니다.
    라벨은 시안대로 한 글자 약어이고 두 언어가 같습니다.

    값이 빈 줄은 빠지고 아래 줄이 올라옵니다 — 휴대폰을 비공개로 둔 사람은
    왼쪽 단이 메일 한 줄이 됩니다.
  */
  const columns = [
    [
      ["M.", mobile],
      ["E.", email],
    ],
    [
      ["T.", tel],
      ["F.", fax],
    ],
  ]
    .map((column) => column.filter(([, value]) => value) as [string, string][])
    // 한 단 안에서는 두 줄이 같은 크기여야 합니다. 라벨 폭(62)을 뺀 자리에 맞춥니다.
    // 36 은 왼쪽 단(378)에 메일 주소가 들어가는 최대값이고, 바닥 24 는 로컬파트가
    // 16 자인 메일(@dvi-ind.com 포함 28 자)까지 단 밖으로 안 나가는 선입니다.
    .map((rows, index) => ({
      rows,
      size: fitLines(
        rows.map(([, value]) => value),
        (index === 0 ? 440 : W - 486 - 40) - 62,
        30,
        22,
      ),
    }));

  /*
    오른쪽 단의 세로 쌓기 — 로고·인증 아래로 역할 줄, 그 아래로 연락처가 섭니다.

    예전에는 셋 다 시안 좌표로 고정이었습니다(역할 147, 연락처 275). 인증이 둘일 때는
    맞았지만 셋이 되는 순간 인증 블록이 역할 줄 자리까지 내려와 두 줄이 맞닿았습니다.
    인증 개수는 회사가 관리 화면에서 늘리는 값이라 고정 좌표로는 못 버팁니다.

    그래서 블록 높이를 실제로 재서 쌓아 내려갑니다. 값이 짧으면 예전 좌표 그대로고,
    길어질 때만 아래 블록이 그만큼 내려갑니다.
  */
  const LINE = 1.2; // satori 기본 줄 높이

  /*
    인증은 한 줄에 눕힙니다. ("IATF 16949 · ISO 14001 · ISO 45001")

    한 줄에 하나씩 쌓으면 셋부터 자리가 없습니다 — 인증 3줄 + 역할 2줄 + 연락처 2줄 +
    주소 2줄을 시안 여백대로 쌓으면 511px 이라 카드(500)를 11px 넘깁니다. 그래서 셋째
    인증이 역할 줄과 맞닿았습니다. 눕히면 높이가 한 줄이라 아래 블록이 안 밀립니다.

    폭은 왼쪽 심볼(x 112)에 닿지 않는 선까지 씁니다. 인증이 아주 많으면 줄어듭니다.
  */
  const certLine = certifications.join(" · ");
  const certSize = fitSize(widthEm(certLine), 860 - 130, 22, 14);
  const certBlockBottom = 33 + 25 + (certLine ? 14 + certSize * LINE : 0);

  const roleMainSize = roleSize(role, 32);
  const roleSubSize = roleSize(roleSub, 28);
  const roleGap = 16;
  const roleTop = Math.max(147, certBlockBottom + 14);
  const roleHeight =
    (role.length > 0 ? roleMainSize * LINE : 0) + (roleSub.length > 0 ? roleGap + roleSubSize * LINE : 0);

  /*
    연락처는 역할 줄 아래에 서되, 카드 바닥에 붙어 있는 주소 블록을 밟으면 안 됩니다.
    위아래 양쪽에서 눌리는 자리입니다.

    시안 자리는 275 지만, 주소가 접혀서 블록이 위로 자라면 그만큼 올라갑니다(영문 카드가
    그렇습니다 — 대신 영문에는 역할 영문 줄이 없어서 위가 비어 있습니다). 올라가더라도
    역할 줄 밑으로는 못 올라옵니다.
  */
  // 사업장 사이는 6 을 띄웁니다 — 주소가 접히면 둘째 줄과 다음 사업장이 붙어 한 덩어리로 읽힙니다.
  const officeGap = 6;
  const officesTop =
    H - 27 - (officeLineCount * officeSize * LINE + Math.max(0, offices.length - 1) * officeGap);
  const contactsHeight = Math.max(...columns.map((column) => column.rows.length * (column.size * LINE + 12)));
  const contactsFloor = roleTop + roleHeight + 16;
  const contactsTop = Math.max(
    contactsFloor,
    Math.min(Math.max(275, contactsFloor), officesTop - contactsHeight - 12),
  );

  const [regular, semibold] = await loadFonts();

  const image = new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: W,
          height: H,
          display: "flex",
          backgroundColor: "#FFFFFF",
          fontFamily: "Pretendard",
          overflow: "hidden",
        }}
      >
        {/*
          왼쪽 세로선 — 심볼부터 영문명까지, 신원 블록의 높이를 잡아 주는 선입니다.

          brandColor 를 그대로 쓰면 이름보다 선이 진해집니다. 시안의 연보라는
          브랜드색을 흰 바닥에 70% 로 얹은 색이라 opacity 로 만듭니다
          (satori 에 color-mix 가 없습니다).

          영문명 줄이 없으면 그만큼 짧아집니다. 길이를 고정하면 이름 한 줄짜리
          카드에서 선만 혼자 아래로 삐져 나옵니다.
        */}
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 33,
            width: 3,
            height: subName ? 217 : 170,
            backgroundColor: brand,
            opacity: 0.7,
          }}
        />

        {/* 신원 — 심볼 · 이름 · 영문명 */}
        <div style={{ position: "absolute", left: 48, top: 47, display: "flex", flexDirection: "column" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/brand/symbol.png`} width={64} height={64} alt="" />
          {/*
            자간 7 은 한글 이름(세 글자)을 시안만큼 벌려 놓는 값입니다. 영문 이름에
            그대로 주면 글자 사이가 벌어져 단어로 안 읽힙니다.
          */}
          <div
            style={{
              marginTop: 17,
              fontSize: en ? 38 : 44,
              fontWeight: 600,
              color: INK,
              letterSpacing: en ? 0 : 7,
            }}
          >
            {name}
          </div>
          {/*
            국문 카드의 영문명은 한글 이름 바로 아래입니다. 공개 카드(ProfileCard)와
            순서가 같아야 합니다. 영문 카드에서는 위 줄이 이미 영문명이라 비어 있습니다.
          */}
          {subName ? <div style={{ marginTop: 12, fontSize: 34, color: INK }}>{subName}</div> : null}
        </div>

        {/*
          역할 — 오른쪽 단. 이름 줄과 나란히 놓이도록 좌표로 맞춥니다.

          글자 크기가 서로 달라(44 vs 26) flex 로는 두 단의 첫 줄이 안 맞습니다.
          satori 에 baseline 정렬이 없어서 시안 좌표를 그대로 씁니다.
        */}
        <div style={{ position: "absolute", left: 486, top: roleTop, display: "flex", flexDirection: "column" }}>
          {role.length > 0 ? <RoleLine parts={role} size={roleMainSize} color={INK} /> : null}
          {roleSub.length > 0 ? (
            <div style={{ display: "flex", marginTop: roleGap }}>
              <RoleLine parts={roleSub} size={roleSubSize} color={INK} />
            </div>
          ) : null}
        </div>

        {/* 로고 · 인증 — 오른쪽 위 */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 33,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          {/*
            워드마크만 있는 로고입니다. 심볼은 왼쪽 위에 따로 있어서, 심볼이 붙은
            가로형 로고(logo-wordmark.png)를 쓰면 한 장에 심볼이 두 번 나옵니다.
            600x120 원본을 5:1 그대로 줄입니다.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/brand/wordmark.png`} width={125} height={25} alt="" />
          {certLine ? (
            <div style={{ display: "flex", marginTop: 14, fontSize: certSize, fontWeight: 600, color: brand }}>
              {certLine}
            </div>
          ) : null}
        </div>

        {/* 연락처 두 단 */}
        <div style={{ position: "absolute", left: 48, top: contactsTop, display: "flex" }}>
          {columns.map((column, index) => (
            // 왼쪽 단은 값이 짧아도 폭을 지켜야 오른쪽 단이 시안 자리에 섭니다.
            // (오른쪽 단에는 width 키 자체를 주지 않습니다 — satori 는 undefined 값을 만나면 터집니다)
            <div key={index} style={{ display: "flex", flexDirection: "column", ...(index === 0 ? { width: 440 } : {}) }}>
              {column.rows.map(([label, value]) => (
                <div key={label} style={{ display: "flex", marginBottom: 12 }}>
                  <div style={{ display: "flex", width: 62, fontSize: column.size, fontWeight: 600, color: INK }}>
                    {label}
                  </div>
                  <div style={{ display: "flex", fontSize: column.size, color: INK }}>{value}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/*
          사업장 — 카드 아래에 붙입니다.

          위에서부터 쌓지 않고 바닥에 붙이는 이유: 사업장이 하나든 셋이든 마지막 줄과
          카드 아래 여백이 같아야 합니다. 위에 두면 한 곳뿐인 회사의 카드만 아래가
          휑하게 뜹니다.
        */}
        {offices.length > 0 ? (
          <div style={{ position: "absolute", left: 45, bottom: 27, display: "flex", flexDirection: "column" }}>
            {offices.map((office, index) => (
              <div key={office.line} style={{ display: "flex", marginTop: index === 0 ? 0 : officeGap }}>
                {office.label ? (
                  // 라벨 폭을 고정해야 사업장이 둘 이상일 때 주소 시작점이 한 줄로 섭니다.
                  <div
                    style={{
                      display: "flex",
                      width: officeLabelWidth,
                      fontSize: officeSize,
                      fontWeight: 600,
                      color: INK,
                    }}
                  >
                    {office.label}
                  </div>
                ) : null}
                {/* width 가 있어야 긴 주소(영문)가 카드 밖으로 나가지 않고 접힙니다. */}
                <div style={{ display: "flex", width: officeWidth, fontSize: officeSize, color: INK }}>
                  {office.line}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );

  return Buffer.from(await image.arrayBuffer()).toString("base64");
}

/**
 * 캐시.
 *
 * 예전에는 `export const revalidate = 60` 만 있었는데, [slug] 에
 * generateStaticParams 가 없어 라우트가 ƒ(Dynamic) 으로 잡히는 바람에 아무 일도
 * 하지 않았습니다. 요청마다 DB 를 읽고 폰트를 받고 satori 를 돌리고 있었습니다.
 *
 * 지금은 결과물(PNG)을 slug·언어별로 캐시합니다. 60 초는 이 캐시를 손대는 곳이
 * 하나도 없을 때를 위한 바닥값이고, 실제로는 저장할 때 태그로 즉시 지웁니다.
 * (api/employees/[id] · api/company 의 revalidateTag)
 *
 * 키에는 언어가 들어가지만 태그는 언어를 구분하지 않습니다 — 프로필을 한 번
 * 저장하면 국문·영문 이미지가 함께 지워져야 합니다.
 */
const cachedCard = (slug: string, lang: Lang) =>
  unstable_cache(() => renderCard(slug, lang), ["card-png", slug, lang], {
    tags: [cardTag(slug), CARDS_TAG],
    revalidate: 60,
  })();

/** 라우트가 부르는 진입점. 없는 카드면 null 을 돌려주고 404 판단은 라우트가 합니다. */
export async function cardImageResponse(slug: string, lang: Lang): Promise<Response | null> {
  const base64 = await cachedCard(slug, lang);
  if (!base64) return null;

  /*
    캐시는 서버 쪽 이야기고, 브라우저·메일 클라이언트에는 매번 물어보게 합니다.
    서명 이미지라 한번 박히면 오래 남는데, 여기서 max-age 를 주면 프로필을 고쳐도
    받는 사람 화면에서는 옛 명함이 계속 보입니다.
  */
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
