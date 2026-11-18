import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

describe("errors", () => {
  it.each([
    [new ValidationError(), 400, "VALIDATION_ERROR"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new RateLimitError(), 429, "RATE_LIMITED"],
  ])("%s tem status e code fixos", (err, status, code) => {
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
  });

  it("ValidationError carrega os detalhes", () => {
    expect(new ValidationError("x", [{ a: 1 }]).details).toEqual([{ a: 1 }]);
  });
});
