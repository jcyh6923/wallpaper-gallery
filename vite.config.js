// import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { VantResolver } from '@vant/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
// import { obfuscator as obfuscatorPlugin } from 'rollup-obfuscator'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import compression from 'vite-plugin-compression'

// 是否为生产环境
// const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Element Plus + Vant 自动按需导入
    AutoImport({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver(), VantResolver()],
    }),
    // Gzip 压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // 10KB 以上才压缩
    }),
  ],
  base: '/wallpaper-gallery/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/variables" as *;`,
      },
    },
  },
  // 生产环境移除 console
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    // 分块策略
    rollupOptions: {
      output: {
        manualChunks: {
          'vue': ['vue'],
          'vue-router': ['vue-router'],
          'element-plus': ['element-plus'],
          'vant': ['vant'],
        },
        // 优化文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      // 生产环境启用代码混淆（轻量配置）
      // plugins: isProduction
      //   ? [
      //       obfuscatorPlugin({
      //         compact: true,
      //         stringArray: true,
      //         stringArrayThreshold: 0.5,
      //         stringArrayEncoding: ['base64'],
      //         // 关闭重型混淆以保持性能和包体积
      //         controlFlowFlattening: false,
      //         deadCodeInjection: false,
      //         debugProtection: true,
      //         // 排除第三方库以提高性能
      //         exclude: [/node_modules/],
      //       }),
      //     ]
      //   : [],
    },
    // 块大小警告阈值
    chunkSizeWarningLimit: 500,
  },
})
