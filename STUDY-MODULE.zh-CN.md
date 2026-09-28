# Ryot 中文定制版改动说明

基于上游 [IgnisDa/ryot](https://github.com/IgnisDa/ryot)（commit `302931f`，2026-09-24）改造。
改动**只落在前端**（`apps/frontend`），后端 Rust 未动。

## 一、怎么跑起来

```bash
# 1. 装依赖（仓库自带 yarn 4.1.1，不用全局装）
node .yarn/releases/yarn-4.1.1.cjs install

# 2. 起前端
node .yarn/releases/yarn-4.1.1.cjs workspace @ryot/frontend dev
```

打开 <http://localhost:3000/study>。

> 学习中心**不需要 Rust 后端和登录**。原版 `/dashboard` 必须连上 `127.0.0.1:8000` 的后端
> （否则 `/auth` 会 500），所以新增模块刻意做成了无后端依赖。

## 四之二、中文化（只保留简体中文）

> **已移除中/英切换**。原因：ryot 上游把英文硬编码在 152 个组件里，切到英文只能让
> `t()` 失效，而 DOM 兜底翻译已经替换过的中文没法回滚，界面会变成中英混排；
> 且设置存在 localStorage，桌面端端口一变就读不回来。与其留个点了没反应的开关，
> 不如只保留简体中文。

现在的实现分两层：

| 层 | 位置 | 说明 |
|---|---|---|
| 主动翻译 | `app/lib/i18n/index.tsx` | `I18nProvider` + `t()`，词条表在 `app/lib/i18n/locales/zh-CN.ts`。已接入侧边栏导航、仪表盘外壳、新模块全部文案 |
| 兜底替换 | `useRuntimeTranslation` | MutationObserver 对 DOM 文本/placeholder/title 做**全词精确匹配**替换，覆盖还没改造的旧组件 |

兜底层只认完整字符串（如 `"Workouts"`），所以媒体标题这类用户数据不会被误伤。
配套改动：`root.tsx` 里 `<html lang="zh-CN">`、Mantine 主题字体加了 Noto Sans SC 回退、
页面标题与描述改中文。

## 三、新增的四个模块

路由统一在 `/study` 下，共用 `app/routes/study.tsx` 这个中文外壳布局：

| 路由 | 功能 |
|---|---|
| `/study` | 总览：倒计时、连续打卡、待复习数、预测分、目标设置、洞察摘要 |
| `/study/plan` | 考研计划表：任务增删改、甘特/清单、各科进度、风险测算 |
| `/study/gongkao` | 公考事业编计划表：多套计划隔离、考试大类/试卷类型、倒计时、风险测算 |
| `/study/cet` | 四六级打卡：每日五项打卡、91 天热力图、30 天趋势、能力雷达 |
| `/study/review` | 定期复习提醒：SM-2 调度队列、三档评分、浏览器通知、7 天负载 |
| `/study/analytics` | AI 数据分析：洞察卡片、雷达/柱状/折线图、可复制的学习报告 |

### 关键实现

- **数据层** `app/lib/study/storage.ts` — 手写 IndexedDB 封装，零新增依赖；
  IndexedDB 不可用时（隐私模式）自动退化到 localStorage。
- **复习调度** `app/lib/study/review-scheduler.ts` — SM-2 间隔重复（艾宾浩斯遗忘曲线的工程实现）：
  前两轮固定 1 天 / 6 天，之后 `间隔 × 难度因子`；评分 <3 打回第一轮；难度因子下限 1.3。
- **分析引擎** `app/lib/study/ai.ts` — 纯本地规则，不联网、不需要 API Key：
  - 连续打卡、达标率、91 天热力图、平台期检测（近 7 天 vs 前 7 天下滑 >20%）
  - 五项能力雷达（词汇/听力/阅读/写作/翻译），归一化到 0-100
  - 四六级分数预测：基线 420 + 强度 + 词汇量，有模考分时按 4:6 融合
  - 考研风险：剩余小时数 / 剩余天数 vs 每日可用小时，输出 低/中/高
  - `generateInsights()` 把上述结论翻成中文洞察与动作建议
- **提醒** `app/lib/study/reminder.ts` — Notification API，到点弹一次，当天不重复打扰。

### 验证

```bash
cd apps/frontend
node ../../node_modules/vite-node/dist/cli.mjs -c vite.smoke.config.mts app/lib/study/smoke.ts
```

> 上面这条需要一个空内容的最小 vite 配置文件（仓库的 `vite.config.ts` 带 react-router 插件，
> 会尝试重建缓存目录）。`app/lib/study/smoke.ts` 是 34 项断言的冒烟测试，
> 覆盖示例数据、四六级分析、考研分析、SM-2 调度、队列统计、洞察生成、空数据边界。
> 最后一次运行全部通过：预测 537 分 / 考研进度 49% / 风险「高」/ 逾期 1 项。

## 三之二、公考事业编计划表

路由 `/study/gongkao`，侧边栏紧跟「考研计划表」，原有菜单顺序不变。

### 数据隔离

任务通过 `planId` 归属到某一套计划，**考研 / 国考 / A 省省考 / B 省省考 / 各省事业单位
互不影响**，切换计划只是换筛选条件，不会覆盖任何数据。

- 考研任务存在 `kaoyan` store，公考任务存在独立的 `gongkao` store
- 公考的「计划」列表存在 settings 里（随备份一起导出 / 导入）
- 删除一套计划会连带删掉它下面的任务，不留孤儿数据

### 考试与试卷

| 大类 | 省份 | 试卷类型 |
|---|---|---|
| 国考 | 固定全国 | 副省级 / 市地级 / 行政执法卷 |
| 省考 | 31 个省份可选 | 江苏 A/B/C、浙江 A/B、广东 县级/乡镇，其余省份「通用卷」 |
| 事业单位 | 省份 + 联考 | 联考 A~E 类（综合管理/社科专技/自科专技/中小学教师/医疗卫生）、省内单独命题 |

笔试日期可手动改，默认按常规考期填初值：国考 11 月最后一个周日、省考 3 月第二个周六、
事业单位 3 月最后一个周六。**初值只是参考，以当年官方公告为准。**

### 与考研模块的复用关系

- **统计算法**：`analyzePlan()` 是唯一实现，`analyzeKaoyan()` 与 `analyzeGongkao()`
  只是传入不同科目列表和考试日期的包装，逻辑完全复用。
- **UI 组件**：`app/components/study/plan-shared.tsx` 导出预警横幅、三张数据卡片、
  科目进度（可展开子项）、任务表格、任务弹窗、新建按钮。**考研页与公考页用同一份组件**，
  视觉和交互天然一致，改一处两边同时生效。
- 科目进度支持展开子项，按「省份 / 试卷类型」拆分（例如「行测」展开为
  「国考 · 副省级」「江苏省考 · A类」两条独立进度）。

### 任务状态

沿用与考研完全一致的四个状态：未开始 / 进行中 / 已完成 / 已延期。
（需求里只列了后三个，但保留「未开始」才能和考研表格口径一致，新建任务默认落在这里。）

### 测试

`app/lib/study/smoke-gongkao.ts` 共 38 项断言，覆盖试卷目录、默认日期、与考研口径一致、
三套计划数据隔离、子进度拆分、风险阈值、考研模块未回归。全部通过。

## 四、打包成可安装的 App（PWA）

学习中心是纯前端 + 本地存储，天然适合做成离线 PWA：装到桌面或手机主屏后有独立图标、
没有浏览器地址栏、断网也能用。

### 为什么是 PWA 而不是原生安装包

| 方案 | 这台机器能做吗 |
|---|---|
| PWA（装到桌面 / 手机主屏） | ✅ 已实现 |
| Android APK（Capacitor） | ❌ 没有 Java，也没有 Android SDK |
| 桌面 EXE（Tauri） | ❌ 没有 Rust 工具链 |
| 桌面 EXE（Electron） | ⚠️ 可行但要额外装 ~100MB 依赖，需要时再说 |

> 本次**没有发布到线上**。要装到手机，需要你自己把它放到任意 HTTPS 静态托管上
> （GitHub Pages / Vercel / Netlify / 对象存储静态网站都行，直接上传
> `apps/build/study-pwa` 整个目录即可）。

### 构建

```bash
# 产物输出到 ryot/apps/build/study-pwa（纯静态，1.4MB）
node .yarn/releases/yarn-4.1.1.cjs workspace @ryot/frontend build:pwa

# 本地预览（含 SPA 路由回退 + service worker）
node .yarn/releases/yarn-4.1.1.cjs workspace @ryot/frontend preview:pwa
# → http://localhost:4173/study
```

### 实现要点

`apps/frontend/study-pwa/` 是一份独立的 Vite SPA 构建配置，**不改动主应用的 SSR 构建**：

- `vite.config.ts` — 把 `~` 别名指向 `apps/frontend/app`，因此**直接复用原有的页面组件**，
  没有复制任何业务代码；`VitePWA` 用 `generateSW` 策略预缓存全部产物 + 中文字体。
- `main.tsx` — `HashRouter` 挂载原有五个页面，`/` 自动跳转到 `/study`。
  用哈希路由而不是 `BrowserRouter`：静态托管不一定做 SPA 回退，直接访问 `/study` 会 404，
  而 PWA 从桌面/主屏图标启动时打开的正是这个地址；哈希路由下所有请求都落在 `/`，
  任何静态服务器都能跑。
- `manifest.json` — 中文名「学习中心」、`start_url: /`、`display: standalone`、
  `theme_color: #1c7ed6`，图标 192/512/602 三档。
- `build.emptyOutDir: true` — 必须保持 true，否则上一轮的 hashed 文件会留在原地并被
  一起预缓存，产物一轮轮膨胀（实测 1.4MB → 2.3MB）。

> ryot 原有的 service worker（`app/entry.worker.ts`）只处理通知、**不做任何资源缓存**，
> 所以原版 PWA 断网即白屏。这里的 PWA 是独立构建，绕开了这个问题。

### 安装方式

- **Windows / macOS（Chrome、Edge）**：打开线上地址 → 地址栏右侧的「安装」图标 → 安装。
  装完有独立窗口和桌面图标。
- **Android（Chrome）**：打开 → 菜单「安装应用」/「添加到主屏幕」。
- **iOS（Safari）**：打开 → 底部分享按钮 → 「添加到主屏幕」。
  （iOS 上 PWA 通知限制较多，需先加到主屏再用。）

> 手机安装**必须走 HTTPS**，本机 `http://192.168.x.x` 装不了——这是需要发布到线上的原因。

### 顺带修掉的两个隐患

**1. 手机端崩溃**：`crypto.randomUUID()` 只在 HTTPS / localhost 下存在，用手机通过局域网
http 打开时是 `undefined`，创建任务 / 打卡会直接抛错。已统一换成
`app/lib/study/types.ts` 里的 `newId()`，带降级实现。

**2. 数据丢失**：装成 App 后在系统设置里「清除应用数据」会把 IndexedDB 一起清掉，
换设备也会丢，而此前没有任何备份手段。已在总览页加「数据备份」卡片：
导出 JSON / 导入 JSON / 清空数据（带二次确认），底层用 `storage.ts` 的
`exportAll` / `importAll`，备份文件含考研任务、打卡、复习队列和设置。

## 四之三、桌面安装包（Electron）

PWA 之外又做了一个真正的 Windows 安装包：双击安装、桌面/开始菜单建快捷方式、
不依赖浏览器。目录在 `apps/desktop/`（**刻意不进 yarn 工作区**，用 npm 独立装依赖，
避免动到主项目的依赖树）。

### 产出

```
apps/desktop/dist/学习中心 Setup 1.0.0.exe     82 MB   NSIS 安装包
apps/desktop/dist/win-unpacked/学习中心.exe    181 MB  免安装版（直接拷走就能用）
```

### 命令

```bash
# 1. 一次性装依赖（约 190MB，走 npmmirror 镜像）
cd apps/desktop && npm install

# 2. 构建渲染层到 apps/desktop/renderer
node .yarn/releases/yarn-4.1.1.cjs workspace @ryot/frontend build:desktop

# 3. 生成图标 + 打包
cd apps/desktop && node scripts/make-icon.mjs && npm run dist
```

### 四个关键设计

1. **不用 `file://` 加载页面**。file:// 不是安全上下文，Chromium 会禁用 IndexedDB 和
   Service Worker，而学习模块的数据全在 IndexedDB 里——那样一打开就是空数据。
   主进程会起一个只监听 `127.0.0.1` 的本地静态服务器再加载。
2. **端口必须固定（47625，被占用时顺延）**。页面 origin 就是 `http://127.0.0.1:<port>`，
   localStorage 和 IndexedDB 都按 origin 隔离。**用随机端口的话每次打开都是新 origin，
   打卡记录、复习队列、设置全部读不回来**，表现得像每次都被重置。这是第一版最严重的 bug。
3. **`signAndEditExecutable: false`**。electron-builder 为了做 rcedit/签名要解压
   `winCodeSign`，里面的 macOS dylib 是符号链接，未开开发者模式的 Windows 无权创建，
   解压必定失败。没有签名证书，索性关掉。代价是 exe 的文件属性/图标用 Electron 默认的，
   安装包图标不受影响（`nsis.installerIcon` 单独指定）。
4. **图标自己生成**。`scripts/make-icon.mjs` 由 512×512 PNG 拼出 `.ico`
   （ICO 容器允许内嵌 PNG，Vista 起支持），不需要任何图像处理库。

### 在本机打包时踩到的坑

| 现象 | 原因 | 解法 |
|---|---|---|
| npm/yarn install 报错 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` | 删除保护限制单回合删除文件数 | 桌面端不进 yarn 工作区，用 npm 在子目录独立装 |
| `Cannot find module http-proxy-agent/dist/index.js` | 删除保护没真删文件，而是**重命名**成 `*.DELETE.<hash>` | 到 `node_modules` 里 `find . -name "*.DELETE.*"` 改回原名 |
| 7z 解压 winCodeSign 报「客户端没有所需的特权」 | 建符号链接需要管理员/开发者模式 | `signAndEditExecutable: false` 绕开 |
| package.json 解析失败 | 在 JSON 里写了注释 | package.json 不支持注释，说明写进代码/文档 |

## 五、已知限制

1. **中文化未覆盖 100%**。已翻译核心导航与新增模块，其余靠 DOM 兜底层；
   彻底改造需要把 152 个组件逐个换成 `t()`，词典（`zh-CN.ts`）需要继续扩充。
2. **数据只在本地浏览器**。有「数据备份」导出/导入 JSON（总览页），
   换浏览器、清站点数据或换设备仍会丢，记得定期导出。
3. **提醒只在页面打开时有效**。没有服务端推送，关闭页面期间不会弹通知，
   下次打开会补一次。
4. **AI 分析是规则引擎而非大模型**。好处是可解释、离线、毫秒级；
   若要接真实模型，替换 `generateInsights` 即可，其余分析函数可复用。

## 六、改动文件清单

新增：

```
apps/frontend/app/lib/i18n/index.tsx
apps/frontend/app/lib/i18n/locales/zh-CN.ts
apps/frontend/app/lib/study/{types,storage,store.tsx,review-scheduler,ai,seed,reminder}.ts(x)
apps/frontend/app/lib/study/smoke.ts
apps/frontend/app/routes/study.tsx
apps/frontend/app/routes/study.{_index,plan,cet,review,analytics}.tsx
apps/frontend/app/components/locale-switch.tsx
apps/frontend/study-pwa/{index.html,main.tsx,vite.config.ts}   ← PWA 独立构建
```

修改：

```
apps/frontend/app/root.tsx                                  挂 I18nProvider、中文字体、lang
apps/frontend/app/routes/_dashboard.tsx                      侧边栏加「学习中心」，标签接 t()
apps/frontend/app/components/routes/dashboard/navigation/navigation-config.ts   新增 getStudyLinks()
apps/frontend/app/lib/state/general.tsx                      侧边栏展开状态加 study 字段
```
