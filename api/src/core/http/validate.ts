import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors.js";

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/** Valida body, params e query com zod. Em caso de falha, lança ValidationError com os detalhes. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: unknown[] = [];
    for (const part of ["body", "params", "query"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        details.push(
          ...result.error.issues.map((issue) => ({
            in: part,
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
        continue;
      }
      // req.query é somente leitura no Express 5; redefinimos a propriedade.
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (details.length > 0) return next(new ValidationError("Entrada inválida", details));
    next();
  };
}
