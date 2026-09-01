<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  tag?: string
  tagTone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent'
  back?: boolean
}
const props = withDefaults(defineProps<Props>(), { tagTone: 'primary', back: false })
const router = useRouter()
</script>

<template>
  <div class="page-header">
    <div class="page-header__main">
      <el-button v-if="back" class="page-header__back" text :icon="'ArrowLeft'" @click="router.back()">返回</el-button>
      <h2 class="page-header__title">{{ title }}</h2>
      <span v-if="tag" class="page-header__tag" :class="`is-${tagTone}`">{{ tag }}</span>
      <span v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</span>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  &__main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__back { padding-left: 0; }

  &__title {
    font-size: var(--zh-font-title);
    font-weight: 700;
    color: var(--zh-text-primary);
    letter-spacing: .5px;
    margin: 0;
    white-space: nowrap;
  }

  &__tag {
    padding: 2px 8px;
    border-radius: var(--zh-radius-sm);
    font-size: var(--zh-font-xs);
    font-weight: 600;
    background: var(--zh-primary-light);
    color: var(--zh-primary);
    &.is-success { background: var(--zh-success-light); color: var(--zh-success); }
    &.is-warning { background: var(--zh-warning-light); color: var(--zh-warning); }
    &.is-danger { background: var(--zh-danger-light); color: var(--zh-danger); }
    &.is-accent { background: var(--zh-accent-light); color: var(--zh-accent); }
  }

  &__subtitle {
    font-size: var(--zh-font-sm);
    color: var(--zh-text-secondary);
  }

  &__actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
