/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：定期复习提醒页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	ActionIcon,
	Alert,
	Badge,
	Button,
	Card,
	Center,
	Group,
	Loader,
	Progress,
	RingProgress,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { IconBell, IconPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
	DUE_STATE_COLORS,
	DUE_STATE_LABELS,
	getDueState,
	masteryScore,
	sortByUrgency,
} from "~/lib/study/review-scheduler";
import {
	getNotificationPermission,
	maybeNotify,
	requestNotificationPermission,
	testNotification,
} from "~/lib/study/reminder";
import { analyzeReviews } from "~/lib/study/ai";
import { useStudy } from "~/lib/study/store";
import { REVIEW_SOURCES, type ReviewItem, type ReviewSource } from "~/lib/study/types";

/** 评分按钮：SM-2 的 0-5 分映射成三个直觉档位 */
const GRADES = [
	{ value: 1, label: "忘了", color: "red" },
	{ value: 3, label: "有点模糊", color: "yellow" },
	{ value: 5, label: "记得很牢", color: "teal" },
];

export default function StudyReviewPage() {
	const { loading, reviews, settings, addReview, gradeReview, removeReview, updateSettings } =
		useStudy();
	const [title, setTitle] = useState("");
	const [subject, setSubject] = useState("数学");
	const [source, setSource] = useState<ReviewSource | null>("考研");
	const [permission, setPermission] = useState<string>("unsupported");

	useEffect(() => {
		setPermission(getNotificationPermission());
	}, []);

	// 页面打开后做一次到点检查；之后每 10 分钟查一次
	useEffect(() => {
		if (loading) return;
		maybeNotify(settings, reviews);
		const timer = setInterval(() => maybeNotify(settings, reviews), 10 * 60 * 1000);
		return () => clearInterval(timer);
	}, [loading, settings, reviews]);

	if (loading)
		return (
			<Center h={300}>
				<Loader />
			</Center>
		);

	const analysis = analyzeReviews(reviews);
	const queue = sortByUrgency(reviews).filter(
		(item) => getDueState(item) === "today" || getDueState(item) === "overdue",
	);
	const upcoming = sortByUrgency(reviews).filter(
		(item) => getDueState(item) === "upcoming" || getDueState(item) === "mastered",
	);

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>定期复习提醒</Title>
					<Text size="sm" c="dimmed">
						基于 SM-2 间隔重复算法，在快要忘记的节点提醒你再过一遍
					</Text>
				</Stack>
			</Group>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>提醒设置</Text>
					<Badge
						color={
							permission === "granted"
								? "teal"
								: permission === "denied"
									? "red"
									: "gray"
						}
					>
						{permission === "granted"
							? "通知已开启"
							: permission === "denied"
								? "通知被浏览器拒绝"
								: permission === "unsupported"
									? "当前浏览器不支持通知"
									: "尚未开启通知"}
					</Badge>
				</Group>
				<Group grow align="flex-end">
					<Switch
						label="启用每日复习提醒"
						checked={settings.reminderEnabled}
						onChange={(e) => updateSettings({ reminderEnabled: e.currentTarget.checked })}
					/>
					{/* 用原生 time 输入，避免额外依赖 @mantine/dates 的 TimeInput */}
					<TextInput
						label="提醒时间"
						type="time"
						value={settings.reminderTime}
						onChange={(event) =>
							updateSettings({ reminderTime: event.currentTarget.value })
						}
					/>
					<Group>
						<Button
							variant="default"
							leftSection={<IconBell size={16} />}
							onClick={async () => {
								if (permission !== "granted") {
									const next = await requestNotificationPermission();
									setPermission(next);
									return;
								}
								testNotification(queue.length);
							}}
						>
							{permission === "granted" ? "测试通知" : "开启浏览器通知"}
						</Button>
					</Group>
				</Group>
				{permission === "denied" ? (
					<Alert color="red" mt="sm" variant="light">
						通知权限被拒绝了，需要在浏览器地址栏左侧的站点设置里手动恢复。
					</Alert>
				) : null}
			</Card>

			<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
				<StatCard label="今日待复习" value={`${analysis.today}`} color="orange" />
				<StatCard label="已逾期" value={`${analysis.overdue}`} color="red" />
				<StatCard label="未到期" value={`${analysis.upcoming}`} color="blue" />
				<StatCard label="已掌握" value={`${analysis.mastered}`} color="teal" />
			</SimpleGrid>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>新增复习条目</Text>
				</Group>
				<Group align="flex-end">
					<TextInput
						label="知识点"
						placeholder="例如：洛必达法则的 7 种变形"
						value={title}
						onChange={(e) => setTitle(e.currentTarget.value)}
						style={{ flex: 1 }}
					/>
					<TextInput
						label="科目"
						value={subject}
						onChange={(e) => setSubject(e.currentTarget.value)}
						w={120}
					/>
					<Select
						label="来源"
						data={REVIEW_SOURCES.map((s) => ({ value: s, label: s }))}
						value={source}
						onChange={(value) => setSource(value as ReviewSource | null)}
						w={120}
					/>
					<Button
						leftSection={<IconPlus size={16} />}
						disabled={!title || !source}
						onClick={async () => {
							await addReview({ title, subject, source: source ?? "其他" });
							setTitle("");
						}}
					>
						添加
					</Button>
				</Group>
			</Card>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>今天要过的（{queue.length}）</Text>
					<Text size="xs" c="dimmed">
						平均掌握度 {analysis.avgMastery}%
					</Text>
				</Group>
				{queue.length === 0 ? (
					<Center h={80}>
						<Text size="sm" c="dimmed">
							今天的复习清空了，明天见
						</Text>
					</Center>
				) : (
					<Stack gap="xs">
						{queue.map((item) => (
							<ReviewRow key={item.id} item={item} onGrade={gradeReview} onRemove={removeReview} />
						))}
					</Stack>
				)}
			</Card>

			<SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						未来 7 天复习负载
					</Text>
					<Stack gap={6}>
						{analysis.load.map((day) => (
							<Group key={day.date} gap="xs">
								<Text size="xs" w={64}>
									{day.date.slice(5)}
								</Text>
								<Progress
									value={Math.min((day.count / Math.max(1, reviews.length)) * 100, 100)}
									size="md"
									style={{ flex: 1 }}
									color={day.count > 8 ? "red" : "blue"}
								/>
								<Text size="xs" w={28} ta="right">
									{day.count}
								</Text>
							</Group>
						))}
					</Stack>
				</Card>

				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						各科掌握度
					</Text>
					<Stack gap={6}>
						{analysis.worstSubjects.length === 0 ? (
							<Text size="sm" c="dimmed">
								暂无数据
							</Text>
						) : (
							analysis.worstSubjects.map((s) => (
								<Group key={s.subject} gap="xs">
									<Text size="xs" w={64}>
										{s.subject}
									</Text>
									<Progress
										value={s.avgMastery}
										size="md"
										style={{ flex: 1 }}
										color={s.avgMastery < 40 ? "red" : s.avgMastery < 70 ? "blue" : "teal"}
									/>
									<Text size="xs" w={28} ta="right">
										{s.avgMastery}
									</Text>
								</Group>
							))
						)}
					</Stack>
				</Card>
			</SimpleGrid>

			{upcoming.length > 0 ? (
				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						其余条目（{upcoming.length}）
					</Text>
					<Stack gap="xs">
						{upcoming.map((item) => (
							<ReviewRow key={item.id} item={item} onGrade={gradeReview} onRemove={removeReview} />
						))}
					</Stack>
				</Card>
			) : null}
		</Stack>
	);
}

function ReviewRow({
	item,
	onGrade,
	onRemove,
}: {
	item: ReviewItem;
	onGrade: (id: string, quality: number) => Promise<void>;
	onRemove: (id: string) => Promise<void>;
}) {
	const state = getDueState(item);
	const mastery = masteryScore(item);

	return (
		<Card withBorder radius="sm" padding="xs">
			<Group justify="space-between" wrap="nowrap" align="center">
				<Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
					<Group gap="xs">
						<Text size="sm" fw={500} truncate>
							{item.title}
						</Text>
						<Badge size="xs" variant="light" color={DUE_STATE_COLORS[state]}>
							{DUE_STATE_LABELS[state]}
						</Badge>
						{item.source ? (
							<Badge size="xs" variant="outline">
								{item.source}
							</Badge>
						) : null}
					</Group>
					<Text size="xs" c="dimmed">
						{item.subject} · 第 {item.stage} 轮 · 间隔 {item.intervalDays} 天 · 下次{" "}
						{item.nextReviewAt}
					</Text>
				</Stack>
				<Tooltip label={`掌握度 ${mastery}%`}>
					<RingProgress
						size={38}
						thickness={4}
						sections={[
							{
								value: mastery,
								color: mastery < 40 ? "red" : mastery < 70 ? "blue" : "teal",
							},
						]}
					/>
				</Tooltip>
				<Group gap={4}>
					{GRADES.map((grade) => (
						<Button
							key={grade.value}
							size="compact-xs"
							variant="light"
							color={grade.color}
							onClick={() => onGrade(item.id, grade.value)}
						>
							{grade.label}
						</Button>
					))}
					<ActionIcon variant="subtle" color="red" onClick={() => onRemove(item.id)}>
						<IconTrash size={16} />
					</ActionIcon>
				</Group>
			</Group>
		</Card>
	);
}

function StatCard({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color: string;
}) {
	return (
		<Card withBorder radius="md" padding="sm">
			<Text size="xs" c="dimmed">
				{label}
			</Text>
			<Text size="xl" fw={700} c={color}>
				{value}
			</Text>
		</Card>
	);
}
