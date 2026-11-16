import { describe, expect, it } from "vitest";
import { ApiError } from "../shared/api/errors";
import { shouldRetry } from "./query-client";

describe("shouldRetry", () => {
  it("não repete erro 4xx", () => {
    expect(shouldRetry(0, new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, "NOT_FOUND", "x"))).toBe(false);
  });

  it("repete erro 5xx e de rede até 2 vezes", () => {
    expect(shouldRetry(0, new ApiError(500, "INTERNAL_ERROR", "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(0, "NETWORK_ERROR", "x"))).toBe(true);
    expect(shouldRetry(2, new ApiError(500, "INTERNAL_ERROR", "x"))).toBe(false);
  });
});
