-- 사내 통합 로그인(SSO) 계정 식별자.
-- 최초 SSO 로그인 때 이메일로 기존 명함과 연결되고, 그 뒤로는 이 값으로 찾는다.
ALTER TABLE "Employee" ADD COLUMN "ssoSubject" TEXT;

CREATE UNIQUE INDEX "Employee_ssoSubject_key" ON "Employee"("ssoSubject");
