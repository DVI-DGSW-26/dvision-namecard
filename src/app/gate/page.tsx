import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { SSO_BACK_COOKIE } from "@/lib/oidc";
import { safeRedirect } from "@/lib/safe-redirect";
import { GateForm } from "./GateForm";

/**
 * 로그인 화면.
 *
 * 입구는 사내 통합 로그인(DVI 계정)입니다. 다른 사내 서비스와 같은 계정이고,
 * 허브에서 이미 로그인했다면 화면 없이 통과됩니다.
 *
 * 공용 비밀번호 폼은 아래에 접어 두고 병행합니다 — 전환이 자리를 잡으면
 * 걷어냅니다. 접기만 하고 지우지 않는 것이 롤백 경로입니다
 * (DVI-auth docs/employee-rollout.md 의 전환 원칙).
 *
 * ?next 검증은 여기서 한 번만 합니다. 폼은 이미 걸러진 값만 받으므로 다시
 * 확인하지 않습니다 — 검증 지점이 둘이면 한쪽만 고쳐 놓고 안전하다고 믿게 됩니다.
 */

type Props = {
  searchParams: Promise<{ next?: string; error?: string; manual?: string }>;
};

export default async function GatePage({ searchParams }: Props) {
  const { next, error, manual } = await searchParams;
  const destination = safeRedirect(next);

  /*
    오류도 수동 요청도 아니면 화면 없이 바로 통합 로그인을 시작한다.
    허브 등에서 이미 로그인한 사람은 버튼 클릭 없이 그대로 통과된다.

    루프가 되지 않는 이유: SSO 콜백이 실패하면 /gate?error=... 로 오고,
    그때는 이 리다이렉트를 건너뛰어 버튼과 접힌 기존 폼이 보인다.
    통합 로그인에서 막 돌아왔는데(1분 안, justBack) 또 게이트로 왔다면 세션이
    이어지지 않는 것이다. 다시 보내면 끝없이 오가므로 그때도 멈추고 안내한다.
    기존 방식으로 로그인하고 싶으면 /gate?manual=1 로 들어온다.
  */
  const justBack = (await cookies()).has(SSO_BACK_COOKIE);
  if (!error && manual === undefined && !justBack) {
    redirect(`/api/auth/sso?next=${encodeURIComponent(destination)}`);
  }
  const notice =
    error ??
    (justBack && manual === undefined
      ? "로그인하고 돌아왔지만 로그인 상태가 이어지지 않았습니다. 잠시 후 아래 버튼으로 다시 시도해 주세요."
      : undefined);

  return (
    <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-group py-section sm:px-section sm:py-block">
      <p className="text-xs text-fg-muted">(주)디비전 사내 디지털 명함</p>
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
      <p className="mt-group text-sm text-fg-muted">
        DVI 계정으로 로그인해 주세요. 다른 사내 서비스와 같은 계정입니다.
      </p>

      {/* SSO 콜백·갱신이 실패하면 ?error=<이유> 로 돌아옵니다. */}
      {notice && (
        <p className="mt-group rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-fg">
          {notice}
        </p>
      )}

      <div className="mt-block flex flex-col gap-group">
        <a
          href={`/api/auth/sso?next=${encodeURIComponent(destination)}`}
          className="flex h-12 w-full items-center justify-center rounded-md bg-brand text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          DVI 계정으로 로그인
        </a>

        {/*
          기존 방식은 접어 둡니다. 두 입구를 나란히 두면 직원이 어느 쪽인지
          고민하게 됩니다 — 롤백 경로는 살아 있되 화면에서는 하나만 보입니다.
        */}
        <details className="group">
          <summary className="cursor-pointer list-none text-center text-xs text-fg-muted underline-offset-4 hover:underline">
            기존 방식(공지 비밀번호)으로 로그인
          </summary>
          <div className="mt-group">
            <GateForm next={destination} />
          </div>
        </details>
      </div>
    </main>
  );
}
