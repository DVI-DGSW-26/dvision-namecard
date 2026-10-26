"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EditSlugDialog } from "@/components/EditSlugDialog";
import { Input, Select } from "@/components/form";
import { SearchIcon } from "@/components/icons";
import {
  MAX_PAGE_SIZE,
  PAGE_SIZE,
  toListSearchParams,
  type EmployeeListItem,
  type EmployeeListResponse,
} from "@/lib/employee-list";
import type { Status } from "@/types";

/**
 * 임직원 목록 표. 검색·필터·페이지네이션·CSV 내보내기.
 *
 * 직원은 인사 시스템에서 옵니다. 여기서 추가·삭제·퇴사 처리를 하지 않습니다 —
 * 인사에 등록되면 목록에 나타나고, 인사에서 퇴사 처리하면 '퇴사' 로 바뀝니다.
 * 이 화면이 바꾸는 건 명함 쪽 값(권한·주소·비밀번호)뿐입니다.
 *
 * 상태·현재 페이지 같은 구분은 색이 아니라 굵기와 테두리로 만듭니다 — 토큰
 * 정의서의 "위계는 크기·굵기·여백으로만".
 */

/** 상태 배지 문구. 인사의 재직 상태를 그대로 보여 줍니다(휴직은 재직으로 옵니다). */
const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "재직",
  RESIGNED: "퇴사",
};

/**
 * 상태 구분에 색을 쓰지 않습니다. 토큰 정의서가 "위계는 크기·굵기·여백으로만"이라고
 * 못박고 있고, primary-soft 는 선택 상태 배경 외에는 쓰지 않기로 되어 있습니다.
 * 테두리는 Border 토큰의 명시된 용도(배지 테두리)입니다.
 */
const STATUS_STYLE: Record<Status, string> = {
  ACTIVE: "text-caption-bold text-text",
  RESIGNED: "text-caption text-sub-text",
};

const STATUS_OPTIONS: Status[] = ["ACTIVE", "RESIGNED"];

/**
 * YYYY-MM-DD (KST).
 *
 * sv-SE 로케일이 ISO 와 같은 표기를 내주기 때문에 자릿수 맞추는 코드 없이 씁니다.
 * toISOString().slice(0,10) 로 자르면 UTC 기준이라 한국 시간 오전 9시 이전 수정건이
 * 하루 전날로 보입니다.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** 목업의 `1 2 3 … 18` 형태. 현재 페이지 주변과 양 끝만 남깁니다. */
function pageTokens(current: number, last: number): Array<number | "gap"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages = new Set([1, last, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);

  const tokens: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) tokens.push("gap");
    tokens.push(page);
    previous = page;
  }
  return tokens;
}

function toCsv(rows: EmployeeListItem[]): string {
  const header = ["이름", "부서", "직위", "이메일", "수정일", "상태"];
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [
      row.nameKo,
      row.department ?? "",
      row.rank ?? "",
      row.email ?? "",
      formatDate(row.updatedAt),
      STATUS_LABEL[row.status],
    ]
      .map(escape)
      .join(","),
  );
  return [header.map(escape).join(","), ...lines].join("\r\n");
}

const CELL = "px-group py-sibling text-body text-text whitespace-nowrap";

export function EmployeeTable() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);

  // 응답과 에러에 "어떤 조회의 결과인지"(key)를 같이 들고 다닙니다.
  // 그래야 로딩 여부를 별도 state 없이 현재 조회 key 와 비교해 파생시킬 수 있습니다.
  const [result, setResult] = useState<{ key: string; body: EmployeeListResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  /* 관리 동작(권한·주소 변경·비밀번호 발급) --------------------------------- */

  const [slugTarget, setSlugTarget] = useState<EmployeeListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  /**
   * 방금 발급한 초기 비밀번호. 응답에 한 번만 실려 오므로 화면에 붙들어 둡니다.
   *
   * 목록 데이터에 섞지 않는 이유: 목록은 새로고침될 때마다 서버 값으로 덮이는데,
   * 이 값은 서버에 남지 않아서 그 순간 사라집니다.
   */
  const [issued, setIssued] = useState<{
    nameKo: string;
    email: string;
    password: string;
  } | null>(null);

  // 직원을 추가한 뒤 같은 조회 조건 그대로 목록을 다시 받기 위한 값입니다.
  // URL 파라미터가 아니라 fetch effect 의 의존성으로만 씁니다.
  const [reloadNonce, setReloadNonce] = useState(0);

  // 타이핑 중에 매 글자 요청이 나가지 않도록 한 박자 늦춥니다.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 필터를 바꾸면 3페이지에 머물러 결과가 0건으로 보이는 일이 없도록 1페이지로 되돌립니다.
  // (effect 가 아니라 각 핸들러에서 직접 되돌립니다 — 연쇄 렌더가 생기지 않습니다.)
  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const changeTeam = useCallback((value: string) => {
    setTeamId(value);
    setPage(1);
  }, []);

  const changeStatus = useCallback((value: Status | "") => {
    setStatus(value);
    setPage(1);
  }, []);

  const query = useMemo(
    () => ({
      q: debouncedSearch,
      teamId,
      status: status || undefined,
      page,
    }),
    [debouncedSearch, teamId, status, page],
  );

  const queryKey = useMemo(() => toListSearchParams(query).toString(), [query]);

  // 응답이 도착 순서와 다르게 뒤섞여 옛 결과가 최신 결과를 덮어쓰지 않도록
  // 마지막 요청만 상태에 반영합니다.
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();

    fetch(`/api/employees?${queryKey}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`목록을 불러오지 못했습니다 (${response.status})`);
        return (await response.json()) as EmployeeListResponse;
      })
      .then((body) => {
        if (requestId !== requestRef.current) return;
        setResult({ key: queryKey, body });
        setFailure(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setFailure({
          key: queryKey,
          message: cause instanceof Error ? cause.message : "목록을 불러오지 못했습니다",
        });
      });

    return () => controller.abort();
  }, [queryKey, reloadNonce]);

  // 이번 조회의 결과가 아직 안 왔으면 로딩 중입니다.
  const isLoading = result?.key !== queryKey && failure?.key !== queryKey;
  const error = failure?.key === queryKey ? failure.message : exportError;

  // 새 조회가 도는 동안에도 직전 결과를 계속 보여줘서 표가 깜빡이지 않게 합니다.
  const data = result?.body ?? null;
  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  /** 목록을 다시 받아옵니다. 관리 동작은 전부 성공 후 이걸 부릅니다. */
  const refresh = useCallback(() => setReloadNonce((n) => n + 1), []);

  /**
   * 관리 동작 한 번 = 요청 한 번 + 목록 새로고침.
   *
   * 낙관적 갱신을 하지 않습니다 — 권한·주소는 서버가 거절할 수 있는 값이고
   * (중복 주소, 마지막 관리자), 화면만 먼저 바꾸면 되돌리는 코드가 더 복잡해집니다.
   */
  const runAction = useCallback(
    async (path: string, init: RequestInit): Promise<boolean> => {
      setIsActing(true);
      setActionError(null);
      try {
        const response = await fetch(path, init);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const firstFieldError = body?.errors ? Object.values(body.errors)[0] : null;
          setActionError(
            body?.error ?? (typeof firstFieldError === "string" ? firstFieldError : "처리하지 못했습니다."),
          );
          return false;
        }
        refresh();
        return true;
      } catch {
        setActionError("네트워크 오류로 처리하지 못했습니다.");
        return false;
      } finally {
        setIsActing(false);
      }
    },
    [refresh],
  );

  const changeRowRole = useCallback(
    (row: EmployeeListItem, next: "MEMBER" | "ADMIN") =>
      runAction(`/api/employees/${row.id}/admin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // 주소는 그대로 두고 권한만 바꿉니다. 스키마가 두 값을 함께 받습니다.
        body: JSON.stringify({ slug: row.slug, role: next }),
      }),
    [runAction],
  );

  /**
   * 초기 비밀번호 발급·재발급.
   *
   * 만들어진 값은 응답에 한 번만 실려 옵니다. 저장되는 건 해시라 이 화면을 닫으면
   * 다시 볼 수 없고, 그때는 또 발급하면 됩니다. 그래서 모달로 띄워 관리자가
   * 복사해 전달할 때까지 남겨 둡니다.
   */
  const issuePassword = useCallback(
    async (row: EmployeeListItem) => {
      setIsActing(true);
      setActionError(null);
      try {
        const response = await fetch(`/api/employees/${row.id}/password`, { method: "POST" });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setActionError(payload?.error ?? "발급하지 못했습니다.");
          return;
        }
        setIssued({ nameKo: row.nameKo, email: payload.email, password: payload.password });
        refresh();
      } catch {
        setActionError("네트워크 오류로 발급하지 못했습니다.");
      } finally {
        setIsActing(false);
      }
    },
    [refresh],
  );

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      // 현재 화면의 필터를 그대로 적용하되, 보이는 페이지가 아니라 전체를 내려받습니다.
      const params = toListSearchParams({ ...query, page: 1, pageSize: MAX_PAGE_SIZE });
      const response = await fetch(`/api/employees?${params}`);
      if (!response.ok) throw new Error(`내보내기에 실패했습니다 (${response.status})`);
      const body = (await response.json()) as EmployeeListResponse;

      // 앞의 BOM 이 없으면 엑셀이 CSV 를 ANSI 로 읽어 한글이 깨집니다.
      const blob = new Blob(["﻿", toCsv(body.items)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dvision-employees.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause: unknown) {
      setExportError(cause instanceof Error ? cause.message : "내보내기에 실패했습니다");
    } finally {
      setIsExporting(false);
    }
  }, [query]);

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap items-start justify-between gap-group">
        <div>
          <p className="text-caption text-sub-text">임직원 관리</p>
          {/* 숫자와 "명"이 갈라져 줄바꿈되지 않도록 한 덩어리로 둡니다. */}
          <h1 className="mt-tight text-display whitespace-nowrap">
            직원 {total.toLocaleString("ko-KR")}명
          </h1>
        </div>

        {/* 직원 추가 버튼은 없습니다 — 입사자는 인사 시스템에 등록하면 여기 나타납니다. */}
        <div className="flex w-full items-center gap-sibling sm:w-auto">
          <button
            type="button"
            onClick={exportCsv}
            disabled={isExporting || total === 0}
            className="h-12 flex-1 rounded-card border border-border px-group text-body whitespace-nowrap transition-colors hover:border-text disabled:cursor-not-allowed disabled:text-sub-text disabled:hover:border-border sm:flex-none"
          >
            {isExporting ? "내보내는 중…" : "CSV 내보내기"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-sibling">
        {/* 검색은 모바일에서 한 줄을 통째로 씁니다. 아래 줄에 필터 두 개가 나란히 옵니다. */}
        <div className="w-full sm:min-w-64 sm:flex-1">
          <Input
            type="search"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="이름·이메일·부서 검색"
            aria-label="이름·이메일·부서 검색"
            icon={<SearchIcon className="h-5 w-5" />}
          />
        </div>

        {/*
          Select 는 기본 클래스에 w-full 을 갖고 있어서 className 으로 폭을 넘기면
          Tailwind 규칙 순서상 밀립니다. 폭은 바깥 div 로 잡습니다.
          min-w-0 이 없으면 flex 아이템이 내용 폭 밑으로 안 줄어들어 줄이 터집니다.
        */}
        <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
          <Select
            value={teamId}
            onChange={(event) => changeTeam(event.target.value)}
            aria-label="부서 필터"
          >
            {/* 부서 필터는 팀 단위입니다. 파트까지 나누면 선택지가 20개를 넘습니다. */}
            <option value="">전체 부서</option>
            {(data?.teams ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
          <Select
            value={status}
            onChange={(event) => changeStatus(event.target.value as Status | "")}
            aria-label="상태 필터"
          >
            <option value="">전체 상태</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 에러도 색이 아니라 문구로 알립니다. 빨강을 추가하면 팔레트가 늘어납니다. */}
      {error ? (
        <p role="alert" className="rounded-card bg-sub-bg px-group py-sibling text-caption text-text">
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-card bg-sub-bg px-group py-sibling text-caption text-text">
          {actionError}
        </p>
      ) : null}

      {/*
        md 미만 — 카드 리스트.
        7열 표를 가로 스크롤로 밀어 넣으면 이름 말고는 아무것도 안 보입니다.
        같은 items 를 쓰므로 표와 내용이 어긋날 일은 없습니다.
      */}
      <div className="flex flex-col gap-sibling md:hidden">
        {isLoading && items.length === 0 ? (
          <p className="rounded-card border border-border px-group py-block text-center text-body text-sub-text">
            불러오는 중…
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-card border border-border px-group py-block text-center text-body text-sub-text">
            조건에 맞는 직원이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-sibling">
            {items.map((row) => (
              <li key={row.id} className="flex gap-sibling rounded-card border border-border p-group">
                {/* min-w-0 이 없으면 긴 이메일이 카드 밖으로 삐져나갑니다. */}
                <div className="flex min-w-0 flex-1 flex-col gap-tight">
                  <div className="flex items-start justify-between gap-sibling">
                    <Link
                      href={`/edit?e=${encodeURIComponent(row.slug)}`}
                      className="flex min-w-0 items-center gap-sibling"
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sub-bg text-caption text-sub-text"
                      >
                        {[...row.nameKo][0] ?? "?"}
                      </span>
                      <span className="truncate text-body-bold">{row.nameKo}</span>
                    </Link>
                    <span className={`shrink-0 rounded-card border border-border px-sibling py-tight whitespace-nowrap ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>

                  <p className="text-caption text-sub-text">
                    {[row.department, row.rank].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate text-caption text-sub-text">{row.email ?? "—"}</p>
                  <p className="text-caption text-sub-text">{formatDate(row.updatedAt)}</p>

                  {/* 좁은 화면에서도 권한을 바꿀 수 있어야 합니다 — 관리자가 자리에 없을 때 폰으로 처리합니다. */}
                  <select
                    value={row.role}
                    disabled={isActing}
                    onChange={(event) => changeRowRole(row, event.target.value as "MEMBER" | "ADMIN")}
                    aria-label={`${row.nameKo} 권한`}
                    className="mt-tight h-9 w-full rounded-card border border-border bg-bg px-sibling text-caption focus:border-text focus:outline-none disabled:text-sub-text"
                  >
                    <option value="MEMBER">직원</option>
                    <option value="ADMIN">관리자</option>
                  </select>

                  <div className="mt-tight flex flex-wrap gap-tight">
                    <button
                      type="button"
                      onClick={() => issuePassword(row)}
                      disabled={isActing}
                      className="h-9 rounded-card border border-border px-group text-caption text-text"
                    >
                      {row.hasPassword ? "비번 재발급" : "비번 발급"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlugTarget(row)}
                      className="h-9 rounded-card border border-border px-group text-caption text-text"
                    >
                      주소
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-card border border-border md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-sub-bg">
            <tr>
              {["이름", "부서", "직위", "이메일", "수정일", "상태", "권한", "관리"].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-group py-sibling text-caption text-sub-text whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-group py-block text-center text-body text-sub-text">
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-group py-block text-center text-body text-sub-text">
                  조건에 맞는 직원이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className={CELL}>
                    {/* 이름을 누르면 관리자가 그 사람 명함을 대신 편집합니다. */}
                    <Link
                      href={`/edit?e=${encodeURIComponent(row.slug)}`}
                      className="flex items-center gap-sibling hover:text-primary"
                    >
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sub-bg text-caption text-sub-text"
                      >
                        {[...row.nameKo][0] ?? "?"}
                      </span>
                      <span className="text-body-bold">{row.nameKo}</span>
                    </Link>
                  </td>
                  <td className={CELL}>{row.department ?? "—"}</td>
                  <td className={CELL}>{row.rank ?? "—"}</td>
                  <td className={CELL}>{row.email ?? "—"}</td>
                  <td className="px-group py-sibling text-body text-sub-text whitespace-nowrap">
                    {formatDate(row.updatedAt)}
                  </td>
                  <td className={`px-group py-sibling whitespace-nowrap ${STATUS_STYLE[row.status]}`}>
                    {/* 재직 상태는 인사 시스템 값이라 보여 주기만 합니다. */}
                    {STATUS_LABEL[row.status]}
                  </td>
                  <td className="px-group py-sibling">
                    {/*
                      권한은 선택 상자입니다. 예전에는 어떤 공용 비밀번호로
                      들어왔느냐로 갈려서, 권한을 옮기려면 비밀번호를 알려줘야 했습니다.
                      마지막 관리자의 권한을 내리는 건 서버가 막습니다.
                    */}
                    <select
                      value={row.role}
                      disabled={isActing}
                      onChange={(event) =>
                        changeRowRole(row, event.target.value as "MEMBER" | "ADMIN")
                      }
                      aria-label={`${row.nameKo} 권한`}
                      className="h-9 rounded-card border border-border bg-bg px-sibling text-caption whitespace-nowrap focus:border-text focus:outline-none disabled:text-sub-text"
                    >
                      <option value="MEMBER">직원</option>
                      <option value="ADMIN">관리자</option>
                    </select>
                  </td>
                  <td className="px-group py-sibling">
                    <div className="flex gap-tight whitespace-nowrap">
                      {/*
                        비밀번호를 발급해야 로그인할 수 있습니다. 아직 못 받은 사람은
                        버튼 이름으로 구분됩니다 — 목록을 훑다가 바로 알아채야 합니다.
                      */}
                      <button
                        type="button"
                        onClick={() => issuePassword(row)}
                        disabled={isActing}
                        className={`h-9 rounded-card border px-sibling text-caption hover:border-text ${
                          row.hasPassword ? "border-border text-text" : "border-text text-text"
                        }`}
                      >
                        {row.hasPassword ? "비번 재발급" : "비번 발급"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlugTarget(row)}
                        className="h-9 rounded-card border border-border px-sibling text-caption text-text hover:border-text"
                      >
                        주소
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/*
        방금 발급한 초기 비밀번호.

        서버에는 해시만 남으므로 이 화면을 닫으면 다시 볼 수 없습니다. 그래서 닫기를
        누르기 전까지 남겨 두고, 다시 필요하면 재발급하면 된다는 것도 함께 적습니다.
        메일로 자동 발송하지 않는 이유: 메일함은 지워지지 않는 기록이라, 초기 비밀번호가
        평문으로 계속 남습니다. 전달 방법은 관리자가 정하는 편이 낫습니다.
      */}
      {issued ? (
        <div className="rounded-card border border-text px-group py-group">
          <p className="text-caption-bold text-text">
            {issued.nameKo} 님의 초기 비밀번호를 발급했습니다
          </p>
          <p className="mt-tight text-caption text-sub-text">
            이 창을 닫으면 다시 볼 수 없습니다. 본인에게 전달하고, 놓쳤으면 다시 발급하세요.
            받은 사람은 첫 로그인에서 비밀번호를 바꾸게 됩니다.
          </p>
          <div className="mt-group flex flex-wrap items-center gap-group">
            <code className="rounded-card bg-sub-bg px-group py-sibling text-body-bold text-text">
              {issued.password}
            </code>
            <span className="text-caption text-sub-text">{issued.email}</span>
            <div className="ml-auto flex gap-sibling">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(issued.password)}
                className="h-10 rounded-card border border-border px-group text-caption-bold text-text"
              >
                복사
              </button>
              <button
                type="button"
                onClick={() => setIssued(null)}
                className="h-10 rounded-card bg-primary px-group text-caption-bold text-white"
              >
                전달 완료
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-group">
        <p className="text-caption text-sub-text">
          {`${firstRow} – ${lastRow} / ${total.toLocaleString("ko-KR")}`}
        </p>

        {/* 좁은 화면에서는 페이지 번호가 여러 줄로 접힙니다. 가로 스크롤보다 낫습니다. */}
        <nav
          aria-label="페이지 이동"
          className="flex w-full flex-wrap items-center justify-center gap-tight sm:w-auto sm:justify-end"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-9 rounded-card border border-border px-sibling text-caption whitespace-nowrap transition-colors hover:border-text disabled:text-sub-text disabled:hover:border-border"
          >
            이전
          </button>

          {pageTokens(page, lastPage).map((token, index) =>
            token === "gap" ? (
              <span key={`gap-${index}`} className="px-sibling text-caption text-sub-text">
                …
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => setPage(token)}
                aria-current={token === page ? "page" : undefined}
                // 현재 페이지는 굵기와 테두리로만 구분합니다. Text 토큰은 본문용이라
                // 배경으로 깔지 않고, primary 예산은 CTA 몫으로 남깁니다.
                className={
                  token === page
                    ? "h-9 min-w-9 rounded-card border border-text px-sibling text-caption-bold text-text"
                    : "h-9 min-w-9 rounded-card border border-border px-sibling text-caption text-sub-text transition-colors hover:border-text"
                }
              >
                {token}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="h-9 rounded-card border border-border px-sibling text-caption whitespace-nowrap transition-colors hover:border-text disabled:text-sub-text disabled:hover:border-border"
          >
            다음
          </button>
        </nav>
      </div>

      <EditSlugDialog
        target={slugTarget}
        onClose={() => setSlugTarget(null)}
        onSaved={refresh}
      />
    </div>
  );
}
