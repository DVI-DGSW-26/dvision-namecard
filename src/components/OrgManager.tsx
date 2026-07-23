"use client";

import { useCallback, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/form";
import {
  ORG_KIND_LABEL,
  orgItemSchema,
  type OrgKind,
  type OrgLists,
  type TeamItem,
} from "@/lib/org";
import { fieldErrors } from "@/lib/validation";

/**
 * 조직 목록 관리 — 직위 · 임원 직책 · 직책 · 부서.
 *
 * 목록이 DB 테이블이라 관리자가 여기서 바꾸면 곧바로 /edit 의 선택 상자에 반영됩니다.
 * 저장할 때마다 서버에서 목록을 다시 받아 옵니다 — 낙관적 갱신을 하면 순서(sortOrder)
 * 정렬이 화면과 서버에서 갈립니다.
 *
 * 항목을 지워도 그 값을 쓰던 직원은 남습니다. 해당 칸만 비워집니다(서버의 SetNull).
 * 지우기 전에 그 사실을 문구로 알려 줍니다 — 되돌리려면 직원마다 다시 골라야 합니다.
 */

/** 탭 = 화면에 보이는 묶음. 부서 탭 하나가 팀과 파트 두 목록을 함께 다룹니다. */
const TABS = [
  { key: "ranks", label: ORG_KIND_LABEL.ranks },
  { key: "executiveTitles", label: ORG_KIND_LABEL.executiveTitles },
  { key: "positions", label: ORG_KIND_LABEL.positions },
  { key: "departments", label: "부서" },
  { key: "offices", label: ORG_KIND_LABEL.offices },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Draft = {
  name: string;
  nameEn: string;
  nameEnFull: string;
  sortOrder: string;
  teamId: string;
  postalCode: string;
  address: string;
};

const emptyDraft = (sortOrder: number, teamId = ""): Draft => ({
  name: "",
  nameEn: "",
  nameEnFull: "",
  sortOrder: String(sortOrder),
  teamId,
  postalCode: "",
  address: "",
});

/** 목록마다 쓰는 칸이 달라서, 없는 값은 빈 문자열로 채웁니다. 서버가 kind 별로 골라 씁니다. */
type AnyItem = {
  id: string;
  name: string;
  sortOrder: number;
  nameEn?: string;
  nameEnFull?: string;
  teamId?: string;
  postalCode?: string;
  address?: string;
};

const toDraft = (item: AnyItem): Draft => ({
  name: item.name,
  nameEn: item.nameEn ?? "",
  nameEnFull: item.nameEnFull ?? "",
  sortOrder: String(item.sortOrder),
  teamId: item.teamId ?? "",
  postalCode: item.postalCode ?? "",
  address: item.address ?? "",
});

export function OrgManager({ initial }: { initial: OrgLists }) {
  const [lists, setLists] = useState(initial);
  const [tab, setTab] = useState<TabKey>("ranks");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch("/api/org");
    if (response.ok) setLists(await response.json());
  }, []);

  /**
   * 쓰기 한 번 = 요청 한 번 + 목록 새로고침.
   *
   * 성공하면 null, 실패하면 필드별 오류를 돌려줍니다. 호출하는 쪽이 그 오류를
   * 자기 폼에 붙입니다 — 화면 상단에 몰아 보여 주면 어느 행이 틀렸는지 알 수 없습니다.
   */
  const send = useCallback(
    async (
      method: "POST" | "PATCH" | "DELETE",
      kind: OrgKind,
      id: string | null,
      body?: unknown,
    ): Promise<Record<string, string> | null> => {
      setBusy(true);
      setError(null);
      try {
        const path = id ? `/api/org/${kind}/${id}` : `/api/org/${kind}`;
        const response = await fetch(path, {
          method,
          ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          if (payload?.errors) return payload.errors;
          setError(payload?.error ?? "저장하지 못했습니다.");
          return {};
        }
        await reload();
        return null;
      } catch {
        setError("네트워크 오류로 저장하지 못했습니다.");
        return {};
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap gap-sibling border-b border-border">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={active ? "page" : undefined}
              className={[
                "-mb-px border-b-2 px-group py-sibling text-caption-bold",
                active ? "border-text text-text" : "border-transparent text-sub-text hover:text-text",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-caption text-text">{error}</p> : null}

      {tab === "departments" ? (
        <Departments teams={lists.teams} send={send} busy={busy} />
      ) : tab === "offices" ? (
        <SimpleList kind="offices" items={lists.offices} send={send} busy={busy} />
      ) : (
        <SimpleList
          kind={tab}
          items={tab === "executiveTitles" ? lists.executiveTitles : lists[tab]}
          send={send}
          busy={busy}
        />
      )}
    </div>
  );
}

type SendFn = (
  method: "POST" | "PATCH" | "DELETE",
  kind: OrgKind,
  id: string | null,
  body?: unknown,
) => Promise<Record<string, string> | null>;

/* 직위 · 임원 직책 · 직책 ---------------------------------------------------- */

function SimpleList({
  kind,
  items,
  send,
  busy,
}: {
  kind: OrgKind;
  items: AnyItem[];
  send: SendFn;
  busy: boolean;
}) {
  const nextOrder = useMemo(
    () => (items.length ? Math.max(...items.map((i) => i.sortOrder)) + 10 : 10),
    [items],
  );

  return (
    <section className="flex flex-col gap-group">
      <p className="text-caption text-sub-text">
        {kind === "offices"
          ? "명함에는 여기 등록된 사업장이 전부 찍힙니다. 우편번호는 (43011) 처럼 주소 앞에 붙습니다."
          : `${ORG_KIND_LABEL[kind]} 목록입니다. 순서 숫자가 작을수록 선택 상자에서 위에 놓입니다.`}
      </p>

      {items.length === 0 ? (
        <p className="text-body text-sub-text">아직 항목이 없습니다. 아래에서 추가하세요.</p>
      ) : (
        <ul className="flex flex-col gap-sibling">
          {items.map((item) => (
            <ItemRow key={item.id} kind={kind} item={item} send={send} busy={busy} />
          ))}
        </ul>
      )}

      <ItemRow kind={kind} item={null} send={send} busy={busy} nextOrder={nextOrder} />
    </section>
  );
}

/**
 * 한 항목의 편집 행. item 이 null 이면 추가용 빈 행입니다.
 *
 * 행마다 자기 draft 와 오류를 들고 있습니다. 부모가 한 벌로 관리하면 한 행을
 * 고치는 동안 다른 행의 입력이 사라집니다.
 */
function ItemRow({
  kind,
  item,
  send,
  busy,
  nextOrder = 10,
  teams,
}: {
  kind: OrgKind;
  item: AnyItem | null;
  send: SendFn;
  busy: boolean;
  nextOrder?: number;
  /** 파트 행에서만 씁니다 — 소속 팀을 고르는 선택 상자. */
  teams?: TeamItem[];
}) {
  // 목록마다 쓰는 칸이 다릅니다. 임원 직책만 영문이 두 벌이고, 사업장은 영문 대신 주소를 씁니다.
  const withFullName = kind === "executiveTitles";
  const isOffice = kind === "offices";
  const isNew = item === null;
  const [draft, setDraft] = useState<Draft>(
    item ? toDraft(item) : emptyDraft(nextOrder, teams?.[0]?.id ?? ""),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = (key: keyof Draft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function save() {
    // 서버와 같은 스키마로 먼저 걸러 냅니다. 서버도 다시 검증합니다.
    const parsed = orgItemSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const result = await send(isNew ? "POST" : "PATCH", kind, item?.id ?? null, draft);
    if (result) {
      setErrors(result);
      return;
    }
    // 추가 행은 비워서 다음 항목을 바로 입력할 수 있게 둡니다.
    if (isNew) setDraft(emptyDraft(nextOrder + 10, draft.teamId));
  }

  async function remove() {
    const result = await send("DELETE", kind, item!.id);
    if (result) setErrors(result);
  }

  const err = (key: string) => errors[key];

  return (
    <li className="rounded-card border border-border p-group">
      <div className="grid grid-cols-1 gap-group sm:grid-cols-[1fr_1fr_6rem]">
        <Field label="이름" htmlFor={`${kind}-${item?.id ?? "new"}-name`} error={err("name")}>
          <Input
            id={`${kind}-${item?.id ?? "new"}-name`}
            value={draft.name}
            placeholder={isNew ? "새 항목" : undefined}
            invalid={Boolean(err("name"))}
            onChange={(e) => set("name")(e.target.value)}
          />
        </Field>

        {isOffice ? (
          <Field
            label="우편번호"
            htmlFor={`${kind}-${item?.id ?? "new"}-postalCode`}
            error={err("postalCode")}
          >
            <Input
              id={`${kind}-${item?.id ?? "new"}-postalCode`}
              value={draft.postalCode}
              placeholder="43011"
              inputMode="numeric"
              invalid={Boolean(err("postalCode"))}
              onChange={(e) => set("postalCode")(e.target.value)}
            />
          </Field>
        ) : (
          <Field
            label={withFullName ? "영문 약어" : "영문 표기"}
            htmlFor={`${kind}-${item?.id ?? "new"}-nameEn`}
            error={err("nameEn")}
          >
            <Input
              id={`${kind}-${item?.id ?? "new"}-nameEn`}
              value={draft.nameEn}
              placeholder={withFullName ? "CEO" : "Manager"}
              invalid={Boolean(err("nameEn"))}
              onChange={(e) => set("nameEn")(e.target.value)}
            />
          </Field>
        )}

        <Field label="순서" htmlFor={`${kind}-${item?.id ?? "new"}-sortOrder`} error={err("sortOrder")}>
          <Input
            id={`${kind}-${item?.id ?? "new"}-sortOrder`}
            inputMode="numeric"
            value={draft.sortOrder}
            invalid={Boolean(err("sortOrder"))}
            onChange={(e) => set("sortOrder")(e.target.value)}
          />
        </Field>
      </div>

      {isOffice ? (
        <div className="mt-group">
          <Field
            label="주소"
            htmlFor={`${kind}-${item?.id ?? "new"}-address`}
            error={err("address")}
            hint={draft.postalCode ? `명함 표기: (${draft.postalCode}) ${draft.address}` : undefined}
          >
            <Input
              id={`${kind}-${item?.id ?? "new"}-address`}
              value={draft.address}
              placeholder="대구 북구 홈암로 51"
              invalid={Boolean(err("address"))}
              onChange={(e) => set("address")(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {withFullName ? (
        <div className="mt-group">
          <Field
            label="영문 정식 명칭"
            htmlFor={`${kind}-${item?.id ?? "new"}-nameEnFull`}
            error={err("nameEnFull")}
          >
            <Input
              id={`${kind}-${item?.id ?? "new"}-nameEnFull`}
              value={draft.nameEnFull}
              placeholder="Chief Executive Officer"
              invalid={Boolean(err("nameEnFull"))}
              onChange={(e) => set("nameEnFull")(e.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {teams ? (
        <div className="mt-group">
          <Field label="소속 팀" htmlFor={`${kind}-${item?.id ?? "new"}-teamId`} error={err("teamId")}>
            <Select
              id={`${kind}-${item?.id ?? "new"}-teamId`}
              value={draft.teamId}
              invalid={Boolean(err("teamId"))}
              onChange={(e) => set("teamId")(e.target.value)}
            >
              <option value="">선택</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      <div className="mt-group flex flex-wrap items-center justify-end gap-sibling">
        {confirmingDelete ? (
          <>
            <p className="mr-auto text-caption text-sub-text">
              지우면 이 값을 쓰던 직원의 칸이 비워집니다. 계속할까요?
            </p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-10 rounded-card border border-border px-group text-caption-bold text-text"
            >
              취소
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="h-10 rounded-card bg-primary px-group text-caption-bold text-white disabled:bg-sub-bg disabled:text-sub-text"
            >
              삭제
            </button>
          </>
        ) : (
          <>
            {!isNew ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="h-10 rounded-card border border-border px-group text-caption-bold text-text disabled:text-sub-text"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="h-10 rounded-card bg-primary px-group text-caption-bold text-white disabled:bg-sub-bg disabled:text-sub-text"
            >
              {isNew ? "추가" : "저장"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/* 부서 — 팀 안에 파트 -------------------------------------------------------- */

function Departments({
  teams,
  send,
  busy,
}: {
  teams: TeamItem[];
  send: SendFn;
  busy: boolean;
}) {
  const nextTeamOrder = teams.length ? Math.max(...teams.map((t) => t.sortOrder)) + 10 : 10;

  return (
    <section className="flex flex-col gap-section">
      <p className="text-caption text-sub-text">
        부서는 팀 · 파트 2단계입니다. 팀을 지우면 그 팀의 파트도 함께 사라집니다.
      </p>

      {teams.map((team) => {
        const nextPartOrder = team.parts.length
          ? Math.max(...team.parts.map((p) => p.sortOrder)) + 10
          : 10;
        return (
          <div key={team.id} className="flex flex-col gap-sibling">
            <ul>
              <ItemRow kind="teams" item={team} send={send} busy={busy} />
            </ul>

            <div className="ml-group border-l border-border pl-group">
              <p className="mb-sibling text-caption text-sub-text">파트</p>
              <ul className="flex flex-col gap-sibling">
                {team.parts.map((part) => (
                  <ItemRow
                    key={part.id}
                    kind="parts"
                    item={part}
                    send={send}
                    busy={busy}
                    teams={teams}
                  />
                ))}
                <ItemRow
                  // 팀이 바뀌면 추가 행의 기본 소속 팀도 바뀌어야 하므로 key 에 팀 id 를 넣습니다.
                  key={`new-part-${team.id}`}
                  kind="parts"
                  item={null}
                  send={send}
                  busy={busy}
                  nextOrder={nextPartOrder}
                  teams={[team]}
                />
              </ul>
            </div>
          </div>
        );
      })}

      <div>
        <p className="mb-sibling text-caption text-sub-text">팀 추가</p>
        <ul>
          <ItemRow
            kind="teams"
            item={null}
            send={send}
            busy={busy}
            nextOrder={nextTeamOrder}
          />
        </ul>
      </div>
    </section>
  );
}
