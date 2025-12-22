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
  let devtoolsDetected = false

  // 检测到开发者工具时的处理
  const onDevToolsDetected = () => {
    if (!devtoolsDetected) {
      devtoolsDetected = true
      alert(warningMessage)
      // 重定向到首页或刷新页面
      setTimeout(() => {
        window.location.reload()
      }, 100)
    }
  }

  // 禁用快捷键（使用 capture 阶段拦截）
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

  // 在 capture 阶段拦截，优先级更高
  document.addEventListener('keydown', blockShortcuts, true)
  window.addEventListener('keydown', blockShortcuts, true)

  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    alert(warningMessage)
    return false
  }, true)

  // 方法1: 窗口尺寸检测
  const threshold = 160
  const checkWindowSize = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold
    const heightThreshold = window.outerHeight - window.innerHeight > threshold
    if (widthThreshold || heightThreshold) {
      onDevToolsDetected()
    }
    else {
      devtoolsDetected = false
    }
  }

  // 方法2: debugger 时间检测
  const checkDebugger = () => {
    const start = performance.now()
    debugger
    const end = performance.now()
    // 如果 debugger 执行时间超过 100ms，说明开发者工具打开了
    if (end - start > 100) {
      onDevToolsDetected()
    }
  }

  // 方法3: console 对象检测
  const checkConsole = () => {
    const element = new Image()
    Object.defineProperty(element, 'id', {
      get() {
        onDevToolsDetected()
        return ''
      },
    })
    console.log('%c', element)
  }

  // 定期检测（多种方法组合）
  setInterval(checkWindowSize, 500)
  setInterval(checkDebugger, 1000)
  setInterval(checkConsole, 2000)

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
