/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：学习总览页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	Alert,
	Badge,
	Button,
	Card,
	Center,
	Group,
	Loader,
	NumberInput,
	Progress,
	RingProgress,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import {
	IconAlertTriangle,
	IconBulb,
	IconCalendarEvent,
	IconDownload,
	IconFlame,
	IconBrain,
	IconTargetArrow,
	IconUpload,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { useStudy } from "~/lib/study/store";
import {
	analyzeCheckIns,
	analyzeKaoyan,
	generateInsights,
} from "~/lib/study/ai";
import { getDueState, sortByUrgency } from "~/lib/study/review-scheduler";
import { todayString } from "~/lib/study/types";
import { CET_LEVELS, type CetLevel, type StudySettings } from "~/lib/study/types";

export default function StudyOverviewPage() {
	const {
		loading,
		tasks,
		checkIns,
		reviews,
		settings,
		loadDemoData,
		updateSettings,
		exportBackup,
		importBackup,
		resetAll,
	} = useStudy();
	const [backupMessage, setBackupMessage] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	if (loading)
		return (
			<Center h={300}>
				<Loader />
			</Center>
		);

	const isEmpty =
		tasks.length === 0 && checkIns.length === 0 && reviews.length === 0;

	// 空数据时只跳过上方的数据看板，但「目标设置」必须一直可见——
	// 否则新用户还没建任何数据就被挡住，改不了考试日期。
	if (isEmpty)
		return (
			<Stack gap="md" mt="xl">
				<Alert color="blue" title="还没有任何学习数据" icon={<IconBulb size={16} />}>
					这个模块的数据全部存在你自己的浏览器里，不上传服务器。可以先载入一份示例数据看看效果，
					之后随时清空。
				</Alert>
				<Group>
					<Button onClick={loadDemoData}>载入示例数据</Button>
					<Button variant="default" component={Link} to="/study/plan">
						直接去建计划
					</Button>
				</Group>
				<SettingsCard
					settings={settings}
					updateSettings={updateSettings}
				/>
			</Stack>
		);

	const cet = analyzeCheckIns(checkIns, settings);
	const kaoyan = analyzeKaoyan(tasks, settings);
	const insights = generateInsights({ checkIns, tasks, reviews, settings });
	const dueToday = sortByUrgency(reviews).filter(
		(r) => getDueState(r) === "today" || getDueState(r) === "overdue",
	);

	const daysToKaoyan = Math.max(dayjs(settings.examDate).diff(todayString(), "day"), 0);
	const daysToCet = Math.max(dayjs(settings.cetExamDate).diff(todayString(), "day"), 0);

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>学习总览</Title>
					<Text size="sm" c="dimmed">
						{todayString()} · 数据保存在本机浏览器
					</Text>
				</Stack>
				<Button variant="default" size="xs" onClick={loadDemoData}>
					载入示例数据
				</Button>
			</Group>

			<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
				<MetricCard
					icon={<IconCalendarEvent size={18} />}
					label="距离考研"
					value={`${daysToKaoyan}`}
					suffix="天"
					footer={`考试日 ${settings.examDate}`}
					color="blue"
				/>
				<MetricCard
					icon={<IconFlame size={18} />}
					label="连续打卡"
					value={`${cet.streak}`}
					suffix="天"
					footer={`累计 ${cet.totalDays} 天 · ${Math.round(cet.totalMinutes / 60)} 小时`}
					color={cet.streak >= 7 ? "teal" : "orange"}
				/>
				<MetricCard
					icon={<IconBrain size={18} />}
					label="今日待复习"
					value={`${dueToday.length}`}
					suffix="项"
					footer={`复习库共 ${reviews.length} 项`}
					color={dueToday.length > 0 ? "red" : "green"}
				/>
				<MetricCard
					icon={<IconTargetArrow size={18} />}
					label={`${settings.cetLevel} 预测分`}
					value={`${cet.predictedScore}`}
					suffix="分"
					footer={`${daysToCet} 天后考试 · 425 过线`}
					color={cet.predictedScore >= 425 ? "teal" : "red"}
				/>
			</SimpleGrid>

			<SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
				<Card withBorder radius="md" padding="md">
					<Group justify="space-between" mb="xs">
						<Text fw={600}>考研计划进度</Text>
						<Badge color={kaoyan.risk === "高" ? "red" : kaoyan.risk === "中" ? "yellow" : "teal"}>
							风险 {kaoyan.risk}
						</Badge>
					</Group>
					<Group align="center" gap="xl">
						<RingProgress
							size={110}
							thickness={10}
							sections={[{ value: kaoyan.overallProgress, color: "blue" }]}
							label={
								<Text ta="center" size="sm" fw={700}>
									{kaoyan.overallProgress}%
								</Text>
							}
						/>
						<Stack gap={4} style={{ flex: 1 }}>
							<Text size="sm">
								已完成 {kaoyan.totalDoneHours} / {kaoyan.totalTargetHours} 小时
							</Text>
							<Text size="sm" c="dimmed">
								剩余 {kaoyan.remainingHours} 小时，摊到每天{" "}
								{kaoyan.requiredHoursPerDay.toFixed(1)} 小时
							</Text>
							{kaoyan.bySubject.slice(0, 3).map((s) => (
								<Group key={s.subject} gap="xs">
									<Text size="xs" w={44}>
										{s.subject}
									</Text>
									<Progress
										value={s.progress}
										size="sm"
										style={{ flex: 1 }}
										color={s.progress < 40 ? "red" : "blue"}
									/>
									<Text size="xs" w={32} ta="right">
										{s.progress}%
									</Text>
								</Group>
							))}
						</Stack>
					</Group>
				</Card>

				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="xs">
						分析与建议
					</Text>
					<Stack gap="xs">
						{insights.slice(0, 5).map((insight) => (
							<Group key={insight.title} gap="xs" align="flex-start" wrap="nowrap">
								<IconAlertTriangle
									size={14}
									style={{ marginTop: 3 }}
									color={
										insight.severity === "danger"
											? "var(--mantine-color-red-6)"
											: insight.severity === "warn"
												? "var(--mantine-color-orange-6)"
												: insight.severity === "good"
													? "var(--mantine-color-teal-6)"
													: "var(--mantine-color-blue-6)"
									}
								/>
								<Stack gap={0}>
									<Text size="sm" fw={600}>
										{insight.title}
									</Text>
									<Text size="xs" c="dimmed">
										{insight.detail}
									</Text>
								</Stack>
							</Group>
						))}
					</Stack>
				</Card>
			</SimpleGrid>

			<SettingsCard settings={settings} updateSettings={updateSettings} />

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>数据备份</Text>
					<Text size="xs" c="dimmed">
						{tasks.length} 个任务 · {checkIns.length} 条打卡 · {reviews.length} 个复习项
					</Text>
				</Group>
				<Text size="xs" c="dimmed" mb="sm">
					数据只存在这台设备的浏览器里。装成 App 后在系统设置里「清除应用数据」会把它一起清掉，
					换手机也会丢——所以请定期导出一份 JSON 存起来。
				</Text>
				<Group>
					<Button
						variant="default"
						size="xs"
						leftSection={<IconDownload size={14} />}
						onClick={async () => {
							const json = await exportBackup();
							const blob = new Blob([json], { type: "application/json" });
							const url = URL.createObjectURL(blob);
							const anchor = document.createElement("a");
							anchor.href = url;
							anchor.download = `学习中心备份-${todayString()}.json`;
							anchor.click();
							URL.revokeObjectURL(url);
						}}
					>
						导出备份
					</Button>
					<Button
						variant="default"
						size="xs"
						leftSection={<IconUpload size={14} />}
						onClick={() => fileInputRef.current?.click()}
					>
						导入备份
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/json,.json"
						hidden
						onChange={async (event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (!file) return;
							try {
								await importBackup(await file.text());
								setBackupMessage("导入成功");
							} catch (error) {
								setBackupMessage(
									`导入失败：${error instanceof Error ? error.message : "未知错误"}`,
								);
							}
						}}
					/>
					<Button
						variant="default"
						size="xs"
						color="red"
						onClick={() => {
							if (window.confirm("确定清空全部学习数据？该操作不可撤销，建议先导出备份。"))
								resetAll();
						}}
					>
						清空数据
					</Button>
					{backupMessage ? (
						<Text size="xs" c="dimmed">
							{backupMessage}
						</Text>
					) : null}
				</Group>
			</Card>

			<Card withBorder radius="md" padding="md">
				<Text fw={600} mb="xs">
					四六级能力雷达
				</Text>
				<SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
					{cet.ability.map((a) => (
						<Stack key={a.dimension} gap={4}>
							<Group justify="space-between">
								<Text size="xs">{a.dimension}</Text>
								<Text size="xs" c="dimmed">
									{a.raw}
								</Text>
							</Group>
							<Progress
								value={a.score}
								size="sm"
								color={
									a.dimension === cet.weakest
										? "red"
										: a.dimension === cet.strongest
											? "teal"
											: "blue"
								}
							/>
						</Stack>
					))}
				</SimpleGrid>
			</Card>
		</Stack>
	);
}

/**
 * 考试日期与每日目标。
 * 抽成组件是为了在「还没有数据」的空状态下也能渲染——考试日期是所有倒计时、
 * 风险测算的基准，必须让用户第一时间就能改。
 */
function SettingsCard({
	settings,
	updateSettings,
}: {
	settings: StudySettings;
	updateSettings: (patch: Partial<StudySettings>) => Promise<void>;
}) {
	return (
		<Card withBorder radius="md" padding="md">
			<Text fw={600} mb="sm">
				目标设置
			</Text>
			<Group grow align="flex-end">
				<TextInput
					label="考研初试日期"
					type="date"
					value={settings.examDate}
					onChange={(e) => updateSettings({ examDate: e.currentTarget.value })}
				/>
				<TextInput
					label={`${settings.cetLevel} 考试日期`}
					type="date"
					value={settings.cetExamDate}
					onChange={(e) => updateSettings({ cetExamDate: e.currentTarget.value })}
				/>
				<Stack gap={4}>
					<Text size="xs" fw={500}>
						报考级别
					</Text>
					<SegmentedControl
						size="xs"
						data={CET_LEVELS.map((l) => ({ value: l, label: l }))}
						value={settings.cetLevel}
						onChange={(v) => updateSettings({ cetLevel: v as CetLevel })}
					/>
				</Stack>
				<NumberInput
					label="每日单词目标"
					min={0}
					value={settings.dailyWordGoal}
					onChange={(v) => updateSettings({ dailyWordGoal: Number(v) || 0 })}
				/>
				<NumberInput
					label="每日学习分钟"
					min={0}
					value={settings.dailyMinutesGoal}
					onChange={(v) => updateSettings({ dailyMinutesGoal: Number(v) || 0 })}
				/>
			</Group>
			<Text size="xs" c="dimmed" mt="xs">
				改完立刻生效：预测分数、风险等级、所需日均投入都按这里的设置重算。
				默认填的是常规考期（考研 12 月第三个周六、四六级 6/12 月第二个周六），
				具体以当年官方通知为准，请自己核对后修改。
			</Text>
		</Card>
	);
}

function MetricCard({
	icon,
	label,
	value,
	suffix,
	footer,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	suffix: string;
	footer: string;
	color: string;
}) {
	return (
		<Card withBorder radius="md" padding="md">
			<Group gap="xs" mb={4}>
				{icon}
				<Text size="xs" c="dimmed">
					{label}
				</Text>
			</Group>
			<Group gap={4} align="baseline">
				<Text size="xl" fw={700} c={color}>
					{value}
				</Text>
				<Text size="sm" c="dimmed">
					{suffix}
				</Text>
			</Group>
			<Text size="xs" c="dimmed" mt={4}>
				{footer}
			</Text>
		</Card>
	);
}
