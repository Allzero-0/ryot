/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：AI 数据分析页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	Alert,
	Badge,
	Button,
	Card,
	Center,
	Code,
	CopyButton,
	Group,
	Loader,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { BarChart, LineChart, RadarChart } from "@mantine/charts";
import { IconBrain, IconDownload, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { ClientOnly } from "remix-utils/client-only";
import {
	analyzeCheckIns,
	analyzeKaoyan,
	analyzeReviews,
	generateInsights,
} from "~/lib/study/ai";
import { useStudy } from "~/lib/study/store";
import { todayString } from "~/lib/study/types";

const SEVERITY_COLORS = {
	good: "teal",
	info: "blue",
	warn: "yellow",
	danger: "red",
} as const;

export default function StudyAnalyticsPage() {
	const { loading, tasks, checkIns, reviews, settings } = useStudy();
	const [reportOpen, setReportOpen] = useState(false);

	if (loading)
		return (
			<Center h={300}>
				<Loader />
			</Center>
		);

	if (checkIns.length === 0 && tasks.length === 0)
		return (
			<Alert color="blue" title="数据太少，分析不了">
				至少要有几条打卡记录或几个计划任务，分析引擎才有东西可算。可以在总览页一键载入示例数据。
			</Alert>
		);

	const cet = analyzeCheckIns(checkIns, settings);
	const kaoyan = analyzeKaoyan(tasks, settings);
	const review = analyzeReviews(reviews);
	const insights = generateInsights({ checkIns, tasks, reviews, settings });

	const report = buildReport({
		date: todayString(),
		streak: cet.streak,
		totalDays: cet.totalDays,
		totalHours: Math.round(cet.totalMinutes / 60),
		predictedScore: cet.predictedScore,
		weakest: cet.weakest,
		strongest: cet.strongest,
		kaoyanProgress: kaoyan.overallProgress,
		kaoyanRisk: kaoyan.risk,
		requiredPerDay: kaoyan.requiredHoursPerDay,
		overdue: review.overdue,
		insights: insights.map((i) => `${i.title}：${i.detail}`),
	});

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>AI 数据分析</Title>
					<Text size="sm" c="dimmed">
						本地规则引擎 · 不联网 · 每条结论都可追溯到具体数字
					</Text>
				</Stack>
				<Group>
					<Button
						variant="default"
						leftSection={<IconSparkles size={16} />}
						onClick={() => setReportOpen((v) => !v)}
					>
						{reportOpen ? "收起报告" : "生成学习报告"}
					</Button>
					<CopyButton value={report}>
						{({ copied, copy }) => (
							<Button
								variant="default"
								leftSection={<IconDownload size={16} />}
								color={copied ? "teal" : undefined}
								onClick={copy}
							>
								{copied ? "已复制" : "复制报告"}
							</Button>
						)}
					</CopyButton>
				</Group>
			</Group>

			{reportOpen ? (
				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="xs">
						{todayString()} 学习报告
					</Text>
					<Code block style={{ whiteSpace: "pre-wrap" }}>
						{report}
					</Code>
				</Card>
			) : null}

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Group gap="xs">
						<IconBrain size={18} />
						<Text fw={600}>分析与建议</Text>
					</Group>
					<Badge variant="light">{insights.length} 条</Badge>
				</Group>
				<Stack gap="sm">
					{insights.map((insight) => (
						<Alert
							key={insight.title}
							color={SEVERITY_COLORS[insight.severity]}
							variant="light"
							title={insight.title}
							p="xs"
						>
							<Text size="sm">{insight.detail}</Text>
							{insight.action ? (
								<Text size="xs" c="dimmed" mt={4}>
									建议动作：{insight.action}
								</Text>
							) : null}
						</Alert>
					))}
				</Stack>
			</Card>

			<SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						四六级能力雷达
					</Text>
					<ClientOnly
						fallback={
							<Center h={280}>
								<Text size="sm" c="dimmed">
									图表加载中…
								</Text>
							</Center>
						}
					>
						{() => (
							<RadarChart
								h={280}
								data={cet.ability.map((a) => ({
									dimension: a.dimension,
									得分: a.score,
								}))}
								dataKey="dimension"
								series={[{ name: "得分", color: "blue.5", opacity: 0.4 }]}
								withPolarGrid
								withPolarAngleAxis
								withPolarRadiusAxis
								polarRadiusAxisProps={{ domain: [0, 100] }}
							/>
						)}
					</ClientOnly>
					<Text size="xs" c="dimmed">
						短板「{cet.weakest}」的边际收益最高；当前预测 {cet.predictedScore} 分（
						{cet.scoreBasis}）
					</Text>
				</Card>

				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						考研各科投入对比
					</Text>
					<ClientOnly
						fallback={
							<Center h={280}>
								<Text size="sm" c="dimmed">
									图表加载中…
								</Text>
							</Center>
						}
					>
						{() => (
							<BarChart
								h={280}
								data={kaoyan.bySubject.map((s) => ({
									科目: s.subject,
									计划: s.targetHours,
									已完成: s.doneHours,
								}))}
								dataKey="科目"
								series={[
									{ name: "计划", color: "gray.4" },
									{ name: "已完成", color: "blue.6" },
								]}
								gridAxis="y"
								type="default"
							/>
						)}
					</ClientOnly>
					<Text size="xs" c="dimmed">
						风险 {kaoyan.risk} · {kaoyan.riskReason}
					</Text>
				</Card>
			</SimpleGrid>

			<Card withBorder radius="md" padding="md">
				<Text fw={600} mb="sm">
					打卡时长趋势（近 30 天）
				</Text>
				<ClientOnly
					fallback={
						<Center h={240}>
							<Text size="sm" c="dimmed">
								图表加载中…
							</Text>
						</Center>
					}
				>
					{() => (
						<LineChart
							h={240}
							data={cet.trend.map((t) => ({
								date: t.date.slice(5),
								分钟: t.minutes,
								单词: t.words,
							}))}
							dataKey="date"
							series={[
								{ name: "分钟", color: "blue.6" },
								{ name: "单词", color: "teal.6" },
							]}
							curveType="monotone"
							gridAxis="y"
							tickLine="x"
						/>
					)}
				</ClientOnly>
				<Group mt="xs" gap="xl">
					<Text size="xs" c="dimmed">
						近 7 天日均 {Math.round(cet.recent7Avg)} 分钟
					</Text>
					<Text size="xs" c="dimmed">
						前 7 天日均 {Math.round(cet.previous7Avg)} 分钟
					</Text>
					{cet.isPlateau ? (
						<Badge color="orange">检测到平台期</Badge>
					) : (
						<Badge color="teal">节奏稳定</Badge>
					)}
				</Group>
			</Card>

			<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
				<Card withBorder radius="md" padding="sm">
					<Text size="xs" c="dimmed">
						打卡总览
					</Text>
					<Text size="lg" fw={700}>
						{cet.totalDays} 天 / {Math.round(cet.totalMinutes / 60)} 小时
					</Text>
					<Text size="xs" c="dimmed">
						累计 {cet.totalWords} 词 · 达标率{" "}
						{Math.round(cet.goalRate * 100)}%
					</Text>
				</Card>
				<Card withBorder radius="md" padding="sm">
					<Text size="xs" c="dimmed">
						考研计划
					</Text>
					<Text size="lg" fw={700}>
						{kaoyan.overallProgress}%
					</Text>
					<Text size="xs" c="dimmed">
						剩 {kaoyan.remainingHours} 小时 / {kaoyan.remainingDays} 天
					</Text>
				</Card>
				<Card withBorder radius="md" padding="sm">
					<Text size="xs" c="dimmed">
						复习队列
					</Text>
					<Text size="lg" fw={700} c={review.overdue ? "red" : "teal"}>
						{review.overdue} 项逾期
					</Text>
					<Text size="xs" c="dimmed">
						共 {review.total} 项 · 平均掌握度 {review.avgMastery}%
					</Text>
				</Card>
			</SimpleGrid>
		</Stack>
	);
}

function buildReport(input: {
	date: string;
	streak: number;
	totalDays: number;
	totalHours: number;
	predictedScore: number;
	weakest: string;
	strongest: string;
	kaoyanProgress: number;
	kaoyanRisk: string;
	requiredPerDay: number;
	overdue: number;
	insights: string[];
}) {
	return [
		`学习报告 ${input.date}`,
		"━━━━━━━━━━━━━━━━━━━━",
		`· 连续打卡 ${input.streak} 天，累计 ${input.totalDays} 天 / ${input.totalHours} 小时`,
		`· ${input.predictedScore} 分（预测）`,
		`· 最强项：${input.strongest}　最薄弱：${input.weakest}`,
		`· 考研进度 ${input.kaoyanProgress}%，风险等级「${input.kaoyanRisk}」`,
		`· 剩余任务摊到每天 ${input.requiredPerDay.toFixed(1)} 小时`,
		`· 复习队列逾期 ${input.overdue} 项`,
		"",
		"分析结论：",
		...input.insights.map((line, index) => `${index + 1}. ${line}`),
	].join("\n");
}
