/**
 * 以后接端到端同步时实现这个接口。
 * 只能收发已经加密的规则包字节，不能上传明文，也不能在这里做账号。
 */
export interface EndToEndSyncAdapter {
  id: string;
  pushEncrypted(bytes: Uint8Array): Promise<void>;
  pullEncrypted(): Promise<Uint8Array | null>;
}

const adapters: EndToEndSyncAdapter[] = [];

export function registerSyncAdapter(adapter: EndToEndSyncAdapter): void {
  if (!adapters.some((item) => item.id === adapter.id)) adapters.push(adapter);
}

export function listSyncAdapters(): string[] {
  return adapters.map((item) => item.id);
}
