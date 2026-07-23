"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddEmployeeDialog } from "@/components/AddEmployeeDialog";
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
 * 색은 CTA(직원 추가) 하나에만 primary 를 채웁니다. 상태·현재 페이지 같은 구분은
 * 색이 아니라 굵기와 테두리로 만듭니다 — 토큰 정의서의 "위계는 크기·굵기·여백으로만".
 */

/** 상태 배지. Status enum 과 화면 문구는 1:1 이 아니라서 여기서 한 번만 매핑합니다. */
const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: "활성",
  PENDING: "초대중",
  RESIGNED: "비활성",
};

/**
 * 상태 구분에 색을 쓰지 않습니다. 토큰 정의서가 "위계는 크기·굵기·여백으로만"이라고
 * 못박고 있고, primary-soft 는 선택 상태 배경 외에는 쓰지 않기로 되어 있습니다.
 * 테두리는 Border 토큰의 명시된 용도(배지 테두리)입니다.
 */
const STATUS_STYLE: Record<Status, string> = {
  ACTIVE: "text-caption-bold text-text",
  PENDING: "text-caption text-text",
  RESIGNED: "text-caption text-sub-text",
};

const STATUS_OPTIONS: Status[] = ["ACTIVE", "PENDING", "RESIGNED"];

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

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

  const allOnPageSelected = items.length > 0 && items.every((row) => selected.has(row.id));

  const toggleAllOnPage = useCallback(() => {
    setSelected((previous) => {
      const next = new Set(previous);
      // 현재 페이지 밖의 선택은 건드리지 않습니다.
      if (items.every((row) => next.has(row.id))) {
        items.forEach((row) => next.delete(row.id));
      } else {
        items.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }, [items]);

  const toggleOne = useCallback((id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

        {/* 좁은 화면에서는 두 버튼이 한 줄을 반씩 나눠 씁니다. */}
        <div className="flex w-full items-center gap-sibling sm:w-auto">
          <button
            type="button"
            onClick={exportCsv}
            disabled={isExporting || total === 0}
            className="h-12 flex-1 rounded-card border border-border px-group text-body whitespace-nowrap transition-colors hover:border-text disabled:cursor-not-allowed disabled:text-sub-text disabled:hover:border-border sm:flex-none"
          >
            {isExporting ? "내보내는 중…" : "CSV 내보내기"}
          </button>
          {/* CTA — 이 화면에서 primary 를 채워 쓰는 유일한 요소입니다. */}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="h-12 flex-1 rounded-card bg-primary px-group text-body-bold text-white whitespace-nowrap transition-colors hover:bg-primary-hover sm:flex-none"
          >
            직원 추가
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

      {/*
        md 미만 — 카드 리스트.
        7열 표를 가로 스크롤로 밀어 넣으면 이름 말고는 아무것도 안 보입니다.
        같은 items/selected 를 쓰므로 표와 내용이 어긋날 일은 없습니다.
      */}
      <div className="flex flex-col gap-sibling md:hidden">
        <label className="flex min-h-11 items-center gap-sibling text-caption text-sub-text">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={toggleAllOnPage}
            disabled={items.length === 0}
            className="h-4 w-4 accent-primary"
          />
          이 페이지 전체 선택
        </label>

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
              <li
                key={row.id}
                // primary-soft 는 "선택 상태 배경"으로만 쓰기로 되어 있습니다. 여기가 그 자리입니다.
                className={`flex gap-sibling rounded-card border border-border p-group ${
                  selected.has(row.id) ? "bg-primary-soft" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggleOne(row.id)}
                  aria-label={`${row.nameKo} 선택`}
                  className="mt-tight h-4 w-4 shrink-0 accent-primary"
                />

                {/* min-w-0 이 없으면 긴 이메일이 카드 밖으로 삐져나갑니다. */}
                <div className="flex min-w-0 flex-1 flex-col gap-tight">
                  <div className="flex items-start justify-between gap-sibling">
                    <div className="flex min-w-0 items-center gap-sibling">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sub-bg text-caption text-sub-text"
                      >
                        {[...row.nameKo][0] ?? "?"}
                      </span>
                      <span className="truncate text-body-bold">{row.nameKo}</span>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-card border border-border px-sibling py-tight whitespace-nowrap ${STATUS_STYLE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>

                  <p className="text-caption text-sub-text">
                    {[row.department, row.rank].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate text-caption text-sub-text">{row.email ?? "—"}</p>
                  <p className="text-caption text-sub-text">{formatDate(row.updatedAt)}</p>
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
              <th scope="col" className="w-12 px-group py-sibling">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={items.length === 0}
                  aria-label="이 페이지 전체 선택"
                  className="h-4 w-4 accent-primary"
                />
              </th>
              {["이름", "부서", "직위", "이메일", "수정일", "상태"].map((label) => (
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
                <td colSpan={7} className="px-group py-block text-center text-body text-sub-text">
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-group py-block text-center text-body text-sub-text">
                  조건에 맞는 직원이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                // primary-soft 는 "선택 상태 배경"으로만 쓰기로 되어 있습니다. 여기가 그 자리입니다.
                <tr
                  key={row.id}
                  className={`border-t border-border ${selected.has(row.id) ? "bg-primary-soft" : ""}`}
                >
                  <td className="px-group py-sibling">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`${row.nameKo} 선택`}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className={CELL}>
                    <div className="flex items-center gap-sibling">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sub-bg text-caption text-sub-text"
                      >
                        {[...row.nameKo][0] ?? "?"}
                      </span>
                      <span className="text-body-bold">{row.nameKo}</span>
                    </div>
                  </td>
                  <td className={CELL}>{row.department ?? "—"}</td>
                  <td className={CELL}>{row.rank ?? "—"}</td>
                  <td className={CELL}>{row.email ?? "—"}</td>
                  <td className="px-group py-sibling text-body text-sub-text whitespace-nowrap">
                    {formatDate(row.updatedAt)}
                  </td>
                  <td className="px-group py-sibling">
                    <span
                      className={`inline-flex rounded-card border border-border px-sibling py-tight whitespace-nowrap ${STATUS_STYLE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-group">
        <p className="text-caption text-sub-text">
          {selected.size > 0
            ? `${selected.size}명 선택됨`
            : `${firstRow} – ${lastRow} / ${total.toLocaleString("ko-KR")}`}
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

      <AddEmployeeDialog
        open={isAdding}
        onClose={() => setIsAdding(false)}
        // 추가 직후에는 수정일이 가장 최근이라 1페이지 맨 위에 옵니다.
        onCreated={() => {
          setPage(1);
          setReloadNonce((n) => n + 1);
        }}
      />
    </div>
  );
}
