/**
 * 명함 이미지(/c/[slug]/card.png) 캐시 태그.
 *
 * 굽는 쪽(card.png 라우트)과 지우는 쪽(프로필·회사 저장 API)이 같은 문자열을 써야
 * 하는데, 한쪽에 두면 다른 쪽이 라우트 파일을 import 하게 됩니다. 라우트 파일은
 * 정해진 것만 export 할 수 있어서(GET·runtime 등) 거기에 상수를 얹으면 빌드가 막힙니다.
 * 그래서 양쪽 다 여기를 봅니다.
 */

/** 카드 한 장. 그 사람 프로필만 바뀌었을 때 씁니다. */
export const cardTag = (slug: string) => `card:${slug}`;

/** 카드 전부. 회사 값(주소·팩스·대표번호)은 전원의 이미지에 찍히므로 통째로 지웁니다. */
export const CARDS_TAG = "cards";
