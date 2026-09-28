/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：复习提醒（Notification API）
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import dayjs from "dayjs";
import type { ReviewItem, StudySettings } from "./types";
import { todayString } from "./types";
import { getDueState } from "./review-scheduler";

/**
 * 浏览器端复习提醒。
 *
 * 不做服务端推送：学习提醒的时效只在当天，用 Notification API 在页面打开时
 * 触发已经够用。若页面没打开，下次打开时会补一次提醒。
 */

const NOTIFIED_KEY = "ryot-study:notified-on";

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

export function getNotificationPermission(): PermissionState {
	if (typeof window === "undefined" || !("Notification" in window))
		return "unsupported";
	return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
	const state = getNotificationPermission();
	if (state !== "default") return state;
	const result = await Notification.requestPermission();
	return result as PermissionState;
}

/** 今天是否已经提醒过（避免每次刷新都弹） */
function alreadyNotified() {
	return window.localStorage.getItem(NOTIFIED_KEY) === todayString();
}

function markNotified() {
	window.localStorage.setItem(NOTIFIED_KEY, todayString());
}

export function getDueItems(items: ReviewItem[]) {
	return items.filter(
		(item) => getDueState(item) === "today" || getDueState(item) === "overdue",
	);
}

/**
 * 到点检查：当天已过提醒时间 + 有到期项 + 今天还没提醒过 → 弹系统通知。
 */
export function maybeNotify(settings: StudySettings, items: ReviewItem[]) {
	if (!settings.reminderEnabled) return false;
	if (getNotificationPermission() !== "granted") return false;
	if (alreadyNotified()) return false;

	const due = getDueItems(items);
	if (due.length === 0) return false;

	const [hour, minute] = settings.reminderTime.split(":").map(Number);
	const reminderAt = dayjs(todayString()).hour(hour || 21).minute(minute || 0);
	if (dayjs().isBefore(reminderAt)) return false;

	const overdue = due.filter((i) => getDueState(i) === "overdue").length;
	const body =
		overdue > 0
			? `今天有 ${due.length} 项待复习，其中 ${overdue} 项已逾期`
			: `今天有 ${due.length} 项待复习`;

	new Notification("该复习了", { body, icon: "/icons/maskable_icon_x180.png" });
	markNotified();
	return true;
}

/** 手动触发一次提醒（用于测试通知是否可用） */
export function testNotification(count: number) {
	if (getNotificationPermission() !== "granted") return false;
	new Notification("提醒测试", {
		body: count > 0 ? `当前有 ${count} 项待复习` : "通知通道正常",
	});
	return true;
}
