// ========================================
// 壁纸数据管理 Store (优化版 - 按需加载 + Web Worker)
// ========================================

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isWorkerAvailable, workerDecodeAndParse } from '@/composables/useWorker'
import { decodeData } from '@/utils/codec'
import { SERIES_CONFIG } from '@/utils/constants'
import { buildImageUrl } from '@/utils/format'

export const useWallpaperStore = defineStore('wallpaper', () => {
  // ========================================
  // State
  // ========================================

  // 系列数据缓存（只存储索引信息）
  const seriesIndexCache = ref({})

  // 分类数据缓存（按需加载）
  const categoryCache = ref({})

  // 当前加载的壁纸列表（合并后的）
  const wallpapers = ref([])

  // 当前加载的系列
  const currentLoadedSeries = ref('')

  // 已加载的分类列表（当前系列）
  const loadedCategories = ref(new Set())

  // 加载状态
  const loading = ref(false)
  const error = ref(null)

  // 后台加载状态（用于控制 UI 是否显示加载中的数量变化）
  const isBackgroundLoading = ref(false)

  // 首次加载完成后的初始数量（用于在后台加载期间稳定显示）
  const initialLoadedCount = ref(0)

  // ========================================
  // Getters
  // ========================================

  const total = computed(() => wallpapers.value.length)

  // 用于 UI 显示的稳定总数（后台加载期间不会变化）
  const displayTotal = computed(() => {
    // 如果正在后台加载，显示初始加载的数量
    if (isBackgroundLoading.value && initialLoadedCount.value > 0) {
      return initialLoadedCount.value
    }
    return wallpapers.value.length
  })

  const loaded = computed(() => wallpapers.value.length > 0)

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
    }
  })

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * 解码数据（优先使用 Worker，降级到主线程）
   */
  async function decodeDataWithWorker(encoded) {
    // 如果 Worker 可用且数据较大，使用 Worker
    if (isWorkerAvailable() && encoded.length > 1000) {
      try {
        return await workerDecodeAndParse(encoded)
      }
      catch (e) {
        console.warn('Worker decode failed, fallback to main thread:', e)
      }
    }
    // 降级到主线程
    const jsonStr = decodeData(encoded)
    return JSON.parse(jsonStr)
  }

  /**
   * 将相对路径转换为完整 URL
   */
  function transformWallpaperUrls(wallpaper) {
    return {
      ...wallpaper,
      url: wallpaper.path ? buildImageUrl(wallpaper.path) : (wallpaper.url || ''),
      thumbnailUrl: wallpaper.thumbnailPath ? buildImageUrl(wallpaper.thumbnailPath) : (wallpaper.thumbnailUrl || ''),
      previewUrl: wallpaper.previewPath ? buildImageUrl(wallpaper.previewPath) : (wallpaper.previewUrl || null),
      downloadUrl: wallpaper.path ? buildImageUrl(wallpaper.path) : (wallpaper.downloadUrl || ''),
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * 加载系列的分类索引（只加载索引，不加载具体数据）
   */
  async function loadSeriesIndex(seriesId) {
    // 如果已有缓存，直接返回
    if (seriesIndexCache.value[seriesId]) {
      return seriesIndexCache.value[seriesId]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      throw new Error(`Invalid series: ${seriesId}`)
    }

    try {
      const response = await fetch(seriesConfig.indexUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // 解密分类列表（使用 Worker）
      let indexData
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const categories = await decodeDataWithWorker(encoded)
          indexData = {
            generatedAt: data.generatedAt,
            series: data.series,
            seriesName: data.seriesName,
            total: data.total,
            categoryCount: data.categoryCount,
            categories,
            schema: data.schema,
            env: data.env,
          }
        }
        catch (err) {
          console.warn('Failed to decode category index:', err)
          indexData = data
        }
      }
      else {
        indexData = data
      }

      // 存入缓存
      seriesIndexCache.value[seriesId] = indexData
      return indexData
    }
    catch (e) {
      console.error(`Failed to load series index for ${seriesId}:`, e)
      throw e
    }
  }

  /**
   * 加载单个分类的数据
   */
  async function loadCategory(seriesId, categoryFile) {
    const cacheKey = `${seriesId}:${categoryFile}`

    // 如果已有缓存，直接返回
    if (categoryCache.value[cacheKey]) {
      return categoryCache.value[cacheKey]
    }

    const seriesConfig = SERIES_CONFIG[seriesId]
    if (!seriesConfig) {
      throw new Error(`Invalid series: ${seriesId}`)
    }

    try {
      const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryFile}`
      const response = await fetch(categoryUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      // 解密数据（使用 Worker）
      let wallpaperList
      const encoded = data.blob || data.payload
      if (encoded) {
        try {
          const decoded = await decodeDataWithWorker(encoded)
          wallpaperList = decoded.wallpapers || decoded
        }
        catch (err) {
          console.warn(`Failed to decode category ${categoryFile}:`, err)
          wallpaperList = data.wallpapers || []
        }
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存
      categoryCache.value[cacheKey] = transformedList
      return transformedList
    }
    catch (e) {
      console.error(`Failed to load category ${categoryFile}:`, e)
      throw e
    }
  }

  /**
   * 初始化系列（只加载前3个分类 - 首屏优化）
   */
  async function initSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    loading.value = true
    error.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0

    try {
      // 1. 加载分类索引
      const indexData = await loadSeriesIndex(seriesId)

      // 2. 只加载前3个分类（首屏优化）
      const initialCategories = indexData.categories.slice(0, 3)
      const categoryPromises = initialCategories.map(cat => loadCategory(seriesId, cat.file))
      const categoryDataArrays = await Promise.all(categoryPromises)

      // 3. 合并数据
      wallpapers.value = categoryDataArrays.flat()

      // 4. 记录已加载的分类
      initialCategories.forEach((cat) => {
        loadedCategories.value.add(cat.file)
      })

      // 5. 记录初始加载数量（用于 UI 稳定显示）
      initialLoadedCount.value = wallpapers.value.length

      // 6. 后台异步加载剩余分类（不阻塞）
      const remainingCategories = indexData.categories.slice(3)
      if (remainingCategories.length > 0) {
        isBackgroundLoading.value = true
        loadRemainingCategories(seriesId, remainingCategories)
      }
    }
    catch (e) {
      console.error(`Failed to init series ${seriesId}:`, e)
      error.value = e.message || '加载壁纸数据失败'
      wallpapers.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 后台加载剩余分类（不阻塞主流程）
   */
  async function loadRemainingCategories(seriesId, categories) {
    // 批量加载：每次加载3个分类后才更新一次 wallpapers
    const BATCH_SIZE = 3
    const batches = []

    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      batches.push(categories.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      // 过滤已加载的分类
      const unloadedBatch = batch.filter(cat => !loadedCategories.value.has(cat.file))
      if (unloadedBatch.length === 0)
        continue

      try {
        // 并行加载批次内的所有分类
        const batchPromises = unloadedBatch.map(cat => loadCategory(seriesId, cat.file))
        const batchResults = await Promise.all(batchPromises)

        // 合并本批次的数据
        const batchData = batchResults.flat()

        // 一次性追加本批次的所有数据(减少响应式更新次数)
        wallpapers.value = [...wallpapers.value, ...batchData]

        // 标记本批次的分类为已加载
        unloadedBatch.forEach((cat) => {
          loadedCategories.value.add(cat.file)
        })

        // 批次间暂停，避免阻塞主线程
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      catch (e) {
        console.warn(`Failed to load batch:`, e)
        // 继续加载下一批次
      }
    }

    // 后台加载完成，更新状态
    isBackgroundLoading.value = false
    initialLoadedCount.value = wallpapers.value.length
  }

  /**
   * 加载所有分类（用户主动触发）
   */
  async function loadAllCategories(seriesId) {
    const indexData = seriesIndexCache.value[seriesId]
    if (!indexData) {
      await loadSeriesIndex(seriesId)
      return
    }

    const unloadedCategories = indexData.categories.filter(cat =>
      !loadedCategories.value.has(cat.file),
    )

    if (unloadedCategories.length === 0) {
      return
    }

    loading.value = true
    try {
      await loadRemainingCategories(seriesId, unloadedCategories)
    }
    finally {
      loading.value = false
    }
  }

  /**
   * 根据 ID 获取单个壁纸
   */
  function getWallpaperById(id) {
    return wallpapers.value.find(w => w.id === id)
  }

  /**
   * 获取壁纸索引
   */
  function getWallpaperIndex(id) {
    return wallpapers.value.findIndex(w => w.id === id)
  }

  /**
   * 获取上一张壁纸
   */
  function getPrevWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index > 0) {
      return wallpapers.value[index - 1]
    }
    return null
  }

  /**
   * 获取下一张壁纸
   */
  function getNextWallpaper(currentId) {
    const index = getWallpaperIndex(currentId)
    if (index < wallpapers.value.length - 1) {
      return wallpapers.value[index + 1]
    }
    return null
  }

  /**
   * 清除缓存
   */
  function clearCache(seriesId) {
    if (seriesId) {
      // 清除指定系列的缓存
      delete seriesIndexCache.value[seriesId]
      Object.keys(categoryCache.value).forEach((key) => {
        if (key.startsWith(`${seriesId}:`)) {
          delete categoryCache.value[key]
        }
      })
    }
    else {
      // 清除所有缓存
      seriesIndexCache.value = {}
      categoryCache.value = {}
    }
  }

  return {
    // State
    wallpapers,
    loading,
    error,
    currentLoadedSeries,
    loadedCategories,
    isBackgroundLoading,
    // Getters
    total,
    displayTotal,
    loaded,
    statistics,
    // Actions
    initSeries,
    loadAllCategories,
    loadCategory,
    getWallpaperById,
    getWallpaperIndex,
    getPrevWallpaper,
    getNextWallpaper,
    clearCache,
  }
})
