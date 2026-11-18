import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, log: createLogger("info", stream) };
}

describe("logger", () => {
  it("não registra cabeçalhos secretos", () => {
    const { lines, log } = capture();
    log.info(
      {
        req: {
          headers: {
            authorization: "Bearer SEGREDO-1",
            cookie: "session=SEGREDO-2",
            "x-device-key": "SEGREDO-3",
          },
        },
        res: { headers: { "set-cookie": "session=SEGREDO-4" } },
      },
      "req",
    );
    expect(lines.join("")).not.toMatch(/SEGREDO/);
  });

  it.each(["password", "token", "secret", "key", "deviceKey", "keyHash"])(
    "não registra o campo %s, nem aninhado",
    (field) => {
      const { lines, log } = capture();
      log.info({ [field]: "SEGREDO-A", dados: { [field]: "SEGREDO-B" } }, "x");
      expect(lines.join("")).not.toMatch(/SEGREDO/);
    },
  );

  it("mantém os campos comuns", () => {
    const { lines, log } = capture();
    log.info({ requestId: "r-1" }, "ok");
    expect(lines.join("")).toContain("r-1");
  });
});
