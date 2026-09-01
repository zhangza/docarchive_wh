<script setup lang="ts">
interface Node {
  stage: string
  title: string
  time?: string
  operator?: string
  status?: string
  desc?: string
  duration?: string
}
interface Props {
  nodes: Node[]
  currentStage?: string
}
defineProps<Props>()

function toneOf(status?: string) {
  if (status === '已完成' || status === '完成') return 'done'
  if (status === '进行中') return 'active'
  if (status === '超时' || status === '异常') return 'error'
  return 'wait'
}
</script>

<template>
  <div class="lc-timeline">
    <div v-for="(n, i) in nodes" :key="i" class="lc-timeline__item" :class="`is-${toneOf(n.status)}`">
      <div class="lc-timeline__rail">
        <span class="lc-timeline__dot">{{ i + 1 }}</span>
        <span v-if="i < nodes.length - 1" class="lc-timeline__line" />
      </div>
      <div class="lc-timeline__card">
        <div class="lc-timeline__head">
          <span class="lc-timeline__stage">{{ n.stage }}</span>
          <span class="lc-timeline__title">{{ n.title }}</span>
          <span v-if="n.duration" class="lc-timeline__duration num">{{ n.duration }}</span>
        </div>
        <div class="lc-timeline__meta">
          <span v-if="n.time" class="num">{{ n.time }}</span>
          <span v-if="n.operator">· {{ n.operator }}</span>
          <span v-if="n.status" class="lc-timeline__status">{{ n.status }}</span>
        </div>
        <div v-if="n.desc" class="lc-timeline__desc">{{ n.desc }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lc-timeline {
  display: flex;
  flex-direction: column;

  &__item {
    display: flex;
    gap: 12px;
    --tone: var(--zh-border-strong);
    --tone-bg: var(--zh-bg-soft);

    &.is-done { --tone: var(--zh-success); --tone-bg: var(--zh-success-light); }
    &.is-active { --tone: var(--zh-primary); --tone-bg: var(--zh-primary-light); }
    &.is-error { --tone: var(--zh-danger); --tone-bg: var(--zh-danger-light); }
  }

  &__rail {
    position: relative;
    width: 24px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__dot {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--tone);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    z-index: 1;
    font-family: var(--zh-font-num);
    box-shadow: 0 0 0 3px var(--tone-bg);
  }

  &__line {
    flex: 1;
    width: 2px;
    background: linear-gradient(180deg, var(--tone), var(--zh-border));
    margin: 2px 0;
    min-height: 14px;
  }

  &__card {
    flex: 1;
    min-width: 0;
    padding: 0 0 16px;
  }

  &__head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  &__stage {
    padding: 1px 7px;
    border-radius: var(--zh-radius-sm);
    background: var(--tone-bg);
    color: var(--tone);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  &__title { font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-text-primary); }

  &__duration {
    margin-left: auto;
    font-size: 11px;
    color: var(--zh-text-placeholder);
    background: var(--zh-bg-soft);
    padding: 1px 6px;
    border-radius: 3px;
  }

  &__meta {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--zh-text-placeholder);
  }

  &__status { color: var(--tone); font-weight: 600; }

  &__desc {
    margin-top: 5px;
    font-size: var(--zh-font-xs);
    color: var(--zh-text-regular);
    line-height: 1.7;
    padding: 7px 10px;
    background: var(--zh-bg-soft);
    border-radius: var(--zh-radius-sm);
    border-left: 2px solid var(--tone);
  }
}
</style>
