<script setup>
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Pagination from '@/components/common/Pagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useViewMode } from '@/composables/useViewMode'
import { useWallpaperType } from '@/composables/useWallpaperType'
import WallpaperCard from './WallpaperCard.vue'

const props = defineProps({
  wallpapers: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  // 原始壁纸总数（未筛选前）
  totalCount: {
    type: Number,
    default: 0,
  },
  // 是否有筛选条件激活
  hasFilters: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'resetFilters'])

// 注册 GSAP Flip 插件
gsap.registerPlugin(Flip)

const router = useRouter()
const { currentSeries, currentSeriesConfig, availableSeriesOptions } = useWallpaperType()
const { viewMode } = useViewMode()
const gridRef = ref(null)
const isAnimating = ref(false)
// 用于控制实际显示的视图模式
const displayViewMode = ref(viewMode.value)

// 空状态类型判断
const emptyStateType = computed(() => {
  if (props.loading)
    return 'loading'
  if (props.wallpapers.length === 0) {
    // 如果有筛选条件或搜索词，说明是筛选后无结果
    if (props.hasFilters || props.searchQuery) {
      return 'no-filter-results'
    }
    // 否则是系列本身没有数据
    return 'no-series-data'
  }
  return null
})

// 当前系列的名称
const currentSeriesName = computed(() => {
  return currentSeriesConfig.value?.name || '壁纸'
})

// 获取其他可用系列（用于快捷跳转）
const alternativeSeries = computed(() => {
  return availableSeriesOptions.value.filter(opt => opt.id !== currentSeries.value)
})

// 跳转到其他系列
function navigateToSeries(seriesId) {
  router.push(`/${seriesId}`)
}

// 重置筛选条件
function handleResetFilters() {
  emit('resetFilters')
}

// 分页
const DEFAULT_PAGE_SIZE = 30
const PAGE_SIZES = [10, 20, 30, 50]
const wallpapersRef = computed(() => props.wallpapers)
const {
  currentPage,
  pageSize,
  displayedItems,
  goToPage,
  setPageSize,
  pausePagination,
  resumePagination,
} = usePagination(wallpapersRef, DEFAULT_PAGE_SIZE)

// 用于控制列表显示的状态，避免闪烁
const showGrid = ref(true)

// Flip 插件预热标记
const isFlipWarmedUp = ref(false)

// ========================================
// 视图切换动画 - 使用 GSAP Flip 实现丝滑形态变换
// ========================================
watch(viewMode, async (newMode, oldMode) => {
  if (!gridRef.value || newMode === oldMode)
    return

  // 如果正在动画中，先终止之前的动画
  if (isAnimating.value) {
    gsap.killTweensOf('.wallpaper-card')
  }

  isAnimating.value = true
  // 暂停分页切换，防止动画期间切换页面
  pausePagination()

  try {
    const cards = gridRef.value.querySelectorAll('.wallpaper-card')

    if (cards.length === 0) {
      displayViewMode.value = newMode
      isAnimating.value = false
      resumePagination()
      return
    }

    // 记录当前卡片的位置和尺寸状态
    const state = Flip.getState(cards, {
      simple: true,
    })

    // 切换布局类
    displayViewMode.value = newMode
    await nextTick()

    // 执行 Flip 动画
    Flip.from(state, {
      duration: 0.45,
      ease: 'power2.inOut',
      stagger: {
        amount: 0.12,
        from: 'start',
      },
      absolute: true,
      scale: true,
      onComplete: () => {
        isAnimating.value = false
        isFlipWarmedUp.value = true
        resumePagination()
      },
    })
  }
  catch (error) {
    console.warn('View mode animation error:', error)
    displayViewMode.value = newMode
    isAnimating.value = false
    resumePagination()
  }
})

// 预热 Flip 插件
function warmupFlip() {
  if (isFlipWarmedUp.value || !gridRef.value)
    return

  const cards = gridRef.value.querySelectorAll('.wallpaper-card')
  if (cards.length > 0) {
    Flip.getState(cards, { simple: true })
    isFlipWarmedUp.value = true
  }
}

// 页面切换时的入场动画
function animateCardsIn() {
  if (!gridRef.value)
    return

  nextTick(() => {
    const cards = gridRef.value?.querySelectorAll('.wallpaper-card')
    if (cards && cards.length > 0) {
      gsap.fromTo(
        cards,
        {
          opacity: 0,
          y: 20,
          scale: 0.98,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.35,
          stagger: {
            amount: 0.25,
            from: 'start',
          },
          ease: 'power2.out',
          onComplete: warmupFlip,
        },
      )
    }
  })
}

// 初始加载动画
onMounted(() => {
  if (gridRef.value && displayedItems.value.length > 0) {
    animateCardsIn()
  }
  else {
    setTimeout(warmupFlip, 500)
  }
})

// 监听 wallpapers 变化（筛选/搜索时）
watch(() => props.wallpapers, async (newVal, oldVal) => {
  if (oldVal && oldVal.length > 0 && newVal.length > 0) {
    showGrid.value = false
    await nextTick()
    setTimeout(() => {
      showGrid.value = true
      // 数据变化后播放入场动画
      animateCardsIn()
    }, 50)
  }
}, { deep: false })

// 处理分页切换
function handlePageChange(page) {
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })

  // 短暂隐藏后切换页面并播放动画
  showGrid.value = false

  setTimeout(() => {
    goToPage(page)
    showGrid.value = true
    nextTick(() => {
      animateCardsIn()
    })
  }, 100)
}

// 处理每页条数变化
function handlePageSizeChange(size) {
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })

  showGrid.value = false

  setTimeout(() => {
    setPageSize(size)
    showGrid.value = true
    nextTick(() => {
      animateCardsIn()
    })
  }, 100)
}

function handleSelect(wallpaper) {
  emit('select', wallpaper)
}
</script>

<template>
  <div class="wallpaper-grid-wrapper">
    <!-- Loading State -->
    <div v-if="loading" class="grid-loading">
      <LoadingSpinner size="lg" />
      <p class="loading-text">
        加载{{ currentSeriesName }}中...
      </p>
    </div>

    <!-- Empty State: 系列数据为空 -->
    <div v-else-if="emptyStateType === 'no-series-data'" class="grid-empty series-empty">
      <div class="empty-icon">
        <!-- 根据系列显示不同图标 -->
        <svg v-if="currentSeries === 'desktop'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <svg v-else-if="currentSeries === 'mobile'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <svg v-else-if="currentSeries === 'avatar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      <h3>暂无{{ currentSeriesName }}</h3>
      <p>该分类暂时没有内容，敬请期待~</p>
      <!-- 快捷跳转按钮 -->
      <div v-if="alternativeSeries.length > 0" class="empty-actions">
        <button
          v-for="series in alternativeSeries"
          :key="series.id"
          class="action-btn"
          @click="navigateToSeries(series.id)"
        >
          查看{{ series.name }}
        </button>
      </div>
    </div>

    <!-- Empty State: 筛选后无结果 -->
    <div v-else-if="emptyStateType === 'no-filter-results'" class="grid-empty filter-empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M8 8l6 6M14 8l-6 6" />
        </svg>
      </div>
      <h3>没有找到匹配的壁纸</h3>
      <p>尝试调整搜索条件或筛选器</p>
      <div class="empty-actions">
        <button class="action-btn primary" @click="handleResetFilters">
          清除筛选条件
        </button>
      </div>
    </div>

    <!-- Grid -->
    <template v-else>
      <div
        ref="gridRef"
        class="wallpaper-grid"
        :class="[`view-${displayViewMode}`, { 'is-hidden': !showGrid, 'is-animating': isAnimating }]"
      >
        <WallpaperCard
          v-for="(wallpaper, index) in displayedItems"
          :key="wallpaper.id"
          :wallpaper="wallpaper"
          :index="index"
          :search-query="searchQuery"
          :view-mode="displayViewMode"
          @click="handleSelect"
        />
      </div>

      <!-- 分页 -->
      <Pagination
        :current="currentPage"
        :total="wallpapers.length"
        :page-size="pageSize"
        :page-sizes="PAGE_SIZES"
        @change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.wallpaper-grid-wrapper {
  min-height: 400px;
}

.wallpaper-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: var(--grid-gap);
  transition: opacity 0.15s ease;

  &.is-hidden {
    opacity: 0;
  }

  // 动画进行中禁用 hover 效果，避免干扰
  &.is-animating {
    pointer-events: none;
  }

  // 网格视图（默认）
  &.view-grid {
    @include respond-to('sm') {
      grid-template-columns: repeat(2, 1fr);
    }

    @include respond-to('md') {
      grid-template-columns: repeat(3, 1fr);
    }

    @include respond-to('lg') {
      grid-template-columns: repeat(4, 1fr);
    }

    @include respond-to('xl') {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  // 列表视图
  &.view-list {
    grid-template-columns: 1fr;
    gap: $spacing-md;
  }

  // 瀑布流视图
  &.view-masonry {
    display: block;
    column-count: 2;
    column-gap: calc(var(--grid-gap) * 1.2);

    @include respond-to('md') {
      column-count: 3;
    }

    @include respond-to('lg') {
      column-count: 4;
    }

    @include respond-to('xl') {
      column-count: 5;
    }

    > * {
      break-inside: avoid;
      margin-bottom: calc(var(--grid-gap) * 1.2);
    }
  }
}

.grid-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  gap: $spacing-md;
}

.loading-text {
  font-size: $font-size-sm;
  color: var(--color-text-muted);
}

.grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;
  animation: fadeIn 0.5s ease;

  .empty-icon {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-hover);
    border-radius: 50%;
    margin-bottom: $spacing-lg;

    svg {
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      opacity: 0.7;
    }
  }

  h3 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    margin-bottom: $spacing-lg;
  }

  &.series-empty {
    .empty-icon {
      background: linear-gradient(135deg, var(--color-accent-light) 0%, rgba(99, 102, 241, 0.1) 100%);

      svg {
        color: var(--color-accent);
        opacity: 0.8;
      }
    }
  }

  &.filter-empty {
    .empty-icon {
      background: var(--color-bg-secondary);

      svg {
        color: var(--color-text-muted);
      }
    }
  }
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  justify-content: center;
  margin-top: $spacing-sm;
}

.action-btn {
  padding: 10px 20px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  &:active {
    transform: scale(0.95);
  }

  &.primary {
    color: white;
    background: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background: var(--color-accent-hover);
      border-color: var(--color-accent-hover);
      color: white;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
