import { beforeEach, describe, expect, it, vi } from "vitest";

const pg = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(options: unknown) {
      pg.calls.push(options);
    }
  },
}));
vi.mock("../generated/prisma/client.js", () => ({
  PrismaClient: class {},
}));

describe("db", () => {
  beforeEach(() => {
    pg.calls.length = 0;
    vi.resetModules();
  });

  it("usa a URL do pooler e no máximo 1 conexão", async () => {
    await import("./db.js");
    expect(pg.calls).toEqual([
      {
        connectionString: "postgres://chicken:chicken@localhost:5433/chicken",
        max: 1,
      },
    ]);
  });

  it("cria um único cliente por processo, mesmo importado duas vezes", async () => {
    const a = await import("./db.js");
    const b = await import("./db.js");
    expect(a.db).toBe(b.db);
    expect(pg.calls).toHaveLength(1);
  });
});
