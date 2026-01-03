import { createRouter, createWebHistory } from 'vue-router'
import { isMobileDevice } from '@/composables/useDevice'
import { DEVICE_SERIES } from '@/utils/constants'

// ========================================
// 路由配置
// ========================================
const routes = [
  // 首页 - 根据设备类型自动选择系列
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { title: 'Wallpaper Gallery - 精选高清壁纸' },
  },
  // 电脑壁纸
  {
    path: '/desktop',
    name: 'Desktop',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '电脑壁纸 - Wallpaper Gallery',
      series: 'desktop',
    },
  },
  // 手机壁纸
  {
    path: '/mobile',
    name: 'Mobile',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '手机壁纸 - Wallpaper Gallery',
      series: 'mobile',
    },
  },
  // 头像
  {
    path: '/avatar',
    name: 'Avatar',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '头像 - Wallpaper Gallery',
      series: 'avatar',
    },
  },
  // 关于页面
  {
    path: '/about',
    name: 'About',
    component: () => import('@/views/About.vue'),
    meta: { title: '关于我们 - Wallpaper Gallery' },
  },
  // 404 重定向到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0, behavior: 'smooth' }
  },
})

// ========================================
// 路由守卫配置
// ========================================

// 存储键常量
const STORAGE_KEY_SERIES = 'wallpaper-gallery-current-series'
const STORAGE_KEY_USER_CHOICE = 'wallpaper-gallery-user-explicit-choice'

// 导航标记，防止循环
let isInternalNavigation = false
let navigationCount = 0
let lastNavigationTime = 0
const MAX_NAVIGATIONS_PER_SECOND = 5 // 每秒最大导航次数
const NAVIGATION_RESET_TIME = 1000 // 重置计数器的时间间隔

/**
 * 获取当前设备类型
 */
function getDeviceType() {
  return isMobileDevice() ? 'mobile' : 'desktop'
}

/**
 * 检查系列是否对当前设备可用
 */
function isSeriesAvailableForDevice(series, deviceType) {
  const available = DEVICE_SERIES[deviceType] || DEVICE_SERIES.desktop
  return available.includes(series)
}

/**
 * 获取用户应该看到的默认系列
 * 优先级：用户明确选择（如果对当前设备可用）> 设备类型推荐
 */
function getRecommendedSeries() {
  const deviceType = getDeviceType()
  const defaultSeries = deviceType === 'mobile' ? 'mobile' : 'desktop'

  // 1. 检查用户是否有明确的选择记录
  const userChoice = localStorage.getItem(STORAGE_KEY_USER_CHOICE)
  if (userChoice && isSeriesAvailableForDevice(userChoice, deviceType)) {
    return userChoice
  }

  // 2. 检查是否有保存的系列偏好
  const savedSeries = localStorage.getItem(STORAGE_KEY_SERIES)
  if (savedSeries && isSeriesAvailableForDevice(savedSeries, deviceType)) {
    return savedSeries
  }

  // 3. 使用设备默认系列
  return defaultSeries
}

/**
 * 记录用户的明确选择
 * 当用户主动点击导航时调用
 */
export function recordUserChoice(series) {
  localStorage.setItem(STORAGE_KEY_USER_CHOICE, series)
  localStorage.setItem(STORAGE_KEY_SERIES, series)
}

/**
 * 清除用户选择记录（用于重置）
 */
export function clearUserChoice() {
  localStorage.removeItem(STORAGE_KEY_USER_CHOICE)
}

// 路由守卫
router.beforeEach((to, from, next) => {
  // 更新页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }

  // 循环检测：检查短时间内的导航次数
  const now = Date.now()
  if (now - lastNavigationTime > NAVIGATION_RESET_TIME) {
    // 超过重置时间，清零计数器
    navigationCount = 0
  }
  lastNavigationTime = now
  navigationCount++

  // 如果导航次数过多，可能是循环，直接放行避免卡死
  if (navigationCount > MAX_NAVIGATIONS_PER_SECOND) {
    console.warn('[Router] 检测到可能的导航循环，跳过重定向')
    isInternalNavigation = false
    next()
    return
  }

  // 如果直接访问具体系列页面（包括刷新），保存用户选择
  if (to.meta?.series) {
    // 直接访问系列页面时，保存为用户选择（刷新时也会触发）
    localStorage.setItem(STORAGE_KEY_SERIES, to.meta.series)
    // 如果是从其他页面导航过来，也记录为明确选择
    if (from.name) {
      recordUserChoice(to.meta.series)
    }
  }

  // 处理首页的智能重定向
  if (to.path === '/' && !isInternalNavigation) {
    const recommendedSeries = getRecommendedSeries()
    const targetPath = `/${recommendedSeries}`

    // 安全检查：确保目标路径有效且不同于当前路径
    if (recommendedSeries && targetPath !== from.path) {
      // 首页访问时，静默重定向到推荐系列
      // 使用 replace 避免产生历史记录
      isInternalNavigation = true
      next({ path: targetPath, replace: true })
      return
    }
  }

  // 重置内部导航标记
  isInternalNavigation = false

  next()
})

// 导航完成后的清理
router.afterEach(() => {
  isInternalNavigation = false
})

export default router
