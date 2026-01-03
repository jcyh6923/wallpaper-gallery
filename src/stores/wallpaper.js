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
  const errorType = ref(null) // 'network' | 'parse' | 'format' | 'unknown'

  // 后台加载状态（用于控制 UI 是否显示加载中的数量变化）
  const isBackgroundLoading = ref(false)

  // 首次加载完成后的初始数量（用于在后台加载期间稳定显示）
  const initialLoadedCount = ref(0)

  // 重试配置
  const MAX_RETRIES = 3
  const RETRY_DELAY = 1000 // 1秒

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

    // 动态导入格式化函数（避免循环依赖）
    let totalSizeFormatted = '0 B'
    if (totalSize > 0) {
      try {
        // 使用简单的格式化逻辑，避免导入依赖
        const units = ['B', 'KB', 'MB', 'GB']
        const k = 1024
        const i = Math.floor(Math.log(totalSize) / Math.log(k))
        totalSizeFormatted = `${Number.parseFloat((totalSize / k ** i).toFixed(2))} ${units[i]}`
      }
      catch (e) {
        totalSizeFormatted = `${totalSize} B`
      }
    }

    return {
      total: items.length,
      jpg: jpgCount,
      png: pngCount,
      totalSize,
      totalSizeFormatted,
    }
  })

  // ========================================
  // Helper Functions
  // ========================================

  /**
   * 分类错误类型
   */
  function classifyError(error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'network'
    }
    if (error.message && error.message.includes('HTTP error')) {
      return 'network'
    }
    if (error instanceof SyntaxError || error.message.includes('JSON')) {
      return 'parse'
    }
    if (error.message && (error.message.includes('Invalid') || error.message.includes('format'))) {
      return 'format'
    }
    return 'unknown'
  }

  /**
   * 获取用户友好的错误信息
   */
  function getErrorMessage(error, errorType, context = '') {
    const contextStr = context ? ` (${context})` : ''
    switch (errorType) {
      case 'network':
        return `网络连接失败，请检查网络设置${contextStr}`
      case 'parse':
        return `数据解析失败，可能是数据格式错误${contextStr}`
      case 'format':
        return `数据格式错误${contextStr}`
      default:
        return error.message || `加载失败${contextStr}`
    }
  }

  /**
   * 延迟函数
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 带重试的 fetch 请求
   */
  async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options)
        if (!response.ok) {
          // 4xx 错误不重试
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          // 5xx 错误重试
          if (i < retries - 1) {
            await delay(RETRY_DELAY * (i + 1))
            continue
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response
      }
      catch (error) {
        // 网络错误重试
        if (error instanceof TypeError && error.message.includes('fetch')) {
          if (i < retries - 1) {
            await delay(RETRY_DELAY * (i + 1))
            continue
          }
        }
        throw error
      }
    }
  }

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
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      const response = await fetchWithRetry(seriesConfig.indexUrl)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

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
          // 如果解码失败，尝试使用原始数据
          if (data.categories) {
            indexData = data
          }
          else {
            const decodeErr = new Error('Failed to decode category index')
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        indexData = data
      }

      // 验证数据格式
      if (!indexData.categories || !Array.isArray(indexData.categories)) {
        const err = new Error('Invalid index data format: missing categories array')
        errorType.value = 'format'
        throw err
      }

      // 存入缓存
      seriesIndexCache.value[seriesId] = indexData
      return indexData
    }
    catch (e) {
      const errType = classifyError(e)
      errorType.value = errType
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
      const err = new Error(`Invalid series: ${seriesId}`)
      errorType.value = 'format'
      throw err
    }

    try {
      const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryFile}`
      const response = await fetchWithRetry(categoryUrl)
      let data
      try {
        data = await response.json()
      }
      catch (parseError) {
        const err = new Error(`Failed to parse JSON for category ${categoryFile}: ${parseError.message}`)
        errorType.value = 'parse'
        throw err
      }

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
          // 如果解码失败，尝试使用原始数据
          wallpaperList = data.wallpapers || []
          if (!wallpaperList || !Array.isArray(wallpaperList)) {
            const decodeErr = new Error(`Failed to decode category ${categoryFile}`)
            errorType.value = 'parse'
            throw decodeErr
          }
        }
      }
      else {
        wallpaperList = data.wallpapers || []
      }

      // 验证数据格式
      if (!Array.isArray(wallpaperList)) {
        const err = new Error(`Invalid category data format: ${categoryFile}`)
        errorType.value = 'format'
        throw err
      }

      // 转换 URL
      const transformedList = wallpaperList.map(w => transformWallpaperUrls(w))

      // 存入缓存
      categoryCache.value[cacheKey] = transformedList
      return transformedList
    }
    catch (e) {
      const errType = classifyError(e)
      errorType.value = errType
      console.error(`Failed to load category ${categoryFile}:`, e)
      throw e
    }
  }

  /**
   * 初始化系列（加载所有分类 - 确保数据完整）
   */
  async function initSeries(seriesId, forceRefresh = false) {
    // 如果已加载相同系列且有数据，跳过
    if (!forceRefresh && currentLoadedSeries.value === seriesId && wallpapers.value.length > 0) {
      return
    }

    loading.value = true
    error.value = null
    errorType.value = null
    currentLoadedSeries.value = seriesId
    loadedCategories.value = new Set()
    isBackgroundLoading.value = false
    initialLoadedCount.value = 0

    try {
      // 1. 加载分类索引
      const indexData = await loadSeriesIndex(seriesId)

      // 2. 加载所有分类（确保数据完整）
      const allCategories = indexData.categories
      const categoryPromises = allCategories.map(cat => loadCategory(seriesId, cat.file))
      const categoryDataArrays = await Promise.all(categoryPromises)

      // 3. 合并所有数据
      wallpapers.value = categoryDataArrays.flat()

      // 4. 记录已加载的分类
      allCategories.forEach((cat) => {
        loadedCategories.value.add(cat.file)
      })

      // 5. 记录初始加载数量（用于 UI 稳定显示）
      initialLoadedCount.value = wallpapers.value.length

      // 清除错误状态
      error.value = null
      errorType.value = null
    }
    catch (e) {
      console.error(`Failed to init series ${seriesId}:`, e)
      const errType = errorType.value || classifyError(e)
      errorType.value = errType
      error.value = getErrorMessage(e, errType, `系列: ${seriesId}`)
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
      // 检查系列是否已切换，如果切换则停止加载
      if (currentLoadedSeries.value !== seriesId) {
        return
      }

      // 过滤已加载的分类
      const unloadedBatch = batch.filter(cat => !loadedCategories.value.has(cat.file))
      if (unloadedBatch.length === 0)
        continue

      try {
        // 并行加载批次内的所有分类
        const batchPromises = unloadedBatch.map(cat => loadCategory(seriesId, cat.file))
        const batchResults = await Promise.all(batchPromises)

        // 再次检查系列是否已切换（加载完成后）
        if (currentLoadedSeries.value !== seriesId) {
          return
        }

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

    // 后台加载完成，更新状态（仅当系列未切换时）
    if (currentLoadedSeries.value === seriesId) {
      isBackgroundLoading.value = false
      initialLoadedCount.value = wallpapers.value.length
    }
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
    errorType,
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
