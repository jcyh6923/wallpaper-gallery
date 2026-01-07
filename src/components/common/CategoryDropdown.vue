<script setup>
/**
 * 自定义分类下拉选择器
 * 左右分栏布局，支持一级和二级分类选择
 * 带丝滑动画效果
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  categoryOptions: {
    type: Array,
    default: () => [],
  },
  categoryFilter: {
    type: String,
    default: 'all',
  },
  subcategoryFilter: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits(['update:categoryFilter', 'update:subcategoryFilter'])

// 下拉框状态
const isOpen = ref(false)
const dropdownRef = ref(null)

// 当前悬停/预览的一级分类（用于显示二级分类列表）
const hoveredCategory = ref(props.categoryFilter)

// 当前悬停的一级分类的二级分类列表
const currentSubcategories = computed(() => {
  if (hoveredCategory.value === 'all') {
    return []
  }
  const category = props.categoryOptions.find(opt => opt.value === hoveredCategory.value)
  return category?.subcategories || []
})

// 显示文本
const displayText = computed(() => {
  if (props.categoryFilter === 'all') {
    return '全部分类'
  }
  let text = props.categoryFilter
  if (props.subcategoryFilter !== 'all') {
    text += ` · ${props.subcategoryFilter}`
  }
  return text
})

// 是否有选中
const hasSelection = computed(() => props.categoryFilter !== 'all')

// 打开下拉框
function openDropdown() {
  // 打开时，悬停状态设为当前选中的分类
  hoveredCategory.value = props.categoryFilter
  isOpen.value = true
}

// 关闭下拉框
function closeDropdown() {
  isOpen.value = false
}

// 切换下拉框
function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  }
  else {
    openDropdown()
  }
}

// 处理一级分类点击
function handleCategoryClick(option) {
  hoveredCategory.value = option.value

  // 如果没有子分类或选择"全部"，直接确认选择并重置子分类
  if (!option.subcategories?.length || option.value === 'all') {
    emit('update:categoryFilter', option.value)
    emit('update:subcategoryFilter', 'all')
    closeDropdown()
  }
}

// 处理二级分类点击
function handleSubcategoryClick(subcategoryName) {
  // 同时更新父分类和子分类
  emit('update:categoryFilter', hoveredCategory.value)
  emit('update:subcategoryFilter', subcategoryName)
  closeDropdown()
}

// 点击外部关闭
function handleClickOutside(event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown()
  }
}

// 监听 props 变化，同步悬停状态
watch(() => props.categoryFilter, (newVal) => {
  if (!isOpen.value) {
    hoveredCategory.value = newVal
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="category-dropdown">
    <!-- 触发器 -->
    <button
      class="dropdown-trigger"
      :class="{ 'is-open': isOpen, 'has-selection': hasSelection }"
      @click="toggleDropdown"
    >
      <span class="trigger-text">{{ displayText }}</span>
      <svg class="trigger-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <!-- 下拉面板 -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-panel" :class="{ 'single-column': currentSubcategories.length === 0 }">
        <div class="panel-content">
          <!-- 左侧：一级分类 -->
          <div class="category-list primary-list">
            <div class="list-header">
              分类
            </div>
            <div class="list-items">
              <button
                v-for="option in categoryOptions"
                :key="option.value"
                class="category-item"
                :class="{
                  'is-active': hoveredCategory === option.value,
                  'has-children': option.subcategories?.length > 0,
                }"
                @click="handleCategoryClick(option)"
              >
                <span class="item-label">{{ option.label }}</span>
                <span v-if="option.count" class="item-count">{{ option.count }}</span>
                <svg
                  v-if="option.subcategories?.length > 0"
                  class="item-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 右侧：二级分类 -->
          <Transition name="slide-right">
            <div v-if="currentSubcategories.length > 0" class="category-list secondary-list">
              <div class="list-header">
                {{ hoveredCategory }}
              </div>
              <div class="list-items">
                <!-- 全部选项 -->
                <button
                  class="category-item"
                  :class="{ 'is-active': categoryFilter === hoveredCategory && subcategoryFilter === 'all' }"
                  @click="handleSubcategoryClick('all')"
                >
                  <span class="item-label">全部</span>
                </button>
                <!-- 二级分类列表 -->
                <button
                  v-for="sub in currentSubcategories"
                  :key="sub.name"
                  class="category-item"
                  :class="{ 'is-active': categoryFilter === hoveredCategory && subcategoryFilter === sub.name }"
                  @click="handleSubcategoryClick(sub.name)"
                >
                  <span class="item-label">{{ sub.name }}</span>
                  <span class="item-count">{{ sub.count }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>

    <!-- 遮罩层 -->
    <Transition name="fade">
      <div v-if="isOpen" class="dropdown-overlay" @click="closeDropdown" />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.category-dropdown {
  position: relative;
  z-index: 100;
}

// 触发器按钮 - 适配深色模式
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0 11px;
  width: 160px;
  height: 32px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;

  &:hover {
    border-color: var(--color-border-hover, var(--color-border));
  }

  &.is-open {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);

    .trigger-arrow {
      transform: rotate(180deg);
    }
  }

  &.has-selection {
    color: var(--color-text-primary);
  }
}

.trigger-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

// 下拉面板 - 适配深色模式，固定宽度避免抖动
.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  z-index: 1000;
  // 性能优化
  will-change: transform, opacity;
  contain: layout style;
  // 固定宽度，避免内容变化导致抖动
  width: 380px;

  // 没有二级分类时，只显示左侧
  &.single-column {
    width: 180px;

    .primary-list {
      border-right: none;
    }
  }
}

.panel-content {
  display: flex;
  max-height: 360px;
}

// 分类列表 - 适配深色模式，固定宽度
.category-list {
  display: flex;
  flex-direction: column;

  &.primary-list {
    width: 180px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
  }

  &.secondary-list {
    width: 200px;
    flex-shrink: 0;
    background: var(--color-bg-card);
  }
}

.list-header {
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-hover);
}

.list-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
}

// 分类项 - 适配深色模式
.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  &.is-active {
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-weight: 500;
  }

  &.has-children .item-label {
    flex: 1;
  }
}

.item-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
  padding: 2px 8px;
  border-radius: 10px;

  .is-active & {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
}

.item-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

// 遮罩层
.dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
}

// ========================================
// 动画效果 - 优化性能，减少卡顿
// ========================================

// 下拉面板动画 - 使用 transform 提升性能
.dropdown-enter-active {
  animation: dropdownIn 0.15s ease-out;
}

.dropdown-leave-active {
  animation: dropdownOut 0.1s ease-in;
}

@keyframes dropdownIn {
  0% {
    opacity: 0;
    transform: translateY(-8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dropdownOut {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-8px);
  }
}

// 右侧面板滑入动画 - 简化动画减少卡顿
.slide-right-enter-active {
  animation: slideRightIn 0.15s ease-out;
}

.slide-right-leave-active {
  animation: slideRightOut 0.1s ease-in;
}

@keyframes slideRightIn {
  0% {
    opacity: 0;
    transform: translateX(-12px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideRightOut {
  0% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-12px);
  }
}

// 遮罩层淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
