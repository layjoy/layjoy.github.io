/**
 * 预留扩展。v1 的数组都是空的。
 * 不要在这里接第三方统计，也不要上传儿童的学习内容、录音或心情。
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
