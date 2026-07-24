import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cardTag } from "@/lib/card-cache";
import { MAX_UPLOAD_BYTES, isAcceptedType, photoUrlFor, processPhoto } from "@/lib/photo";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

/**
 * 프로필 사진 올리기·지우기.
 *
 * 권한 규칙은 프로필 수정(/api/employees/[id])과 같습니다 — 본인 것이거나 관리자.
 * 여기만 느슨하면 남의 명함에 아무 사진이나 걸 수 있습니다.
 *
 * sharp 를 쓰므로 Node 런타임이어야 합니다. (Route Handler 는 기본이 Node 런타임)
 */

/** 본인이거나 관리자인지. 아니면 응답을 돌려줍니다. */
async function guard(id: string) {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  if (session.role !== "admin" && session.employeeId !== id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "본인의 명함만 수정할 수 있습니다." }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const allowed = await guard(id);
  if (!allowed.ok) return allowed.response;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { slug: true } });
  if (!employee) {
    return NextResponse.json({ error: "없는 직원입니다." }, { status: 404 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("photo");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ errors: { photo: "사진 파일을 선택해 주세요." } }, { status: 422 });
  }
  // 크기를 먼저 봅니다. 큰 파일을 sharp 에 넘긴 뒤 거절하면 그만큼 메모리를 씁니다.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { errors: { photo: "사진은 10MB 이하만 올릴 수 있습니다." } },
      { status: 422 },
    );
  }
  if (!isAcceptedType(file.type)) {
    return NextResponse.json(
      { errors: { photo: "JPG · PNG · WebP · HEIC 만 올릴 수 있습니다." } },
      { status: 422 },
    );
  }

  const processed = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!processed) {
    return NextResponse.json(
      { errors: { photo: "이미지를 읽지 못했습니다. 다른 파일로 시도해 주세요." } },
      { status: 422 },
    );
  }

  try {
    const saved = await prisma.employeePhoto.upsert({
      where: { employeeId: id },
      update: { data: processed.data, mimeType: processed.mimeType },
      create: { employeeId: id, data: processed.data, mimeType: processed.mimeType },
      select: { updatedAt: true },
    });

    // 카드가 보는 건 이 주소뿐입니다. 갱신 시각을 붙여 옛 사진이 캐시에 남지 않게 합니다.
    const photoUrl = photoUrlFor(employee.slug, saved.updatedAt);
    await prisma.employee.update({ where: { id }, data: { photoUrl } });

    revalidateTag(cardTag(employee.slug), { expire: 0 });
    return NextResponse.json({ ok: true, photoUrl });
  } catch {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const allowed = await guard(id);
  if (!allowed.ok) return allowed.response;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { slug: true } });
  if (!employee) {
    return NextResponse.json({ error: "없는 직원입니다." }, { status: 404 });
  }

  try {
    // 사진이 없어도 성공으로 답합니다 — 두 번 눌렀을 때 오류가 뜰 이유가 없습니다.
    await prisma.employeePhoto.deleteMany({ where: { employeeId: id } });
    await prisma.employee.update({ where: { id }, data: { photoUrl: null } });

    revalidateTag(cardTag(employee.slug), { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "지우지 못했습니다." }, { status: 500 });
  }
}
