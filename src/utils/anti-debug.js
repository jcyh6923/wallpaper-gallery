// ========================================
// 反调试保护（生产环境）
// ========================================

/* eslint-disable no-alert, no-console, no-debugger */

/**
 * 初始化反调试保护
 * 禁止打开控制台，显示友好提示
 */
export function initAntiDebug() {
  // 仅在生产环境启用
  if (import.meta.env.DEV) {
    return
  }

  const warningMessage = '兄弟bro，想打开控制台干啥呢？ 😏'

  // ========================================
  // 1. 禁用快捷键（capture 阶段拦截）- 核心保护
  // ========================================
  const blockShortcuts = (e) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault()
      e.stopPropagation()
      alert(warningMessage)
      return false
    }
    // Ctrl+Shift+I / Cmd+Option+I (开发者工具)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
      e.preventDefault()
      e.stopPropagation()
      alert(warningMessage)
      return false
    }
    // Ctrl+Shift+J / Cmd+Option+J (控制台)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
      e.preventDefault()
      e.stopPropagation()
      alert(warningMessage)
      return false
    }
    // Ctrl+Shift+C / Cmd+Option+C (检查元素)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
      e.preventDefault()
      e.stopPropagation()
      alert(warningMessage)
      return false
    }
    // Ctrl+U / Cmd+U (查看源代码)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
      e.preventDefault()
      e.stopPropagation()
      alert(warningMessage)
      return false
    }
  }

  document.addEventListener('keydown', blockShortcuts, true)
  window.addEventListener('keydown', blockShortcuts, true)

  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    alert(warningMessage)
    return false
  }, true)

  // ========================================
  // 2. 持续 debugger 注入（反断点核心）
  // ========================================
  const injectDebugger = () => {
    // 使用多种方式注入 debugger，让断点无法正常使用
    const methods = [
      () => { debugger },
      () => { (function () { }).constructor('debugger')() },
      // eslint-disable-next-line no-eval
      () => { (0, eval)('debugger') },
      // eslint-disable-next-line no-new-func
      () => { new Function('debugger')() },
    ]
    // 随机选择一种方式
    methods[Math.floor(Math.random() * methods.length)]()
  }

  // ========================================
  // 启动检测（只保留核心保护，移除容易误判的检测）
  // ========================================

  // 持续 debugger 注入（100ms 一次，降低频率）
  setInterval(injectDebugger, 100)

  // 控制台输出警告
  console.log(
    '%c⚠️ 警告',
    'color: red; font-size: 30px; font-weight: bold;',
  )
  console.log(
    `%c${warningMessage}`,
    'color: #333; font-size: 16px;',
  )
}
