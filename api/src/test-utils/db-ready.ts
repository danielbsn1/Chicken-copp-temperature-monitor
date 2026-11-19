import { env } from "../config/env.js";

/**
 * Para os testes de contrato que usam o Postgres real. Só vale para banco local
 * (nunca escreve em banco remoto por engano). Fora da CI, sem banco migrado os
 * testes são pulados; na CI isso é falha, para o gate não passar em branco.
 * `probe` é uma consulta simples à tabela devices, passada pelo teste.
 */
export async function isDatabaseReady(probe: () => Promise<unknown>): Promise<boolean> {
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL);
  const ready =
    isLocal &&
    (await probe().then(
      () => true,
      () => false,
    ));
  if (process.env.CI && !ready) {
    throw new Error("CI sem Postgres migrado: o teste de contrato não pode ser pulado.");
  }
  return ready;
}
