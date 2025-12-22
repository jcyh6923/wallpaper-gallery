// ========================================
// 壁纸数据管理 Composable
// ========================================

import { computed, ref } from 'vue'
import { SERIES_CONFIG } from '@/utils/constants'
import { buildImageUrl } from '@/utils/format'

// 每个系列的数据缓存
const seriesCache = ref({})

// 当前加载的系列
const currentLoadedSeries = ref('')

// 当前系列的壁纸数据
const wallpapers = ref([])
const loading = ref(false)
const error = ref(null)

// 格式化字节数
function formatBytes(bytes) {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * 将相对路径转换为完整 URL
 * @param {object} wallpaper - 壁纸数据（包含相对路径）
 * @returns {object} 包含完整 URL 的壁纸数据
 */
function transformWallpaperUrls(wallpaper) {
  return {
    ...wallpaper,
    // 动态拼接完整 URL
    url: wallpaper.path ? buildImageUrl(wallpaper.path) : '',
    thumbnailUrl: wallpaper.thumbnailPath ? buildImageUrl(wallpaper.thumbnailPath) : '',
    previewUrl: wallpaper.previewPath ? buildImageUrl(wallpaper.previewPath) : null,
    downloadUrl: wallpaper.path ? buildImageUrl(wallpaper.path) : '',
  }
}

export function useWallpapers() {
  /**
   * 加载指定系列的壁纸数据
   * @param {string} seriesId - 系列ID (desktop, mobile, avatar)
   * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
   */
  const fetchWallpapers = async (seriesId = 'desktop', forceRefresh = false) => {
    // 验证系列ID
    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      error.value = `Invalid series: ${seriesId}`
      return
    }

    // 如果已有缓存且不强制刷新，直接使用缓存
    if (!forceRefresh && seriesCache.value[seriesId]) {
      wallpapers.value = seriesCache.value[seriesId]
      currentLoadedSeries.value = seriesId
      return
    }

    loading.value = true
    error.value = null

    try {
      // 加载 JSON 数据
      const response = await fetch(seriesConfig.dataUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      const wallpaperList = data.wallpapers || data

      // 处理壁纸数据（JSON 中已包含完整 URL，或需要转换相对路径）
      const transformedList = wallpaperList.map((wallpaper) => {
        // 如果 JSON 中已经有完整 URL，直接使用
        if (wallpaper.url && wallpaper.thumbnailUrl) {
          return wallpaper
        }
        // 否则从相对路径转换
        return transformWallpaperUrls(wallpaper)
      })

      // 存入缓存
      seriesCache.value[seriesId] = transformedList

      // 更新当前数据
      wallpapers.value = transformedList
      currentLoadedSeries.value = seriesId
    }
    catch (e) {
      console.error(`Failed to fetch wallpapers for ${seriesId}:`, e)
      error.value = e.message || '加载壁纸数据失败'
      // 如果加载失败，设置空数组
      wallpapers.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 切换到指定系列并加载数据
   * @param {string} seriesId - 系列ID
   */
  const switchSeries = async (seriesId) => {
    if (currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      // 已经是当前系列且有数据，无需重新加载
      return
    }
    await fetchWallpapers(seriesId)
  }

  /**
   * 清除指定系列的缓存
   * @param {string} seriesId - 系列ID，不传则清除所有缓存
   */
  const clearCache = (seriesId) => {
    if (seriesId) {
      delete seriesCache.value[seriesId]
    }
    else {
      seriesCache.value = {}
    }
  }

  // 是否已加载数据
  const loaded = computed(() => wallpapers.value.length > 0)

  // 壁纸总数
  const total = computed(() => wallpapers.value.length)

  // 统计信息
  const statistics = computed(() => {
    const items = wallpapers.value
    const jpgCount = items.filter(w => w.format === 'JPG' || w.format === 'JPEG').length
    const pngCount = items.filter(w => w.format === 'PNG').length
    const totalSize = items.reduce((sum, w) => sum + (w.size || 0), 0)

    return {
      total: items.length,
      jpg: jpgCount,
      png: pngCount,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
    }
  })

  // 根据 ID 获取单个壁纸
  const getWallpaperById = (id) => {
    return wallpapers.value.find(w => w.id === id)
  }

  // 获取壁纸在列表中的索引
  const getWallpaperIndex = (id) => {
    return wallpapers.value.findIndex(w => w.id === id)
  }

  // 获取上一张壁纸
  const getPrevWallpaper = (currentId) => {
    const index = getWallpaperIndex(currentId)
    if (index > 0) {
      return wallpapers.value[index - 1]
    }
    return null
  }

  // 获取下一张壁纸
  const getNextWallpaper = (currentId) => {
    const index = getWallpaperIndex(currentId)
    if (index < wallpapers.value.length - 1) {
      return wallpapers.value[index + 1]
    }
    return null
  }

  return {
    wallpapers,
    loading,
    error,
    loaded,
    total,
    statistics,
    currentLoadedSeries,
    fetchWallpapers,
    switchSeries,
    clearCache,
    getWallpaperById,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
  }
}
