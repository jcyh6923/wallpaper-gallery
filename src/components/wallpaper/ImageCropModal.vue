<script setup>
/**
 * 图片裁剪弹窗组件
 * 专为 PC 端电脑壁纸设计，支持多种比例预设和自由裁剪
 */
import Cropper from 'cropperjs'
import { gsap } from 'gsap'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import 'cropperjs/dist/cropper.css'

const props = defineProps({
  // 原图 URL
  imageUrl: {
    type: String,
    required: true,
  },
  // 文件名（用于下载）
  filename: {
    type: String,
    default: 'cropped-wallpaper',
  },
  // 是否打开
  isOpen: {
    type: Boolean,
    default: false,
  },
  // 原图分辨率
  originalResolution: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close'])

// Refs
const modalRef = ref(null)
const contentRef = ref(null)
const imageRef = ref(null)
const cropper = ref(null)

// State
const imageLoaded = ref(false)
const imageError = ref(false)
const isProcessing = ref(false)
const selectedRatio = ref('auto')
const cropInfo = ref({ width: 0, height: 0 })

// 获取用户屏幕分辨率
const screenResolution = ref({
  width: window.screen.width * (window.devicePixelRatio || 1),
  height: window.screen.height * (window.devicePixelRatio || 1),
})

// 比例预设配置
const ratioPresets = computed(() => [
  {
    id: 'auto',
    name: '自动适配',
    icon: 'monitor',
    description: `${screenResolution.value.width} × ${screenResolution.value.height}`,
    ratio: screenResolution.value.width / screenResolution.value.height,
    highlight: true,
  },
  {
    id: '16:9',
    name: '16:9',
    icon: 'widescreen',
    description: '标准宽屏',
    ratio: 16 / 9,
  },
  {
    id: '21:9',
    name: '21:9',
    icon: 'ultrawide',
    description: '超宽带鱼屏',
    ratio: 21 / 9,
  },
  {
    id: '32:9',
    name: '32:9',
    icon: 'superwide',
    description: '超超宽/双屏',
    ratio: 32 / 9,
  },
  {
    id: '16:10',
    name: '16:10',
    icon: 'macbook',
    description: 'MacBook',
    ratio: 16 / 10,
  },
  {
    id: '3:2',
    name: '3:2',
    icon: 'surface',
    description: 'Surface',
    ratio: 3 / 2,
  },
  {
    id: '4:3',
    name: '4:3',
    icon: 'classic',
    description: '传统比例',
    ratio: 4 / 3,
  },
  {
    id: '5:4',
    name: '5:4',
    icon: 'square-ish',
    description: '近方形',
    ratio: 5 / 4,
  },
  {
    id: '1:1',
    name: '1:1',
    icon: 'square',
    description: '正方形',
    ratio: 1,
  },
  {
    id: 'free',
    name: '自由',
    icon: 'unlock',
    description: '任意比例',
    ratio: Number.NaN,
  },
])

// 当前选中的比例配置
const currentPreset = computed(() =>
  ratioPresets.value.find(p => p.id === selectedRatio.value) || ratioPresets.value[0],
)

// 初始化 Cropper
function initCropper() {
  if (!imageRef.value || cropper.value)
    return

  const preset = currentPreset.value
  const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio

  cropper.value = new Cropper(imageRef.value, {
    aspectRatio,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9,
    restore: false,
    guides: true,
    center: true,
    highlight: true,
    cropBoxMovable: true,
    cropBoxResizable: true,
    toggleDragModeOnDblclick: false,
    initialAspectRatio: aspectRatio,
    crop(event) {
      cropInfo.value = {
        width: Math.round(event.detail.width),
        height: Math.round(event.detail.height),
      }
    },
  })
}

// 销毁 Cropper
function destroyCropper() {
  if (cropper.value) {
    cropper.value.destroy()
    cropper.value = null
  }
}

// 切换比例
function selectRatio(ratioId) {
  selectedRatio.value = ratioId
  const preset = ratioPresets.value.find(p => p.id === ratioId)
  if (cropper.value && preset) {
    const aspectRatio = Number.isNaN(preset.ratio) ? Number.NaN : preset.ratio
    cropper.value.setAspectRatio(aspectRatio)
  }
}

// 图片加载完成
function handleImageLoad() {
  imageLoaded.value = true
  nextTick(() => {
    initCropper()
  })
}

// 图片加载失败
function handleImageError() {
  imageError.value = true
  imageLoaded.value = true
}

// 裁剪并下载
async function handleCropAndDownload() {
  if (!cropper.value || isProcessing.value)
    return

  isProcessing.value = true

  try {
    // 获取裁剪后的 canvas
    const canvas = cropper.value.getCroppedCanvas({
      maxWidth: 8192,
      maxHeight: 8192,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    })

    if (!canvas) {
      throw new Error('裁剪失败')
    }

    // 转换为 blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b)
            resolve(b)
          else reject(new Error('转换失败'))
        },
        'image/png',
        1,
      )
    })

    // 下载文件
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const baseName = props.filename.replace(/\.[^.]+$/, '')
    link.href = url
    link.download = `${baseName}_cropped_${cropInfo.value.width}x${cropInfo.value.height}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    // 关闭弹窗
    handleClose()
  }
  catch (error) {
    console.error('裁剪下载失败:', error)
  }
  finally {
    isProcessing.value = false
  }
}

// 关闭弹窗
function handleClose() {
  animateOut(() => {
    emit('close')
  })
}

// 入场动画
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
    scale: 0.95,
    opacity: 0,
  }, {
    scale: 1,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.2)',
  }, '-=0.1')
}

// 出场动画
function animateOut(callback) {
  if (!modalRef.value || !contentRef.value) {
    callback?.()
    return
  }

  const tl = gsap.timeline({ onComplete: callback })

  tl.to(contentRef.value, {
    scale: 0.95,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  })

  tl.to(modalRef.value, {
    opacity: 0,
    duration: 0.2,
  }, '-=0.1')
}

// 监听打开状态
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    imageLoaded.value = false
    imageError.value = false
    selectedRatio.value = 'auto'
    await nextTick()
    animateIn()
  }
  else {
    destroyCropper()
  }
})

// 键盘事件
function handleKeydown(e) {
  if (!props.isOpen)
    return
  if (e.key === 'Escape') {
    handleClose()
  }
  else if (e.key === 'Enter' && !isProcessing.value) {
    handleCropAndDownload()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  destroyCropper()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" ref="modalRef" class="crop-modal-overlay" @click.self="handleClose">
      <div ref="contentRef" class="crop-modal-content">
        <!-- Header -->
        <div class="crop-header">
          <button class="back-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>返回</span>
          </button>
          <h2 class="crop-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2v4M6 14v8M18 2v4M18 14v8M2 6h4M14 6h8M2 18h4M14 18h8" />
            </svg>
            智能裁剪
          </h2>
          <button class="close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Main Content -->
        <div class="crop-main">
          <!-- 左侧：裁剪区域 -->
          <div class="crop-area">
            <!-- Loading -->
            <div v-if="!imageLoaded" class="crop-loading">
              <LoadingSpinner size="lg" />
              <p>正在加载原图...</p>
              <p class="loading-hint">
                原图较大，请耐心等待
              </p>
            </div>

            <!-- Error -->
            <div v-else-if="imageError" class="crop-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>原图加载失败</p>
            </div>

            <!-- Cropper Image -->
            <img
              v-show="imageLoaded && !imageError"
              ref="imageRef"
              :src="imageUrl"
              class="crop-image"
              crossorigin="anonymous"
              @load="handleImageLoad"
              @error="handleImageError"
            >
          </div>

          <!-- 右侧：控制面板 -->
          <div class="crop-panel">
            <!-- 比例预设 -->
            <div class="panel-section">
              <h3 class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                比例预设
              </h3>
              <div class="ratio-grid">
                <button
                  v-for="preset in ratioPresets"
                  :key="preset.id"
                  class="ratio-btn"
                  :class="{
                    'ratio-btn--active': selectedRatio === preset.id,
                    'ratio-btn--highlight': preset.highlight,
                  }"
                  @click="selectRatio(preset.id)"
                >
                  <span class="ratio-name">{{ preset.name }}</span>
                  <span class="ratio-desc">{{ preset.description }}</span>
                </button>
              </div>
            </div>

            <!-- 裁剪信息 -->
            <div class="panel-section">
              <h3 class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                裁剪尺寸
              </h3>
              <div class="size-info">
                <div class="size-card">
                  <span class="size-label">裁剪后</span>
                  <span class="size-value">
                    {{ cropInfo.width || '—' }} × {{ cropInfo.height || '—' }}
                  </span>
                </div>
                <div v-if="originalResolution" class="size-card size-card--muted">
                  <span class="size-label">原图</span>
                  <span class="size-value">
                    {{ originalResolution.width }} × {{ originalResolution.height }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 操作提示 -->
            <div class="panel-section panel-section--tips">
              <div class="tips-content">
                <div class="tip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 9l7 7 7-7" />
                  </svg>
                  <span>拖动调整裁剪区域</span>
                </div>
                <div class="tip-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                  </svg>
                  <span>滚轮缩放图片</span>
                </div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="panel-actions">
              <button class="action-btn action-btn--secondary" @click="handleClose">
                取消
              </button>
              <button
                class="action-btn action-btn--primary"
                :disabled="!imageLoaded || imageError || isProcessing"
                @click="handleCropAndDownload"
              >
                <LoadingSpinner v-if="isProcessing" size="sm" />
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ isProcessing ? '处理中...' : '裁剪并下载' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.crop-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
}

.crop-modal-content {
  display: flex;
  flex-direction: column;
  width: 95vw;
  max-width: 1400px;
  height: 90vh;
  max-height: 900px;
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

// Header
.crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-sm;
  font-size: $font-size-sm;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.crop-title {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);

  svg {
    width: 24px;
    height: 24px;
    color: var(--color-accent);
  }
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

// Main Content
.crop-main {
  display: flex;
  flex: 1;
  min-height: 0;
}

// Crop Area
.crop-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  position: relative;
  overflow: hidden;
}

.crop-loading,
.crop-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-md;
  color: var(--color-text-muted);

  p {
    font-size: $font-size-sm;
    margin: 0;
  }

  .loading-hint {
    font-size: $font-size-xs;
    opacity: 0.6;
  }

  svg {
    width: 48px;
    height: 48px;
  }
}

.crop-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

// Control Panel
.crop-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-left: 1px solid var(--color-border);
}

.panel-section {
  padding: $spacing-lg;
  border-bottom: 1px solid var(--color-border);

  &--tips {
    flex: 1;
    border-bottom: none;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  margin-bottom: $spacing-md;

  svg {
    width: 18px;
    height: 18px;
    color: var(--color-accent);
  }
}

// Ratio Grid
.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-xs;
}

.ratio-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: $spacing-sm;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);
  text-align: left;
  transition: all var(--transition-fast);
  border: 2px solid transparent;

  &:hover {
    background: var(--color-bg-primary);
    border-color: var(--color-border);
  }

  &--active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--color-accent);

    .ratio-name {
      color: var(--color-accent);
    }
  }

  &--highlight {
    grid-column: span 2;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);

    &.ratio-btn--active {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    }
  }
}

.ratio-name {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
}

.ratio-desc {
  font-size: 10px;
  color: var(--color-text-muted);
}

// Size Info
.size-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.size-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-sm $spacing-md;
  background: var(--color-bg-hover);
  border-radius: var(--radius-md);

  &--muted {
    opacity: 0.6;
  }
}

.size-label {
  font-size: $font-size-xs;
  color: var(--color-text-muted);
}

.size-value {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--color-text-primary);
  font-family: 'SF Mono', Monaco, monospace;
}

// Tips
.tips-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: $font-size-xs;
  color: var(--color-text-muted);

  svg {
    width: 14px;
    height: 14px;
    color: var(--color-text-muted);
  }
}

// Actions
.panel-actions {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-lg;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  padding: $spacing-md;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);

  svg {
    width: 18px;
    height: 18px;
  }

  &--secondary {
    flex: 0.4;
    color: var(--color-text-secondary);
    background: var(--color-bg-hover);

    &:hover {
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
    }
  }

  &--primary {
    flex: 0.6;
    color: white;
    background: var(--color-accent);

    &:hover:not(:disabled) {
      background: var(--color-accent-hover);
      transform: translateY(-2px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  }
}

// Cropper 自定义样式
:deep(.cropper-container) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.cropper-view-box) {
  outline: 2px solid var(--color-accent);
  outline-color: rgba(99, 102, 241, 0.8);
}

:deep(.cropper-line) {
  background-color: var(--color-accent);
}

:deep(.cropper-point) {
  width: 12px;
  height: 12px;
  background-color: var(--color-accent);
  border-radius: 50%;
  opacity: 1;
}

:deep(.cropper-point.point-se) {
  width: 16px;
  height: 16px;
}

:deep(.cropper-dashed) {
  border-color: rgba(255, 255, 255, 0.3);
}

:deep(.cropper-modal) {
  background-color: rgba(0, 0, 0, 0.6);
}
</style>
