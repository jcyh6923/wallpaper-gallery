# 🔧 子域名部署 404 问题解决方案

## 问题描述

访问 `https://wallpaper.061129.xyz` 时：
- ✅ HTML 页面能加载
- ❌ 所有 JS/CSS 资源返回 **404 Not Found**

错误示例：
```
GET http://wallpaper.061129.xyz/wallpaper-gallery/assets/js/index-xxx.js
Status: 404 (Not Found)
```

---

## 根本原因

### 问题根源

项目在 Vite 配置中设置了子路径前缀：

```javascript
// vite.config.js (旧配置)
export default defineConfig({
  base: '/wallpaper-gallery/',  // ❌ 错误配置
  // ...
})
```

### 为什么会出错？

1. **构建时的路径**：
   - Vite 构建时会在所有资源路径前加上 `base` 前缀
   - 生成的 `index.html` 中资源路径为：`/wallpaper-gallery/assets/js/xxx.js`

2. **实际访问路径**：
   - 网站通过子域名根路径访问：`https://wallpaper.061129.xyz/`
   - 浏览器请求资源：`https://wallpaper.061129.xyz/wallpaper-gallery/assets/js/xxx.js`
   - 但服务器上根本不存在 `/wallpaper-gallery/` 目录！

3. **路径不匹配**：
   ```
   预期路径: /assets/js/index.js
   实际请求: /wallpaper-gallery/assets/js/index.js
   结果: 404 Not Found
   ```

---

## 解决方案

### 步骤 1：修改 Vite 配置

将 `base` 路径改为根路径：

```javascript
// vite.config.js (新配置)
export default defineConfig({
  base: '/',  // ✅ 子域名部署使用根路径
  // ...
})
```

### 步骤 2：重新构建项目

```bash
npm run build
```

### 步骤 3：验证资源路径

检查 `dist/index.html` 中的资源路径：

```bash
grep -E '(href=|src=)' dist/index.html
```

**修改前**：
```html
<script src="/wallpaper-gallery/assets/js/index.js"></script>
```

**修改后**：
```html
<script src="/assets/js/index.js"></script>
```

### 步骤 4：提交并推送

```bash
git add -A
git commit -m "fix: 修改 base path 为根路径，适配子域名部署"
git push origin main
```

---

## 验证部署

### 等待 GitHub Actions 部署完成

1. 访问：https://github.com/IT-NuanxinPro/wallpaper-gallery/actions
2. 等待最新的工作流显示 ✅（约 1-3 分钟）

### 访问网站测试

```bash
# 访问网站
open https://wallpaper.061129.xyz

# 或使用 curl 测试
curl -I https://wallpaper.061129.xyz
```

### 检查浏览器控制台

打开浏览器开发者工具（F12）：
- **Network** 标签页：所有资源应该返回 **200 OK**
- **Console** 标签页：无 404 错误

---

## 技术原理

### GitHub Pages 的路径处理

GitHub Pages 对不同类型仓库的路径处理方式：

| 仓库类型 | 访问地址 | base 配置 | 资源路径 |
|---------|---------|----------|---------|
| 用户主页 (`username.github.io`) | `https://username.github.io/` | `/` | `/assets/...` |
| 项目仓库（默认） | `https://username.github.io/repo/` | `/repo/` | `/repo/assets/...` |
| 项目仓库（自定义域名） | `https://custom.domain/` | `/` | `/assets/...` |

### 本项目的配置

- **仓库名**: `wallpaper-gallery`（普通项目仓库）
- **访问方式**: 自定义子域名 `wallpaper.061129.xyz`
- **部署路径**: 根路径 `/`
- **base 配置**: `/`（必须）

---

## 常见错误对比

### ❌ 错误配置 1：使用项目名作为 base

```javascript
// 错误！
base: '/wallpaper-gallery/'
```

**问题**：适用于 `username.github.io/wallpaper-gallery/` 访问，但不适用于自定义域名。

### ❌ 错误配置 2：使用相对路径

```javascript
// 错误！
base: './'
```

**问题**：相对路径在多级路由时会出错。

### ✅ 正确配置：使用根路径

```javascript
// 正确！
base: '/'
```

**适用场景**：
- 自定义根域名（如 `example.com`）
- 自定义子域名（如 `app.example.com`）
- 用户主页仓库（`username.github.io`）

---

## 其他前端框架的配置

### Vue CLI

```javascript
// vue.config.js
module.exports = {
  publicPath: '/',  // 子域名部署使用根路径
}
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  output: {
    publicPath: '/',
  },
}
```

### Create React App

```javascript
// package.json
{
  "homepage": "https://wallpaper.061129.xyz"
}
```

或者使用环境变量：
```bash
PUBLIC_URL=/ npm run build
```

### Next.js

```javascript
// next.config.js
module.exports = {
  basePath: '',  // 空字符串表示根路径
}
```

---

## 故障排查清单

### 问题：资源 404

- [ ] 检查 `vite.config.js` 中的 `base` 配置
- [ ] 重新构建项目（`npm run build`）
- [ ] 检查 `dist/index.html` 中的资源路径
- [ ] 确认 GitHub Pages 已重新部署
- [ ] 清除浏览器缓存（Ctrl + Shift + R）

### 问题：修改后仍然 404

- [ ] 等待 GitHub Actions 部署完成（1-3 分钟）
- [ ] 强制刷新浏览器（Ctrl + F5）
- [ ] 检查 GitHub Actions 日志是否有错误
- [ ] 确认 CNAME 文件未被覆盖

### 问题：本地开发正常，部署后 404

- [ ] 本地开发服务器和生产构建的 `base` 配置不同
- [ ] 检查是否使用了环境变量控制 `base`
- [ ] 确认构建产物在 `dist/` 目录

---

## 相关文档

- **Vite 配置文档**: https://vitejs.dev/config/shared-options.html#base
- **GitHub Pages 文档**: https://docs.github.com/en/pages
- **本项目部署指南**: `SUBDOMAIN_GUIDE.md`

---

## 总结

### 关键点

1. **子域名部署必须使用根路径** (`base: '/'`)
2. **每次修改 base 配置后必须重新构建**
3. **验证 `dist/index.html` 中的路径是否正确**
4. **等待 GitHub Pages 重新部署完成**

### 一次性解决命令

```bash
# 1. 修改 vite.config.js 中的 base 为 '/'

# 2. 重新构建
npm run build

# 3. 验证路径
grep -E '(href=|src=)' dist/index.html

# 4. 提交推送
git add -A
git commit -m "fix: 修改 base path 为根路径，适配子域名部署"
git push origin main

# 5. 等待 1-3 分钟后访问
open https://wallpaper.061129.xyz
```

---

**问题解决时间**: 2025-12-26
**Git Commit**: `76e4478`
**状态**: ✅ 已修复
