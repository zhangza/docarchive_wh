<script setup lang="ts">
/**
 * VizPanel —— 深空大屏面板容器（agent05 专属）
 * 特点：半透明玻璃面板 + 四角科技切角 + 顶部霓虹标题条 + 可选发光边
 */
withDefaults(defineProps<{
  title?: string
  /** 右上角副信息 */
  extra?: string
  /** 强调色调 */
  tone?: 'cyan' | 'blue' | 'violet' | 'lime' | 'amber' | 'pink' | 'red'
  /** 面板高度 */
  height?: string
  /** 是否显示发光边框 */
  glow?: boolean
  /** 内容区无内边距 */
  flush?: boolean
}>(), { tone: 'cyan', glow: false, flush: false })
</script>

<template>
  <section class="vp" :class="[`vp--${tone}`, { 'is-glow': glow }]" :style="height ? { height } : undefined">
    <!-- 四角科技切角 -->
    <i class="vp__corner vp__corner--tl" />
    <i class="vp__corner vp__corner--tr" />
    <i class="vp__corner vp__corner--bl" />
    <i class="vp__corner vp__corner--br" />

    <header v-if="title || $slots.title" class="vp__head">
      <span class="vp__bar" />
      <span class="vp__title">
        <slot name="title">{{ title }}</slot>
      </span>
      <span class="vp__line" />
      <span v-if="extra || $slots.extra" class="vp__extra">
        <slot name="extra">{{ extra }}</slot>
      </span>
    </header>

    <div class="vp__body" :class="{ 'is-flush': flush }">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.vp {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 10px 12px 12px;
  border-radius: 4px;
  background: var(--viz-panel);
  border: 1px solid var(--viz-line);
  box-shadow: var(--zh-shadow-xs);
  overflow: hidden;

  // 顶部一道渐隐高光
  &::before {
    content: '';
    position: absolute; inset: 0 0 auto 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--tc), transparent);
    opacity: .7;
  }

  &--cyan { --tc: var(--viz-cyan); }
  &--blue { --tc: var(--viz-blue); }
  &--violet { --tc: var(--viz-violet); }
  &--lime { --tc: var(--viz-lime); }
  &--amber { --tc: var(--viz-amber); }
  &--pink { --tc: var(--viz-pink); }
  &--red { --tc: var(--viz-red); }

  &.is-glow {
    border-color: color-mix(in srgb, var(--tc) 42%, transparent);
    box-shadow: 0 4px 16px -8px color-mix(in srgb, var(--tc) 36%, transparent);
  }

  /* 四角切角 */
  &__corner {
    position: absolute; width: 9px; height: 9px; pointer-events: none;
    border-color: var(--tc); opacity: .82;

    &--tl { top: 0; left: 0; border-top: 1.5px solid; border-left: 1.5px solid; }
    &--tr { top: 0; right: 0; border-top: 1.5px solid; border-right: 1.5px solid; }
    &--bl { bottom: 0; left: 0; border-bottom: 1.5px solid; border-left: 1.5px solid; }
    &--br { bottom: 0; right: 0; border-bottom: 1.5px solid; border-right: 1.5px solid; }
  }

  &__head {
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0; margin-bottom: 9px;
  }

  &__bar {
    width: 3px; height: 12px; flex-shrink: 0; border-radius: 1px;
    background: var(--tc);
    box-shadow: 0 0 8px var(--tc);
  }

  &__title {
    flex-shrink: 0;
    font-size: 13px; font-weight: 700; letter-spacing: .5px;
    color: var(--viz-text);
  }

  &__line {
    flex: 1; height: 1px; min-width: 12px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--tc) 45%, transparent), transparent);
  }

  &__extra {
    flex-shrink: 0;
    font-size: 10px; color: var(--viz-text-dim);
    font-variant-numeric: tabular-nums;
  }

  &__body {
    flex: 1; min-height: 0; min-width: 0;
    &.is-flush { margin: 0 -12px -12px; }
  }
}
</style>
