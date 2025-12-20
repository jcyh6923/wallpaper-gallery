<script setup>
import { FORMAT_OPTIONS, SORT_OPTIONS } from '@/utils/constants'

defineProps({
  sortBy: {
    type: String,
    default: 'newest',
  },
  formatFilter: {
    type: String,
    default: 'all',
  },
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['update:sortBy', 'update:formatFilter'])

function handleSortChange(value) {
  emit('update:sortBy', value)
}

function handleFormatChange(value) {
  emit('update:formatFilter', value)
}
</script>

<template>
  <div class="filter-panel">
    <div class="filter-left">
      <span class="result-count">
        共 <strong>{{ resultCount }}</strong> 张壁纸
        <span v-if="resultCount !== totalCount" class="filtered-hint">
          (筛选自 {{ totalCount }} 张)
        </span>
      </span>
    </div>

    <div class="filter-right">
      <!-- Format Filter -->
      <div class="filter-item">
        <span class="filter-label">格式</span>
        <el-select
          :model-value="formatFilter"
          placeholder="全部格式"
          size="default"
          style="width: 120px"
          @change="handleFormatChange"
        >
          <el-option
            v-for="option in FORMAT_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>

      <!-- Sort -->
      <div class="filter-item">
        <span class="filter-label">排序</span>
        <el-select
          :model-value="sortBy"
          placeholder="排序方式"
          size="default"
          style="width: 130px"
          @change="handleSortChange"
        >
          <el-option
            v-for="option in SORT_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  padding: $spacing-md 0;
}

.filter-left {
  display: flex;
  align-items: center;
}

.result-count {
  font-size: $font-size-sm;
  color: var(--color-text-secondary);

  strong {
    color: var(--color-text-primary);
    font-weight: $font-weight-semibold;
  }
}

.filtered-hint {
  color: var(--color-text-muted);
  font-size: $font-size-xs;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.filter-label {
  font-size: $font-size-sm;
  color: var(--color-text-muted);
  white-space: nowrap;

  @include mobile-only {
    display: none;
  }
}
</style>
