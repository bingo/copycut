# CopyCut PRD — Step 1 产品文档

> 小红书场景视频/图文编辑工具，以剪映 Web 为原型裁剪。

## 项目阶段目标

CopyCut 是一个以剪映 Web 为参照对象的裁剪型产品。项目名 CopyCut 即表达其目标：不是重新发明完整剪辑软件，而是先理解剪映的能力边界，再按具体发布场景裁剪成更轻量的 Web 工作流。

| 阶段 | 目标 | 输出 |
|------|------|------|
| Step 1 | 分析剪映 Web 应用，并围绕 Alpha 场景“小红书内容剪辑”完成 feature tailoring | 裁剪后的功能列表、用户故事、用例、Alpha mock 范围 |
| Step 2 | 基于 Step 1 PRD 实现基础 Web 应用 | Presentation 层 mock 页面，剪辑、AI、真实导出等能力先留空或 stub |
| Step 3 | 关联页面和后台能力 | 接入基础图片/视频编辑能力、AI 生成 API、真实导出和存储 |

> 本目录只覆盖 Step 1 的产品文档输出。若文档中出现“导出”“自动字幕”“实时渲染”等表述，Alpha 阶段默认指 UI 流程、交互状态和 mock/stub 结果；真实处理能力归入 Step 3。

## 文档目录

| 文件 | 内容 |
|------|------|
| [00-overview.md](00-overview.md) | 项目概览：定位、目标用户、版本路线图、竞品对比 |
| [01-jianying-feature-analysis.md](01-jianying-feature-analysis.md) | 剪映 Web 全功能分析（13 个功能域，逐条梳理）|
| [02-feature-tailoring.md](02-feature-tailoring.md) | 功能裁剪：小红书场景适配，保留/简化/砍掉决策矩阵 + Alpha 功能架构图 |
| [03-user-stories.md](03-user-stories.md) | 用户故事（US-001 ~ US-122），含验收条件，P0/P1/P2 优先级 |
| [04-use-cases.md](04-use-cases.md) | 端到端用例（UC-01 ~ UC-09），覆盖核心工作流 |
| [05-alpha-scope.md](05-alpha-scope.md) | Alpha / Step 2 范围定义：P0/P1/P2 功能列表、技术约束、交付物、评估标准 |

## 关键决策摘要

- **默认格式**：9:16 竖屏（小红书主流），兼顾 1:1 方形
- **核心差异化**：封面制作模块 + 图文轮播模式 + 小红书风格滤镜预设（剪映没有针对性优化）
- **砍掉的大功能**：AI 数字人、绿幕抠像、专业调色（曲线/HSL/色轮）、关键帧动画、团队协作
- **Alpha 技术约束**：纯前端 Mock，无真实渲染，无后端，草稿优先保存项目元数据
- **范围口径**：`02-feature-tailoring.md` 是产品裁剪依据，`05-alpha-scope.md` 是 Step 2 mock 实施依据；如有冲突，以 `05-alpha-scope.md` 为准

## 下一步（Step 2）

基于本 PRD，实现 Presentation 层 Mock 页面：
- 首页（草稿列表）
- 编辑器主界面（Layout 骨架 + 所有面板 UI）
- 封面制作模块
- 图文轮播模式
- 发布准备面板
- 导出弹窗
