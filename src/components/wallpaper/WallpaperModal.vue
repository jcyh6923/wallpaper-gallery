<script setup>
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ImageCropModal from '@/components/wallpaper/ImageCropModal.vue'
import { useDevice } from '@/composables/useDevice'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, formatRelativeTime, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
import { recordDownload, recordView } from '@/utils/supabase'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null,
  },
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'prev', 'next'])

// 设备检测
const { isMobile } = useDevice()

// 获取当前系列
const { currentSeries } = useWallpaperType()

// 是否显示裁剪功能（仅 PC 端且仅 desktop 系列）
const showCropFeature = computed(() => !isMobile.value && currentSeries.value === 'desktop')

// 裁剪弹窗状态
const isCropModalOpen = ref(false)

// 打开裁剪弹窗
function openCropModal() {
  isCropModalOpen.value = true
}

// 关闭裁剪弹窗
function closeCropModal() {
  isCropModalOpen.value = false
}

const modalRef = ref(null)
const contentRef = ref(null)
const infoRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const downloading = ref(false)
const actualDimensions = ref({ width: 0, height: 0 })

// 保存滚动位置（修复移动端弹窗关闭后滚动位置丢失问题）
const savedScrollY = ref(0)

// 渐进式加载状态
const previewLoaded = ref(false)
const originalLoaded = ref(false)
const showOriginal = ref(false)
const loadingOriginal = ref(false)

// 是否有预览图（仅 desktop 系列）
const hasPreview = computed(() => !!props.wallpaper?.previewUrl)

// 当前显示的图片 URL
const displayUrl = computed(() => {
  if (!props.wallpaper)
    return ''

  // 如果没有预览图，直接返回原图
  if (!hasPreview.value) {
    return props.wallpaper.url
  }

  // 如果用户选择查看原图，返回原图 URL
  if (showOriginal.value) {
    return props.wallpaper.url
  }

  // 默认返回预览图 URL
  return props.wallpaper.previewUrl || props.wallpaper.url
})

// GSAP 入场动画
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // 追踪壁纸预览事件
    if (props.wallpaper) {
      trackWallpaperPreview(props.wallpaper)
      // 记录到 Supabase 统计
      recordView(props.wallpaper, currentSeries.value)
    }

    // 保存当前滚动位置
    savedScrollY.value = window.scrollY || window.pageYOffset

    // 设置 body top 保持视觉位置，禁止背景滚动
    document.body.style.top = `-${savedScrollY.value}px`
    document.body.classList.add('modal-open')

    await nextTick()
    animateIn()
  }
  else {
    // 恢复背景滚动
    document.body.classList.remove('modal-open')
    document.body.style.top = ''

    // 恢复滚动位置（立即跳转，无动画）
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})

function animateIn() {
  if (!modalRef.value || !contentRef.value)
    return

  const tl = gsap.timeline()

  tl.fromTo(modalRef.value, {
    opacity: 0,
  }, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  })

  tl.fromTo(contentRef.value, {
    scale: 0.9,
    y: 30,
    opacity: 0,
  }, {
    scale: 1,
    y: 0,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.2)',
  }, '-=0.1')

  if (infoRef.value) {
    tl.fromTo(infoRef.value.children, {
      y: 20,
      opacity: 0,
    }, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
    }, '-=0.2')
  }
}

function animateOut(callback) {
  if (!modalRef.value || !contentRef.value) {
    callback?.()
    return
  }

  const tl = gsap.timeline({
    onComplete: callback,
  })

  tl.to(contentRef.value, {
    scale: 0.95,
    y: 20,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  })

  tl.to(modalRef.value, {
    opacity: 0,
    duration: 0.2,
  }, '-=0.1')
}

// Reset state when wallpaper changes
watch(() => props.wallpaper, () => {
  imageLoaded.value = false
  imageError.value = false
  actualDimensions.value = { width: 0, height: 0 }
  // 重置渐进式加载状态
  previewLoaded.value = false
  originalLoaded.value = false
  showOriginal.value = false
  loadingOriginal.value = false
})

// 分辨率信息 - 显示当前加载图片的分辨率（预览图或原图）
const resolution = computed(() => {
  // 使用图片加载后的真实尺寸来计算分辨率标签
  if (actualDimensions.value.width > 0) {
    return getResolutionLabel(actualDimensions.value.width, actualDimensions.value.height)
  }
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const relativeTime = computed(() => props.wallpaper ? formatRelativeTime(props.wallpaper.createdAt) : '')
const displayFilename = computed(() => props.wallpaper ? getDisplayFilename(props.wallpaper.filename) : '')

// 原图分辨率信息（来自 JSON 数据，用于显示原图质量）
const originalResolution = computed(() => props.wallpaper?.resolution || null)
// 显示用的尺寸（显示当前加载图片的实际尺寸，即预览图尺寸）
const displayDimensions = computed(() => {
  // 使用图片加载后获取的实际尺寸（预览图尺寸）
  if (actualDimensions.value.width > 0) {
    return actualDimensions.value
  }
  return { width: 0, height: 0 }
})

// Handlers
function handleImageLoad(e) {
  imageLoaded.value = true

  // 根据是否有预览图更新不同的状态
  if (hasPreview.value) {
    if (showOriginal.value) {
      originalLoaded.value = true
      loadingOriginal.value = false
    }
    else {
      previewLoaded.value = true
    }
  }
  else {
    // 没有预览图，直接标记原图加载完成
    originalLoaded.value = true
  }

  // 获取图片实际尺寸
  if (e.target) {
    actualDimensions.value = {
      width: e.target.naturalWidth,
      height: e.target.naturalHeight,
    }
  }
}

function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
  loadingOriginal.value = false
}

function handleClose() {
  animateOut(() => {
    emit('close')
  })
}

function handlePrev() {
  emit('prev')
}

function handleNext() {
  emit('next')
}

async function handleDownload() {
  if (!props.wallpaper || downloading.value)
    return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
    // 追踪下载事件,包含系列信息
    trackWallpaperDownload(props.wallpaper, currentSeries.value)
    // 记录到 Supabase 统计
    recordDownload(props.wallpaper, currentSeries.value)
  }
  finally {
    downloading.value = false
  }
}

// Keyboard navigation
function handleKeydown(e) {
  if (!props.isOpen)
    return

  switch (e.key) {
    case 'Escape':
      handleClose()
      break
    case 'ArrowLeft':
      handlePrev()
      break
    case 'ArrowRight':
      handleNext()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // 确保清理 modal-open 类和样式
  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  // 如果组件销毁时弹窗是打开的，恢复滚动位置
  if (savedScrollY.value > 0) {
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && wallpaper" ref="modalRef" class="modal-overlay">
      <div ref="contentRef" class="modal-content">
        <!-- Close Button -->
        <button class="modal-close" aria-label="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- Navigation Buttons -->
        <button class="modal-nav modal-nav--prev" aria-label="上一张" @click="handlePrev">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button class="modal-nav modal-nav--next" aria-label="下一张" @click="handleNext">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <!-- Image Container -->
        <div class="modal-image-container">
          <!-- Loading -->
          <div v-if="!imageLoaded" class="modal-loading">
            <LoadingSpinner size="lg" />
            <p v-if="loadingOriginal" class="loading-text">
              正在加载原图...
            </p>
          </div>

          <!-- Error -->
          <div v-else-if="imageError" class="modal-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p>图片加载失败</p>
          </div>

          <!-- Image -->
          <img
            v-show="imageLoaded && !imageError"
            :src="displayUrl"
            :alt="wallpaper.filename"
            width="1920"
            height="1080"
            class="modal-image"
            @load="handleImageLoad"
            @error="handleImageError"
          >

          <!-- 预览图标识 -->
          <div v-if="hasPreview && imageLoaded && !imageError && !showOriginal" class="preview-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>预览图</span>
          </div>

          <!-- 原图标识 -->
          <div v-if="hasPreview && imageLoaded && !imageError && showOriginal" class="original-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
            <span>原图</span>
          </div>
        </div>

        <!-- Info Panel -->
        <div ref="infoRef" class="modal-info">
          <!-- 图片加载中显示骨架屏 -->
          <template v-if="!imageLoaded || imageError">
            <div class="info-skeleton">
              <div class="skeleton-title" />
              <div class="skeleton-tags">
                <div class="skeleton-tag" />
                <div class="skeleton-tag" />
                <div class="skeleton-tag" />
              </div>
              <div class="skeleton-details">
                <div class="skeleton-line" />
                <div class="skeleton-line" />
                <div class="skeleton-line" />
              </div>
              <div class="skeleton-btn" />
            </div>
          </template>

          <!-- 图片加载完成后显示真实信息 -->
          <template v-else>
            <div class="info-header">
              <h3 class="info-title">
                {{ displayFilename }}
              </h3>
              <div class="info-tags">
                <!-- 移动端显示原图清晰度，PC端显示预览图清晰度 -->
                <span v-if="isMobile && originalResolution" class="tag" :class="[`tag--${originalResolution.type || 'success'}`]">{{ originalResolution.label }}</span>
                <span v-else class="tag" :class="[`tag--${resolution.type || 'success'}`]">{{ resolution.label }}</span>
                <span class="tag tag--secondary">{{ fileExt }}</span>
              </div>
            </div>

            <div class="info-details" :class="{ 'info-details--compact': isMobile }">
              <!-- 移动端紧凑布局：直接显示原图信息 -->
              <template v-if="isMobile">
                <!-- 第一行：原图分辨率 -->
                <div v-if="originalResolution" class="detail-row">
                  <div class="detail-item detail-item--highlight">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    <span>{{ originalResolution.width }} × {{ originalResolution.height }}</span>
                  </div>
                </div>
                <!-- 第二行：文件大小 + 日期 -->
                <div class="detail-row">
                  <div class="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>{{ formattedSize }}</span>
                  </div>
                  <div class="detail-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{{ formattedDate }}</span>
                  </div>
                </div>
              </template>

              <!-- PC端布局：显示预览图分辨率和日期，文件大小在原图卡片显示 -->
              <template v-else>
                <!-- 预览图分辨率尺寸 -->
                <div v-if="displayDimensions.width > 0" class="detail-item detail-item--highlight">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ displayDimensions.width }} × {{ displayDimensions.height }}</span>
                  <span v-if="hasPreview && !showOriginal" class="detail-label">预览图</span>
                </div>
                <!-- 上传日期 -->
                <div class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>{{ formattedDate }}</span>
                  <span class="detail-sub">({{ relativeTime }})</span>
                </div>
              </template>
            </div>

            <!-- 原图信息卡片（仅PC端且有预览图时显示，突出原图质量吸引下载） -->
            <div v-if="!isMobile && hasPreview && originalResolution" class="original-info-card">
              <div class="original-info-header">
                <span class="original-label">原图</span>
                <span class="original-resolution-tag" :class="[`tag--${originalResolution.type || 'success'}`]">
                  {{ originalResolution.label }}
                </span>
              </div>
              <div class="original-info-details">
                <div class="original-dimension">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ originalResolution.width }} × {{ originalResolution.height }}</span>
                </div>
                <div class="original-size">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  <span>{{ formattedSize }}</span>
                </div>
              </div>
              <p class="original-hint">
                下载获取完整高清原图
              </p>
            </div>

            <!-- 操作按钮组 -->
            <div class="action-buttons">
              <!-- 裁剪按钮（仅PC端 desktop 系列显示） -->
              <button
                v-if="showCropFeature"
                class="crop-btn"
                :disabled="!imageLoaded || imageError"
                @click="openCropModal"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
                </svg>
                <span>智能裁剪</span>
              </button>

              <!-- 下载按钮 -->
              <button
                class="download-btn"
                :disabled="downloading"
                @click="handleDownload"
              >
                <LoadingSpinner v-if="downloading" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ downloading ? '下载中...' : '下载原图' }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 裁剪弹窗 -->
  <ImageCropModal
    v-if="wallpaper"
    :image-url="wallpaper.url"
    :filename="wallpaper.filename"
    :is-open="isCropModalOpen"
    :original-resolution="originalResolution"
    @close="closeCropModal"
  />
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  padding: $spacing-sm;

  @include tablet-up {
    padding: $spacing-lg;
  }
}

.modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 95vw;
  max-height: 95vh;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);

  @include tablet-up {
    flex-direction: row;
    max-width: 1400px;
    max-height: 90vh;
  }

  @include desktop-up {
    max-width: 1600px;
  }
}

.modal-close {
  position: absolute;
  top: $spacing-md;
  right: $spacing-md;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.modal-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: translateY(-50%) scale(1.1);
  }

  svg {
    width: 24px;
    height: 24px;
  }

  &--prev {
    left: $spacing-md;
  }

  &--next {
    right: $spacing-md;

    @include tablet-up {
      right: calc(320px + $spacing-lg);
    }
  }

  @include mobile-only {
    width: 40px;
    height: 40px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

.modal-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 300px; // 增加移动端初始高度，避免图片加载后弹窗突然变大
  max-height: 60vh; // 移动端限制图片区域高度，增大显示空间
  background: var(--color-bg-primary);
  overflow: hidden;

  // 移动端统一圆角
  @include mobile-only {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  @include tablet-up {
    min-width: 600px;
    min-height: 500px;
    max-height: none; // 桌面端不限制
    // 平板及以上左侧圆角
    border-radius: var(--radius-xl) 0 0 var(--radius-xl);
  }

  @include desktop-up {
    min-width: 800px;
  }
}

.modal-loading,
.modal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  color: var(--color-text-muted);

  svg {
    width: 48px;
    height: 48px;
  }
}

.loading-text {
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.modal-image {
  max-width: 100%;
  max-height: 100%; // 移动端限制在容器内
  object-fit: contain;
  opacity: 0;
  animation: imageReveal 0.5s ease forwards;

  // 移动端图片圆角与容器一致
  @include mobile-only {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  @include tablet-up {
    max-height: 85vh;
    // 平板及以上左侧圆角
    border-radius: var(--radius-xl) 0 0 var(--radius-xl);
  }
}

@keyframes imageReveal {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// 预览图/原图标识
.preview-badge,
.original-badge {
  position: absolute;
  bottom: $spacing-md;
  left: $spacing-md;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 6px $spacing-sm;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  svg {
    width: 14px;
    height: 14px;
  }
}

.preview-badge {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.original-badge {
  background: rgba(16, 185, 129, 0.9);
  color: white;
}

.modal-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-lg;
  background: var(--color-bg-card);

  // 移动端底部圆角 + 缩小间距
  @include mobile-only {
    gap: $spacing-sm;
    padding: $spacing-md;
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  }

  @include tablet-up {
    width: 320px;
    min-width: 320px;
    border-left: 1px solid var(--color-border);
    padding: $spacing-xl;
    // 平板及以上右侧圆角
    border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
  }
}

.info-header {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.info-title {
  font-size: $font-size-md;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  word-break: break-all;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.tag {
  padding: 4px $spacing-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  letter-spacing: 0.3px;

  &--primary {
    background: rgba(99, 102, 241, 0.15);
    color: var(--color-accent);
  }

  &--success {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  &--warning {
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
  }

  &--info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  &--danger {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  &--dark {
    background: rgba(0, 0, 0, 0.6);
    color: white;

    [data-theme='dark'] & {
      background: rgba(255, 255, 255, 0.15);
    }
  }
}

.info-details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);

  // 移动端紧凑布局
  &--compact {
    gap: $spacing-xs;
    padding: $spacing-sm;
  }
}

// 移动端详情行
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;

  .detail-item {
    flex: 1;
    min-width: 0;
  }
}

.detail-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);

  svg {
    width: 18px;
    height: 18px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  &--highlight {
    color: var(--color-text-primary);
    font-weight: $font-weight-medium;

    svg {
      color: var(--color-accent);
    }
  }
}

.detail-sub {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  margin-left: 2px;
}

// 预览图标签
.detail-label {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  margin-left: $spacing-xs;
  padding: 2px 6px;
  background: var(--color-bg-hover);
  border-radius: 4px;
}

// 原图信息卡片（突出显示原图质量，吸引用户下载）
.original-info-card {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-md;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-md);
  position: relative;
  overflow: hidden;

  // 装饰性光晕
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }
}

.original-info-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  position: relative;
  z-index: 1;
}

.original-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.original-resolution-tag {
  padding: 4px 10px;
  font-size: $font-size-md;
  font-weight: $font-weight-bold;
  border-radius: $radius-sm;
  letter-spacing: 0.5px;

  &.tag--danger {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  &.tag--warning {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
  }

  &.tag--info {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  &.tag--success {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  &.tag--primary {
    background: rgba(99, 102, 241, 0.2);
    color: var(--color-accent);
  }
}

.original-info-details {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
  position: relative;
  z-index: 1;
}

.original-dimension,
.original-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-accent);
  }
}

.original-hint {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
  margin: 0;
  position: relative;
  z-index: 1;
}

// 操作按钮组
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  margin-top: auto;
}

// 裁剪按钮
.crop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-md;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
  color: var(--color-accent);
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: var(--radius-md);
  border: 1px solid rgba(99, 102, 241, 0.3);
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(16, 185, 129, 0.25) 100%);
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-md;
  background: var(--color-accent);
  color: white;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

// 骨架屏样式
.info-skeleton {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.skeleton-title {
  height: 24px;
  width: 80%;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.skeleton-tags {
  display: flex;
  gap: $spacing-xs;
}

.skeleton-tag {
  height: 24px;
  width: 50px;
  background: var(--color-bg-hover);
  border-radius: $radius-sm;
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(2) {
    width: 40px;
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    width: 35px;
    animation-delay: 0.2s;
  }
}

.skeleton-details {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
}

.skeleton-line {
  height: 18px;
  background: var(--color-bg-card);
  border-radius: var(--radius-sm);
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(1) {
    width: 70%;
  }

  &:nth-child(2) {
    width: 50%;
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    width: 60%;
    animation-delay: 0.2s;
  }
}

.skeleton-btn {
  height: 48px;
  width: 100%;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  animation: skeletonPulse 1.5s ease-in-out infinite;
  margin-top: auto;
}

@keyframes skeletonPulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
