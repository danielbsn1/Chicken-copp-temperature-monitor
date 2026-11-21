import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/errors";
import { pairingErrorMessage } from "./devices.hooks";

describe("pairingErrorMessage", () => {
  it.each([
    [new ApiError(409, "PAIRING_CLOSED", "x"), "Aperte o botão de pareamento"],
    [new ApiError(404, "NOT_FOUND", "x"), "Equipamento não encontrado"],
    [new ApiError(409, "CONFLICT", "x"), "Este e-mail já tem conta"],
    [new ApiError(400, "VALIDATION_ERROR", "x"), "12 caracteres"],
    [new ApiError(429, "RATE_LIMITED", "x"), "Muitas tentativas"],
    [new ApiError(0, "NETWORK_ERROR", "x"), "Sem conexão com o servidor"],
    [new ApiError(0, "TIMEOUT", "x"), "Sem conexão com o servidor"],
    [new ApiError(500, "INTERNAL", "x"), "Não foi possível vincular"],
    [new Error("qualquer coisa"), "Não foi possível vincular"],
  ])("%#: devolve a mensagem certa", (error, text) => {
    expect(pairingErrorMessage(error)).toContain(text);
  });
});
