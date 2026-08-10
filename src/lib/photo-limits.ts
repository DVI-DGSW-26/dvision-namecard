/**
 * 프로필 사진 업로드의 상한과 허용 형식.
 *
 * lib/photo.ts 가 아니라 여기에 두는 이유: 저 파일은 맨 위에서 sharp(네이티브
 * 모듈)를 불러오므로 클라이언트 컴포넌트가 import 할 수 없습니다. 그렇다고
 * PhotoPicker 에 같은 숫자를 한 번 더 적으면, 상한을 바꿀 때 한쪽만 고쳐서
 * "고를 때는 통과했는데 서버가 거절" 하는 상태가 됩니다. 그래서 양쪽이 여기를
 * 함께 봅니다. (lib/card-cache.ts 와 같은 이유입니다)
 */

/**
 * 업로드 상한.
 *
 * 4.5MB 는 Vercel Functions 의 요청 본문 한도입니다 — 이걸 넘으면 우리 코드가
 * 돌기도 전에 413(FUNCTION_PAYLOAD_TOO_LARGE)이 나가고, 그 응답은 JSON 이
 * 아니라서 화면에는 이유 없는 실패만 뜹니다. 멀티파트 경계·헤더가 몇백 바이트
 * 더 붙으므로 4MB 로 끊어 그 앞에서 우리가 먼저 막습니다.
 *
 * 폰 원본 사진은 이 상한을 자주 넘습니다. 그래서 PhotoPicker 가 넘는 파일만
 * 브라우저에서 한 번 줄여 보낸 뒤, 그래도 크면 이 상한으로 거절합니다.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** 사람에게 보여 줄 상한. 메시지마다 숫자를 새로 적지 않도록 여기서 만듭니다. */
export const MAX_UPLOAD_LABEL = `${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`;

/**
 * 받아들이는 형식.
 *
 * HEIC(아이폰 원본)는 뺐습니다. 서버의 sharp 가 쓰는 libvips 에는 HEVC 디코더가
 * 들어 있지 않아 열 수 없고(AVIF 만 됩니다), 받아 놓고 "이미지를 읽지 못했습니다"
 * 로 되돌려주는 건 아무 도움이 안 됩니다. 게다가 accept 목록에서 HEIC 를 빼면
 * iOS 사파리가 사진을 고르는 순간 JPEG 으로 바꿔서 넘겨줍니다 — 아이폰 사용자가
 * 아무것도 하지 않아도 되는 길입니다. 목록에 HEIC 를 적어 두면 원본이 그대로
 * 올라와 반드시 실패합니다.
 */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** <input type="file"> 의 accept 값. 목록과 갈라지지 않게 여기서 만듭니다. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",");

export function isAcceptedType(mimeType: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}
