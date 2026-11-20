import { env } from "../../config/env";
import { http } from "../../shared/api/http";
import { statusSchema, type DeviceStatus } from "./status.schemas";

export function getStatus(signal?: AbortSignal): Promise<DeviceStatus> {
  return http("/status", { query: { deviceId: env.deviceId }, signal }, statusSchema);
}
