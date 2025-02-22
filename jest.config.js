module.exports = {
  // Configurações básicas
  preset: "ts-jest",
  testEnvironment: "node",

  // Extensões de arquivo que o Jest deve considerar
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Padrão para encontrar arquivos de teste
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)", // Arquivos .test.ts ou .test.js
    "**/?(*.)+(spec|test).[jt]s?(x)", // Arquivos .spec.ts ou .spec.js
  ],

  // Transformações de arquivo
  transform: {
    "^.+\\.ts$": "ts-jest", // Compila TypeScript antes dos testes
  },

  // Cobertura de código
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/",
    "/dist/",
    "/coverage/",
  ],

  // Mapeamento de aliases (se estiver usando paths no tsconfig.json)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // Exemplo de alias @/ para src/
  },

  // Limite de tempo para cada teste (em milissegundos)
  testTimeout: 10000, // 10 segundos

  // Ignorar pastas específicas
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Configurações de watch mode
  watchPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Configurações de verbosidade
  verbose: true,
};
