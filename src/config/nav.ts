import type { Role } from "@/lib/session-token";

/**
 * 로그인 후 화면의 네비게이션 항목.
 *
 * TopNav(데스크톱 가로 메뉴)와 BottomTabBar(모바일 하단 탭)가 같은 목록을 그립니다.
 * 각자 배열을 들고 있으면 항목을 하나 추가할 때 한쪽만 고쳐 놓고 "넣었다" 고
 * 믿게 되므로 여기 한 곳에만 둡니다.
 *
 * icon 은 컴포넌트가 아니라 이름입니다. 이 파일이 아이콘 모듈을 import 하면
 * 서버 설정 파일이 JSX 에 묶여서, 아이콘과 무관한 곳에서도 딸려 들어옵니다.
 * 실제 매핑은 BottomTabBar 가 합니다.
 */
export type NavIcon = "user" | "mail" | "users";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/edit", label: "내 명함", icon: "user" },
  { href: "/edit/signature", label: "이메일 서명", icon: "mail" },
  { href: "/admin/employees", label: "임직원 관리", icon: "users", adminOnly: true },
];

/**
 * 해당 역할이 볼 수 있는 항목만 남깁니다.
 *
 * `임직원 관리` 는 /admin 아래라 middleware 가 이미 막고 있지만, 회원에게
 * 보여주고 눌렀을 때 튕기는 것보다 아예 안 보이는 편이 낫습니다.
 */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}
