import { requireDevice } from "../../core/http/guards.js";
import { authenticate } from "./devices.service.js";

export { devicesRouter } from "./devices.routes.js";
export { listDevices, registerDevice, setFirmware, touch } from "./devices.service.js";
export type { Tx } from "./devices.repository.js";

/** Guarda do ESP32 (X-Device-Key); o ingest o usa nas suas rotas. */
export const requireDeviceKey = requireDevice(authenticate);
