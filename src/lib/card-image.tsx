import { unstable_cache } from "next/cache";
import { ImageResponse } from "next/og";
import { CARDS_TAG, cardTag } from "@/lib/card-cache";
import { cardName, type Lang } from "@/lib/lang";
import { officeLines, roleParts } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { companyOfficesInclude, employeeOrgInclude } from "@/types";

/**
 * 명함을 PNG 한 장으로 렌더합니다. 이메일 서명이 이 이미지를 그대로 씁니다.
 *
 * 왜 이미지인가: Gmail 은 CSS 배경 이미지를 지우고 요소 겹침(레이어)도 지원하지 않아,
 * 디자인의 "글자 뒤 워터마크" 를 HTML 로는 재현할 수 없습니다. 카드 전체를 서버에서
 * 이미지로 구우면 워터마크까지 디자인 그대로 어느 메일 클라이언트에서든 동일하게 보입니다.
 * (대신 이미지라 글자·링크는 눌리지 않습니다. 서명 HTML 이 이미지 전체를 명함 링크로 감쌉니다.)
 *
 * next/og(Satori)는 flexbox 하위 집합만 지원합니다. grid·gap 없이 flex 로만 짜세요.
 * prisma·폰트 fetch 때문에 Node 런타임이어야 합니다 — 라우트에서 runtime 을 지정합니다.
 *
 * 국문·영문 라우트가 이 파일 하나를 함께 씁니다. 언어별로 파일을 나누면 레이아웃을
 * 한쪽만 고치는 순간 같은 명함이 두 모양이 됩니다.
 */

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
  });
  if (!employee || employee.status === "RESIGNED") return null;

  const { company } = employee;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";
  const en = lang === "en";

  const brand = safeColor(company.brandColor);
  const INK = "#212121";
  const SUB = "#6B6B6B";
  const LINE = "#E5E7EB";

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

  const role = [
    ...roleParts(employee, lang),
    present(en ? employee.credentialEn : employee.credential),
  ]
    .filter(Boolean)
    .join("  •  ");

  const tel = present(employee.telWork) ?? present(company.tel);
  const mobile = employee.mobilePublic ? present(employee.telMobile) : null;
  const fax = present(company.fax);
  const email = present(employee.email);
  const addresses = officeLines(company.offices, lang);

  // 연락처 라벨은 두 언어가 같습니다. 국문 명함에서도 관행적으로 영문 약어를 씁니다.
  const contacts = [
    ["TEL", tel],
    ["FAX", fax],
    ["MOBILE", mobile],
    ["E-MAIL", email],
  ].filter(([, v]) => v) as [string, string][];

  const [regular, semibold] = await loadFonts();

  const image = new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: 600,
          height: 340,
          display: "flex",
          backgroundColor: "#FFFFFF",
          fontFamily: "Pretendard",
          overflow: "hidden",
        }}
      >
        {/* 우측 배경 워터마크 — 내용 뒤에 깔리고 카드 밖으로 넘칩니다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${base}/brand/watermark.png`}
          width={420}
          height={420}
          alt=""
          style={{ position: "absolute", right: -60, top: -20 }}
        />

        {/* 내용 */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", padding: 36 }}>
          {/* 이름·역할(좌) + 로고(우) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/*
                자간 6 은 한글 이름(세 글자)을 넓게 벌리려고 넣은 값입니다. 영문
                이름에 그대로 주면 글자 사이가 벌어져 단어로 안 읽힙니다.
              */}
              <div
                style={{
                  fontSize: en ? 30 : 34,
                  fontWeight: 600,
                  color: brand,
                  letterSpacing: en ? 0 : 6,
                }}
              >
                {name}
              </div>
              {/*
                국문 카드의 영문명은 한글 이름 바로 아래, 역할 줄 위입니다.
                공개 카드(ProfileCard)와 순서가 같아야 합니다.

                600x340 고정 캔버스라 줄이 하나 늘면 아래가 밀립니다. 영문명이 있는
                사람만 6px 을 더 씁니다.
              */}
              {subName ? (
                <div style={{ fontSize: 15, color: SUB, marginTop: 6 }}>{subName}</div>
              ) : null}
              {role ? <div style={{ fontSize: 16, color: SUB, marginTop: 6 }}>{role}</div> : null}
            </div>
            {/*
              공식 가로형 로고 한 장입니다. 예전엔 symbol.png 옆에 "D"+"VISION" 을
              텍스트로 조판했는데, 자간·굵기가 공식 로고와 미묘하게 어긋났습니다.
              203x45 원본을 높이 38 에 맞춰 171x38 으로 줄입니다(4.51:1 유지).
            */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/brand/logo-wordmark.png`} width={171} height={38} alt="" />
            </div>
          </div>

          {/*
            회사 위치 — 사업장마다 한 줄입니다. (본사 · R&D센터)

            600x340 고정 캔버스라 줄이 늘어나면 아래가 밀립니다. 그래서 한 곳일 때의
            여백(30)을 그대로 두고 둘째 줄부터는 줄간격만 좁게(4) 붙입니다.
            satori 는 flex 하위 집합만 지원하므로 gap 대신 marginTop 을 씁니다.

            영문 주소를 안 채운 사업장은 줄이 통째로 빠집니다. 한 곳도 없으면
            블록 자체가 사라지고 아래 연락처가 그만큼 올라옵니다.
          */}
          {addresses.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
              {addresses.map((line, index) => (
                <div key={line} style={{ fontSize: 16, color: INK, marginTop: index === 0 ? 0 : 4 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : null}

          {/* 구분선 */}
          <div style={{ display: "flex", width: 330, height: 1, backgroundColor: LINE, marginTop: 14 }} />

          {/* 연락처 */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
            {contacts.map(([label, value]) => (
              <div key={label} style={{ display: "flex", marginBottom: 8 }}>
                <div style={{ display: "flex", width: 84, fontSize: 14, fontWeight: 600, color: brand }}>
                  {label}
                </div>
                <div style={{ display: "flex", fontSize: 14, color: INK }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 600,
      height: 340,
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
