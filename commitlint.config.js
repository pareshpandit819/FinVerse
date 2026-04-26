/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "revert", "ci", "build"],
    ],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 200],
  },
};
