import sharp from "sharp";

/**
 * 프로필 사진 처리. 올라온 파일을 명함에 쓸 한 장으로 줄입니다.
 *
 * 원본을 그대로 두지 않는 이유: 요즘 폰 사진은 한 장에 3–8MB 인데 명함에서는
 * 96px 원으로 그려집니다. 그대로 저장하면 DB 도 커지고, 카드를 여는 사람이 매번
 * 그 용량을 내려받습니다.
 *
 * sharp 는 네이티브 모듈이라 Node 런타임 전용입니다 — Edge 에서 부르지 마세요.
 */

/** 저장할 한 변의 길이. 명함에서는 96px, 편집 미리보기에서도 96px 이라 2배수로 충분합니다. */
const SIZE = 512;

/** 업로드 상한. 폰 원본 사진이 대개 8MB 아래라 그보다 넉넉히 잡습니다. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** 받아들이는 형식. sharp 가 열 수 있고 브라우저가 흔히 올리는 것들입니다. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * 저장할 형태.
 *
 * Buffer 가 아니라 Uint8Array 인 이유: Prisma 의 Bytes 는 Uint8Array<ArrayBuffer> 를
 * 요구하는데, Buffer 의 backing buffer 타입이 더 넓어서 그대로는 들어가지 않습니다.
 */
export type ProcessedPhoto = { data: Uint8Array<ArrayBuffer>; mimeType: string };

export function isAcceptedType(mimeType: string): boolean {
  return ACCEPTED.includes(mimeType.toLowerCase());
}

/**
 * 정사각형 webp 한 장으로 만듭니다. 열 수 없는 파일이면 null.
 *
 * cover 로 자르는 이유: 명함의 사진 자리가 원형이라 비율이 다른 사진을 그대로
 * 넣으면 위아래가 잘리거나 좌우에 여백이 생깁니다. 가운데를 기준으로 잘라
 * 어떤 사진을 올려도 같은 모양이 되게 합니다.
 *
 * webp 로 통일하는 이유: 저장된 형식이 여러 가지면 내보낼 때마다 Content-Type 을
 * 따져야 하고, 같은 화질에서 JPEG 보다 작습니다.
 *
 * rotate() 를 먼저 부르는 건 EXIF 회전 정보 때문입니다. 폰으로 세로로 찍은 사진은
 * 실제 픽셀이 눕혀져 있고 "돌려서 보라" 는 표시만 붙어 있어서, 이걸 적용하지 않으면
 * 명함에 누운 얼굴이 들어갑니다.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto | null> {
  try {
    const buffer = await sharp(input)
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();

    // 복사본을 만들어 backing buffer 를 확정합니다. sharp 가 돌려주는 Buffer 는
    // 풀에서 잘라 쓴 조각이라 타입도 넓고, 그대로 두면 옆 데이터와 메모리를 공유합니다.
    const data = new Uint8Array(new ArrayBuffer(buffer.byteLength));
    data.set(buffer);

    return { data, mimeType: "image/webp" };
  } catch {
    // 이미지가 아니거나 깨진 파일입니다. 부르는 쪽이 422 로 답합니다.
    return null;
  }
}

/**
 * 사진을 내주는 공개 주소.
 *
 * 뒤에 갱신 시각을 붙입니다. 이게 없으면 사진을 바꿔도 브라우저와 중간 캐시가
 * 옛 사진을 계속 보여 줍니다 — 주소가 그대로이기 때문입니다.
 */
export function photoUrlFor(slug: string, updatedAt: Date): string {
  return `/c/${encodeURIComponent(slug)}/photo?v=${updatedAt.getTime()}`;
}
