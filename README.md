# Wallpaper Gallery

一个高雅大气的壁纸展示网站，基于 Vue 3 + Vite 7 构建，完美适配桌面端和移动端。

## 特性

### 核心功能

- **高清壁纸展示** - 支持 4K 及更高分辨率壁纸
- **三大系列** - 电脑壁纸、手机壁纸、头像，根据设备智能推荐
- **智能搜索** - 实时搜索建议、关键词高亮、回车确认搜索
- **多种排序** - 按时间、大小、名称排序
- **动态分类** - 自动从壁纸数据中提取分类，按数量排序
- **格式筛选** - 按 JPG/PNG 格式筛选
- **一键下载** - 直接下载原图

### 视图与浏览

- **多视图模式** - 网格视图、列表视图、瀑布流视图自由切换
- **滑动切换动效** - 视图模式切换带有平滑滑动指示器
- **全屏浏览** - 沉浸式全屏浏览模式，ESC 退出
- **无限滚动** - 智能分页加载，滚动自动加载更多
- **今日精选** - 每日随机推荐精选壁纸

### 用户体验

- **智能设备检测** - 综合 User Agent、触摸支持、屏幕尺寸判断设备类型
- **主题切换** - 深色/浅色主题，自动跟随系统
- **响应式设计** - 完美适配桌面端和移动端
- **移动端优化** - 底部筛选弹窗、顶部搜索弹窗、侧边导航抽屉
- **用户偏好记忆** - 记住用户的系列选择、排序方式、视图模式
- **友好空状态** - 区分"系列无数据"和"筛选无结果"，提供快捷操作
- **流畅动画** - GSAP 驱动的精致过渡动画
- **回到顶部** - 平滑滚动回到页面顶部
- **本地缩略图** - 预生成 WebP 缩略图，首页加载更快

### 路由与导航

- **智能重定向** - 首次访问根据设备类型自动跳转到推荐系列
- **偏好优先** - 用户明确选择的系列优先于设备推荐
- **循环检测** - 防止路由守卫产生无限循环
- **历史优化** - 使用 replace 避免污染浏览历史

## 技术栈

- **框架**: Vue 3.5 (Composition API + script setup)
- **构建工具**: Vite 7
- **UI 组件**: Element Plus (PC端) + Vant (移动端)
- **动画**: GSAP
- **样式**: Sass + postcss-pxtorem (移动端适配)
- **路由**: Vue Router 4
- **部署**: GitHub Pages + GitHub Actions

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生成壁纸数据（三个系列）
npm run generate

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```
## 项目结构

```text
wallpaper-gallery/
├── .github/workflows/    # GitHub Actions 配置
├── public/
│   └── data/            # 壁纸数据 JSON（构建时生成）
│       ├── desktop.json # 电脑壁纸数据
│       ├── mobile.json  # 手机壁纸数据
│       └── avatar.json  # 头像数据
├── scripts/
│   └── generate-data.js # 数据生成脚本
├── src/
│   ├── assets/styles/   # 全局样式（Sass）
│   ├── components/      # Vue 组件
│   │   ├── common/      # 通用组件（搜索、筛选、回到顶部等）
│   │   ├── home/        # 首页组件（今日精选）
│   │   ├── layout/      # 布局组件（头部、底部）
│   │   └── wallpaper/   # 壁纸相关组件
│   ├── composables/     # 组合式函数
│   │   ├── useDevice.js     # 设备检测（UA、触摸、屏幕尺寸）
│   │   ├── useFilter.js     # 筛选与动态分类
│   │   ├── useTheme.js      # 主题管理
│   │   ├── useViewMode.js   # 视图模式
│   │   ├── useWallpapers.js # 壁纸数据管理
│   │   └── useWallpaperType.js # 系列管理
│   ├── router/          # Vue Router 路由配置（智能重定向）
│   ├── views/           # 页面视图组件
│   └── utils/           # 工具函数和常量
└── index.html
```

## 三大系列

| 系列 | 路由 | 设备可见性 | 宽高比 |
| --- | --- | --- | --- |
| 电脑壁纸 | `/desktop` | PC 端 | 16:10 |
| 手机壁纸 | `/mobile` | 移动端 | 9:16 |
| 头像 | `/avatar` | 全设备 | 1:1 |

- PC 端显示：电脑壁纸 + 头像
- 移动端显示：手机壁纸 + 头像

### 目录结构

```text
nuanXinProPic/
├── wallpaper/
│   ├── desktop/    # 电脑壁纸原图
│   ├── mobile/     # 手机壁纸原图
│   └── avatar/     # 头像原图
└── thumbnail/
    ├── desktop/    # 电脑壁纸缩略图
    ├── mobile/     # 手机壁纸缩略图
    └── avatar/     # 头像缩略图
```

### 图片加载策略

| 场景 | 图片来源 | 说明 |
| --- | --- | --- |
| 首页列表 | `thumbnail/` 目录 | WebP 格式缩略图，400px 宽，加载快速 |
| 今日精选 | `wallpaper/` 目录 | 原图展示，21:9 宽屏比例 |
| 详情预览 | `wallpaper/` 目录 | 原图，支持下载 |

**降级策略**：缩略图加载失败时自动切换到 [wsrv.nl](https://wsrv.nl) 代理服务生成缩略图，确保图片始终可用。

## License

MIT
