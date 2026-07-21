"use client";

/**
 * 폼 기본 요소.
 *
 * 타이포·여백은 토큰 유틸(text-body, gap-tight …)만 씁니다. 여기서 임의 크기를
 * 한 번 허용하면 화면 전체로 번집니다.
 */

export function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-section">
      <div className="flex items-baseline gap-sibling">
        {/* 섹션 번호는 primary 를 쓰는 몇 안 되는 자리입니다. */}
        <span className="text-caption-bold text-primary">{number}</span>
        <h2 className="text-title">{title}</h2>
      </div>
      {description ? (
        <p className="mt-tight text-caption text-sub-text">{description}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-tight">
      <label htmlFor={htmlFor} className="text-caption text-sub-text">
        {label}
      </label>
      {children}
      {/* 에러도 색이 아니라 문구로 알립니다. 빨강을 추가하면 팔레트가 늘어납니다. */}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-caption text-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-sub-text">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** 인풋 오른쪽 안쪽에 붙는 단위 표시 (년, 대, 명, T / 년) */
  suffix?: string;
  invalid?: boolean;
};

export function Input({ suffix, invalid, className = "", ...props }: InputProps) {
  const field = (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={[
        "h-12 w-full rounded-card border bg-bg px-group text-body text-text",
        "placeholder:text-sub-text focus:outline-none focus:border-text",
        // 비활성(회사 정보 · 회원)은 배경으로 구분합니다. 값은 그대로 읽을 수 있어야 합니다.
        "disabled:bg-sub-bg disabled:text-sub-text",
        invalid ? "border-text" : "border-border",
        suffix ? "pr-block" : "",
        className,
      ].join(" ")}
    />
  );

  if (!suffix) return field;

  return (
    <div className="relative">
      {field}
      <span className="pointer-events-none absolute inset-y-0 right-group flex items-center text-caption text-sub-text">
        {suffix}
      </span>
    </div>
  );
}

export function Select({
  invalid,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={[
        "h-12 w-full rounded-card border bg-bg px-group text-body text-text",
        "focus:outline-none focus:border-text disabled:bg-sub-bg disabled:text-sub-text",
        invalid ? "border-text" : "border-border",
        className,
      ].join(" ")}
    />
  );
}

/** 두 칸 그리드. 좁은 화면에서는 한 칸으로 떨어집니다. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-group sm:grid-cols-2">{children}</div>;
}
