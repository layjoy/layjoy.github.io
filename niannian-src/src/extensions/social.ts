import type { TogetherSession } from "../types";

/**
 * 社交只留本地亲子确认。
 * 不提供开放聊天、好友列表或消息发送。
 */
export interface SocialExtension {
  id: string;
  confirmTogether(activityId: string): Promise<TogetherSession>;
}

export async function confirmTogetherLocal(activityId: string): Promise<TogetherSession> {
  return { activityId, confirmedByParent: true, at: Date.now() };
}
