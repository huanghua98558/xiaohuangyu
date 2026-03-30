<template>
  <Teleport to="body">
    <Transition name="city-modal">
      <div v-if="visible" class="city-modal-overlay" @click.self="handleClose">
        <div class="city-modal">
          <!-- 头部 -->
          <div class="modal-header">
            <div class="header-icon">📍</div>
            <h3 class="header-title">选择您的城市</h3>
            <p class="header-desc">为了给您推荐更精准的任务，请选择您所在的城市</p>
          </div>

          <!-- 搜索框 -->
          <div class="search-box">
            <input 
              v-model="searchText" 
              type="text" 
              placeholder="搜索城市..."
              class="search-input"
            />
          </div>

          <!-- 热门城市 -->
          <div class="hot-cities" v-if="!searchText">
            <div class="section-title">热门城市</div>
            <div class="city-grid">
              <button 
                v-for="city in hotCities" 
                :key="city"
                class="city-btn hot"
                @click="selectCity(city)"
              >
                {{ city }}
              </button>
            </div>
          </div>

          <!-- 城市列表 -->
          <div class="city-list">
            <template v-if="searchText">
              <!-- 搜索结果 -->
              <div class="section-title">搜索结果</div>
              <button 
                v-for="city in filteredCities" 
                :key="city"
                class="city-btn list"
                @click="selectCity(city)"
              >
                {{ city }}
              </button>
              <div v-if="filteredCities.length === 0" class="no-result">
                未找到匹配的城市
              </div>
            </template>
            <template v-else>
              <!-- 按省份分组 -->
              <div v-for="(cities, province) in groupedCities" :key="province" class="province-group">
                <div class="section-title">{{ province }}</div>
                <div class="city-grid small">
                  <button 
                    v-for="city in cities" 
                    :key="city"
                    class="city-btn list"
                    @click="selectCity(city)"
                  >
                    {{ city }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- 底部 -->
          <div class="modal-footer">
            <button class="skip-btn" @click="handleSkip">跳过</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'select', 'skip'])

const searchText = ref('')

// 热门城市
const hotCities = [
  '北京市', '上海市', '广州市', '深圳市', '杭州市',
  '成都市', '武汉市', '南京市', '苏州市', '西安市'
]

// 省份和城市数据
const provinceData = {
  '直辖市': ['北京市', '上海市', '天津市', '重庆市'],
  '广东省': ['广州市', '深圳市', '东莞市', '佛山市', '珠海市', '惠州市', '中山市', '汕头市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '绍兴市', '金华市', '台州市'],
  '江苏省': ['南京市', '苏州市', '无锡市', '常州市', '南通市', '徐州市', '扬州市'],
  '四川省': ['成都市', '绵阳市', '德阳市', '宜宾市', '南充市', '泸州市'],
  '湖北省': ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄石市'],
  '山东省': ['济南市', '青岛市', '烟台市', '潍坊市', '临沂市', '淄博市'],
  '河南省': ['郑州市', '洛阳市', '开封市', '新乡市', '安阳市'],
  '福建省': ['福州市', '厦门市', '泉州市', '漳州市', '莆田市'],
  '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市'],
  '陕西省': ['西安市', '咸阳市', '宝鸡市', '渭南市', '汉中市'],
  '安徽省': ['合肥市', '芜湖市', '蚌埠市', '阜阳市', '安庆市'],
  '河北省': ['石家庄市', '唐山市', '保定市', '邯郸市', '秦皇岛市'],
  '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '丹东市'],
  '江西省': ['南昌市', '九江市', '赣州市', '景德镇市', '萍乡市'],
  '云南省': ['昆明市', '大理市', '丽江市', '曲靖市', '玉溪市'],
  '贵州省': ['贵阳市', '遵义市', '六盘水市', '安顺市'],
  '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '牡丹江市', '大庆市'],
  '吉林省': ['长春市', '吉林市', '四平市', '通化市'],
  '山西省': ['太原市', '大同市', '临汾市', '运城市'],
  '甘肃省': ['兰州市', '天水市', '酒泉市', '白银市'],
  '内蒙古自治区': ['呼和浩特市', '包头市', '鄂尔多斯市', '赤峰市'],
  '广西壮族自治区': ['南宁市', '桂林市', '柳州市', '北海市'],
  '海南省': ['海口市', '三亚市', '儋州市'],
  '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '喀什市'],
  '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市'],
  '青海省': ['西宁市', '海东市'],
  '西藏自治区': ['拉萨市', '日喀则市']
}

// 所有城市列表（用于搜索）
const allCities = computed(() => {
  const cities = []
  Object.values(provinceData).forEach(provinceCities => {
    cities.push(...provinceCities)
  })
  return cities
})

// 搜索过滤后的城市
const filteredCities = computed(() => {
  if (!searchText.value) return []
  const keyword = searchText.value.toLowerCase()
  return allCities.value.filter(city => 
    city.toLowerCase().includes(keyword)
  )
})

// 按省份分组的城市
const groupedCities = computed(() => provinceData)

// 选择城市
const selectCity = (city) => {
  // 根据城市名推断省份
  let province = ''
  for (const [p, cities] of Object.entries(provinceData)) {
    if (cities.includes(city)) {
      province = p === '直辖市' ? city : p
      break
    }
  }
  
  emit('select', { province, city })
  handleClose()
}

// 跳过
const handleSkip = () => {
  emit('skip')
  handleClose()
}

// 关闭弹窗
const handleClose = () => {
  searchText.value = ''
  emit('close')
}
</script>

<style scoped>
.city-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0 16px;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.city-modal {
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  background: #fff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部 */
.modal-header {
  padding: 24px 20px 16px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.header-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 6px;
}

.header-desc {
  font-size: 13px;
  opacity: 0.9;
  margin: 0;
}

/* 搜索框 */
.search-box {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 16px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #667eea;
}

/* 城市列表 */
.city-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.section-title {
  font-size: 13px;
  color: #999;
  padding: 8px 0;
  margin-top: 4px;
}

.city-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.city-grid.small {
  gap: 8px;
}

.city-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.city-btn:active {
  transform: scale(0.95);
}

.city-btn.hot {
  border-color: #667eea;
  color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.city-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.city-btn.list {
  font-size: 13px;
  padding: 6px 12px;
}

.no-result {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.province-group {
  margin-bottom: 12px;
}

/* 底部 */
.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
}

.skip-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 22px;
  background: #f5f5f5;
  color: #666;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.skip-btn:active {
  background: #eee;
}

/* 动画 */
.city-modal-enter-active,
.city-modal-leave-active {
  transition: all 0.3s ease;
}

.city-modal-enter-active .city-modal,
.city-modal-leave-active .city-modal {
  transition: transform 0.3s ease;
}

.city-modal-enter-from,
.city-modal-leave-to {
  opacity: 0;
}

.city-modal-enter-from .city-modal,
.city-modal-leave-to .city-modal {
  transform: translateY(100%);
}
</style>
