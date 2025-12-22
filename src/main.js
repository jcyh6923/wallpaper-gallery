import { createApp } from 'vue'
// 反调试保护（生产环境）
import { initAntiDebug } from '@/utils/anti-debug'
import App from './App.vue'

import router from './router'

// 自定义 flexible 适配方案（PC 端保持设计稿尺寸，移动端等比缩放）
import '@/utils/flexible'

const app = createApp(App)

app.use(router)
app.mount('#app')

// 初始化反调试
initAntiDebug()
