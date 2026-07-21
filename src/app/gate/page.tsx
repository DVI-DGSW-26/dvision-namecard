import { GateForm } from "./GateForm";

/**
 * 공용 비밀번호 입력 화면.
 *
 * 개인 계정이 없는 구조라 이 화면이 유일한 인증 지점입니다.
 * 회원 비밀번호와 관리자 비밀번호를 같은 칸에서 받고, 어느 쪽이 맞았는지에 따라
 * 세션 role 이 달라집니다. (lib/auth.ts)
 */

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-section py-block">
      <p className="text-caption text-sub-text">(주)디비전 디지털 명함</p>
      <h1 className="mt-tight text-display">
        <span className="text-primary">D</span>VISION
      </h1>
      <p className="mt-sibling text-body text-sub-text">
        사내 공지로 받은 비밀번호를 입력해 주세요.
      </p>

      <div className="mt-block">
        <GateForm next={next ?? null} />
      </div>
    </main>
  );
}
