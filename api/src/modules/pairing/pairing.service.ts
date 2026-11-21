import { randomBytes } from "node:crypto";
import { AppError, ConflictError, NotFoundError } from "../../core/errors.js";
import { signUp } from "../auth/index.js";
import { createPairedDevice, hashKey } from "../devices/index.js";
import * as repository from "./pairing.repository.js";
import type { AnnounceBody, ClaimBody, SignupBody } from "./pairing.schemas.js";

/** Quanto tempo a janela de pareamento fica aberta depois de apertar o botão. */
export const PAIRING_WINDOW_MS = 5 * 60 * 1000;

/**
 * Agrupa por "mesma rede": o IPv4 público inteiro, ou o /64 no IPv6 (o aparelho e o navegador
 * usam endereços diferentes dentro do mesmo /64). IPv4 embutido em IPv6 vira IPv4.
 */
export function ipGroup(ip: string): string {
  const clean = ip.split("%")[0] ?? ip;
  const mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) return mapped[1];
  if (!clean.includes(":")) return clean;
  const [head = "", tail = ""] = clean.split("::");
  const left = head ? head.split(":") : [];
  const right = clean.includes("::") && tail ? tail.split(":") : [];
  const fill = clean.includes("::")
    ? Array<string>(8 - left.length - right.length).fill("0")
    : [];
  const full = [...left, ...fill, ...right];
  const prefix = full
    .slice(0, 4)
    .map((part) => part.toLowerCase().replace(/^0+(?=.)/, ""));
  return `${prefix.join(":")}::/64`;
}

export type AnnounceResult =
  { status: "waiting"; pairing: boolean } | { status: "claimed"; deviceId: string };

/**
 * O ESP32 se anuncia (de tempos em tempos) enquanto não tem dono. Apertar o botão abre a
 * janela de pareamento de 5 min. Quando alguém vincula, a resposta passa a ser "claimed".
 */
export async function announce(
  ip: string,
  body: AnnounceBody,
  now = new Date(),
): Promise<AnnounceResult> {
  const group = ipGroup(ip);
  const keyHash = hashKey(body.key);
  const existing = await repository.find(body.serial);
  const sameKey = existing?.keyHash === keyHash;

  if (existing?.claimedDeviceId && sameKey) {
    await repository.touchClaimed(body.serial, group, now);
    return { status: "claimed", deviceId: existing.claimedDeviceId };
  }

  const open = body.button
    ? new Date(now.getTime() + PAIRING_WINDOW_MS)
    : sameKey && existing?.pairingUntil && existing.pairingUntil > now
      ? existing.pairingUntil
      : null;
  await repository.upsert({
    serial: body.serial,
    keyHash,
    fwVersion: body.fwVersion,
    ip: group,
    announcedAt: now,
    pairingUntil: open,
  });
  return { status: "waiting", pairing: open !== null };
}

/** Equipamentos em modo de pareamento vistos do mesmo IP de quem pergunta. */
export async function available(ip: string, now = new Date()) {
  const rows = await repository.listOpenByIp(ipGroup(ip), now);
  return rows.map((row) => ({
    serial: row.serial,
    fwVersion: row.fwVersion,
    expiresAt: row.pairingUntil?.toISOString() ?? null,
  }));
}

type Announcement = NonNullable<Awaited<ReturnType<typeof repository.find>>>;

/** O equipamento existe, está sem dono, com o botão apertado e (se não for manual) na mesma rede. */
async function assertClaimable(
  serial: string,
  ip: string,
  manual: boolean,
  now: Date,
): Promise<Announcement> {
  const announcement = await repository.find(serial);
  if (!announcement || announcement.claimedDeviceId) {
    throw new NotFoundError("Equipamento não encontrado");
  }
  if (!manual && announcement.ip !== ipGroup(ip)) {
    // Mesma resposta de um equipamento que não existe: não revela o de outra rede.
    throw new NotFoundError("Equipamento não encontrado");
  }
  if (!announcement.pairingUntil || announcement.pairingUntil <= now) {
    throw new AppError(
      409,
      "PAIRING_CLOSED",
      "Aperte o botão de pareamento do equipamento e tente de novo",
    );
  }
  return announcement;
}

/** Id legível do equipamento: o nome sem acentos, em minúsculas, com hífen, mais 4 caracteres. */
export function deviceIdFrom(name: string, suffix: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return `${slug || "galinheiro"}-${suffix}`;
}

const MAX_ID_ATTEMPTS = 5;

async function createFor(
  userId: string,
  announcement: Announcement,
  name: string,
): Promise<{ deviceId: string; name: string }> {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = deviceIdFrom(name, randomBytes(2).toString("hex"));
    const claimed = await repository.runInTransaction(async (tx) => {
      const created = await createPairedDevice(
        { id, name, keyHash: announcement.keyHash, ownerId: userId },
        tx,
      );
      if (!created) return "taken" as const;
      const marked = await repository.markClaimed(announcement.serial, id, tx);
      if (!marked) throw new ConflictError("Equipamento já vinculado");
      return "ok" as const;
    });
    if (claimed === "ok") return { deviceId: id, name };
  }
  throw new ConflictError("Não foi possível gerar um identificador; tente de novo");
}

/** Vincula o equipamento à conta já logada. */
export async function claim(
  userId: string,
  ip: string,
  body: ClaimBody,
  now = new Date(),
) {
  const announcement = await assertClaimable(body.serial, ip, body.manual, now);
  return createFor(userId, announcement, body.name);
}

/**
 * Cria a conta (e-mail e senha) e vincula o primeiro equipamento. Confere o equipamento antes
 * de criar a conta, para não deixar conta sem equipamento por um pareamento que não vale.
 */
export async function signupAndClaim(ip: string, body: SignupBody, now = new Date()) {
  const announcement = await assertClaimable(body.serial, ip, body.manual, now);
  const user = await signUp(body.email, body.password);
  return createFor(user.id, announcement, body.name);
}

/** Limpeza do job diário. */
export function purgeAnnouncements(before: Date): Promise<number> {
  return repository.deleteBefore(before);
}
