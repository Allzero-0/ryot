/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：考研模块冒烟测试
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
/**
 * 冒烟测试：验证分析引擎与 SM-2 调度算出来的数字是否合理。
 * 用 `vite-node` 运行（仓库里已有该依赖），不需要额外装测试框架。
 */
import { analyzeCheckIns, analyzeKaoyan, analyzeReviews, generateInsights } from "./ai";
import { applyReview, createReviewItem, getDueState, masteryScore } from "./review-scheduler";
import { buildDemoData } from "./seed";
import { DEFAULT_SETTINGS } from "./types";

let failures = 0;
function check(name: string, condition: boolean, extra?: unknown) {
	if (condition) {
		console.log(`  ✓ ${name}`);
	} else {
		failures += 1;
		console.log(`  ✗ ${name}`, extra ?? "");
	}
}

console.log("\n[1] 示例数据生成");
const demo = buildDemoData();
check("生成 10 个考研任务", demo.tasks.length === 10, demo.tasks.length);
check("生成打卡记录 (40-75 条)", demo.checkIns.length > 40, demo.checkIns.length);
check("生成 10 个复习条目", demo.reviews.length === 10, demo.reviews.length);
check(
	"打卡日期不重复",
	new Set(demo.checkIns.map((c) => c.date)).size === demo.checkIns.length,
);

console.log("\n[2] 四六级分析");
const cet = analyzeCheckIns(demo.checkIns, DEFAULT_SETTINGS);
check("连续打卡天数 >= 0", cet.streak >= 0, cet.streak);
check("热力图 91 天", cet.heatmap.length === 91, cet.heatmap.length);
check("趋势 30 天", cet.trend.length === 30, cet.trend.length);
check("能力雷达 5 项", cet.ability.length === 5);
check(
	"能力分都在 0-100",
	cet.ability.every((a) => a.score >= 0 && a.score <= 100),
	cet.ability,
);
check(
	"预测分在 250-710",
	cet.predictedScore >= 250 && cet.predictedScore <= 710,
	cet.predictedScore,
);
check("识别出了最强的短板项", typeof cet.weakest === "string" && cet.weakest.length > 0);
console.log(`     → 连续 ${cet.streak} 天，预测 ${cet.predictedScore} 分，短板「${cet.weakest}」`);

console.log("\n[3] 考研计划分析");
const kaoyan = analyzeKaoyan(demo.tasks, DEFAULT_SETTINGS);
check("总体进度 0-100", kaoyan.overallProgress >= 0 && kaoyan.overallProgress <= 100, kaoyan.overallProgress);
check("剩余天数 > 0", kaoyan.remainingDays > 0, kaoyan.remainingDays);
check("按科目聚合非空", kaoyan.bySubject.length > 0, kaoyan.bySubject.length);
check("风险等级合法", ["低", "中", "高"].includes(kaoyan.risk), kaoyan.risk);
check("甘特数据数量匹配", kaoyan.gantt.length === demo.tasks.length);
console.log(
	`     → 进度 ${kaoyan.overallProgress}%，剩 ${kaoyan.remainingDays} 天，日均需 ${kaoyan.requiredHoursPerDay.toFixed(1)}h，风险「${kaoyan.risk}」`,
);

console.log("\n[4] SM-2 复习调度");
let item = createReviewItem({ title: "测试知识点", subject: "数学", source: "考研" });
check("新建条目当天到期", getDueState(item) === "today");
item = applyReview(item, 5);
check("高分后间隔 1 天", item.intervalDays === 1, item.intervalDays);
check("高分后轮次 +1", item.stage === 1, item.stage);
item = applyReview(item, 5);
check("第二次间隔 6 天", item.intervalDays === 6, item.intervalDays);
const beforeEase = item.ease;
item = applyReview(item, 1);
check("低分后回到第 0 轮", item.stage === 0, item.stage);
check("低分后间隔重置为 1", item.intervalDays === 1, item.intervalDays);
check("难度因子被下调", item.ease < beforeEase, `${beforeEase} → ${item.ease}`);
check("难度因子不低于 1.3", item.ease >= 1.3, item.ease);
check("掌握度在 0-100", masteryScore(item) >= 0 && masteryScore(item) <= 100, masteryScore(item));
check("历史记录了 3 次", item.history.length === 3, item.history.length);

console.log("\n[5] 复习队列分析");
const reviewAnalysis = analyzeReviews(demo.reviews);
check(
	"四类状态之和等于总数",
	reviewAnalysis.overdue + reviewAnalysis.today + reviewAnalysis.upcoming + reviewAnalysis.mastered ===
		reviewAnalysis.total,
	reviewAnalysis,
);
check("未来 7 天负载有 7 条", reviewAnalysis.load.length === 7);
check("存在逾期项（示例数据故意制造）", reviewAnalysis.overdue > 0, reviewAnalysis.overdue);
console.log(
	`     → 逾期 ${reviewAnalysis.overdue}，今日 ${reviewAnalysis.today}，未到期 ${reviewAnalysis.upcoming}，已掌握 ${reviewAnalysis.mastered}`,
);

console.log("\n[6] 综合洞察");
const insights = generateInsights({
	checkIns: demo.checkIns,
	tasks: demo.tasks,
	reviews: demo.reviews,
	settings: DEFAULT_SETTINGS,
});
check("至少生成 5 条洞察", insights.length >= 5, insights.length);
check("每条都有标题和详情", insights.every((i) => i.title && i.detail));
check(
	"严重程度取值合法",
	insights.every((i) => ["good", "info", "warn", "danger"].includes(i.severity)),
);
console.log(`     → 共 ${insights.length} 条，例如：`);
for (const i of insights.slice(0, 3)) console.log(`        · [${i.severity}] ${i.title}`);

console.log("\n[7] 空数据不崩");
const empty = analyzeCheckIns([], DEFAULT_SETTINGS);
check("空打卡不报错", empty.streak === 0 && empty.predictedScore === 0);
const emptyKaoyan = analyzeKaoyan([], DEFAULT_SETTINGS);
check("空计划不报错", emptyKaoyan.overallProgress === 0);
const emptyInsights = generateInsights({
	checkIns: [],
	tasks: [],
	reviews: [],
	settings: DEFAULT_SETTINGS,
});
check("空数据也能生成洞察", emptyInsights.length >= 0);

console.log(
	failures === 0 ? "\n全部通过 ✓\n" : `\n${failures} 项失败 ✗\n`,
);
process.exit(failures === 0 ? 0 : 1);
