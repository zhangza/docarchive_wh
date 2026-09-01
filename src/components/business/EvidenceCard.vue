<script setup lang="ts">
interface Props {
  evidenceId: string
  name: string
  type?: string
  collectTime?: string
  collector?: string
  hash?: string
  chainStatus?: string
  size?: string
}
defineProps<Props>()

const ICONS: Record<string, string> = {
  照片: 'Picture',
  影像: 'Picture',
  录音: 'Microphone',
  录像: 'VideoCamera',
  文档: 'Document',
  票据: 'Tickets',
  处方: 'Document',
  台账: 'Notebook'
}
</script>

<template>
  <div class="evi-card">
    <div class="evi-card__icon">
      <el-icon><component :is="ICONS[type || ''] || 'Files'" /></el-icon>
    </div>
    <div class="evi-card__body">
      <div class="evi-card__name text-ellipsis">{{ name }}</div>
      <div class="evi-card__meta">
        <span class="num">{{ evidenceId }}</span>
        <span v-if="type" class="evi-card__type">{{ type }}</span>
        <span v-if="size">{{ size }}</span>
      </div>
      <div class="evi-card__meta">
        <span v-if="collectTime" class="num">{{ collectTime }}</span>
        <span v-if="collector">· {{ collector }}</span>
      </div>
      <div v-if="hash" class="evi-card__hash">
        <span class="evi-card__hash-label">HASH</span>
        <span class="evi-card__hash-val num">{{ hash }}</span>
      </div>
    </div>
    <div class="evi-card__side">
      <span v-if="chainStatus" class="evi-card__chain" :class="chainStatus === '已固化' ? 'is-ok' : 'is-wait'">
        <el-icon><Lock /></el-icon>{{ chainStatus }}
      </span>
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.evi-card {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--zh-border-light);
  border-radius: var(--zh-radius);
  background: #fff;
  transition: all .2s;

  &:hover { border-color: var(--zh-primary); box-shadow: var(--zh-shadow-xs); }

  &__icon {
    width: 38px; height: 38px;
    flex-shrink: 0;
    border-radius: var(--zh-radius-sm);
    background: var(--zh-primary-lighter);
    color: var(--zh-primary);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }

  &__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

  &__name { font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-text-primary); }

  &__meta {
    display: flex; flex-wrap: wrap; gap: 6px;
    font-size: 11px; color: var(--zh-text-placeholder);
  }

  &__type {
    padding: 0 5px;
    border-radius: 3px;
    background: var(--zh-accent-light);
    color: var(--zh-accent);
    font-weight: 600;
  }

  &__hash {
    display: flex; align-items: center; gap: 5px;
    margin-top: 2px;
    &-label {
      font-size: 10px;
      padding: 0 4px;
      border-radius: 2px;
      background: var(--zh-purple-light);
      color: var(--zh-purple);
      font-weight: 700;
      flex-shrink: 0;
    }
    &-val {
      font-size: 10px;
      color: var(--zh-text-placeholder);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__side {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
    gap: 6px;
  }

  &__chain {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--zh-radius-sm);
    white-space: nowrap;
    &.is-ok { color: var(--zh-success); background: var(--zh-success-light); }
    &.is-wait { color: var(--zh-warning); background: var(--zh-warning-light); }
  }
}
</style>
