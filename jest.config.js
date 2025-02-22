export const preset = "ts-jest";
export const testEnvironment = "node";
export const moduleFileExtensions = ["ts", "js"];
export const testMatch = ["**/__tests__/**/*.test.ts"];
export const transform = {
  "^.+\\.ts$": "ts-jest",
};
