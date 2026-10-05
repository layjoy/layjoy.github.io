/**
 * 预留扩展。这些数组保持为空，不要接第三方统计。
 * 学习记录的同步走自己的后端（server/），上传前已经用家长口令加密。
 * 社交若以后再做，必须先有家长明确同意，并且这一版禁止联网聊天。
 */

export interface SyncAdapter {
  id: string;
  pushEncrypted(blob: Uint8Array): Promise<void>;
  pullEncrypted(): Promise<Uint8Array | null>;
}

export interface GrowthPort {
  id: string;
  saveSummary(text: string): Promise<void>;
}

export interface SocialPort {
  id: string;
  mode: "disabled";
}

export const syncAdapters: SyncAdapter[] = [];
export const growthPorts: GrowthPort[] = [];
export const socialPorts: SocialPort[] = [];
