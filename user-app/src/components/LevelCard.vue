<template>
  <div class="level-card" v-if="levelInfo">
    <div class="level-header">
      <div class="level-icon">{{ levelInfo.levelIcon || '⭐' }}</div>
      <div class="level-info">
        <div class="level-name">{{ levelInfo.levelName || '新手体验官' }}</div>
        <div class="level-bonus">
          <span class="coefficient">收益 x{{ levelInfo.coefficient || 1 }}</span>
          <span class="concurrent" v-if="levelInfo.concurrentTasks && levelInfo.concurrentTasks > 1">
            可同时{{ levelInfo.concurrentTasks }}任务
          </span>
        </div>
      </div>
    </div>
    
    <!-- 升级进度 -->
    <div class="progress-section" v-if="levelInfo.nextLevel && levelInfo.progress">
      <div class="progress-title">
        <span>升级到 {{ levelInfo.nextLevel.name || '下一级' }}</span>
        <span class="progress-percent">{{ levelInfo.progress.overallPercent || 0 }}%</span>
      </div>
      
      <!-- 任务数进度 -->
      <div class="progress-item" v-if="levelInfo.progress.tasks">
        <div class="progress-label">
          <span>完成任务</span>
          <span>{{ levelInfo.progress.tasks.current || 0 }}/{{ levelInfo.progress.tasks.required || 0 }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (levelInfo.progress.tasks.percent || 0) + '%' }"></div>
        </div>
      </div>
      
      <!-- 积分进度 -->
      <div class="progress-item" v-if="levelInfo.progress.points">
        <div class="progress-label">
          <span>累计积分</span>
          <span>{{ levelInfo.progress.points.current || 0 }}/{{ levelInfo.progress.points.required || 0 }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (levelInfo.progress.points.percent || 0) + '%' }"></div>
        </div>
      </div>
      
      <!-- 通过率 -->
      <div class="progress-item" v-if="levelInfo.progress.passRate && levelInfo.progress.passRate.required > 0">
        <div class="progress-label">
          <span>任务通过率</span>
          <span>{{ levelInfo.progress.passRate.current || 0 }}% / {{ levelInfo.progress.passRate.required }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :class="{ 'pass-met': levelInfo.progress.passRate.met }" 
               :style="{ width: Math.min(levelInfo.progress.passRate.current || 0, 100) + '%' }"></div>
        </div>
      </div>
    </div>
    
    <!-- 最高等级提示 -->
    <div class="max-level" v-else-if="!levelInfo.nextLevel">
      <span>已达到最高等级 🎉</span>
    </div>
    
    <!-- 等级特权说明 -->
    <div class="level-benefits">
      <div class="benefit-item" v-if="levelInfo.prioritySupport">
        <span class="benefit-icon">⭐</span>
        <span>专属客服支持</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">💰</span>
        <span>收益加成 {{ Math.round((levelInfo.coefficient - 1) * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  levelInfo: {
    type: Object,
    default: () => null
  }
})
</script>

<style scoped>
.level-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 16px;
}

.level-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.level-icon {
  font-size: 32px;
  background: rgba(255, 255, 255, 0.2);
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.level-info {
  flex: 1;
}

.level-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.level-bonus {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.coefficient {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.concurrent {
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.progress-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}

.progress-title {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.progress-percent {
  font-weight: 600;
}

.progress-item {
  margin-bottom: 8px;
}

.progress-item:last-child {
  margin-bottom: 0;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-fill.pass-met {
  background: #4ade80;
}

.max-level {
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 14px;
  margin-bottom: 12px;
}

.level-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.15);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.benefit-icon {
  font-size: 14px;
}
</style>
