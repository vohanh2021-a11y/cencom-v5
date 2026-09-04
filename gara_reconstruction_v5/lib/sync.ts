/**
 * lib/sync.ts — Hub sync engine cho Spoke offline
 * Spoke push → Hub validate → conflicts → confirm
 */
import { z } from "zod";

export const SyncItemSchema = z.object({
  id: z.string().min(1),
  loai: z.enum(["scCreate", "scAddVatTu", "nhapKho", "dmCreate", "scUpdate"]),
  payload: z.record(z.any()),
  client_ts: z.string().optional()
});

export const SyncPushSchema = z.object({
  device_id: z.string().optional(),
  items: z.array(SyncItemSchema).min(1).max(50)
});

export type SyncItem = z.infer<typeof SyncItemSchema>;

export interface SyncConflict {
  id: string;
  reason: string;
  serverRow?: any;
}
