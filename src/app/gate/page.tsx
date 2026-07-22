import Image from "next/image";
import { brand } from "@/config/brand";
import { safeRedirect } from "@/lib/safe-redirect";
import { GateForm } from "./GateForm";

/**
 * 공용 비밀번호 입력 화면.
 *
 * 개인 계정이 없는 구조라 이 화면이 유일한 인증 지점입니다.
 * 회원 비밀번호와 관리자 비밀번호를 같은 칸에서 받고, 어느 쪽이 맞았는지에 따라
 * 세션 role 이 달라집니다. (lib/auth.ts)
 *
 * ?next 검증은 여기서 한 번만 합니다. 폼은 이미 걸러진 값만 받으므로 다시
 * 확인하지 않습니다 — 검증 지점이 둘이면 한쪽만 고쳐 놓고 안전하다고 믿게 됩니다.
 */

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const { next } = await searchParams;
  const destination = safeRedirect(next);

  return (
    <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-group py-section sm:px-section sm:py-block">
      <p className="text-caption text-sub-text">(주)디비전 사내 디지털 명함</p>
      {/* 로고가 곧 제목입니다. 화면에 글자가 없으므로 alt 가 h1 의 텍스트 역할을 합니다. */}
      <h1 className="mt-sibling">
        <Image
          src={brand.serviceLogo}
          alt="dingdong"
          width={brand.serviceLogoWidth}
          height={brand.serviceLogoHeight}
          priority
          className="h-10 w-auto"
        />
      </h1>
      <p className="mt-group text-body text-sub-text">
        사내 이메일과 공지로 받은 비밀번호를 입력해 주세요.
      </p>

      <div className="mt-block">
        <GateForm next={destination} />
      </div>
    </main>
  );
}
