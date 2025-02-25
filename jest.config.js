module.exports = {
  // Define que o Jest usará o preset "ts-jest" para compilar TypeScript
  preset: "ts-jest",

  // Define o ambiente de testes como Node.js (útil para aplicações backend)
  testEnvironment: "node",

  // Extensões de arquivos que o Jest deve reconhecer como módulos válidos
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Padrão para localizar arquivos de teste na estrutura do projeto
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)", // Testes dentro da pasta __tests__
    "**/?(*.)+(spec|test).[jt]s?(x)", // Arquivos que terminam em .spec ou .test
  ],

  // Configurações para transformar arquivos antes da execução dos testes
  transform: {
    "^.+\\.ts$": "ts-jest", // Compila arquivos TypeScript usando ts-jest
  },

  // Configuração para coleta de cobertura de código
  collectCoverage: true,
  coverageDirectory: "coverage", // Diretório onde será salva a cobertura
  coverageReporters: ["text", "lcov", "clover"], // Formatos de saída da cobertura
  coveragePathIgnorePatterns: [
    "/node_modules/", // Ignora dependências
    "/__tests__/", // Ignora arquivos de teste
    "/dist/", // Ignora arquivos de build
    "/coverage/", // Ignora pasta de relatórios de cobertura
  ],

  // Mapeamento de aliases de caminho (compatível com paths do tsconfig.json)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1", // Permite importar com "@/caminho" ao invés de "../../src/caminho"
  },

  // Define um tempo limite para execução de cada teste (10 segundos)
  testTimeout: 10000,

  // Ignora determinadas pastas para evitar execução desnecessária de testes
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Define arquivos e pastas que não devem ser observados pelo watch mode
  watchPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // Ativa a saída detalhada dos testes no console
  verbose: true,
};
