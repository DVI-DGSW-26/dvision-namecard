import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";

/**
 * 프로필 사진 내주기. 공개 명함이 이 주소를 그대로 씁니다. (인증 불필요)
 *
 * 공개 카드가 공개인 이상 사진도 공개입니다. 다만 퇴사자는 카드와 같은 조건으로
 * 막습니다 — 프로필은 404 인데 사진만 계속 열리면 링크를 아는 사람에게 얼굴이
 * 계속 노출됩니다. (그 판단은 명함 서버의 /photos 가 합니다)
 */
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Props) {
  const { slug } = await params;

  let res: Response;
  try {
    res = await apiFetch(`/photos/${encodeURIComponent(slug)}`);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  }

  // 내용이 바뀌면 값도 바뀝니다 — 서버가 갱신 시각으로 만듭니다.
  const etag = res.headers.get("etag") ?? "";

  // 브라우저가 이미 같은 사진을 갖고 있으면 본문을 다시 보내지 않습니다.
  if (etag && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(await res.arrayBuffer(), {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      etag,
      /*
        주소에 갱신 시각(?v=)이 붙어 있어 사진을 바꾸면 주소 자체가 달라집니다.
        그래서 한 주소의 내용은 영원히 같다고 보고 길게 캐시합니다 — 카드를 열
        때마다 사진을 다시 받아오면 느립니다. immutable 은 새로고침해도 다시
        묻지 않게 합니다.
      */
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
