/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：学习中心外壳布局与侧边导航
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import { AppShell, Burger, Group, NavLink, ScrollArea, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
	IconBook2,
	IconBrain,
	IconCalendarStats,
	IconChecklist,
	IconFileCertificate,
	IconLayoutDashboard,
	IconVocabulary,
} from "@tabler/icons-react";
import { Link, Outlet, useLocation } from "react-router";
import { StudyProvider } from "~/lib/study/store";

const NAV_ITEMS = [
	{
		label: "总览",
		to: "/study",
		icon: IconLayoutDashboard,
		end: true,
	},
	{ label: "考研计划表", to: "/study/plan", icon: IconCalendarStats },
	// 新增模块紧跟考研计划表，原有菜单的相对顺序不变
	{ label: "公考事业编计划表", to: "/study/gongkao", icon: IconFileCertificate },
	{ label: "四六级打卡", to: "/study/cet", icon: IconVocabulary },
	{ label: "定期复习提醒", to: "/study/review", icon: IconBrain },
	{ label: "AI 数据分析", to: "/study/analytics", icon: IconChecklist },
];

export default function StudyLayout() {
	const [opened, { toggle }] = useDisclosure();
	const location = useLocation();

	return (
		<StudyProvider>
			<AppShell
				header={{ height: 60 }}
				navbar={{
					width: 220,
					breakpoint: "sm",
					collapsed: { mobile: !opened },
				}}
				padding="md"
			>
				<AppShell.Header>
					<Group h="100%" px="md" justify="space-between">
						<Group>
							<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
							<BookIcon />
							<Title order={4}>学习中心</Title>
						</Group>
						<Group gap="xs">
							<Text size="xs" c="dimmed" visibleFrom="md">
								考研 · 四六级 · 复习调度 · 数据分析
							</Text>
						</Group>
					</Group>
				</AppShell.Header>

				<AppShell.Navbar p="xs">
					<AppShell.Section grow component={ScrollArea}>
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = item.end
								? location.pathname === item.to
								: location.pathname.startsWith(item.to);
							return (
								<NavLink
									key={item.to}
									component={Link}
									to={item.to}
									label={item.label}
									active={active}
									leftSection={<Icon size={18} stroke={1.5} />}
									onClick={() => {
										if (opened) toggle();
									}}
								/>
							);
						})}
					</AppShell.Section>
					<AppShell.Section>
						<NavLink
							component={Link}
							to="/"
							label="返回 Ryot 主界面"
							leftSection={<IconBook2 size={18} stroke={1.5} />}
						/>
					</AppShell.Section>
				</AppShell.Navbar>

				<AppShell.Main>
					<Outlet />
				</AppShell.Main>
			</AppShell>
		</StudyProvider>
	);
}

function BookIcon() {
	return <IconVocabulary size={26} stroke={1.5} color="var(--mantine-color-blue-6)" />;
}
