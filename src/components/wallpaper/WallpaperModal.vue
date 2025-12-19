<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatFileSize, formatDate, formatRelativeTime, getSizeLabel, getFileExtension, downloadFile } from '@/utils/format'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'prev', 'next'])

const imageLoaded = ref(false)
const imageError = ref(false)
const downloading = ref(false)
const actualDimensions = ref({ width: 0, height: 0 })

// Reset state when wallpaper changes
watch(() => props.wallpaper, () => {
  imageLoaded.value = false
  imageError.value = false
  actualDimensions.value = { width: 0, height: 0 }
})

// 质量标签（根据新数据结构或文件大小）
const quality = computed(() => props.wallpaper?.quality || getSizeLabel(props.wallpaper?.size)?.label || '高清')
const qualityType = computed(() => {
  switch (quality.value) {
    case '超清': return 'warning'
    case '4K': return 'success'
    case '高清': return 'primary'
    default: return 'secondary'
  }
})

// 分辨率信息
const resolution = computed(() => {
  if (props.wallpaper?.resolution) {
    return props.wallpaper.resolution
  }
  // 如果有实际尺寸，使用实际尺寸
  if (actualDimensions.value.width > 0) {
    const w = actualDimensions.value.width
    const h = actualDimensions.value.height
    let label = '720P'
    if (w >= 3840 || h >= 2160) label = '4K+'
    else if (w >= 2560 || h >= 1440) label = '2K'
    else if (w >= 1920 || h >= 1080) label = '1080P'
    return { width: w, height: h, label }
  }
  return { label: '1080P' }
})

const fileExt = computed(() => props.wallpaper ? getFileExtension(props.wallpaper.filename).toUpperCase() : '')
const formattedSize = computed(() => props.wallpaper ? formatFileSize(props.wallpaper.size) : '')
const formattedDate = computed(() => props.wallpaper ? formatDate(props.wallpaper.createdAt) : '')
const relativeTime = computed(() => props.wallpaper ? formatRelativeTime(props.wallpaper.createdAt) : '')

// Handlers
const handleImageLoad = (e) => {
  imageLoaded.value = true
  // 获取图片实际尺寸
  if (e.target) {
    actualDimensions.value = {
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    }
  }
}

const handleImageError = () => {
  imageError.value = true
  imageLoaded.value = true
}

const handleClose = () => {
  emit('close')
}

const handlePrev = () => {
  emit('prev')
}

const handleNext = () => {
  emit('next')
}

const handleDownload = async () => {
  if (!props.wallpaper || downloading.value) return

  downloading.value = true
  try {
    await downloadFile(props.wallpaper.url, props.wallpaper.filename)
  } finally {
    downloading.value = false
  }
}

const handleOverlayClick = (e) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

// Keyboard navigation
const handleKeydown = (e) => {
  if (!props.isOpen) return

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
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && wallpaper" class="modal-overlay" @click="handleOverlayClick">
        <div class="modal-content">
          <!-- Close Button -->
          <button class="modal-close" @click="handleClose" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <!-- Navigation Buttons -->
          <button class="modal-nav modal-nav--prev" @click="handlePrev" aria-label="上一张">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button class="modal-nav modal-nav--next" @click="handleNext" aria-label="下一张">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <!-- Image Container -->
          <div class="modal-image-container">
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
              class="modal-image"
              @load="handleImageLoad"
              @error="handleImageError"
            />
          </div>

          <!-- Info Panel -->
          <div class="modal-info">
            <div class="info-header">
              <h3 class="info-title">{{ wallpaper.filename }}</h3>
              <div class="info-tags">
                <span class="tag" :class="[`tag--${qualityType}`]">
                  {{ quality }}
                </span>
                <span class="tag tag--dark">{{ resolution.label }}</span>
                <span class="tag tag--secondary">{{ fileExt }}</span>
              </div>
            </div>

            <div class="info-details">
              <!-- 分辨率尺寸 -->
              <div v-if="resolution.width" class="detail-item detail-item--highlight">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                <span>{{ resolution.width }} × {{ resolution.height }}</span>
              </div>
              <!-- 文件大小 -->
              <div class="detail-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>{{ formattedSize }}</span>
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
              <span>{{ downloading ? '下载中...' : '下载原图' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
  min-height: 300px;
  background: var(--color-bg-primary);

  @include tablet-up {
    min-width: 600px;
    min-height: 500px;
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

.modal-image {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
  opacity: 0;
  animation: imageReveal 0.5s ease forwards;

  @include tablet-up {
    max-height: 85vh;
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

.modal-info {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-lg;
  background: var(--color-bg-card);

  @include tablet-up {
    width: 320px;
    min-width: 320px;
    border-left: 1px solid var(--color-border);
    padding: $spacing-xl;
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

  &--secondary {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  &--dark {
    background: rgba(0, 0, 0, 0.6);
    color: white;

    [data-theme="dark"] & {
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
  margin-top: auto;

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

// Modal transition
.modal-enter-active,
.modal-leave-active {
  transition: all var(--transition-slow);

  .modal-content {
    transition: all var(--transition-slow);
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-content {
    transform: scale(0.95) translateY(20px);
  }
}
</style>
