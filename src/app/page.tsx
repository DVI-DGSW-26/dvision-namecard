import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * 진입점. 자체 화면이 없고 상태에 따라 보낼 곳만 정합니다.
 *
 * 이 경로는 middleware matcher 에 없습니다. matcher 에 넣으면 비로그인 사용자가
 * /gate?next=%2F 로 가고, 인증 후 다시 / 로 돌아와 또 판단하는 왕복이 생깁니다.
 * 여기서 세션을 직접 읽고 최종 목적지로 한 번에 보냅니다.
 */
export default async function Home() {
  const session = await getSession();
  redirect(session ? "/edit" : "/gate");
}
