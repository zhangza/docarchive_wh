<script setup lang="ts">
interface Props {
  level?: string
  size?: 'small' | 'default' | 'large'
  effect?: 'plain' | 'solid'
}
const props = withDefaults(defineProps<Props>(), { level: '低', size: 'small', effect: 'plain' })

const cls = computed(() => {
  if (props.level === '高') return 'high'
  if (props.level === '中') return 'mid'
  return 'low'
})
</script>

<template>
  <span class="risk-tag" :class="[`risk-tag--${cls}`, `risk-tag--${size}`, effect === 'solid' ? 'is-solid' : '']">
    <i class="risk-tag__dot" />{{ level }}风险
  </span>
</template>

<style scoped lang="scss">
.risk-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 22px;
  line-height: 1;
  border-radius: var(--zh-radius-sm);
  font-size: var(--zh-font-xs);
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  &--large { height: 26px; font-size: var(--zh-font-sm); padding: 0 10px; }

  &--high {
    color: var(--zh-risk-high);
    background: var(--zh-risk-high-bg);
    border-color: var(--zh-risk-high-border);
    .risk-tag__dot { animation: zh-pulse 1.6s ease-in-out infinite; }
  }
  &--mid {
    color: var(--zh-risk-mid);
    background: var(--zh-risk-mid-bg);
    border-color: var(--zh-risk-mid-border);
  }
  &--low {
    color: var(--zh-risk-low);
    background: var(--zh-risk-low-bg);
    border-color: var(--zh-risk-low-border);
  }

  &.is-solid {
    color: #fff;
    border-color: transparent;
    &.risk-tag--high { background: var(--zh-risk-high); }
    &.risk-tag--mid { background: var(--zh-risk-mid); }
    &.risk-tag--low { background: var(--zh-risk-low); }
  }
}
</style>
