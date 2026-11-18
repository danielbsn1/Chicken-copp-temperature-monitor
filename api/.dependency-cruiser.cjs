/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "1-modulo-so-pelo-index",
      comment:
        "Um módulo só importa de outro módulo pelo index.ts dele, nunca pelos arquivos internos.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/(?!$1/)[^/]+/",
        pathNot: "^src/modules/[^/]+/index\\.ts$",
      },
    },
    {
      name: "1-app-so-pelo-index",
      comment: "O app.ts registra os módulos somente pelo index.ts de cada um.",
      severity: "error",
      from: { path: "^src/app\\.ts$" },
      to: { path: "^src/modules/", pathNot: "^src/modules/[^/]+/index\\.ts$" },
    },
    {
      name: "2-sem-ciclos",
      comment: "Os módulos formam um grafo sem ciclos.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "3-core-nao-importa-modulos",
      comment: "O core/ não importa de nenhum módulo.",
      severity: "error",
      from: { path: "^src/core/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "4-express-so-em-controlador-e-rota",
      comment: "Só o controlador, a rota, o app e o core/http importam express.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: [
          "\\.(controller|routes)\\.ts$",
          "^src/app\\.ts$",
          "^src/core/http/",
          "\\.test\\.ts$",
        ],
      },
      to: { path: "node_modules/(@types/)?express/" },
    },
    {
      name: "5-prisma-so-no-repositorio",
      comment:
        "Só o repositório importa o cliente do Prisma; o serviço usa o repositório.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: ["\\.repository\\.ts$", "^src/core/db\\.ts$", "\\.test\\.ts$"],
      },
      to: {
        path: [
          "node_modules/@prisma/(client|adapter-pg)/",
          "^src/generated/",
          "^src/core/db\\.ts$",
        ],
      },
    },
    {
      name: "6-so-o-app-conhece-os-modulos",
      comment: "O app.ts é o único arquivo fora dos módulos que importa módulos.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: ["^src/modules/", "^src/app\\.ts$", "\\.test\\.ts$"],
      },
      to: { path: "^src/modules/" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^src/generated" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js"],
    },
  },
};
