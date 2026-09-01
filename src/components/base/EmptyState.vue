<script setup lang="ts">
interface Props {
  text?: string
  desc?: string
  height?: string
  icon?: string
}
withDefaults(defineProps<Props>(), { text: '暂无数据', height: '180px' })
</script>

<template>
  <div class="empty-state" :style="{ minHeight: height }">
    <div class="empty-state__icon">
      <el-icon><component :is="icon || 'DocumentDelete'" /></el-icon>
    </div>
    <div class="empty-state__text">{{ text }}</div>
    <div v-if="desc" class="empty-state__desc">{{ desc }}</div>
    <div v-if="$slots.default" class="empty-state__action"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--zh-text-placeholder);

  &__icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--zh-bg-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--zh-border-strong);
  }
  &__text { font-size: var(--zh-font-sm); color: var(--zh-text-secondary); }
  &__desc { font-size: var(--zh-font-xs); }
}
</style>
