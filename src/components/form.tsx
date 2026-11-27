"use client";

/**
 * 폼 기본 요소.
 *
 * 타이포·여백은 토큰 유틸(text-sm, gap-tight …)만 씁니다. 여기서 임의 크기를
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
        <span className="text-sm font-semibold text-brand-fg tabular-nums">{number}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {description ? (
        <p className="mt-tight text-xs text-fg-muted">{description}</p>
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {/* 오류는 danger 상태 토큰으로 냅니다. 칸 테두리도 같은 색으로 바뀝니다. */}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-tight text-xs text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-muted">{hint}</p>
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
        "h-10 w-full rounded-md border bg-surface px-3 text-sm text-fg",
        "placeholder:text-fg-subtle hover:border-fg-subtle",
        "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand",
        // 비활성(회사 정보 · 회원)은 배경으로 구분합니다. 값은 그대로 읽을 수 있어야 합니다.
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-muted disabled:hover:border-line-strong",
        invalid ? "border-danger hover:border-danger" : "border-line-strong",
        suffix || action ? "pr-block" : "",
        icon ? "pl-9" : "",
        className,
      ].join(" ")}
    />
  );

  if (!suffix && !icon && !action) return field;

  return (
    <div className="relative">
      {field}
      {icon ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle">
          {icon}
        </span>
      ) : null}
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-fg-muted">
          {suffix}
        </span>
      ) : null}
      {/*
        right-tight 로 붙이는 이유: 안에 들어오는 버튼이 손가락에 맞는 크기(44px)를
        가지려면 자기 여백이 필요한데, right-3(12px) 에 두면 그 여백까지 더해져
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
        "h-10 w-full rounded-md border bg-surface px-3 text-sm text-fg hover:border-fg-subtle",
        "focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-muted disabled:hover:border-line-strong",
        invalid ? "border-danger hover:border-danger" : "border-line-strong",
        className,
      ].join(" ")}
    />
  );
}

/** 두 칸 그리드. 좁은 화면에서는 한 칸으로 떨어집니다. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-group sm:grid-cols-2">{children}</div>;
}

/**
 * 체크박스 한 줄 — 라벨과 보조 설명을 함께 답니다.
 *
 * Field 를 쓰지 않는 이유: Field 는 라벨이 칸 위에 놓이는 구조인데, 체크박스는
 * 네모 옆에 라벨이 붙어야 무엇을 켜는지 읽힙니다. 줄 전체가 label 이라 설명
 * 문구를 눌러도 켜집니다 — 네모(20px)만 노리게 하면 손가락으로 누르기 어렵습니다.
 */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled,
  id,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-sibling py-tight">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand"
      />
      <span>
        <span className="text-sm text-fg">{label}</span>
        {hint ? <span className="mt-tight block text-xs text-fg-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
