# Wallpaper Gallery

一个高雅大气的壁纸展示网站，基于 Vue 3 + Vite 7 构建，完美适配桌面端和移动端。

## ✨ 特性

### 🎨 核心功能

- **高清壁纸展示** - 支持 16K/8K/5K/4K 及更高分辨率壁纸
- **四大系列** - 电脑壁纸、手机壁纸、头像、Bing 每日壁纸
- **Bing 每日壁纸** - 从 2019年6月至今约 2400+ 张必应精选壁纸
  - 按年度分片加载，性能优异
  - 月份选择器快速定位
  - 直连 Bing CDN，无需额外存储
- **智能裁剪** - PC 端电脑壁纸智能裁剪功能
  - 自动适配当前屏幕分辨率
  - 多种比例预设（16:9、21:9、16:10、4:3、iPad、iPhone、安卓全面屏等）
  - 自定义分辨率输入
  - 实时预览 + 沉浸式全屏预览
  - 原图质量输出选项
- **真机显示模式** - 手机壁纸和头像系列专属
  - 模拟 iPhone 外观（Dynamic Island、状态栏、Home 指示器）
  - 电脑端和手机端统一支持
  - 流畅的进入动画（GSAP 硬件加速）
- **竖屏壁纸弹窗** - 移动端专属竖屏壁纸预览体验
- **智能搜索** - 实时搜索建议、关键词高亮、回车确认搜索
- **多种排序** - 按时间、大小、名称排序
- **动态分类** - 自动从壁纸数据中提取分类，按数量排序
- **格式筛选** - 按 JPG/PNG 格式筛选
- **分辨率筛选** - 仅电脑壁纸系列支持，按 16K/8K/5K+/4K+/4K/2K/超清/高清/标清精确筛选
- **一键下载** - 直接下载原图

### 🖼️ 视图与浏览

- **多视图模式**
  - 桌面端：网格/列表/瀑布流，支持 GSAP Flip 动画丝滑切换
  - 移动端：网格/列表，支持手势左右滑动切换视图
- **丝滑切换动画** - 基于 GSAP Flip 插件的视图模式切换动画，卡片平滑形变过渡
- **移动端 Flex 瀑布流** - 采用 Flex + JS 分列算法
- **导航滑块动画** - 系列切换时背景滑块平滑过渡，避免元素抖动
- **动态宽高比** - 根据系列自动适配卡片比例（电脑16:10、手机9:16、头像1:1、Bing 16:9）
- **全屏浏览** - 沉浸式全屏浏览模式，ESC 退出
- **移动端无限滚动** - 滚动到底部自动加载更多
- **今日精选** - 每日随机推荐精选壁纸（仅电脑壁纸系列）
- **3D 热门轮播** - 首页 3D 卡片轮播展示热门壁纸

### 💫 用户体验

- **版本检测与更新提示** - 自动检测新版本，优雅的底部提示栏
- **智能设备检测** - 综合 User Agent、触摸支持、屏幕尺寸判断设备类型
- **主题切换** - 深色/浅色/跟随系统/定时自动切换
- **响应式设计** - 完美适配桌面端和移动端，支持 2K/4K 大屏优化
- **欢迎横幅** - 首页精美渐变横幅，可关闭并记住状态
- **移动端优化**
  - 底部筛选弹窗
  - 顶部搜索弹窗
  - 侧边导航抽屉
  - 手势滑动切换视图
- **用户偏好记忆** - 记住用户的系列选择、排序方式、视图模式
- **本地缩略图** - 预生成 WebP 缩略图，首页加载更快

### 🧭 路由与导航

- **智能重定向** - 首次访问根据设备类型自动跳转到推荐系列
- **偏好优先** - 用户明确选择的系列优先于设备推荐
- **循环检测** - 防止路由守卫产生无限循环
- **历史优化** - 使用 replace 避免污染浏览历史

## 🛠️ 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Vue 3.5 (Composition API + script setup) |
| 构建工具 | Vite 7 |
| UI 组件 | Element Plus (PC端 + Bing 日期选择) + Vant (移动端) |
| 动画 | GSAP + Flip 插件 |
| 图片裁剪 | Cropper.js |
| 样式 | Sass + postcss-pxtorem (移动端适配) |
| 路由 | Vue Router 4 |
| 状态管理 | Pinia |
| 部署 | GitHub Pages (生产) / Vercel (测试) |
| CDN 加速 | Cloudflare + jsDelivr |
| 统计分析 | Cloudflare Web Analytics + Umami |

### 构建优化

- **CDN 外部化** - Vue / Vue Router / vue-demi 通过 CDN 加载（UMD 全局变量模式）
- **代码分割** - Element Plus / Vant / GSAP 独立分包
- **Brotli 压缩** - 静态资源预压缩，体积减少 70%+
- **敏感代码混淆** - 关键业务逻辑混淆保护

### CDN 缓存优化

- **精准缓存控制** - 每张图片使用独立的 `cdnTag` 版本标签
- **增量更新** - 新增图片不影响已有图片的 CDN 缓存
- **时间戳备份** - 图片首次添加时间自动记录，确保 `cdnTag` 稳定不变
- **自动化流程** - GitHub Actions 自动恢复时间戳、生成 cdnTag、构建部署

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/your-username/wallpaper-gallery.git

# 进入目录
cd wallpaper-gallery

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 生成壁纸数据（三个系列）
pnpm generate

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

### 📦 开源用户说明

如果你是 fork 本项目的开源用户：

#### 正常使用（推荐）

运行 `pnpm generate` 或 `pnpm build` 时会自动从线上拉取已生成的壁纸数据。

数据来源：`https://wallpaper.061129.xyz/data/`

**数据完整性保证**：
- ✅ 线上数据由 GitHub Actions 自动部署，始终保持最新
- ✅ 包含完整数据
- ✅ 无需任何额外配置

**如果线上数据源不可用**：
- ⚠️ 这通常意味着生产环境出现问题
- 脚本会回退到 GitHub API（数据可能不完整）
- 建议等待线上数据源恢复后再构建

#### 使用自己的图床

如果你想使用自己的图床：

1. 修改 `src/utils/constants.js` 中的 CDN 配置（替换为你的图床地址）
2. 修改 `scripts/generate-data.js` 中的 `ONLINE_DATA_BASE_URL`
3. 将你的图床仓库 clone 到项目同级或父级目录，目录结构需与本项目兼容

## 📁 项目结构

```text
wallpaper-gallery/
├── .github/workflows/    # GitHub Actions 配置
├── public/
│   └── data/             # 壁纸数据 JSON（构建时生成）
│       ├── desktop/      # 电脑壁纸分类数据
│       ├── mobile/       # 手机壁纸分类数据
│       ├── avatar/       # 头像分类数据
│       └── bing/         # Bing 每日壁纸数据
├── scripts/
│   └── generate-data.js  # 数据生成脚本（含 cdnTag 生成）
├── build/
│   └── vite-plugin-obfuscate.js # 自定义混淆插件
├── src/
│   ├── assets/styles/    # 全局样式（Sass）
│   ├── components/       # Vue 组件
│   │   ├── common/       # 通用组件
│   │   │   ├── feedback/     # 反馈提示组件（Loading、通知、横幅等）
│   │   │   ├── form/         # 表单控件（日期选择器、下拉框、筛选面板等）
│   │   │   ├── navigation/   # 导航组件（返回顶部、分页、抽屉等）
│   │   │   └── ui/           # 基础 UI 组件（动画数字、环境徽章等）
│   │   ├── home/         # 首页组件
│   │   ├── layout/       # 布局组件
│   │   └── wallpaper/    # 壁纸相关组件
│   │       ├── PortraitWallpaperModal/  # 竖屏壁纸弹窗（手机/头像系列）
│   │       ├── WallpaperGrid/           # 壁纸网格（含骨架屏）
│   │       └── WallpaperModal/          # 横屏壁纸弹窗（电脑/Bing系列）
│   ├── composables/      # 组合式函数
│   ├── router/           # Vue Router 路由配置
│   ├── views/            # 页面视图组件
│   └── utils/            # 工具函数和常量
└── index.html
```

### 壁纸数据字段说明

每张壁纸的 JSON 数据包含以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识符 |
| `filename` | string | 文件名 |
| `category` | string | 分类名称 |
| `subcategory` | string? | 二级分类（可选） |
| `path` | string | 原图相对路径 |
| `thumbnailPath` | string | 缩略图相对路径 |
| `previewPath` | string? | 预览图相对路径（可选） |
| `size` | number | 文件大小（字节） |
| `format` | string | 图片格式（JPG/PNG） |
| `createdAt` | string | 首次添加时间（ISO 8601） |
| `cdnTag` | string? | CDN 版本标签（用于精准缓存控制） |
| `resolution` | object? | 分辨率信息（可选） |
| `tags` | string[] | 搜索标签 |

## 📱 四大系列

| 系列 | 路由 | 设备可见性 | 宽高比 | 数据来源 |
| --- | --- | --- | --- | --- |
| 电脑壁纸 | `/desktop` | PC 端 | 16:10 | 自有图床 |
| 手机壁纸 | `/mobile` | 移动端 | 9:16 | 自有图床 |
| 头像 | `/avatar` | 全设备 | 1:1 | 自有图床 |
| Bing 每日壁纸 | `/bing` | 全设备 | 16:9 | Bing CDN |

- PC 端显示：电脑壁纸 + Bing + 头像
- 移动端显示：手机壁纸 + Bing + 头像

## 🎯 性能优化

- **CDN 外部化** - Vue / Vue Router / vue-demi 通过 unpkg CDN 加载
- **CSS 内联** - 关键 CSS 内联到 HTML，加快首屏渲染
- **CLS 优化** - 图片占位符、滚动条预留空间，避免布局偏移
- **图片优化** - WebP 格式、缩略图预生成、懒加载、首屏图片高优先级加载
- **代码分割** - 路由级别代码分割，按需加载；Element Plus / Vant / GSAP 独立分包
- **预连接** - DNS 预解析、预连接到 CDN 域名（jsDelivr、Bing CDN、图片代理服务）
- **Brotli 压缩** - 静态资源预压缩，体积减少 70%+
- **2K/4K 大屏适配** - 容器最大宽度递增（1600/2000/2400px）
- **Cloudflare 缓存** - 部署后自动清除缓存，确保用户及时获取更新
- **Web Worker** - 大数据解码在 Worker 线程执行，避免阻塞主线程
- **分类按需加载** - 首屏只加载前3个分类，剩余分类后台加载

## 📊 SEO 优化

- **结构化数据** - Schema.org 标记，增强搜索引擎理解
- **Sitemap** - 自动生成站点地图
- **搜索引擎提交** - 支持百度主动推送、Google Search Console

## ☕ 赞赏支持

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

本项目完全开源免费，所有壁纸资源均可自由使用。维护开源项目需要投入大量时间和精力，你的支持是我持续更新的动力！

<p align="center">
  <img src="docs/sponsor-alipay.png" width="300" alt="支付宝" />
  <img src="docs/sponsor-wechat.png" width="300" alt="微信支付" />
</p>

感谢每一位支持者 ❤️

## 📄 License

MIT
