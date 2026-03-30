import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 引入样式
import './styles/variables.css'  // 主题变量
import './style.css'              // 全局样式
import './styles/redesign.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

// 初始化主题
import { initTheme } from './composables/useTheme.js'
initTheme()
