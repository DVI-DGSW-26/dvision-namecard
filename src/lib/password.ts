import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * 비밀번호 해시. node:crypto 의 scrypt 만 씁니다.
 *
 * bcrypt·argon2 를 안 쓴 이유: 둘 다 네이티브 빌드가 필요해서 배포 환경마다 걸리는
 * 데가 다릅니다. scrypt 는 Node 에 내장이고 메모리 강도(N)를 직접 정할 수 있어,
 * 사내 도구 규모에서는 이걸로 충분합니다.
 *
 * node:crypto 를 쓰므로 이 파일은 Node 런타임 전용입니다 — middleware(Edge)에서
 * import 하지 마세요. 거기서 필요한 건 lib/session-token.ts 뿐입니다.
 */

/**
 * scrypt 의 프로미스 판.
 *
 * promisify 를 쓰지 않는 이유: 옵션 인자를 받는 오버로드가 타입에 실리지 않아
 * 파라미터(N·r·p)를 넘기는 순간 인자 개수가 안 맞다고 나옵니다.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/*
  scrypt 파라미터.

  N 은 2의 거듭제곱이어야 하고 메모리 사용량이 128 * N * r 바이트입니다.
  16384 * 8 * 128 = 16MB — 로그인 한 번에 16MB, 수십 ms 수준입니다. 사내 인원
  규모에서 동시 로그인이 몰릴 일이 없어 이 정도로 둡니다.

  값을 바꾸면 기존 해시를 못 읽게 되므로, 해시 문자열 안에 파라미터를 함께
  적어 둡니다. 나중에 강도를 올려도 옛 해시는 옛 파라미터로 검증됩니다.
*/
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** 저장 형식: `scrypt$N$r$p$salt$hash` (salt·hash 는 base64) */
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return [PREFIX, N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

/**
 * 비밀번호가 해시와 맞는지. 형식이 깨졌거나 해시가 없으면 false 입니다.
 *
 * 예외를 던지지 않고 false 로 떨어뜨립니다 — 로그인 실패와 저장값 손상을 호출부에서
 * 구분해 봐야 사용자에게 해 줄 말이 같고, 구분해서 알려주면 그게 곧 정보가 됩니다.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isFinite(cost.N) || !Number.isFinite(cost.r) || !Number.isFinite(cost.p)) return false;

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scrypt(password, salt, expected.length, cost);
    // 길이가 다르면 timingSafeEqual 이 던집니다. 길이 자체도 정보라 먼저 걸러 냅니다.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/*
  초기 비밀번호에 쓰는 글자.

  사람이 눈으로 읽고 받아 적는 값이라 헷갈리는 글자를 뺐습니다 —
  0/O, 1/l/I. 대문자만 쓰면 읽기는 쉬운데 자릿수 대비 강도가 떨어져서
  소문자·숫자를 함께 둡니다.
*/
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 초기 비밀번호 길이. 12자 × 56글자면 무차별 대입으로 뚫을 값이 아닙니다. */
const GENERATED_LENGTH = 12;

/**
 * 관리자가 발급하는 초기 비밀번호를 만듭니다.
 *
 * 관리자가 직접 정하게 두지 않는 이유: 여섯 명에게 나눠 줄 비밀번호를 사람이 짜면
 * 회사이름1234 류가 나오고, 한 명 것을 알면 나머지도 짐작됩니다.
 *
 * randomBytes 를 글자 수로 나눌 때 나머지가 생기면 앞쪽 글자가 더 자주 나옵니다.
 * 256 을 알파벳 길이로 나눈 나머지 구간의 값은 버려서 균등하게 뽑습니다.
 */
export function generatePassword(length: number = GENERATED_LENGTH): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";

  while (out.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }

  return out;
}
