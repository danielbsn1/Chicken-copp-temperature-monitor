import {
  requireDevice,
  requireOwnedDevice as ownedGuard,
} from "../../core/http/guards.js";
import { authenticate, ownsDevice } from "./devices.service.js";

export { devicesRouter } from "./devices.routes.js";
export {
  createPairedDevice,
  generateKey,
  hashKey,
  listDevices,
  listOwnedDevices,
  ownsDevice,
  registerDevice,
  setFirmware,
  touch,
} from "./devices.service.js";
export type { Tx } from "./devices.repository.js";

/** Guarda do ESP32 (X-Device-Key); o ingest o usa nas suas rotas. */
export const requireDeviceKey = requireDevice(authenticate);

/** Só o dono acessa rotas com ?deviceId=. */
export const requireOwnedDevice = ownedGuard(ownsDevice);
