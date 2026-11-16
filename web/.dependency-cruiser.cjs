/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "1-modulo-nao-importa-modulo",
      comment: "Nenhum módulo importa outro módulo.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: { path: "^src/modules/(?!$1/)[^/]+/" },
    },
    {
      name: "2-app-so-pelo-index",
      comment: "O app/ importa os módulos somente pelo index.ts deles.",
      severity: "error",
      from: { path: "^src/app/" },
      to: { path: "^src/modules/", pathNot: "^src/modules/[^/]+/index\\.ts$" },
    },
    {
      name: "3-shared-e-config-nao-conhecem-modulos",
      comment: "shared/ e config/ não importam de modules/ nem de app/.",
      severity: "error",
      from: { path: "^src/(shared|config)/" },
      to: { path: "^src/(modules|app)/" },
    },
    {
      name: "5-componentes-sem-api-e-query",
      comment:
        "Componentes não importam *.api.ts nem @tanstack/react-query; só os hooks fazem isso.",
      severity: "error",
      from: {
        path: "^src/(modules/[^/]+/components|shared/ui)/",
        pathNot: "\\.test\\.tsx?$",
      },
      to: { path: ["\\.api\\.ts$", "node_modules/@tanstack/react-query/"] },
    },
    {
      name: "6-sem-ciclos",
      comment: "Não há ciclos de importação.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
