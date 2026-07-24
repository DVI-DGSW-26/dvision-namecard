"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AddEmployeeDialog } from "@/components/AddEmployeeDialog";
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

  /* 관리 동작(상태 변경·주소 변경·삭제) ------------------------------------- */

  const [slugTarget, setSlugTarget] = useState<EmployeeListItem | null>(null);
  // 삭제는 되돌릴 수 없어서 한 번 더 묻습니다. 확인 대상의 id 를 들고 있습니다.
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
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

  /** 목록을 다시 받아옵니다. 관리 동작은 전부 성공 후 이걸 부릅니다. */
  const refresh = useCallback(() => setReloadNonce((n) => n + 1), []);

  /**
   * 관리 동작 한 번 = 요청 한 번 + 목록 새로고침.
   *
   * 낙관적 갱신을 하지 않습니다 — 상태·주소는 서버가 거절할 수 있는 값이고
   * (중복 주소, 이미 지워진 행), 화면만 먼저 바꾸면 되돌리는 코드가 더 복잡해집니다.
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

  const changeRowStatus = useCallback(
    (row: EmployeeListItem, next: Status) =>
      runAction(`/api/employees/${row.id}/admin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // 주소·권한은 그대로 두고 상태만 바꿉니다. 스키마가 세 값을 함께 받습니다.
        body: JSON.stringify({ status: next, slug: row.slug, role: row.role }),
      }),
    [runAction],
  );

  const changeRowRole = useCallback(
    (row: EmployeeListItem, next: "MEMBER" | "ADMIN") =>
      runAction(`/api/employees/${row.id}/admin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: row.status, slug: row.slug, role: next }),
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

  const deleteRow = useCallback(
    async (row: EmployeeListItem) => {
      const ok = await runAction(`/api/employees/${row.id}`, { method: "DELETE" });
      if (ok) {
        setDeleteTarget(null);
        // 지운 사람이 선택 목록에 남아 있으면 다음 일괄 동작이 404 를 받습니다.
        setSelected((previous) => {
          const next = new Set(previous);
          next.delete(row.id);
          return next;
        });
      }
    },
    [runAction],
  );

  const runBulk = useCallback(
    async (payload: { action: "status"; status: Status } | { action: "delete" }) => {
      const ok = await runAction("/api/employees/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, ids: [...selected] }),
      });
      if (ok) {
        setSelected(new Set());
        setBulkConfirm(false);
      }
    },
    [runAction, selected],
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

      {actionError ? (
        <p role="alert" className="rounded-card bg-sub-bg px-group py-sibling text-caption text-text">
          {actionError}
        </p>
      ) : null}

      {/*
        선택 도구막대 — 고른 사람이 있을 때만 나타납니다.

        페이지를 넘겨도 선택이 유지되므로(toggleAllOnPage 가 현재 페이지만 건드립니다)
        여기 숫자는 화면에 보이는 행 수와 다를 수 있습니다. 그래서 "N명" 을 문구로 밝힙니다.
      */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-sibling rounded-card border border-border bg-sub-bg px-group py-sibling">
          <p className="text-caption-bold text-text">{selected.size}명 선택됨</p>

          {bulkConfirm ? (
            <>
              <p className="text-caption text-text">
                선택한 {selected.size}명을 완전히 지웁니다. 명함 주소와 조회 기록이 함께
                사라지고 되돌릴 수 없습니다.
              </p>
              <div className="ml-auto flex gap-sibling">
                <button
                  type="button"
                  onClick={() => setBulkConfirm(false)}
                  className="h-10 rounded-card border border-border bg-bg px-group text-caption-bold text-text"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => runBulk({ action: "delete" })}
                  disabled={isActing}
                  className="h-10 rounded-card bg-primary px-group text-caption-bold text-white disabled:bg-bg disabled:text-sub-text"
                >
                  {isActing ? "지우는 중…" : "완전 삭제"}
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto flex flex-wrap items-center gap-sibling">
              {/* 값을 고르는 즉시 실행되고 선택은 초기화됩니다. 그래서 항상 안내 문구로 되돌립니다. */}
              <select
                value=""
                disabled={isActing}
                onChange={(event) => {
                  if (!event.target.value) return;
                  runBulk({ action: "status", status: event.target.value as Status });
                }}
                aria-label="선택한 직원 상태 변경"
                className="h-10 rounded-card border border-border bg-bg px-sibling text-caption text-text focus:border-text focus:outline-none disabled:text-sub-text"
              >
                <option value="">상태 변경…</option>
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]} 으로
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setBulkConfirm(true)}
                disabled={isActing}
                className="h-10 rounded-card border border-border bg-bg px-group text-caption-bold text-text disabled:text-sub-text"
              >
                완전 삭제
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-10 rounded-card px-group text-caption text-sub-text hover:text-text"
              >
                선택 해제
              </button>
            </div>
          )}
        </div>
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
                    <select
                      value={row.status}
                      disabled={isActing}
                      onChange={(event) => changeRowStatus(row, event.target.value as Status)}
                      aria-label={`${row.nameKo} 상태`}
                      className={`h-9 shrink-0 rounded-card border border-border bg-bg px-sibling whitespace-nowrap focus:border-text focus:outline-none disabled:text-sub-text ${STATUS_STYLE[row.status]}`}
                    >
                      {STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABEL[value]}
                        </option>
                      ))}
                    </select>
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
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="h-9 rounded-card border border-border px-group text-caption text-text"
                    >
                      삭제
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
                <td colSpan={9} className="px-group py-block text-center text-body text-sub-text">
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-group py-block text-center text-body text-sub-text">
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
                  <td className="px-group py-sibling">
                    {/* 배지가 아니라 선택 상자입니다 — 여기가 상태를 바꾸는 유일한 자리입니다. */}
                    <select
                      value={row.status}
                      disabled={isActing}
                      onChange={(event) => changeRowStatus(row, event.target.value as Status)}
                      aria-label={`${row.nameKo} 상태`}
                      className={`h-9 rounded-card border border-border bg-bg px-sibling whitespace-nowrap focus:border-text focus:outline-none disabled:text-sub-text ${STATUS_STYLE[row.status]}`}
                    >
                      {STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-group py-sibling">
                    {/*
                      권한도 상태와 같은 선택 상자입니다. 예전에는 어떤 공용 비밀번호로
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
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="h-9 rounded-card border border-border px-sibling text-caption text-text hover:border-text"
                      >
                        삭제
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
        한 명 삭제 확인. 별도 모달을 띄우지 않고 표 아래 띠로 보여 줍니다 —
        모달을 열면 지우려는 행이 가려져서 누구를 지우는지 확인할 수 없습니다.
      */}
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

      {deleteTarget ? (
        <div className="flex flex-wrap items-center gap-sibling rounded-card border border-border px-group py-sibling">
          <p className="text-caption text-text">
            <strong className="text-caption-bold">{deleteTarget.nameKo}</strong> 님을 완전히
            지웁니다. 명함 주소(/c/{deleteTarget.slug})가 사라지고 이미 보낸 서명의 링크도
            깨집니다. 퇴사 처리라면 상태를 &lsquo;비활성&rsquo;으로 바꾸세요.
          </p>
          <div className="ml-auto flex gap-sibling">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="h-10 rounded-card border border-border px-group text-caption-bold text-text"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => deleteRow(deleteTarget)}
              disabled={isActing}
              className="h-10 rounded-card bg-primary px-group text-caption-bold text-white disabled:bg-sub-bg disabled:text-sub-text"
            >
              {isActing ? "지우는 중…" : "완전 삭제"}
            </button>
          </div>
        </div>
      ) : null}

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

      <EditSlugDialog
        target={slugTarget}
        onClose={() => setSlugTarget(null)}
        onSaved={refresh}
      />
    </div>
  );
}
