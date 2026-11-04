import { keyMatches } from "../lib/device-key.js";
import { prisma } from "../lib/prisma.js";
import { findDevice } from "../repositories/devices.js";

export async function authenticateDevice(
  deviceId: string,
  key: string | undefined,
) {
  if (!key) return null;
  const device = await findDevice(prisma(), deviceId);
  if (!device || !keyMatches(key, device.keyHash)) return null;
  return device;
}
