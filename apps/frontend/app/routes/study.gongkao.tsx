/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：公考事业编计划表页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	ActionIcon,
	Alert,
	Badge,
	Button,
	Card,
	Group,
	Modal,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
	Tooltip,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useState } from "react";
import {
	NewTaskButton,
	PlanMetricCards,
	RiskAlert,
	SubjectProgressPanel,
	TaskDialog,
	TaskTable,
	type TaskFormValue,
	type TaskRow,
} from "~/components/study/plan-shared";
import { analyzeGongkao } from "~/lib/study/ai";
import { useStudy } from "~/lib/study/store";
import {
	GONGKAO_SUBJECTS,
	GONGKAO_TRACKS,
	SUBJECTS_BY_TRACK,
	defaultExamDateForTrack,
	getPaperTypes,
	PROVINCES,
	type GongkaoPlan,
	type GongkaoSubject,
	type GongkaoTrack,
} from "~/lib/study/types";
import { todayString } from "~/lib/study/types";

export default function StudyGongkaoPage() {
	const {
		settings,
		gongkaoPlans,
		gongkaoTasks,
		activeGongkaoPlanId,
		setActiveGongkaoPlan,
		createGongkaoPlan,
		updateGongkaoPlan,
		removeGongkaoPlan,
		addGongkaoTask,
		updateGongkaoTask,
		removeGongkaoTask,
	} = useStudy();

	const [opened, setOpened] = useState(false);
	const [editing, setEditing] = useState<TaskRow | null>(null);
	const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
	const [planModalOpened, setPlanModalOpened] = useState(false);

	// 当前选中的计划；没有计划时为 undefined，页面显示「先建一套计划」
	const activePlan =
		gongkaoPlans.find((p) => p.id === activeGongkaoPlanId) ?? gongkaoPlans[0];

	const planTasks = activePlan
		? gongkaoTasks.filter((t) => t.planId === activePlan.id)
		: [];

	// 统计复用考研那套算法：换科目列表 + 换考试日期，其余完全一致
	const analysis = analyzeGongkao(planTasks, activePlan, settings, gongkaoPlans);

	const visible = subjectFilter
		? planTasks.filter((t) => t.subject === subjectFilter)
		: planTasks;

	const daysLeft = activePlan
		? Math.max(dayjs(activePlan.examDate).diff(todayString(), "day"), 0)
		: 0;

	const defaultSubject: GongkaoSubject = activePlan
		? (SUBJECTS_BY_TRACK[activePlan.track][0] ?? "行测")
		: "行测";

	const submit = async (value: TaskFormValue) => {
		if (!activePlan) return;
		const subject = value.subject as GongkaoSubject;
		if (editing)
			await updateGongkaoTask({ ...editing, ...value, subject, planId: activePlan.id });
		else await addGongkaoTask({ ...value, subject, planId: activePlan.id });
		setOpened(false);
	};

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>公考事业编计划表</Title>
					<Group gap="xs" align="center">
						<Text size="sm" c="dimmed">
							当前计划
						</Text>
						<Select
							size="xs"
							w={240}
							placeholder="还没有计划"
							data={gongkaoPlans.map((p) => ({
								value: p.id,
								label: `${p.name}（${p.examDate}）`,
							}))}
							value={activePlan?.id ?? null}
							onChange={(v) => {
								if (v) setActiveGongkaoPlan(v);
							}}
						/>
						<Button
							size="compact-xs"
							variant="default"
							leftSection={<IconPlus size={14} />}
							onClick={() => setPlanModalOpened(true)}
						>
							新建计划
						</Button>
						{activePlan ? (
							<>
								<Text size="sm" c="dimmed">
									笔试
								</Text>
								<TextInput
									type="date"
									size="xs"
									w={140}
									value={activePlan.examDate}
									onChange={(e) =>
										updateGongkaoPlan({
											...activePlan,
											examDate: e.currentTarget.value,
										})
									}
								/>
								<Badge color={daysLeft <= 30 ? "red" : "blue"} variant="light">
									还剩 {daysLeft} 天
								</Badge>
								<Tooltip label="删除当前这套计划（连同其下所有任务）">
									<ActionIcon
										variant="subtle"
										color="red"
										onClick={() => {
											if (
												window.confirm(
													`确定删除「${activePlan.name}」及其 ${planTasks.length} 个任务？该操作不可撤销。`,
												)
											)
												removeGongkaoPlan(activePlan.id);
										}}
									>
										<IconTrash size={16} />
									</ActionIcon>
								</Tooltip>
							</>
						) : null}
					</Group>
				</Stack>
				<NewTaskButton
					onClick={() => {
						setEditing(null);
						setOpened(true);
					}}
				/>
			</Group>

			{!activePlan ? (
				<Alert color="blue" title="先建一套计划">
					公考/事业编可以同时存在多套计划（国考、A 省省考、B 省省考、各省事业单位……），
					各套任务的时长、进度、倒计时完全独立，切换不会互相覆盖。点左上角「新建计划」开始。
				</Alert>
			) : null}

			{activePlan ? (
				<>
					<RiskAlert analysis={analysis} />
					<PlanMetricCards analysis={analysis} />
					<SubjectProgressPanel
						analysis={analysis}
						emptyHint="这套计划还没有任务"
					/>
					<TaskTable
						tasks={visible}
						subjectFilter={subjectFilter}
						onFilterChange={setSubjectFilter}
						onEdit={(task) => {
							setEditing(task);
							setOpened(true);
						}}
						onRemove={removeGongkaoTask}
						emptyHint="点击右上角「新建任务」给这套计划排任务"
					/>
				</>
			) : null}

			{gongkaoPlans.length > 1 ? (
				<Card withBorder radius="md" padding="md">
					<Text fw={600} mb="sm">
						各套计划概览
					</Text>
					<Stack gap={6}>
						{gongkaoPlans.map((plan) => {
							const items = gongkaoTasks.filter((t) => t.planId === plan.id);
							const target = items.reduce((s, t) => s + t.targetHours, 0);
							const done = items.reduce((s, t) => s + t.doneHours, 0);
							const progress = target ? Math.round((done / target) * 100) : 0;
							const left = Math.max(
								dayjs(plan.examDate).diff(todayString(), "day"),
								0,
							);
							return (
								<Group key={plan.id} gap="xs">
									<Text size="xs" w={180} truncate>
										{plan.name}
									</Text>
									<Text size="xs" w={70} c="dimmed">
										{plan.examDate}
									</Text>
									<Text size="xs" w={56} c="dimmed">
										{left} 天
									</Text>
									<Text size="xs" w={72} c="dimmed">
										{items.length} 个任务
									</Text>
									<Text size="xs" w={48} ta="right">
										{progress}%
									</Text>
									<Button
										size="compact-xs"
										variant={plan.id === activePlan?.id ? "light" : "subtle"}
										onClick={() => setActiveGongkaoPlan(plan.id)}
									>
										切换
									</Button>
								</Group>
							);
						})}
					</Stack>
				</Card>
			) : null}

			<TaskDialog
				key={editing?.id ?? "new"}
				opened={opened}
				close={() => setOpened(false)}
				editing={editing}
				subjects={GONGKAO_SUBJECTS}
				defaultSubject={defaultSubject}
				onSubmit={submit}
			/>

			<CreatePlanModal
				opened={planModalOpened}
				close={() => setPlanModalOpened(false)}
				existing={gongkaoPlans}
				onCreate={async (input) => {
					await createGongkaoPlan(input);
					setPlanModalOpened(false);
				}}
			/>
		</Stack>
	);
}

function CreatePlanModal({
	opened,
	close,
	existing,
	onCreate,
}: {
	opened: boolean;
	close: () => void;
	existing: GongkaoPlan[];
	onCreate: (input: {
		track: GongkaoTrack;
		province?: string;
		paperType: string;
		examDate?: string;
	}) => Promise<void>;
}) {
	const [track, setTrack] = useState<GongkaoTrack | null>("国考");
	const [province, setProvince] = useState<string | null>(null);
	const [paperType, setPaperType] = useState<string | null>(null);
	const [examDate, setExamDate] = useState<string>("");

	const paperTypes = getPaperTypes(track ?? "国考", province ?? undefined);
	const needsProvince = track === "省考" || track === "事业单位";

	const duplicate = existing.some(
		(p) =>
			p.track === track &&
			(track === "国考" || p.province === province) &&
			p.paperType === paperType,
	);

	const valid = Boolean(track && paperType && (!needsProvince || province));

	return (
		<Modal opened={opened} onClose={close} title="新建公考 / 事业编计划">
			<Stack gap="sm">
				<Select
					label="考试大类"
					data={GONGKAO_TRACKS.map((t) => ({ value: t, label: t }))}
					value={track}
					onChange={(v) => {
						const next = (v as GongkaoTrack) ?? "国考";
						setTrack(next);
						setProvince(null);
						setPaperType(getPaperTypes(next)[0] ?? null);
						setExamDate(defaultExamDateForTrack(next));
					}}
				/>
				{needsProvince ? (
					<Select
						label={track === "省考" ? "报考省份" : "省份 / 联考"}
						searchable
						data={PROVINCES.map((p) => ({ value: p, label: p }))}
						value={province}
						onChange={(v) => {
							setProvince(v);
							setPaperType(getPaperTypes(track ?? "省考", v ?? undefined)[0] ?? null);
						}}
					/>
				) : null}
				<Select
					label="试卷类型"
					data={paperTypes.map((p) => ({ value: p, label: p }))}
					value={paperType}
					onChange={setPaperType}
				/>
				<TextInput
					label="笔试日期"
					type="date"
					description="已按常规考期填好初值，请以官方公告为准"
					value={examDate}
					onChange={(e) => setExamDate(e.currentTarget.value)}
				/>
				{duplicate ? (
					<Alert color="yellow" variant="light">
						已经存在一套相同大类 + 省份 + 试卷类型的计划了，建议直接切换过去用，
						或者换一个省份 / 试卷类型。
					</Alert>
				) : null}
				<Group justify="flex-end">
					<Button variant="default" onClick={close}>
						取消
					</Button>
					<Button
						disabled={!valid}
						onClick={async () => {
							if (!track || !paperType) return;
							await onCreate({
								track,
								province: needsProvince ? (province ?? undefined) : undefined,
								paperType,
								examDate: examDate || undefined,
							});
						}}
					>
						创建
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
