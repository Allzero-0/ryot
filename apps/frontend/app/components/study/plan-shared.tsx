/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：考研与公考共用的 UI 组件（卡片/进度/表格/弹窗）
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
/**
 * 考研计划表与公考事业编计划表共用的 UI 组件。
 *
 * 需求要求两个模块「视觉、交互完全统一」，最稳的做法不是复制一遍 JSX，
 * 而是把卡片、进度条、表格、弹窗抽出来共用同一份实现——改一处，两边同时生效。
 */
import {
	Alert,
	Badge,
	Button,
	Card,
	Center,
	Collapse,
	Group,
	Modal,
	NumberInput,
	Progress,
	Select,
	SimpleGrid,
	Stack,
	Table,
	Text,
	TextInput,
	Textarea,
	UnstyledButton,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { KaoyanAnalysis } from "~/lib/study/ai";
import type { TaskStatus } from "~/lib/study/types";
import { TASK_STATUSES } from "~/lib/study/types";

export const STATUS_COLORS: Record<TaskStatus, string> = {
	未开始: "gray",
	进行中: "blue",
	已完成: "teal",
	已延期: "red",
};

/** 顶部预警横幅：所需日均超过设定上限时才出现 */
export function RiskAlert({ analysis }: { analysis: KaoyanAnalysis }) {
	if (analysis.risk === "低") return null;
	return (
		<Alert color={analysis.risk === "高" ? "red" : "yellow"} variant="light">
			{analysis.riskReason}
		</Alert>
	);
}

/** 三张核心数据卡片 */
export function PlanMetricCards({ analysis }: { analysis: KaoyanAnalysis }) {
	return (
		<SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
			<Card withBorder radius="md" padding="sm">
				<Text size="xs" c="dimmed">
					总体进度
				</Text>
				<Text size="xl" fw={700}>
					{analysis.overallProgress}%
				</Text>
				<Progress value={analysis.overallProgress} mt={6} size="sm" />
				<Text size="xs" c="dimmed" mt={4}>
					{analysis.totalDoneHours} / {analysis.totalTargetHours} 小时
				</Text>
			</Card>
			<Card withBorder radius="md" padding="sm">
				<Text size="xs" c="dimmed">
					每天需要投入
				</Text>
				<Text size="xl" fw={700} c={analysis.risk === "高" ? "red" : "blue"}>
					{analysis.requiredHoursPerDay.toFixed(1)} 小时
				</Text>
				<Text size="xs" c="dimmed" mt={4}>
					你设定的日均上限 {analysis.availableHoursPerDay.toFixed(1)} 小时
				</Text>
			</Card>
			<Card withBorder radius="md" padding="sm">
				<Text size="xs" c="dimmed">
					延期任务
				</Text>
				<Text
					size="xl"
					fw={700}
					c={analysis.delayedTasks.length ? "red" : "teal"}
				>
					{analysis.delayedTasks.length} 个
				</Text>
				<Text size="xs" c="dimmed" mt={4}>
					共 {analysis.bySubject.reduce((s, x) => s + x.taskCount, 0)} 个任务
				</Text>
			</Card>
		</SimpleGrid>
	);
}

function progressColor(value: number) {
	if (value < 40) return "red";
	if (value < 70) return "blue";
	return "teal";
}

/** 科目进度条板块，支持展开子项（按省份 / 试卷类型拆分） */
export function SubjectProgressPanel({
	analysis,
	emptyHint = "还没有任务",
}: {
	analysis: KaoyanAnalysis;
	emptyHint?: string;
}) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	return (
		<Card withBorder radius="md" padding="md">
			<Text fw={600} mb="sm">
				各科进度
			</Text>
			{analysis.bySubject.length === 0 ? (
				<Text size="sm" c="dimmed">
					{emptyHint}
				</Text>
			) : (
				<Stack gap="xs">
					{analysis.bySubject.map((s) => {
						const open = expanded[s.subject] ?? false;
						const hasChildren = Boolean(s.children && s.children.length > 0);
						return (
							<Stack key={s.subject} gap={4}>
								<Group gap="xs" wrap="nowrap">
									{hasChildren ? (
										<UnstyledButton
											onClick={() =>
												setExpanded((c) => ({
													...c,
													[s.subject]: !open,
												}))
											}
											aria-label={`展开${s.subject}子进度`}
										>
											{open ? (
												<IconChevronDown size={14} />
											) : (
												<IconChevronRight size={14} />
											)}
										</UnstyledButton>
									) : (
										<span style={{ width: 14 }} />
									)}
									<Text size="sm" w={52}>
										{s.subject}
									</Text>
									<Progress
										value={s.progress}
										size="md"
										style={{ flex: 1 }}
										color={progressColor(s.progress)}
									/>
									<Text size="xs" w={96} ta="right" c="dimmed">
										{s.doneHours}/{s.targetHours}h
									</Text>
									<Text size="xs" w={40} ta="right">
										{s.progress}%
									</Text>
								</Group>
								{hasChildren ? (
									<Collapse in={open}>
										<Stack gap={4} pl={28} pt={4}>
											{s.children?.map((child) => (
												<Group key={child.label} gap="xs" wrap="nowrap">
													<Text size="xs" c="dimmed" w={132} truncate>
														{child.label}
													</Text>
													<Progress
														value={child.progress}
														size="sm"
														style={{ flex: 1 }}
														color={progressColor(child.progress)}
													/>
													<Text size="xs" w={76} ta="right" c="dimmed">
														{child.doneHours}/{child.targetHours}h
													</Text>
													<Text size="xs" w={40} ta="right">
														{child.progress}%
													</Text>
												</Group>
											))}
										</Stack>
									</Collapse>
								) : null}
							</Stack>
						);
					})}
				</Stack>
			)}
		</Card>
	);
}

/** 任务清单里的一行只需要这些字段，考研 / 公考任务都能传进来 */
export interface TaskRow {
	id: string;
	title: string;
	subject: string;
	startDate: string;
	endDate: string;
	targetHours: number;
	doneHours: number;
	status: TaskStatus;
	priority: number;
	note?: string;
	/** 编辑回写时需要原样保留 */
	createdAt: string;
}

/** 任务清单表格 */
export function TaskTable({
	tasks,
	subjectFilter,
	onFilterChange,
	onEdit,
	onRemove,
	emptyHint = "点击右上角「新建任务」开始排计划",
}: {
	tasks: TaskRow[];
	subjectFilter: string | null;
	onFilterChange: (value: string | null) => void;
	onEdit: (task: TaskRow) => void;
	onRemove: (id: string) => void;
	emptyHint?: string;
}) {
	const subjects = [...new Set(tasks.map((t) => t.subject))];

	return (
		<Card withBorder radius="md" padding="md">
			<Group justify="space-between" mb="sm">
				<Text fw={600}>任务清单</Text>
				<Group gap="xs">
					<Text size="xs" c="dimmed">
						科目
					</Text>
					<Select
						size="xs"
						w={130}
						placeholder="全部"
						clearable
						data={subjects.map((s) => ({ value: s, label: s }))}
						value={subjectFilter}
						onChange={onFilterChange}
					/>
				</Group>
			</Group>
			{tasks.length === 0 ? (
				<Center h={120}>
					<Text size="sm" c="dimmed">
						{emptyHint}
					</Text>
				</Center>
			) : (
				<Table highlightOnHover withTableBorder>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>任务名称</Table.Th>
							<Table.Th>科目</Table.Th>
							<Table.Th>起止时间</Table.Th>
							<Table.Th>预估时长</Table.Th>
							<Table.Th>任务状态</Table.Th>
							<Table.Th>优先级</Table.Th>
							<Table.Th />
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{tasks.map((task) => (
							<Table.Tr key={task.id}>
								<Table.Td>
									<Text size="sm" fw={500}>
										{task.title}
									</Text>
									{task.note ? (
										<Text size="xs" c="dimmed">
											{task.note}
										</Text>
									) : null}
								</Table.Td>
								<Table.Td>
									<Badge variant="light" size="sm">
										{task.subject}
									</Badge>
								</Table.Td>
								<Table.Td>
									<Text size="xs">
										{task.startDate} ~ {task.endDate}
									</Text>
								</Table.Td>
								<Table.Td>
									<Text size="xs">
										{task.doneHours}/{task.targetHours}h
									</Text>
								</Table.Td>
								<Table.Td>
									<Badge
										color={STATUS_COLORS[task.status]}
										variant="light"
										size="sm"
									>
										{task.status}
									</Badge>
								</Table.Td>
								<Table.Td>
									<Badge
										color={
											task.priority === 1
												? "red"
												: task.priority === 2
													? "yellow"
													: "gray"
										}
										variant="outline"
										size="sm"
									>
										P{task.priority}
									</Badge>
								</Table.Td>
								<Table.Td>
									<Group gap={4} justify="flex-end">
										<Button
											size="compact-xs"
											variant="subtle"
											onClick={() => onEdit(task)}
										>
											<IconEdit size={16} />
										</Button>
										<Button
											size="compact-xs"
											variant="subtle"
											color="red"
											onClick={() => onRemove(task.id)}
										>
											<IconTrash size={16} />
										</Button>
									</Group>
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			)}
		</Card>
	);
}

/** 新建 / 编辑任务的表单值 */
export interface TaskFormValue {
	title: string;
	subject: string;
	startDate: string;
	endDate: string;
	targetHours: number;
	doneHours: number;
	status: TaskStatus;
	priority: 1 | 2 | 3;
	note?: string;
}

/** 新建 / 编辑任务弹窗。科目列表由调用方传入（考研五科 / 公考四科） */
export function TaskDialog({
	opened,
	close,
	editing,
	subjects,
	defaultSubject,
	onSubmit,
	title = "新建任务",
}: {
	opened: boolean;
	close: () => void;
	editing: TaskRow | null;
	subjects: readonly string[];
	defaultSubject: string;
	onSubmit: (value: TaskFormValue) => Promise<void>;
	title?: string;
}) {
	const [form, setForm] = useState<TaskFormValue>(() => ({
		title: editing?.title ?? "",
		subject: editing?.subject ?? defaultSubject,
		startDate: editing?.startDate ?? new Date().toISOString().slice(0, 10),
		endDate: editing?.endDate ?? new Date().toISOString().slice(0, 10),
		targetHours: editing?.targetHours ?? 20,
		doneHours: editing?.doneHours ?? 0,
		status: editing?.status ?? "未开始",
		priority: (editing?.priority ?? 2) as 1 | 2 | 3,
		note: editing?.note ?? "",
	}));
	const [submitting, setSubmitting] = useState(false);

	const valid = Boolean(form.title && form.subject && form.startDate && form.endDate);

	return (
		<Modal
			opened={opened}
			onClose={close}
			title={editing ? "编辑任务" : title}
		>
			<Stack gap="sm">
				<TextInput
					label="任务名称"
					placeholder="例如：资料分析 速算技巧"
					value={form.title}
					onChange={(e) => setForm((f) => ({ ...f, title: e.currentTarget.value }))}
				/>
				<Group grow>
					<Select
						label="科目"
						data={subjects.map((s) => ({ value: s, label: s }))}
						value={form.subject}
						onChange={(v) => setForm((f) => ({ ...f, subject: v ?? f.subject }))}
					/>
					<Select
						label="状态"
						data={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
						value={form.status}
						onChange={(v) =>
							setForm((f) => ({ ...f, status: (v as TaskStatus) ?? f.status }))
						}
					/>
				</Group>
				<Group grow>
					<TextInput
						label="开始日期"
						type="date"
						value={form.startDate}
						onChange={(e) =>
							setForm((f) => ({ ...f, startDate: e.currentTarget.value }))
						}
					/>
					<TextInput
						label="结束日期"
						type="date"
						value={form.endDate}
						onChange={(e) =>
							setForm((f) => ({ ...f, endDate: e.currentTarget.value }))
						}
					/>
				</Group>
				<Group grow>
					<NumberInput
						label="预估时长（小时）"
						min={0}
						value={form.targetHours}
						onChange={(v) =>
							setForm((f) => ({ ...f, targetHours: Number(v) || 0 }))
						}
					/>
					<NumberInput
						label="已完成（小时）"
						min={0}
						value={form.doneHours}
						onChange={(v) =>
							setForm((f) => ({ ...f, doneHours: Number(v) || 0 }))
						}
					/>
					<Select
						label="优先级"
						data={[
							{ value: "1", label: "P1" },
							{ value: "2", label: "P2" },
							{ value: "3", label: "P3" },
						]}
						value={String(form.priority)}
						onChange={(v) =>
							setForm((f) => ({ ...f, priority: Number(v) as 1 | 2 | 3 }))
						}
					/>
				</Group>
				<Textarea
					label="备注"
					placeholder="可选"
					value={form.note ?? ""}
					onChange={(e) => setForm((f) => ({ ...f, note: e.currentTarget.value }))}
				/>
				<Group justify="flex-end">
					<Button variant="default" onClick={close}>
						取消
					</Button>
					<Button
						disabled={!valid}
						loading={submitting}
						onClick={async () => {
							setSubmitting(true);
							await onSubmit({ ...form, note: form.note || undefined });
							setSubmitting(false);
						}}
					>
						保存
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

/** 页面右上角的「新建任务」按钮，两个模块共用同一个样式 */
export function NewTaskButton({ onClick }: { onClick: () => void }) {
	return (
		<Button leftSection={<IconPlus size={16} />} onClick={onClick}>
			新建任务
		</Button>
	);
}
