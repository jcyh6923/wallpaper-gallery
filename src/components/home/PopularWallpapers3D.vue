<script setup>
/**
 * 3D 热门壁纸轮播组件
 * 效果：中间超大图，两侧层叠堆叠，星空流星背景，科技感特效
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  series: { type: String, default: 'desktop' },
  wallpapers: { type: Array, default: () => [] },
  popularityData: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

// DOM 引用
const containerRef = ref(null)
const canvasRef = ref(null)

// 状态
const currentIndex = ref(0)
const isAnimating = ref(false)
const isHovering = ref(false)
const imageLoaded = ref({})

// 鼠标位置追踪（科技感光效）
const mousePos = ref({ x: 0, y: 0 })

// 定时器
let autoPlayTimer = null
let particleAnimationId = null

// 星空粒子
let stars = []
let shootingStars = []

// 配置
const CONFIG = {
  visibleCount: 7,
  centerWidth: 900, // 增大中间图片宽度: 800 -> 900
  spacingFactor: 0.50, // 调整间距因子
  scaleDecay: 0.06, // 减小缩放衰减,让中间图更突出: 0.08 -> 0.06
  zDecay: 90,
  rotateY: 35,
  opacityDecay: 0.15,
}

// 轮播数据
const carouselList = computed(() => {
  if (props.popularityData?.length && props.wallpapers?.length) {
    return props.popularityData.slice(0, 7)
      .map((stat) => {
        const wallpaper = props.wallpapers.find(w => w.filename === stat.filename)
        return wallpaper ? { ...wallpaper, ...stat } : null
      })
      .filter(Boolean)
  }
  return []
})

const extendedList = computed(() => {
  const list = carouselList.value
  if (list.length === 0)
    return []
  if (list.length < CONFIG.visibleCount) {
    const repeated = []
    while (repeated.length < CONFIG.visibleCount * 2) {
      repeated.push(...list)
    }
    return repeated.slice(0, CONFIG.visibleCount * 2)
  }
  return list
})

// 计算卡片样式
function getCardStyle(index) {
  const total = extendedList.value.length
  if (total === 0)
    return {}

  let relativePos = index - currentIndex.value
  if (relativePos > total / 2)
    relativePos -= total
  if (relativePos < -total / 2)
    relativePos += total

  const absPos = Math.abs(relativePos)
  const halfVisible = Math.floor(CONFIG.visibleCount / 2)

  if (absPos > halfVisible + 0.5) {
    return { opacity: 0, visibility: 'hidden', zIndex: 0 }
  }

  // X轴位置 - 层叠效果
  const spacing = CONFIG.centerWidth * CONFIG.spacingFactor
  const x = relativePos * spacing

  // 缩放
  const scale = Math.max(0.5, 1 - absPos * CONFIG.scaleDecay)

  // Z轴 - 中心最前
  const z = -absPos * CONFIG.zDecay

  // Y轴旋转 - 向中心倾斜（左边向右转，右边向左转）
  let rotateY = 0
  if (relativePos !== 0) {
    rotateY = relativePos < 0
      ? CONFIG.rotateY * Math.min(absPos, 1)
      : -CONFIG.rotateY * Math.min(absPos, 1)
  }

  const opacity = Math.max(0.4, 1 - absPos * CONFIG.opacityDecay)
  const zIndex = 100 - Math.round(absPos * 10)

  return {
    transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex,
  }
}

function isActiveCard(index) {
  const total = extendedList.value.length
  if (total === 0)
    return false
  let relativePos = index - currentIndex.value
  if (relativePos > total / 2)
    relativePos -= total
  if (relativePos < -total / 2)
    relativePos += total
  return Math.abs(relativePos) < 0.5
}

function goToSlide(index) {
  if (isAnimating.value)
    return
  const total = extendedList.value.length
  if (total === 0)
    return

  isAnimating.value = true
  setTimeout(() => {
    isAnimating.value = false
  }, 400)
  currentIndex.value = ((index % total) + total) % total
}

function prevSlide() {
  goToSlide(currentIndex.value - 1)
}

function nextSlide() {
  goToSlide(currentIndex.value + 1)
}

// 点击卡片 - 中心打开弹窗，其他切换
function handleCardClick(index, wallpaper) {
  if (isActiveCard(index)) {
    emit('select', wallpaper)
  }
  else {
    goToSlide(index)
  }
}

// 滚轮切换
function handleWheel(e) {
  if (isAnimating.value)
    return
  e.preventDefault()
  if (Math.abs(e.deltaX) > 30 || Math.abs(e.deltaY) > 30) {
    if (e.deltaX > 0 || e.deltaY > 0) {
      nextSlide()
    }
    else {
      prevSlide()
    }
  }
}

// 鼠标进入/离开
function handleMouseEnter() {
  isHovering.value = true
  stopAutoPlay()
}

function handleMouseLeave() {
  isHovering.value = false
  startAutoPlay()
}

// 鼠标移动追踪（科技感光效）
function handleMouseMove(e) {
  if (!containerRef.value)
    return
  const rect = containerRef.value.getBoundingClientRect()
  mousePos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

// 光效样式
const mouseLightStyle = computed(() => ({
  left: `${mousePos.value.x}px`,
  top: `${mousePos.value.y}px`,
}))

function startAutoPlay() {
  stopAutoPlay()
  autoPlayTimer = setInterval(() => {
    if (!isAnimating.value && !isHovering.value)
      nextSlide()
  }, 2500) // 加快轮播速度: 4000ms -> 2500ms
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

function handleImageLoad(id) {
  imageLoaded.value[id] = true
}

function isImageLoaded(id) {
  return !!imageLoaded.value[id]
}

// ============ 星空 + 流星动画 ============
function initStarfield() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  const container = containerRef.value

  function resize() {
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight
  }
  resize()
  window.addEventListener('resize', resize)

  // 创建星星
  stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.5 + 0.5,
    twinkleSpeed: Math.random() * 0.02 + 0.01,
    twinklePhase: Math.random() * Math.PI * 2,
  }))

  // 流星
  shootingStars = []
  function createShootingStar() {
    if (shootingStars.length < 3 && Math.random() < 0.02) {
      shootingStars.push({
        x: Math.random() * canvas.width,
        y: 0,
        length: Math.random() * 80 + 50,
        speed: Math.random() * 8 + 6,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
        opacity: 1,
      })
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制星星
    const time = Date.now() * 0.001
    stars.forEach((star) => {
      const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.twinklePhase) * 0.5 + 0.5
      const opacity = 0.3 + twinkle * 0.7

      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
      ctx.fill()

      // 星星光晕
      if (star.size > 1) {
        const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`)
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }
    })

    // 创建和绘制流星
    createShootingStar()
    shootingStars = shootingStars.filter((meteor) => {
      meteor.x += Math.cos(meteor.angle) * meteor.speed
      meteor.y += Math.sin(meteor.angle) * meteor.speed
      meteor.opacity -= 0.008

      if (meteor.opacity <= 0 || meteor.y > canvas.height)
        return false

      // 绘制流星
      const tailX = meteor.x - Math.cos(meteor.angle) * meteor.length
      const tailY = meteor.y - Math.sin(meteor.angle) * meteor.length

      const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${meteor.opacity * 0.5})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, ${meteor.opacity})`)

      ctx.beginPath()
      ctx.moveTo(tailX, tailY)
      ctx.lineTo(meteor.x, meteor.y)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 2
      ctx.stroke()

      // 流星头部光点
      ctx.beginPath()
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${meteor.opacity})`
      ctx.fill()

      return true
    })

    particleAnimationId = requestAnimationFrame(animate)
  }

  animate()
}

function destroyStarfield() {
  if (particleAnimationId) {
    cancelAnimationFrame(particleAnimationId)
    particleAnimationId = null
  }
}

watch(carouselList, (newList) => {
  if (newList.length > 0) {
    // 重置状态
    imageLoaded.value = {}
    currentIndex.value = 0

    // 初始化星空和自动播放
    nextTick(() => {
      initStarfield()
      startAutoPlay()
    })
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')
      prevSlide()
    else if (e.key === 'ArrowRight')
      nextSlide()
  })
})

onUnmounted(() => {
  stopAutoPlay()
  destroyStarfield()
})
</script>

<template>
  <!-- 骨架屏：数据加载中 -->
  <div v-if="carouselList.length === 0" class="carousel-3d carousel-3d--loading">
    <div class="carousel-3d__header">
      <div class="skeleton-badge">
        <span class="skeleton-badge__text">🔥 热门壁纸</span>
      </div>
    </div>

    <!-- 加载提示文字 -->
    <div class="loading-hint">
      <div class="loading-hint__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <h3 class="loading-hint__title">
        拼命加载中，请稍后...
      </h3>
      <p class="loading-hint__subtitle">
        正在为您准备精美壁纸
      </p>
    </div>

    <div class="skeleton-cards">
      <div class="skeleton-card skeleton-card--side">
        <div class="skeleton-shimmer" />
        <div class="skeleton-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      </div>
      <div class="skeleton-card skeleton-card--center">
        <div class="skeleton-shimmer" />
        <div class="skeleton-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      </div>
      <div class="skeleton-card skeleton-card--side">
        <div class="skeleton-shimmer" />
        <div class="skeleton-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- 3D轮播 -->
  <div
    v-else
    ref="containerRef"
    class="carousel-3d"
    :class="{ 'is-hovering': isHovering }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @wheel.prevent="handleWheel"
  >
    <!-- 星空画布 -->
    <canvas ref="canvasRef" class="starfield-canvas" />

    <!-- 科技感：鼠标追踪光效 -->
    <div class="mouse-light" :style="mouseLightStyle" />

    <!-- 背景 -->
    <div class="carousel-3d__bg">
      <div class="bg-glow bg-glow--left" />
      <div class="bg-glow bg-glow--right" />
    </div>

    <!-- 标题 -->
    <div class="carousel-3d__header">
      <div class="carousel-badge">
        <span class="badge-icon">🔥</span>
        <span class="badge-text">热门壁纸</span>
      </div>
    </div>

    <!-- 舞台 -->
    <div class="carousel-3d__stage">
      <!-- 镜面地板 -->
      <div class="mirror-floor">
        <div class="floor-line" />
      </div>

      <div class="carousel-3d__track">
        <div
          v-for="(wallpaper, index) in extendedList"
          :key="`${wallpaper.id}-${index}`"
          class="carousel-3d__card"
          :class="{ 'is-active': isActiveCard(index), 'is-animating': isAnimating }"
          :style="getCardStyle(index)"
          @click="handleCardClick(index, wallpaper)"
        >
          <!-- 卡片 -->
          <div class="card-inner">
            <div v-if="!isImageLoaded(wallpaper.id)" class="card-skeleton">
              <div class="skeleton-shimmer" />
            </div>
            <img
              :src="wallpaper.previewUrl || wallpaper.thumbnailUrl"
              :alt="wallpaper.filename"
              class="card-image"
              :class="{ 'is-loaded': isImageLoaded(wallpaper.id) }"
              draggable="false"
              @load="handleImageLoad(wallpaper.id)"
            >
            <!-- 科技感：全息边框脉冲 -->
            <div class="card-border" />
            <div class="card-border-pulse" />
            <div class="card-glow" />
          </div>
        </div>
      </div>
    </div>

    <!-- 导航（悬停显示） -->
    <div class="carousel-3d__nav">
      <button class="nav-btn" @click="prevSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button class="nav-btn" @click="nextSlide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.carousel-3d {
  position: relative;
  padding: $spacing-lg 0 0;
  margin-bottom: $spacing-xl;
  overflow: hidden;
  border-radius: $radius-2xl;
  background: linear-gradient(180deg, #05050a 0%, #0a0a12 50%, #050508 100%);
  min-height: 560px; // 增加高度以适应更大的中间图片

  // 悬停时显示导航
  &.is-hovering {
    .carousel-3d__nav {
      opacity: 1;
      visibility: visible;
    }
  }
}

// 星空画布
.starfield-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

// ============ 科技感效果 ============

// 鼠标追踪光效
.mouse-light {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.3s ease;
  opacity: 0;

  .carousel-3d.is-hovering & {
    opacity: 1;
  }
}

// 背景光晕
.carousel-3d__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-glow {
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.12;

  &--left {
    left: -200px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }

  &--right {
    right: -200px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #f97316, #ef4444);
  }
}

// 标题
.carousel-3d__header {
  position: absolute;
  top: $spacing-lg;
  left: $spacing-lg;
  z-index: 10;
}

.carousel-badge {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.5);
}

// 舞台
.carousel-3d__stage {
  position: relative;
  height: 460px; // 增加舞台高度: 420px -> 460px
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1500px;
  perspective-origin: 50% 45%;
  z-index: 2;
}

// 镜面地板
.mirror-floor {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(255, 255, 255, 0.015) 50%,
    rgba(255, 255, 255, 0.03) 100%
  );
  pointer-events: none;

  .floor-line {
    position: absolute;
    top: 0;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 30%,
      rgba(255, 255, 255, 0.25) 50%,
      rgba(255, 255, 255, 0.15) 70%,
      transparent 100%
    );
  }
}

.carousel-3d__track {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
}

// 卡片
.carousel-3d__card {
  position: absolute;
  width: 520px;
  transform-style: preserve-3d;
  transition:
    transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.55s ease;
  will-change: transform, opacity;
  cursor: pointer;

  &.is-animating {
    transition-duration: 0.4s;
    transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  &.is-active {
    width: 780px; // 增大中间图片: 680px -> 780px

    .card-inner {
      box-shadow:
        0 30px 100px rgba(0, 0, 0, 0.7),
        0 0 100px rgba(249, 115, 22, 0.15);
    }

    .card-border {
      opacity: 1;
    }
    .card-border-pulse {
      opacity: 1;
    }
    .card-glow {
      opacity: 1;
    }
  }

  &:not(.is-active) {
    .card-inner:hover {
      transform: scale(1.02);
    }
  }
}

.card-inner {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: $radius-lg;
  overflow: hidden;
  background: #111;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.4s ease;
  user-select: none;

  &.is-loaded {
    opacity: 1;
  }
}

.card-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #252540 100%);

  .skeleton-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
    animation: shimmer 2s infinite;
  }
}

// 渐变边框
.card-border {
  position: absolute;
  inset: 0;
  border-radius: $radius-lg;
  padding: 2px;
  background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #f97316, #ef4444);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  animation: border-hue 4s linear infinite;
}

@keyframes border-hue {
  from {
    filter: hue-rotate(0deg);
  }
  to {
    filter: hue-rotate(360deg);
  }
}

// 全息边框脉冲
.card-border-pulse {
  position: absolute;
  inset: -4px;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #f97316, #ef4444);
  opacity: 0;
  pointer-events: none;
  animation:
    border-hue 4s linear infinite,
    border-pulse 2s ease-in-out infinite;
  filter: blur(8px);
  z-index: -1;
}

@keyframes border-pulse {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.02);
  }
}

// 光晕
.card-glow {
  position: absolute;
  inset: -6px;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(249, 115, 22, 0.4), rgba(239, 68, 68, 0.4));
  filter: blur(30px);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

// 导航（默认隐藏，悬停显示）
.carousel-3d__nav {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-80%);
  display: flex;
  justify-content: space-between;
  padding: 0 $spacing-lg;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease,
    visibility 0.3s ease;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(249, 115, 22, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
}

// 骨架屏 - 适配深色/浅色主题
.carousel-3d--loading {
  position: relative;
  min-height: 560px; // 与主容器高度保持一致
  border-radius: $radius-2xl;

  // 深色模式（默认，因为轮播图区域本身是深色的）
  background: linear-gradient(180deg, #0a0a15 0%, #12121f 100%);

  .carousel-3d__header {
    position: absolute;
    top: $spacing-lg;
    left: $spacing-lg;
  }

  .skeleton-badge {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-md;
    background: rgba(255, 255, 255, 0.15);
    border-radius: $radius-full;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .skeleton-badge__text {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: rgba(255, 255, 255, 0.7);
  }

  .loading-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 10;
    animation: float-up 2s ease-in-out infinite;
  }

  .loading-hint__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    margin: 0 auto $spacing-md;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4));
    border-radius: 50%;
    border: 2px solid rgba(99, 102, 241, 0.5);
    animation: spin 3s linear infinite;

    svg {
      width: 40px;
      height: 40px;
      color: #a5b4fc;
      filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.8));
    }
  }

  .loading-hint__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    margin-bottom: $spacing-xs;
    color: #c7d2fe;
    text-shadow:
      0 0 20px rgba(165, 180, 252, 0.8),
      0 0 40px rgba(139, 92, 246, 0.6);
    animation: pulse-text 2s ease-in-out infinite;
  }

  .loading-hint__subtitle {
    font-size: $font-size-sm;
    color: rgba(255, 255, 255, 0.8);
    opacity: 1;
  }

  .skeleton-cards {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: $spacing-md;
    height: 400px;
    padding-top: 60px;
    position: relative;
    z-index: 1;
  }

  .skeleton-card {
    position: relative;
    background: rgba(255, 255, 255, 0.12);
    border-radius: $radius-lg;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);

    .skeleton-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%);
      animation: shimmer 2s infinite;
    }

    &--center {
      width: 400px;
      aspect-ratio: 16 / 9;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    &--side {
      width: 300px;
      aspect-ratio: 16 / 9;
      opacity: 0.7;
    }
  }

  .skeleton-card__icon {
    z-index: 2;
    color: rgba(255, 255, 255, 0.5);

    svg {
      width: 40px;
      height: 40px;
      animation: pulse 2s ease-in-out infinite;
    }
  }
}

// 浅色主题下的骨架屏 - 使用 :root 选择器配合 scoped
// 注意：由于 data-theme 在 html 元素上，需要使用非 scoped 的方式
</style>

<style lang="scss">
// 浅色主题下的骨架屏（非 scoped，用于匹配 html[data-theme='light']）
[data-theme='light'] {
  .carousel-3d--loading {
    background: linear-gradient(180deg, #dde3ea 0%, #c8d1dc 100%) !important;

    .skeleton-badge {
      background: rgba(0, 0, 0, 0.12) !important;
      border-color: rgba(0, 0, 0, 0.08) !important;
    }

    .skeleton-badge__text {
      color: rgba(0, 0, 0, 0.6) !important;
    }

    .loading-hint__icon {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3)) !important;
      border-color: rgba(99, 102, 241, 0.4) !important;

      svg {
        color: #4f46e5 !important;
        filter: drop-shadow(0 0 8px rgba(79, 70, 229, 0.5)) !important;
      }
    }

    .loading-hint__title {
      color: #3730a3 !important;
      text-shadow:
        0 0 15px rgba(79, 70, 229, 0.4),
        0 0 30px rgba(124, 58, 237, 0.3) !important;
    }

    .loading-hint__subtitle {
      color: rgba(0, 0, 0, 0.7) !important;
    }

    .skeleton-card {
      background: rgba(0, 0, 0, 0.1) !important;
      border-color: rgba(0, 0, 0, 0.1) !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;

      .skeleton-shimmer {
        background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%) !important;
      }

      &--center {
        background: rgba(0, 0, 0, 0.15) !important;
        border-color: rgba(0, 0, 0, 0.12) !important;
      }
    }

    .skeleton-card__icon {
      color: rgba(0, 0, 0, 0.35) !important;
    }
  }
}
</style>

<style lang="scss" scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
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

@keyframes float-up {
  0%,
  100% {
    transform: translate(-50%, -50%);
  }
  50% {
    transform: translate(-50%, -55%);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse-text {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// 响应式
@media (max-width: 1200px) {
  .carousel-3d {
    min-height: 480px;
  }
  .carousel-3d__stage {
    height: 380px;
  }
  .carousel-3d__card {
    width: 420px;
    &.is-active {
      width: 600px; // 中等屏幕也增大中间图片
    }
  }
}

@media (max-width: 768px) {
  .carousel-3d {
    min-height: 400px;
  }
  .carousel-3d__stage {
    height: 320px;
  }
  .carousel-3d__card {
    width: 300px;
    &.is-active {
      width: 420px; // 小屏幕也增大中间图片
    }
  }
  .nav-btn {
    width: 40px;
    height: 40px;
  }
}
</style>
