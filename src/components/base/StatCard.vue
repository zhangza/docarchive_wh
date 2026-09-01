<script setup lang="ts">
interface Props {
  label: string
  value: number | string
  unit?: string
  icon?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'purple'
  trend?: number
  trendText?: string
  desc?: string
  clickable?: boolean
  active?: boolean
  precision?: number
}
const props = withDefaults(defineProps<Props>(), {
  tone: 'primary',
  precision: 0,
  clickable: false,
  active: false
})

const display = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString('zh-CN', {
      minimumFractionDigits: props.precision,
      maximumFractionDigits: props.precision
    })
  }
  return props.value
})
</script>

<template>
  <div
    class="stat-card"
    :class="[`stat-card--${tone}`, clickable ? 'is-clickable' : '', active ? 'is-active' : '']"
  >
    <div class="stat-card__bar" />
    <div class="stat-card__body">
      <div class="stat-card__head">
        <span class="stat-card__label">{{ label }}</span>
        <el-icon v-if="icon" class="stat-card__icon"><component :is="icon" /></el-icon>
      </div>
      <div class="stat-card__value">
        <span class="num">{{ display }}</span>
        <span v-if="unit" class="stat-card__unit">{{ unit }}</span>
      </div>
      <div class="stat-card__foot">
        <span v-if="trend !== undefined" class="stat-card__trend" :class="trend >= 0 ? 'is-up' : 'is-down'">
          {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }}%
        </span>
        <span v-if="trendText" class="stat-card__trend-text">{{ trendText }}</span>
        <span v-if="desc" class="stat-card__desc">{{ desc }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-card {
  position: relative;
  display: flex;
  background: var(--zh-bg-card);
  border: 1px solid var(--zh-border);
  border-radius: var(--zh-radius);
  overflow: hidden;
  transition: all .22s ease;
  --tone: var(--zh-primary);
  --tone-light: var(--zh-primary-light);

  &--success { --tone: var(--zh-success); --tone-light: var(--zh-success-light); }
  &--warning { --tone: var(--zh-warning); --tone-light: var(--zh-warning-light); }
  &--danger  { --tone: var(--zh-danger);  --tone-light: var(--zh-danger-light); }
  &--accent  { --tone: var(--zh-accent);  --tone-light: var(--zh-accent-light); }
  &--purple  { --tone: var(--zh-purple);  --tone-light: var(--zh-purple-light); }

  &__bar {
    width: 4px;
    flex-shrink: 0;
    background: var(--tone);
  }

  &__body {
    flex: 1;
    padding: 12px 14px;
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__label {
    font-size: var(--zh-font-sm);
    color: var(--zh-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__icon {
    font-size: 16px;
    color: var(--tone);
    background: var(--tone-light);
    padding: 4px;
    border-radius: var(--zh-radius-sm);
    flex-shrink: 0;
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 6px;
    .num {
      font-family: var(--zh-font-num);
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
      color: var(--zh-text-primary);
      font-variant-numeric: tabular-nums;
    }
  }

  &__unit {
    font-size: var(--zh-font-xs);
    color: var(--zh-text-secondary);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    min-height: 16px;
    font-size: var(--zh-font-xs);
  }

  &__trend {
    font-weight: 600;
    &.is-up { color: var(--zh-danger); }
    &.is-down { color: var(--zh-success); }
  }

  &__trend-text,
  &__desc { color: var(--zh-text-placeholder); }

  &.is-clickable {
    cursor: pointer;
    &:hover {
      border-color: var(--tone);
      box-shadow: var(--zh-shadow-sm);
      transform: translateY(-2px);
    }
  }

  &.is-active {
    border-color: var(--tone);
    background: var(--tone-light);
    box-shadow: var(--zh-shadow-sm);
  }
}
</style>
