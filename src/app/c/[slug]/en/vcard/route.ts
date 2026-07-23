import { type NextRequest } from "next/server";
import { vcardResponse } from "@/lib/vcard-route";

type Context = {
  params: Promise<{ slug: string }>;
};

/** .vcf 다운로드 — 영문. 국문과 같은 코드를 씁니다. */
export async function GET(_request: NextRequest, { params }: Context) {
  const { slug } = await params;
  return (await vcardResponse(slug, "en")) ?? new Response("Not Found", { status: 404 });
}
