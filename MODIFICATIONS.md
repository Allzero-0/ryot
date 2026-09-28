# 修改声明 / Notice of Modification

本项目是 [ryot](https://github.com/IgnisDa/ryot) 的修改版本。

- **上游项目**：ryot — https://github.com/IgnisDa/ryot
- **上游基线**：commit `302931f`（2026-09-24 获取）
- **上游许可证**：**GNU General Public License v3.0**（见 `LICENSE`）
- **本仓库许可证**：**GPL-3.0**（与上游一致，GPL 第 5 条 c 款要求衍生作品整体继续以 GPL 授权）

> 换句话说：**这个仓库不能改成 MIT / Apache / 闭源**，必须是 GPL-3.0。
> 这是 GPL 的强 copyleft 要求，不是可选项。

## 改了什么

修改集中在**前端**（`apps/frontend`），后端 Rust 代码未改动。

### 新增

```
apps/frontend/app/lib/i18n/index.tsx                  中文 i18n 层（固定简体中文）
apps/frontend/app/lib/i18n/locales/zh-CN.ts           中文词条表
apps/frontend/app/lib/study/                          学习模块：数据层、分析引擎、种子数据
apps/frontend/app/components/study/plan-shared.tsx    考研与公考共用的 UI 组件
apps/frontend/app/routes/study.tsx                    学习中心外壳与侧边导航
apps/frontend/app/routes/study.{_index,plan,gongkao,cet,review,analytics}.tsx
apps/frontend/study-pwa/                              PWA 独立构建配置
apps/desktop/                                         桌面端 Electron 壳（独立 npm 依赖）
STUDY-MODULE.zh-CN.md                                 中文改动说明
```

### 修改

```
apps/frontend/app/root.tsx                            挂载 I18nProvider、lang="zh-CN"、中文字体
apps/frontend/app/routes/_dashboard.tsx               侧边栏加入「学习中心」
apps/frontend/app/components/routes/dashboard/navigation/navigation-config.ts
apps/frontend/app/lib/state/general.tsx               侧边栏展开状态
apps/frontend/package.json                            新增 build:pwa / build:desktop 脚本
apps/frontend/tsconfig.json                           exclude study-pwa（避免两份 vite 类型冲突）
.gitignore                                            忽略桌面端构建产物与安装包
.gitignore                                            忽略桌面端构建产物与安装包
```

**修改日期：2026 年 9 月 27 日 — 28 日。**

上述改动文件中的 `.ts / .tsx / .js / .mjs` 文件，均已在文件头部加上如下声明
（由 `scripts/add-license-headers.mjs` 批量写入，可重复执行）：

```
/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增/修改：<一句话说明>
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
```

### 无法加头部注释的文件（在此统一声明）

JSON / 配置类文件不支持注释，改动说明记录在此：

| 文件 | 改动 |
|---|---|
| `apps/frontend/package.json` | 新增 `build:pwa`、`build:desktop`、`preview:pwa` 三个脚本 |
| `apps/frontend/tsconfig.json` | `exclude: ["study-pwa"]`（避免根目录与工作区两份 vite 类型冲突） |
| `apps/desktop/package.json` | 新增（Electron 桌面端，独立 npm 依赖，不进 yarn 工作区） |
| `apps/desktop/package-lock.json` | 桌面端依赖锁 |
| `.gitignore` | 忽略 `apps/desktop/renderer`、`*.exe`、`*.blockmap`、`*.7z`、`*.zip` |
| `apps/frontend/study-pwa/index.html` | 新增（PWA 入口：lang="zh-CN"、主题色、apple-touch-icon） |
| `apps/frontend/study-pwa/public/icons/*.png` | 从上游 `public/icons` 复制的 4 个图标 |
| `scripts/add-license-headers.mjs` | 新增（批量写入 GPL 修改头的维护脚本） |

## 上游资产的说明

- 图标 `apps/frontend/public/icons/*`、第三方平台 logo（`provider-logos/`）均沿用上游自带资源，
  未新增第三方商标素材。
- 中文字体通过 Google Fonts CDN 引入（Noto Sans SC，SIL Open Font License）。
- 未引入任何第三方闭源代码或付费素材。

## 源码可得性（GPL 第 6 条）

如果分发编译产物（如 Windows 安装包 `学习中心 Setup 1.0.0.exe`），
其「对应源码」即本仓库。分发时应同时给出本仓库地址。
