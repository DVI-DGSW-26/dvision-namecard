import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * 명함을 PNG 한 장으로 렌더합니다. 이메일 서명이 이 이미지를 그대로 씁니다.
 *
 * 왜 이미지인가: Gmail 은 CSS 배경 이미지를 지우고 요소 겹침(레이어)도 지원하지 않아,
 * 디자인의 "글자 뒤 워터마크" 를 HTML 로는 재현할 수 없습니다. 카드 전체를 서버에서
 * 이미지로 구우면 워터마크까지 디자인 그대로 어느 메일 클라이언트에서든 동일하게 보입니다.
 * (대신 이미지라 글자·링크는 눌리지 않습니다. 서명 HTML 이 이미지 전체를 명함 링크로 감쌉니다.)
 *
 * next/og(Satori)는 flexbox 하위 집합만 지원합니다. grid·gap 없이 flex 로만 짜세요.
 * prisma·폰트 fetch 때문에 Node 런타임이어야 합니다.
 */

export const runtime = "nodejs";

// 이미지 자체는 자주 안 바뀌지만, 프로필을 수정하면 반영돼야 하니 캐시는 짧게 둡니다.
export const revalidate = 60;

const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/packages/pretendard/dist/public/static";

/** brandColor 검증. 형식이 깨졌으면 기본 브랜드색. (signature.ts 의 safeColor 와 같은 규칙) */
function safeColor(value: string | null | undefined): string {
  if (value && /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) return value;
  return "#931B82";
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type Props = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;

  const employee = await prisma.employee.findUnique({ where: { slug }, include: { company: true } });
  if (!employee || employee.status === "RESIGNED") notFound();

  const { company } = employee;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";

  const brand = safeColor(company.brandColor);
  const INK = "#212121";
  const SUB = "#6B6B6B";
  const LINE = "#E5E7EB";

  const role = [employee.rank as string, present(employee.position), present(employee.credential)]
    .filter(Boolean)
    .join("  •  ");

  const tel = present(employee.telWork) ?? present(company.tel);
  const mobile = employee.mobilePublic ? present(employee.telMobile) : null;
  const fax = present(company.fax);
  const email = present(employee.email);
  const address = present(company.address);

  const contacts = [
    ["TEL", tel],
    ["FAX", fax],
    ["MOBILE", mobile],
    ["E-MAIL", email],
  ].filter(([, v]) => v) as [string, string][];

  const [regular, semibold] = await Promise.all([
    fetch(`${PRETENDARD}/Pretendard-Regular.otf`).then((r) => r.arrayBuffer()),
    fetch(`${PRETENDARD}/Pretendard-SemiBold.otf`).then((r) => r.arrayBuffer()),
  ]);

  return new ImageResponse(
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
              <div style={{ fontSize: 34, fontWeight: 600, color: brand, letterSpacing: 6 }}>
                {employee.nameKo}
              </div>
              {role ? <div style={{ fontSize: 16, color: SUB, marginTop: 6 }}>{role}</div> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/brand/symbol.png`} width={30} height={30} alt="" />
              <div style={{ display: "flex", marginLeft: 7 }}>
                <div style={{ fontSize: 23, fontWeight: 600, color: brand }}>D</div>
                <div style={{ fontSize: 23, fontWeight: 600, color: INK }}>VISION</div>
              </div>
            </div>
          </div>

          {/* 회사 위치 */}
          {address ? <div style={{ fontSize: 16, color: INK, marginTop: 30 }}>{address}</div> : null}

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
}
