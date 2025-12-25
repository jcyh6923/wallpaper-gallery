// ========================================
// 壁纸数据管理 Composable
// ========================================

import { computed, ref } from 'vue'
import { decodeData } from '@/utils/codec'
import { SERIES_CONFIG } from '@/utils/constants'
import { buildImageUrl } from '@/utils/format'

// 每个系列的数据缓存（导出以便在路由守卫中使用）
export const seriesCache = ref({})

// 分类索引缓存（记录每个系列的分类列表）
export const categoryIndexCache = ref({})

// 分类数据缓存（记录每个系列的每个分类的数据）
// 结构：{ desktop: { '动漫': [...], '风景': [...] }, mobile: { ... } }
export const categoryDataCache = ref({})

// 当前加载的系列
const currentLoadedSeries = ref('')

// 当前系列的壁纸数据
const wallpapers = ref([])
const loading = ref(true) // 初始为 true，避免首次进入白屏
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
 * 将相对路径转换为完整 URL（带版本号）
 * @param {object} wallpaper - 壁纸数据（包含相对路径）
 * @returns {object} 包含完整 URL 的壁纸数据
 */
function transformWallpaperUrls(wallpaper) {
  return {
    ...wallpaper,
    // 动态拼接完整 URL（带版本号刷新缓存）
    url: wallpaper.path ? buildImageUrl(wallpaper.path) : (wallpaper.url || ''),
    thumbnailUrl: wallpaper.thumbnailPath ? buildImageUrl(wallpaper.thumbnailPath) : (wallpaper.thumbnailUrl || ''),
    previewUrl: wallpaper.previewPath ? buildImageUrl(wallpaper.previewPath) : (wallpaper.previewUrl || null),
    downloadUrl: wallpaper.path ? buildImageUrl(wallpaper.path) : (wallpaper.downloadUrl || ''),
  }
}

/**
 * 加载系列的分类索引
 * @param {string} seriesId - 系列ID
 * @returns {Promise<object>} 分类索引数据
 */
export async function loadCategoryIndex(seriesId) {
  // 如果已有缓存，直接返回
  if (categoryIndexCache.value[seriesId]) {
    return categoryIndexCache.value[seriesId]
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

    // 解密分类列表（新架构使用 blob 字段）
    let indexData
    const encoded = data.blob || data.payload
    if (encoded) {
      try {
        const jsonStr = decodeData(encoded)
        const categories = JSON.parse(jsonStr)
        // 重构索引数据结构
        indexData = {
          generatedAt: data.generatedAt,
          series: data.series,
          seriesName: data.seriesName,
          total: data.total,
          categoryCount: data.categoryCount,
          categories, // 解密后的分类列表
          schema: data.schema,
          env: data.env,
        }
      }
      catch (err) {
        console.warn('Failed to decode category index, fallback to plain data:', err)
        indexData = data
      }
    }
    else {
      // 向后兼容：未加密的索引数据
      indexData = data
    }

    // 存入缓存
    categoryIndexCache.value[seriesId] = indexData

    return indexData
  }
  catch (e) {
    console.error(`Failed to load category index for ${seriesId}:`, e)
    throw e
  }
}

/**
 * 加载单个分类的数据
 * @param {string} seriesId - 系列ID
 * @param {string} categoryFile - 分类文件名（例如：'动漫.json'）
 * @returns {Promise<Array>} 壁纸列表
 */
export async function loadCategoryData(seriesId, categoryFile) {
  const seriesConfig = SERIES_CONFIG[seriesId]
  if (!seriesConfig) {
    throw new Error(`Invalid series: ${seriesId}`)
  }

  // 初始化分类数据缓存结构
  if (!categoryDataCache.value[seriesId]) {
    categoryDataCache.value[seriesId] = {}
  }

  // 如果已有缓存，直接返回
  const categoryName = categoryFile.replace('.json', '')
  if (categoryDataCache.value[seriesId][categoryName]) {
    return categoryDataCache.value[seriesId][categoryName]
  }

  try {
    const categoryUrl = `${seriesConfig.categoryBaseUrl}/${categoryFile}`
    const response = await fetch(categoryUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    // 解密数据（新架构使用 blob 字段）
    let wallpaperList
    const encoded = data.blob || data.payload
    if (encoded) {
      try {
        const jsonStr = decodeData(encoded)
        const decoded = JSON.parse(jsonStr)
        wallpaperList = decoded.wallpapers || decoded
      }
      catch (err) {
        console.warn(`Failed to decode category ${categoryName}, fallback to plain data:`, err)
        wallpaperList = data.wallpapers || []
      }
    }
    else {
      wallpaperList = data.wallpapers || []
    }

    // 处理壁纸数据：转换为完整 URL
    const transformedList = wallpaperList.map(wallpaper => transformWallpaperUrls(wallpaper))

    // 存入缓存
    categoryDataCache.value[seriesId][categoryName] = transformedList

    return transformedList
  }
  catch (e) {
    console.error(`Failed to load category ${categoryName} for ${seriesId}:`, e)
    throw e
  }
}

/**
 * 独立的数据加载函数（可在路由守卫中使用）
 * @param {string} seriesId - 系列ID
 * @param {boolean} useLegacyMode - 是否使用传统模式（加载整个 JSON）
 * @returns {Promise<Array>} 壁纸列表
 */
export async function preloadWallpapers(seriesId, useLegacyMode = false) {
  // 如果已有缓存，直接返回
  if (seriesCache.value[seriesId]) {
    return seriesCache.value[seriesId]
  }

  const seriesConfig = SERIES_CONFIG[seriesId]
  if (!seriesConfig) {
    throw new Error(`Invalid series: ${seriesId}`)
  }

  try {
    // 尝试使用新架构（分类拆分）
    if (!useLegacyMode) {
      try {
        // 1. 加载分类索引
        const indexData = await loadCategoryIndex(seriesId)

        // 2. 并行加载所有分类数据
        const categoryFiles = indexData.categories.map(cat => cat.file)
        const categoryDataPromises = categoryFiles.map(file => loadCategoryData(seriesId, file))
        const categoryDataArrays = await Promise.all(categoryDataPromises)

        // 3. 合并所有分类数据
        const allWallpapers = categoryDataArrays.flat()

        // 存入缓存
        seriesCache.value[seriesId] = allWallpapers

        return allWallpapers
      }
      catch (newArchError) {
        console.warn(`⚠️ Failed to load with new architecture, falling back to legacy mode:`, newArchError)
        // 如果新架构失败，回退到传统模式
      }
    }

    // 传统模式：加载整个 JSON 文件（向后兼容）
    const response = await fetch(seriesConfig.dataUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()

    // 支持加密后的结构：blob / payload 是自定义编码的字符串
    let wallpaperList
    const encoded = data.blob || data.payload
    if (encoded) {
      try {
        const jsonStr = decodeData(encoded)
        const decoded = JSON.parse(jsonStr)
        wallpaperList = decoded.wallpapers || decoded
      }
      catch (err) {
        console.warn('Failed to decode wallpaper payload, fallback to plain data:', err)
        wallpaperList = data.wallpapers || []
      }
    }
    else {
      wallpaperList = data.wallpapers || data
    }

    // 处理壁纸数据：统一使用 buildImageUrl 拼接完整 URL（带版本号）
    const transformedList = wallpaperList.map(wallpaper => transformWallpaperUrls(wallpaper))

    // 存入缓存
    seriesCache.value[seriesId] = transformedList

    return transformedList
  }
  catch (e) {
    console.error(`Failed to preload wallpapers for ${seriesId}:`, e)
    throw e
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
      loading.value = false // 确保 loading 状态更新
      return
    }

    loading.value = true
    error.value = null

    try {
      // 使用独立的预加载函数
      const transformedList = await preloadWallpapers(seriesId)

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

  /**
   * 获取系列的分类索引
   * @param {string} seriesId - 系列ID
   * @returns {Promise<object>} 分类索引数据
   */
  const getCategoryIndex = async (seriesId) => {
    try {
      return await loadCategoryIndex(seriesId)
    }
    catch (e) {
      console.error(`Failed to get category index for ${seriesId}:`, e)
      throw e
    }
  }

  /**
   * 加载单个分类的数据
   * @param {string} seriesId - 系列ID
   * @param {string} categoryFile - 分类文件名
   * @returns {Promise<Array>} 壁纸列表
   */
  const loadCategory = async (seriesId, categoryFile) => {
    try {
      return await loadCategoryData(seriesId, categoryFile)
    }
    catch (e) {
      console.error(`Failed to load category ${categoryFile} for ${seriesId}:`, e)
      throw e
    }
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
    // 分类相关功能
    getCategoryIndex,
    loadCategory,
    categoryIndexCache,
    categoryDataCache,
  }
}
