/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：考研计划表页
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import { Group, Stack, Text, TextInput, Title } from "@mantine/core";
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
import { analyzeKaoyan } from "~/lib/study/ai";
import { useStudy } from "~/lib/study/store";
import { SUBJECTS, type Subject } from "~/lib/study/types";

export default function StudyPlanPage() {
	const { tasks, settings, addTask, updateTask, removeTask, updateSettings } =
		useStudy();
	const [opened, setOpened] = useState(false);
	const [editing, setEditing] = useState<TaskRow | null>(null);
	const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

	const analysis = analyzeKaoyan(tasks, settings);
	const visible = subjectFilter
		? tasks.filter((t) => t.subject === subjectFilter)
		: tasks;

	const submit = async (value: TaskFormValue) => {
		const subject = value.subject as Subject;
		if (editing) await updateTask({ ...editing, ...value, subject });
		else await addTask({ ...value, subject });
		setOpened(false);
	};

	return (
		<Stack gap="md">
			<Group justify="space-between" align="flex-end">
				<Stack gap={0}>
					<Title order={3}>考研计划表</Title>
					<Group gap="xs" align="center">
						<Text size="sm" c="dimmed">
							初试日期
						</Text>
						<TextInput
							type="date"
							size="xs"
							w={140}
							value={settings.examDate}
							onChange={(e) => updateSettings({ examDate: e.currentTarget.value })}
						/>
						<Text size="sm" c="dimmed">
							· 还剩 {analysis.remainingDays} 天
						</Text>
					</Group>
				</Stack>
				<NewTaskButton
					onClick={() => {
						setEditing(null);
						setOpened(true);
					}}
				/>
			</Group>

			<RiskAlert analysis={analysis} />
			<PlanMetricCards analysis={analysis} />
			<SubjectProgressPanel analysis={analysis} />
			<TaskTable
				tasks={visible}
				subjectFilter={subjectFilter}
				onFilterChange={setSubjectFilter}
				onEdit={(task) => {
					setEditing(task);
					setOpened(true);
				}}
				onRemove={removeTask}
			/>

			{/* key 让弹窗在新建/编辑之间切换时重新挂载，从而重置表单 */}
			<TaskDialog
				key={editing?.id ?? "new"}
				opened={opened}
				close={() => setOpened(false)}
				editing={editing}
				subjects={SUBJECTS}
				defaultSubject="数学"
				onSubmit={submit}
			/>
		</Stack>
	);
}
