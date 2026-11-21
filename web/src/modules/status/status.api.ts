import { http } from "../../shared/api/http";
import { statusSchema, type DeviceStatus } from "./status.schemas";

export function getStatus(deviceId: string, signal?: AbortSignal): Promise<DeviceStatus> {
  return http("/status", { query: { deviceId }, signal }, statusSchema);
}
