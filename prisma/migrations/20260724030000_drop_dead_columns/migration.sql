/*
  아무 데서도 읽지 않는 컬럼 둘을 뗍니다.

  - Company.logoUrl  — 명함 이미지는 /brand/logo-wordmark.png 를 코드에 직접 적어
                       씁니다. 이 값("/brand/logo.png")을 읽는 코드가 없습니다.
  - Employee.bio     — 카드·서명·vCard 어디에도 나가지 않습니다.

  지워지는 값(되돌리려면 이 주석을 보세요):
    Company.logoUrl = '/brand/logo.png'
    Employee(slug='hong').bio = '더 가볍고 강한 부품과 스마트한 제조로 미래를 만듭니다'
*/

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "logoUrl";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "bio";
