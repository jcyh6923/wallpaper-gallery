<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import BackToTop from '@/components/common/BackToTop.vue'
import FilterPanel from '@/components/common/FilterPanel.vue'
import TodayPick from '@/components/home/TodayPick.vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid.vue'
import WallpaperModal from '@/components/wallpaper/WallpaperModal.vue'

import { useFilter } from '@/composables/useFilter'
import { useModal } from '@/composables/useModal'
import { useSearch } from '@/composables/useSearch'
import { useWallpapers } from '@/composables/useWallpapers'
import { useWallpaperType } from '@/composables/useWallpaperType'

const route = useRoute()

// 系列管理
const { currentSeries, initFromRoute } = useWallpaperType()

// Wallpapers
const { wallpapers, loading, error, total, fetchWallpapers, getPrevWallpaper, getNextWallpaper } = useWallpapers()

// 共享搜索状态
const { searchQuery, setWallpapers } = useSearch()

// 同步壁纸数据到共享状态
watch(wallpapers, (newWallpapers) => {
  setWallpapers(newWallpapers)
}, { immediate: true })

// 监听路由变化，切换系列
watch(() => route.meta?.series, (newSeries) => {
  if (newSeries) {
    initFromRoute(newSeries)
  }
}, { immediate: false })

// 监听系列变化，重新加载数据
watch(currentSeries, async (newSeries) => {
  await fetchWallpapers(newSeries)
}, { immediate: false })

// Filter
const { sortBy, formatFilter, categoryFilter, categoryOptions, filteredWallpapers, resultCount, hasActiveFilters, resetFilters } = useFilter(wallpapers, searchQuery)

// Modal
const { isOpen, currentData, open, close, updateData } = useModal()

// Current wallpaper for modal
const currentWallpaper = computed(() => currentData.value)

// Handlers
function handleSelectWallpaper(wallpaper) {
  open(wallpaper)
}

function handlePrevWallpaper() {
  if (!currentWallpaper.value)
    return
  const prev = getPrevWallpaper(currentWallpaper.value.id)
  if (prev) {
    updateData(prev)
  }
}

function handleNextWallpaper() {
  if (!currentWallpaper.value)
    return
  const next = getNextWallpaper(currentWallpaper.value.id)
  if (next) {
    updateData(next)
  }
}

// 重置所有筛选条件
function handleReset() {
  resetFilters()
}

// 重新加载当前系列
function handleReload() {
  fetchWallpapers(currentSeries.value, true)
}

// Initialize
onMounted(() => {
  // 如果路由带有系列参数，初始化系列
  if (route.meta?.series) {
    initFromRoute(route.meta.series)
  }
  // 加载当前系列的壁纸数据
  fetchWallpapers(currentSeries.value)
})
</script>

<template>
  <div class="home-page">
    <div class="container">
      <!-- Today's Pick - 仅电脑壁纸系列显示 -->
      <TodayPick
        v-if="wallpapers.length > 0 && !loading && currentSeries === 'desktop'"
        :wallpapers="wallpapers"
        @select="handleSelectWallpaper"
      />

      <!-- Filter Panel -->
      <FilterPanel
        v-model:sort-by="sortBy"
        v-model:format-filter="formatFilter"
        v-model:category-filter="categoryFilter"
        :category-options="categoryOptions"
        :result-count="resultCount"
        :total-count="total"
        :loading="loading"
        @reset="handleReset"
      />

      <!-- Error State -->
      <div v-if="error" class="error-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <h3>加载失败</h3>
        <p>{{ error }}</p>
        <button class="btn btn--primary" @click="handleReload">
          重新加载
        </button>
      </div>

      <!-- Wallpaper Grid -->
      <WallpaperGrid
        v-else
        :wallpapers="filteredWallpapers"
        :loading="loading"
        :search-query="searchQuery"
        :total-count="total"
        :has-filters="hasActiveFilters"
        @select="handleSelectWallpaper"
        @reset-filters="resetFilters"
      />
    </div>

    <!-- Modal -->
    <WallpaperModal
      :wallpaper="currentWallpaper"
      :is-open="isOpen"
      @close="close"
      @prev="handlePrevWallpaper"
      @next="handleNextWallpaper"
    />

    <!-- Back to Top -->
    <BackToTop />
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  padding: $spacing-md 0 $spacing-2xl;

  // 移动端：为 fixed 的筛选栏预留空间
  @include mobile-only {
    padding-top: calc($spacing-md + 52px); // 52px 为筛选栏高度
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-2xl;
  text-align: center;

  svg {
    width: 64px;
    height: 64px;
    color: var(--color-error);
    margin-bottom: $spacing-lg;
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
}
</style>
