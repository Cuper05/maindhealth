import { db } from "@/lib/db";
import { activityLogTable, type ActivityModule } from "@/lib/db/schema/activity-log";

type LogParams = {
  userId?: number;
  module: ActivityModule;
  action: string;
  recordId?: number;
  detail?: string;
};

export async function logActivity(params: LogParams) {
  try {
    await db.insert(activityLogTable).values({
      userId: params.userId,
      module: params.module,
      action: params.action,
      recordId: params.recordId,
      detail: params.detail,
    });
  } catch (err) {
    console.error("[activity_log]", err);
  }
}
