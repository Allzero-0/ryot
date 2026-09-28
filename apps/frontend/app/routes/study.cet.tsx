/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：四六级打卡页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	ActionIcon,
	Badge,
	Button,
	Card,
	Center,
	Group,
	Loader,
	NumberInput,
	Progress,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { IconCheck, IconFlame, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import dayjs from "dayjs";
import { ClientOnly } from "remix-utils/client-only";
import { analyzeCheckIns } from "~/lib/study/ai";
import { useStudy } from "~/lib/study/store";
import { CET_LEVELS, type CetLevel, todayString } from "~/lib/study/types";

const HEAT_COLORS = [
	"var(--mantine-color-default-hover)",
	"var(--mantine-color-blue-2)",
	"var(--mantine-color-blue-4)",
	"var(--mantine-color-blue-6)",
	"var(--mantine-color-blue-8)",
];

export default function StudyCetPage() {
	const { loading, checkIns, settings, upsertCheckIn, removeCheckIn, updateSettings } =
		useStudy();
	const today = todayString();

	const existing = checkIns.find(
		(c) => c.date === today && c.level === settings.cetLevel,
	);

	const [words, setWords] = useState<number | string>(existing?.words ?? 60);
	const [listening, setListening] = useState<number | string>(
		existing?.listening ?? 20,
	);
	const [reading, setReading] = useState<number | string>(existing?.reading ?? 1);
	const [writing, setWriting] = useState<number | string>(existing?.writing ?? 0);
	const [translation, setTranslation] = useState<number | string>(
		existing?.translation ?? 0,
	);
	const [minutes, setMinutes] = useState<number | string>(existing?.minutes ?? 60);
	const [mockScore, setMockScore] = useState<number | string>(
		existing?.mockScore ?? "",
	);
	const [note, setNote] = useState(existing?.note ?? "");
	const [level, setLevel] = useState<CetLevel>(settings.cetLevel);

	if (loading)
		return (
			<Center h={300}>
				<Loader />
			</Center>
		);

	const analysis = analyzeCheckIns(checkIns, settings);
	const recent = [...checkIns].reverse().slice(0, 20);

	const submit = async () => {
		await upsertCheckIn({
			date: today,
			level,
			words: Number(words) || 0,
			listening: Number(listening) || 0,
			reading: Number(reading) || 0,
			writing: Number(writing) || 0,
			translation: Number(translation) || 0,
			minutes: Number(minutes) || 0,
			mockScore: mockScore === "" ? undefined : Number(mockScore),
			note: note || undefined,
		});
	};

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>四六级打卡</Title>
					<Group gap="xs" align="center">
						<Text size="sm" c="dimmed">
							考试日期
						</Text>
						<TextInput
							type="date"
							size="xs"
							w={140}
							value={settings.cetExamDate}
							onChange={(e) => updateSettings({ cetExamDate: e.currentTarget.value })}
						/>
						<Text size="sm" c="dimmed">
							· 目标每天 {settings.dailyWordGoal} 词 /{" "}
							{settings.dailyMinutesGoal} 分钟
						</Text>
					</Group>
				</Stack>
				<SegmentedControl
					size="xs"
					data={CET_LEVELS.map((l) => ({ value: l, label: l }))}
					value={level}
					onChange={(v) => setLevel(v as CetLevel)}
				/>
			</Group>

			<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
				<Card withBorder radius="md" padding="sm">
					<Group gap="xs">
						<IconFlame size={16} color="var(--mantine-color-orange-6)" />
						<Text size="xs" c="dimmed">
							连续打卡
						</Text>
					</Group>
					<Text size="xl" fw={700}>
						{analysis.streak} 天
					</Text>
					<Text size="xs" c="dimmed">
						累计 {analysis.totalDays} 天
					</Text>
				</Card>
				<Card withBorder radius="md" padding="sm">
					<Text size="xs" c="dimmed">
						今日达标情况
					</Text>
					<Text size="xl" fw={700}>
						{existing ? `${existing.words} 词 / ${existing.minutes} 分` : "未打卡"}
					</Text>
					<Text size="xs" c="dimmed">
						达标率 {Math.round(analysis.goalRate * 100)}%（共{" "}
						{analysis.goalMetDays} 天达标）
					</Text>
				</Card>
				<Card withBorder radius="md" padding="sm">
					<Text size="xs" c="dimmed">
						预测得分
					</Text>
					<Text
						size="xl"
						fw={700}
						c={analysis.predictedScore >= 425 ? "teal" : "red"}
					>
						{analysis.predictedScore} 分
					</Text>
					<Text size="xs" c="dimmed" lineClamp={2}>
						{analysis.scoreBasis}
					</Text>
				</Card>
			</SimpleGrid>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>
						{existing ? `更新今天（${today}）的记录` : `今天（${today}）打卡`}
					</Text>
					{existing ? <Badge color="teal">今日已打卡</Badge> : null}
				</Group>
				<Group grow align="flex-end">
					<NumberInput label="背单词（个）" min={0} value={words} onChange={setWords} />
					<NumberInput
						label="听力（分钟）"
						min={0}
						value={listening}
						onChange={setListening}
					/>
					<NumberInput label="阅读（篇）" min={0} value={reading} onChange={setReading} />
					<NumberInput label="写作（篇）" min={0} value={writing} onChange={setWriting} />
					<NumberInput
						label="翻译（篇）"
						min={0}
						value={translation}
						onChange={setTranslation}
					/>
					<NumberInput
						label="总时长（分钟）"
						min={0}
						value={minutes}
						onChange={setMinutes}
					/>
					<NumberInput
						label="模考分（可选）"
						min={0}
						max={710}
						placeholder="0-710"
						value={mockScore}
						onChange={setMockScore}
					/>
					<Button leftSection={<IconCheck size={16} />} onClick={submit}>
						{existing ? "更新" : "打卡"}
					</Button>
				</Group>
				<TextInput
					mt="sm"
					label="今日小结"
					placeholder="例如：听力 section C 错了一半，明天专攻"
					value={note}
					onChange={(e) => setNote(e.currentTarget.value)}
				/>
			</Card>

			<Card withBorder radius="md" padding="md">
				<Text fw={600} mb="sm">
					打卡热力图（近 13 周）
				</Text>
				<Heatmap data={analysis.heatmap} />
			</Card>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>近 30 天学习时长</Text>
					{analysis.isPlateau ? (
						<Badge color="orange">近 7 天较前 7 天下滑超 20%</Badge>
					) : null}
				</Group>
				<ClientOnly fallback={<Center h={260}><Text size="sm" c="dimmed">图表加载中…</Text></Center>}>
					{() => (
						<BarChart
							h={260}
							data={analysis.trend.map((t) => ({
								date: t.date.slice(5),
								时长: t.minutes,
							}))}
							dataKey="date"
							series={[{ name: "时长", color: "blue.6" }]}
							tickLine="x"
							gridAxis="y"
							withLegend={false}
						/>
					)}
				</ClientOnly>
			</Card>

			<Card withBorder radius="md" padding="md">
				<Group justify="space-between" mb="sm">
					<Text fw={600}>能力雷达</Text>
					<Text size="xs" c="dimmed">
						最薄弱：{analysis.weakest} · 最强：{analysis.strongest}
					</Text>
				</Group>
				<SimpleGrid cols={{ base: 1, sm: 5 }} spacing="xs">
					{analysis.ability.map((a) => (
						<Stack key={a.dimension} gap={4}>
							<Group justify="space-between">
								<Text size="xs">{a.dimension}</Text>
								<Text size="xs" c="dimmed">
									{a.score}
								</Text>
							</Group>
							<Progress
								value={a.score}
								size="sm"
								color={a.dimension === analysis.weakest ? "red" : "blue"}
							/>
						</Stack>
					))}
				</SimpleGrid>
			</Card>

			<Card withBorder radius="md" padding="md">
				<Text fw={600} mb="sm">
					最近记录
				</Text>
				{recent.length === 0 ? (
					<Center h={80}>
						<Text size="sm" c="dimmed">
							还没有打卡记录
						</Text>
					</Center>
				) : (
					<Table highlightOnHover>
						<Table.Thead>
							<Table.Tr>
								<Table.Th>日期</Table.Th>
								<Table.Th>级别</Table.Th>
								<Table.Th>单词</Table.Th>
								<Table.Th>听力</Table.Th>
								<Table.Th>阅读</Table.Th>
								<Table.Th>写作</Table.Th>
								<Table.Th>翻译</Table.Th>
								<Table.Th>时长</Table.Th>
								<Table.Th>模考</Table.Th>
								<Table.Th />
							</Table.Tr>
						</Table.Thead>
						<Table.Tbody>
							{recent.map((record) => (
								<Table.Tr key={record.id}>
									<Table.Td>
										<Text size="sm">{record.date}</Text>
										<Text size="xs" c="dimmed">
											{dayjs(record.date).format("dddd")}
										</Text>
									</Table.Td>
									<Table.Td>
										<Badge size="sm" variant="light">
											{record.level}
										</Badge>
									</Table.Td>
									<Table.Td>{record.words}</Table.Td>
									<Table.Td>{record.listening}</Table.Td>
									<Table.Td>{record.reading}</Table.Td>
									<Table.Td>{record.writing}</Table.Td>
									<Table.Td>{record.translation}</Table.Td>
									<Table.Td>
										<Text
											size="sm"
											fw={record.minutes >= settings.dailyMinutesGoal ? 600 : 400}
										>
											{record.minutes} 分
										</Text>
									</Table.Td>
									<Table.Td>{record.mockScore ?? "—"}</Table.Td>
									<Table.Td>
										<ActionIcon
											variant="subtle"
											color="red"
											onClick={() => removeCheckIn(record.id)}
										>
											<IconTrash size={16} />
										</ActionIcon>
									</Table.Td>
								</Table.Tr>
							))}
						</Table.Tbody>
					</Table>
				)}
			</Card>
		</Stack>
	);
}

function Heatmap({ data }: { data: { date: string; minutes: number; level: number }[] }) {
	// 按周围成 7 行（周一~周日），方便直观看出「周几容易断档」
	const cells = [...data];
	const firstDay = dayjs(cells[0].date).day();
	const padding = Array.from({ length: (firstDay + 6) % 7 }, () => null);
	const grid = [...padding, ...cells];

	return (
		<Stack gap={2}>
			<div
				style={{
					display: "grid",
					gridTemplateRows: "repeat(7, 12px)",
					gridAutoFlow: "column",
					gridAutoColumns: "12px",
					gap: 3,
					overflowX: "auto",
				}}
			>
				{grid.map((cell, index) =>
					cell === null ? (
						<div key={`pad-${index}`} />
					) : (
						<Tooltip
							key={cell.date}
							label={`${cell.date} · ${cell.minutes} 分钟`}
							openDelay={200}
						>
							<div
								style={{
									width: 12,
									height: 12,
									borderRadius: 2,
									background: HEAT_COLORS[cell.level],
								}}
							/>
						</Tooltip>
					),
				)}
			</div>
			<Group gap={4} mt={4}>
				<Text size="xs" c="dimmed">
					少
				</Text>
				{HEAT_COLORS.map((color) => (
					<div
						key={color}
						style={{ width: 10, height: 10, borderRadius: 2, background: color }}
					/>
				))}
				<Text size="xs" c="dimmed">
					多
				</Text>
			</Group>
		</Stack>
	);
}
