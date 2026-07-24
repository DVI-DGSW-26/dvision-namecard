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
  /** 인풋 왼쪽 안쪽에 붙는 아이콘 (검색 등) */
  icon?: React.ReactNode;
  /**
   * 인풋 오른쪽 안쪽에 붙는 조작 요소 (비밀번호 표시 토글 등).
   *
   * suffix 와 나눠 둔 이유: suffix 는 pointer-events-none 이라 거기에 버튼을 넣으면
   * 눌리지 않습니다. 값을 읽는 표시(suffix)와 값을 바꾸는 조작(action)은 클릭을
   * 받아야 하는지가 달라서 자리를 따로 둡니다.
   */
  action?: React.ReactNode;
  invalid?: boolean;
};

export function Input({ suffix, icon, action, invalid, className = "", ...props }: InputProps) {
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
        suffix || action ? "pr-block" : "",
        icon ? "pl-block" : "",
        className,
      ].join(" ")}
    />
  );

  if (!suffix && !icon && !action) return field;

  return (
    <div className="relative">
      {field}
      {icon ? (
        <span className="pointer-events-none absolute inset-y-0 left-group flex items-center text-sub-text">
          {icon}
        </span>
      ) : null}
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-group flex items-center text-caption text-sub-text">
          {suffix}
        </span>
      ) : null}
      {/*
        right-tight 로 붙이는 이유: 안에 들어오는 버튼이 손가락에 맞는 크기(44px)를
        가지려면 자기 여백이 필요한데, right-group(16px) 에 두면 그 여백까지 더해져
        인풋 테두리 밖으로 밀려납니다.
      */}
      {action ? (
        <span className="absolute inset-y-0 right-tight flex items-center">{action}</span>
      ) : null}
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
