import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma 가 생성하는 코드는 린트 대상이 아닙니다.
    "src/generated/**",
  ]),
  {
    rules: {
      // 스텁 단계라 안 쓰는 인자가 많습니다. `_` 접두사는 "의도적으로 안 씀" 표시로
      // 취급해 통과시키고, 진짜 실수로 남은 변수만 경고가 뜨게 합니다.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
