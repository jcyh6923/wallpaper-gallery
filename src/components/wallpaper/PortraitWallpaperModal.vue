<script setup>
/**
 * 竖屏壁纸弹窗组件
 * 专为手机壁纸、头像等竖屏图片设计
 * 布局：图片居中显示，信息面板在底部
 */
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useWallpaperType } from '@/composables/useWallpaperType'
import { trackWallpaperDownload, trackWallpaperPreview } from '@/utils/analytics'
import { downloadFile, formatDate, formatFileSize, getDisplayFilename, getFileExtension, getResolutionLabel } from '@/utils/format'
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

// 获取当前系列
const { currentSeries } = useWallpaperType()

const modalRef = ref(null)
const contentRef = ref(null)
const infoRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
const downloading = ref(false)
const actualDimensions = ref({ width: 0, height: 0 })

// 保存滚动位置
const savedScrollY = ref(0)

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

    // 恢复滚动位置
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
})

// 分辨率信息
const resolution = computed(() => {
  // 优先使用 JSON 数据中的分辨率
  if (props.wallpaper?.resolution) {
    return props.wallpaper.resolution
  }
  // 使用图片加载后的真实尺寸
  if (actualDimensions.value.width > 0) {
    return getResolutionLabel(actualDimensions.value.width, actualDimensions.value.height)
  }
  return { label: '加载中', type: 'secondary' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const displayFilename = computed(() => props.wallpaper ? getDisplayFilename(props.wallpaper.filename) : '')

// 原图分辨率信息
const originalResolution = computed(() => props.wallpaper?.resolution || null)

// Handlers
function handleImageLoad(e) {
  imageLoaded.value = true

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
  document.body.classList.remove('modal-open')
  document.body.style.top = ''
  if (savedScrollY.value > 0) {
    window.scrollTo({ top: savedScrollY.value, behavior: 'instant' })
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && wallpaper" ref="modalRef" class="portrait-modal-overlay" @click.self="handleClose">
      <div ref="contentRef" class="portrait-modal-content">
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

        <!-- Image Container - 竖屏布局 -->
        <div class="portrait-image-container">
          <!-- Loading -->
          <div v-if="!imageLoaded" class="modal-loading">
            <LoadingSpinner size="lg" />
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
            :src="wallpaper.url"
            :alt="wallpaper.filename"
            class="portrait-image"
            @load="handleImageLoad"
            @error="handleImageError"
          >
        </div>

        <!-- Info Panel - 底部信息栏 -->
        <div ref="infoRef" class="portrait-info">
          <!-- 图片加载中显示骨架屏 -->
          <template v-if="!imageLoaded || imageError">
            <div class="info-skeleton-compact">
              <div class="skeleton-left">
                <div class="skeleton-title" />
                <div class="skeleton-tags">
                  <div class="skeleton-tag" />
                  <div class="skeleton-tag" />
                </div>
              </div>
              <div class="skeleton-btn-small" />
            </div>
          </template>

          <!-- 图片加载完成后显示真实信息 -->
          <template v-else>
            <div class="info-main">
              <h3 class="info-title">
                {{ displayFilename }}
              </h3>
              <div class="info-meta">
                <div class="info-tags">
                  <span class="tag" :class="[`tag--${resolution.type || 'success'}`]">{{ resolution.label }}</span>
                  <span class="tag tag--secondary">{{ fileExt }}</span>
                </div>
                <div class="info-details">
                  <span v-if="originalResolution" class="detail-item">
                    {{ originalResolution.width }} × {{ originalResolution.height }}
                  </span>
                  <span class="detail-item">{{ formattedSize }}</span>
                  <span class="detail-item detail-date">{{ formattedDate }}</span>
                </div>
              </div>
            </div>

            <button
              class="download-btn"
              :disabled="downloading"
              @click="handleDownload"
            >
              <LoadingSpinner v-if="downloading" size="sm" />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span class="btn-text">{{ downloading ? '下载中' : '下载' }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.portrait-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  padding: $spacing-md;
}

.portrait-modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 500px;
  width: 90vw; // 确保有足够宽度
  min-height: 70vh; // 设置最小高度,避免骨架屏太小
  max-height: 90vh;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);

  @include mobile-only {
    width: 95vw;
    max-width: 100%;
    min-height: 75vh; // 移动端更高一些
    max-height: 95vh;
  }
}

.modal-close {
  position: absolute;
  top: $spacing-sm;
  right: $spacing-sm;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.1);
  }

  svg {
    width: 18px;
    height: 18px;
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
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: $radius-full;
  color: white;
  transition: all var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: translateY(-50%) scale(1.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  &--prev {
    left: $spacing-sm;
  }

  &--next {
    right: $spacing-sm;
  }
}

.portrait-image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 60vh; // 竖屏壁纸需要更大的初始高度,避免加载后弹窗突然变大
  max-height: 70vh;
  background: var(--color-bg-primary);
  overflow: hidden;

  @include mobile-only {
    min-height: 55vh; // 移动端稍小一些
    max-height: 65vh;
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

.portrait-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  opacity: 0;
  animation: imageReveal 0.5s ease forwards;
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

.portrait-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);

  @include mobile-only {
    padding: $spacing-sm;
    gap: $spacing-sm;
  }
}

.info-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.info-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @include mobile-only {
    font-size: $font-size-xs;
  }
}

.info-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: $font-weight-bold;
  border-radius: 4px;
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
}

.info-details {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  font-size: 11px;
  color: var(--color-text-muted);

  @include mobile-only {
    gap: $spacing-xs;
    font-size: 10px;
  }
}

.detail-item {
  white-space: nowrap;

  &:not(:last-child)::after {
    content: '·';
    margin-left: $spacing-xs;
    color: var(--color-text-muted);
  }
}

.detail-date {
  @include mobile-only {
    display: none;
  }
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  background: var(--color-accent);
  color: white;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  flex-shrink: 0;

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

  @include mobile-only {
    padding: $spacing-xs $spacing-sm;

    svg {
      width: 16px;
      height: 16px;
    }

    .btn-text {
      display: none;
    }
  }
}

// 骨架屏样式
.info-skeleton-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: $spacing-md;
}

.skeleton-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.skeleton-title {
  height: 16px;
  width: 60%;
  background: var(--color-bg-hover);
  border-radius: 4px;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.skeleton-tags {
  display: flex;
  gap: 4px;
}

.skeleton-tag {
  height: 18px;
  width: 36px;
  background: var(--color-bg-hover);
  border-radius: 4px;
  animation: skeletonPulse 1.5s ease-in-out infinite;

  &:nth-child(2) {
    width: 30px;
    animation-delay: 0.1s;
  }
}

.skeleton-btn-small {
  height: 36px;
  width: 36px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  animation: skeletonPulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
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
