/**
 * 壁纸数据生成脚本
 * 在构建前运行，为三个系列（desktop, mobile, avatar）分别生成 JSON 文件
 */

import { Buffer } from 'node:buffer'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { CHAR_MAP_ENCODE, VERSION_PREFIX } from '../src/utils/codec-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 自定义编码（Base64 + 字符映射 + 反转）
 * @param {string} str - 原始字符串
 * @returns {string} 编码后的字符串
 */
function encodeData(str) {
  const base64 = Buffer.from(str, 'utf-8').toString('base64')
  const mapped = base64.split('').map(c => CHAR_MAP_ENCODE[c] || c).join('')
  return VERSION_PREFIX + mapped.split('').reverse().join('')
}

// 配置
const CONFIG = {
  // GitHub 图床仓库信息
  GITHUB_OWNER: 'IT-NuanxinPro',
  GITHUB_REPO: 'nuanXinProPic',
  GITHUB_BRANCH: 'main',

  // 本地图床仓库路径（支持本地开发和 CI 环境）
  LOCAL_REPO_PATHS: [
    path.resolve(__dirname, '../nuanXinProPic'), // CI 环境：项目根目录下
    path.resolve(__dirname, '../../nuanXinProPic'), // 本地开发：同级目录
  ],

  // 支持的图片格式
  IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],

  // 输出路径
  OUTPUT_DIR: path.resolve(__dirname, '../public/data'),

  // 是否启用分类拆分（按分类生成独立 JSON）
  ENABLE_CATEGORY_SPLIT: true,

  // 三大系列配置
  SERIES: {
    desktop: {
      id: 'desktop',
      name: '电脑壁纸',
      wallpaperDir: 'wallpaper/desktop',
      thumbnailDir: 'thumbnail/desktop',
      previewDir: 'preview/desktop', // 预览图目录（仅 desktop 系列有）
      outputFile: 'desktop.json',
      hasPreview: true, // 是否有预览图
    },
    mobile: {
      id: 'mobile',
      name: '手机壁纸',
      wallpaperDir: 'wallpaper/mobile',
      thumbnailDir: 'thumbnail/mobile',
      outputFile: 'mobile.json',
      hasPreview: false,
    },
    avatar: {
      id: 'avatar',
      name: '头像',
      wallpaperDir: 'wallpaper/avatar',
      thumbnailDir: 'thumbnail/avatar',
      outputFile: 'avatar.json',
      hasPreview: false,
    },
  },
}

/**
 * 通过本地目录获取壁纸列表（优先使用，避免 API 限流）
 * @returns {{ files: Array, repoPath: string } | null} 壁纸文件列表和仓库路径，失败时返回 null
 */
function fetchWallpapersFromLocal(seriesConfig) {
  // 尝试多个可能的路径
  for (const repoPath of CONFIG.LOCAL_REPO_PATHS) {
    const localWallpaperDir = path.join(repoPath, seriesConfig.wallpaperDir)

    if (!fs.existsSync(localWallpaperDir)) {
      console.log(`  Path not found: ${localWallpaperDir}`)
      continue
    }

    console.log(`  Fetching from local: ${localWallpaperDir}`)

    const files = fs.readdirSync(localWallpaperDir)
      .filter((filename) => {
        const ext = path.extname(filename).toLowerCase()
        return CONFIG.IMAGE_EXTENSIONS.includes(ext)
      })
      .map((filename) => {
        const filePath = path.join(localWallpaperDir, filename)
        const stats = fs.statSync(filePath)
        return {
          name: filename,
          size: stats.size,
          sha: '', // 本地模式无 SHA
          type: 'file',
        }
      })

    console.log(`  Found ${files.length} image files`)
    return { files, repoPath }
  }

  console.log('  No local repository found')
  return null
}

/**
 * 通过 GitHub API 获取壁纸列表
 */
async function fetchWallpapersFromGitHub(seriesConfig) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${seriesConfig.wallpaperDir}?ref=${CONFIG.GITHUB_BRANCH}`

  console.log(`  Fetching from GitHub API: ${apiUrl}`)

  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Wallpaper-Gallery-Builder',
    },
  })

  if (!response.ok) {
    // 如果是 404，说明目录还不存在
    if (response.status === 404) {
      console.log(`  Directory not found on GitHub (this is OK for new series)`)
      return []
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const files = await response.json()

  // 过滤出图片文件
  const imageFiles = files.filter((file) => {
    if (file.type !== 'file')
      return false
    const ext = path.extname(file.name).toLowerCase()
    return CONFIG.IMAGE_EXTENSIONS.includes(ext)
  })

  console.log(`  Found ${imageFiles.length} image files`)

  return imageFiles
}

/**
 * 从文件名中提取分类
 * 文件名格式: {分类}--{原文件名}.{ext}
 * 例如: 游戏--原神_雷电将军.png -> 游戏
 */
function extractCategory(filename) {
  const filenameNoExt = path.basename(filename, path.extname(filename))

  // 检查是否包含分类前缀（使用 -- 分隔）
  if (filenameNoExt.includes('--')) {
    const parts = filenameNoExt.split('--')
    if (parts.length >= 2 && parts[0].trim()) {
      return parts[0].trim()
    }
  }

  // 没有分类前缀，返回 '未分类'
  return '未分类'
}

/**
 * 获取图片分辨率信息
 * 使用 ImageMagick 的 identify 命令获取图片尺寸
 * @param {string} filePath - 图片文件路径
 * @returns {{ width: number, height: number } | null} 图片宽高信息，失败时返回 null
 */
function getImageDimensions(filePath) {
  try {
    // 尝试使用 ImageMagick 获取图片尺寸
    // magick identify -format "%w %h" image.jpg
    let cmd = 'magick'
    try {
      execSync('magick --version', { stdio: 'ignore' })
    }
    catch {
      // 如果 magick 不可用，尝试 identify
      cmd = 'identify'
    }

    const result = execSync(`${cmd} -format "%w %h" "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const [width, height] = result.split(' ').map(Number)
    if (width > 0 && height > 0) {
      return { width, height }
    }
  }
  catch {
    // ImageMagick 不可用或执行失败，静默忽略
  }
  return null
}

/**
 * 根据分辨率生成标签信息
 * @param {number} width
 * @param {number} height
 * @returns {{ label: string, type: string }} 分辨率标签和类型
 */
function getResolutionLabel(width, height) {
  const maxDim = Math.max(width, height)

  if (maxDim >= 7680) {
    return { label: '8K', type: 'danger' }
  }
  else if (maxDim >= 3840) {
    return { label: '4K', type: 'warning' }
  }
  else if (maxDim >= 2560) {
    return { label: '2K', type: 'info' }
  }
  else if (maxDim >= 1920) {
    return { label: '1080P', type: 'success' }
  }
  else if (maxDim >= 1280) {
    return { label: '720P', type: 'primary' }
  }
  else {
    return { label: 'SD', type: 'secondary' }
  }
}

/**
 * 生成壁纸数据
 * @param {Array} files - 文件列表
 * @param {object} seriesConfig - 系列配置
 * @param {string|null} localRepoPath - 本地仓库路径（用于获取分辨率）
 */
function generateWallpaperData(files, seriesConfig, localRepoPath = null) {
  const now = new Date()

  return files.map((file, index) => {
    const ext = path.extname(file.name).replace('.', '').toUpperCase()

    // 根据索引生成模拟上传时间（越前面的越新）
    const uploadDate = new Date(now.getTime() - index * 3600000) // 每张间隔1小时

    // 文件名（不含扩展名）
    const filenameNoExt = path.basename(file.name, path.extname(file.name))

    // 提取分类
    const category = extractCategory(file.name)

    // 只存储相对路径（前端会用 buildImageUrl 动态拼接完整 URL）
    const imagePath = `/${seriesConfig.wallpaperDir}/${encodeURIComponent(file.name)}`
    const thumbnailPath = `/${seriesConfig.thumbnailDir}/${encodeURIComponent(filenameNoExt)}.webp`
    const previewPath = seriesConfig.hasPreview
      ? `/${seriesConfig.previewDir}/${encodeURIComponent(filenameNoExt)}.webp`
      : null

    // 获取图片分辨率
    let resolution = null
    if (localRepoPath) {
      const localFilePath = path.join(localRepoPath, seriesConfig.wallpaperDir, file.name)
      if (fs.existsSync(localFilePath)) {
        const dimensions = getImageDimensions(localFilePath)
        if (dimensions) {
          const labelInfo = getResolutionLabel(dimensions.width, dimensions.height)
          resolution = {
            width: dimensions.width,
            height: dimensions.height,
            label: labelInfo.label,
            type: labelInfo.type,
          }
        }
      }
    }

    const wallpaperData = {
      id: `${seriesConfig.id}-${index + 1}`,
      filename: file.name,
      category,
      // 存储相对路径，前端动态拼接（支持版本号刷新缓存）
      path: imagePath,
      thumbnailPath,
      size: file.size,
      format: ext,
      createdAt: uploadDate.toISOString(),
      sha: file.sha,
    }

    // 添加预览图路径（仅 desktop 系列）
    if (previewPath) {
      wallpaperData.previewPath = previewPath
    }

    // 添加分辨率信息
    if (resolution) {
      wallpaperData.resolution = resolution
    }

    return wallpaperData
  })
}

/**
 * 按分类拆分并生成独立的 JSON 文件
 * @param {Array} wallpapers - 壁纸数据
 * @param {string} seriesId - 系列 ID
 * @param {object} seriesConfig - 系列配置
 */
function generateCategorySplitData(wallpapers, seriesId, seriesConfig) {
  // 创建系列子目录
  const seriesDir = path.join(CONFIG.OUTPUT_DIR, seriesId)
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true })
  }

  // 按分类分组
  const categoryGroups = {}
  wallpapers.forEach((wallpaper) => {
    const category = wallpaper.category
    if (!categoryGroups[category]) {
      categoryGroups[category] = []
    }
    categoryGroups[category].push(wallpaper)
  })

  // 生成分类索引
  const categories = Object.entries(categoryGroups).map(([categoryName, items]) => {
    // 选择第一张作为分类缩略图
    const thumbnail = items[0]?.thumbnailPath || items[0]?.path || ''

    return {
      id: categoryName.replace(/\s+/g, '-').toLowerCase(),
      name: categoryName,
      count: items.length,
      thumbnail,
      file: `${categoryName}.json`,
    }
  })

  // 按数量降序排列
  categories.sort((a, b) => b.count - a.count)

  // 加密分类数据（敏感信息）
  const categoriesBlob = encodeData(JSON.stringify(categories))

  // 生成 index.json（加密版本）
  const indexData = {
    generatedAt: new Date().toISOString(),
    series: seriesId,
    seriesName: seriesConfig.name,
    total: wallpapers.length,
    categoryCount: categories.length,
    // 加密的分类列表
    blob: categoriesBlob,
    schema: 2, // 版本 2：支持分类拆分
    env: process.env.NODE_ENV || 'production',
  }

  const indexPath = path.join(seriesDir, 'index.json')
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2))
  console.log(`  Generated: ${seriesId}/index.json`)

  // 为每个分类生成独立的 JSON 文件
  Object.entries(categoryGroups).forEach(([categoryName, items]) => {
    const categoryData = {
      generatedAt: new Date().toISOString(),
      series: seriesId,
      category: categoryName,
      total: items.length,
      wallpapers: items,
      schema: 2,
    }

    // 加密数据
    const blob = encodeData(JSON.stringify(items))
    const encryptedData = {
      generatedAt: categoryData.generatedAt,
      series: seriesId,
      category: categoryName,
      total: items.length,
      blob,
      schema: 2,
    }

    const categoryPath = path.join(seriesDir, `${categoryName}.json`)
    fs.writeFileSync(categoryPath, JSON.stringify(encryptedData, null, 2))
    console.log(`  Generated: ${seriesId}/${categoryName}.json (${items.length} items)`)
  })

  return categories
}

/**
 * 处理单个系列
 */
async function processSeries(seriesId, seriesConfig) {
  console.log('')
  console.log(`Processing series: ${seriesConfig.name} (${seriesId})`)
  console.log('-'.repeat(40))

  // 优先从本地目录获取（避免 GitHub API 限流）
  let files = null
  let localRepoPath = null
  const localResult = fetchWallpapersFromLocal(seriesConfig)

  if (localResult) {
    files = localResult.files
    localRepoPath = localResult.repoPath
  }
  else {
    // 如果本地目录不存在，则从 GitHub API 获取
    console.log('  Falling back to GitHub API...')
    files = await fetchWallpapersFromGitHub(seriesConfig)
  }

  if (files.length === 0) {
    console.log(`  No image files found for ${seriesConfig.name}`)
    // 生成空的 JSON 文件
    const wallpapers = []
    const blob = encodeData(JSON.stringify(wallpapers))

    const outputData = {
      generatedAt: new Date().toISOString(),
      series: seriesId,
      seriesName: seriesConfig.name,
      total: 0,
      schema: 1, // 数据结构版本号，方便以后升级
      env: process.env.NODE_ENV || 'production',
      // 加密后的数据块
      blob,
    }

    const outputPath = path.join(CONFIG.OUTPUT_DIR, seriesConfig.outputFile)
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2))
    console.log(`  Created empty: ${seriesConfig.outputFile}`)

    return { seriesId, count: 0, wallpapers }
  }

  // 生成壁纸数据（传入 localRepoPath 以获取分辨率）
  const wallpapers = generateWallpaperData(files, seriesConfig, localRepoPath)

  // 按大小降序排列（默认显示最大的在前）
  wallpapers.sort((a, b) => b.size - a.size)

  // 写入 JSON 文件
  const outputPath = path.join(CONFIG.OUTPUT_DIR, seriesConfig.outputFile)
  const blob = encodeData(JSON.stringify(wallpapers))

  const outputData = {
    generatedAt: new Date().toISOString(),
    series: seriesId,
    seriesName: seriesConfig.name,
    total: wallpapers.length,
    schema: 1, // 数据结构版本号
    env: process.env.NODE_ENV || 'production',
    // 不再直接明文输出 wallpapers，而是输出加密后的数据块
    blob,
  }

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2))
  console.log(`  Output: ${seriesConfig.outputFile} (${wallpapers.length} items)`)

  // 分类统计
  const categoryStats = {}
  wallpapers.forEach((w) => {
    categoryStats[w.category] = (categoryStats[w.category] || 0) + 1
  })

  console.log('  Categories:')
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`)
    })

  // 分辨率统计
  const resolutionStats = {}
  wallpapers.forEach((w) => {
    if (w.resolution) {
      resolutionStats[w.resolution.label] = (resolutionStats[w.resolution.label] || 0) + 1
    }
  })

  if (Object.keys(resolutionStats).length > 0) {
    console.log('  Resolutions:')
    Object.entries(resolutionStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([res, count]) => {
        console.log(`    ${res}: ${count}`)
      })
  }

  // 如果启用了分类拆分，生成分类索引和分类文件
  if (CONFIG.ENABLE_CATEGORY_SPLIT) {
    console.log('')
    console.log('  Generating category split data...')
    generateCategorySplitData(wallpapers, seriesId, seriesConfig)
  }

  return { seriesId, count: wallpapers.length, wallpapers }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(50))
  console.log('Wallpaper Data Generator (Multi-Series)')
  console.log('='.repeat(50))

  try {
    // 确保输出目录存在
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true })
    }

    // 处理所有系列
    const results = []
    for (const [seriesId, seriesConfig] of Object.entries(CONFIG.SERIES)) {
      const result = await processSeries(seriesId, seriesConfig)
      results.push(result)
    }

    // 输出汇总统计
    console.log('')
    console.log('='.repeat(50))
    console.log('Generation Complete!')
    console.log('='.repeat(50))

    let totalCount = 0
    results.forEach((result) => {
      const config = CONFIG.SERIES[result.seriesId]
      console.log(`${config.name}: ${result.count} items -> ${config.outputFile}`)
      totalCount += result.count
    })

    console.log('-'.repeat(50))
    console.log(`Total: ${totalCount} wallpapers across ${results.length} series`)
    console.log(`Output directory: ${CONFIG.OUTPUT_DIR}`)
    console.log('')

    // 格式统计（汇总）
    const formatStats = { jpg: 0, png: 0 }
    results.forEach((result) => {
      result.wallpapers.forEach((w) => {
        if (w.format === 'JPG' || w.format === 'JPEG')
          formatStats.jpg++
        else if (w.format === 'PNG')
          formatStats.png++
      })
    })

    console.log('Format Statistics (All Series):')
    console.log(`  JPG: ${formatStats.jpg}`)
    console.log(`  PNG: ${formatStats.png}`)
  }
  catch (error) {
    console.error('Error generating wallpaper data:', error)
    process.exit(1)
  }
}

main()
