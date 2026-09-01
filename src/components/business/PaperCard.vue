<script setup lang="ts">
/**
 * 公文纸样卡 —— 拟物化的 A4 缩略纸样
 * 用于文书模板库「纸样墙」，鼠标悬停微微掀起，右上角朱红文种角标
 */
interface Props {
  /** 文书名称 */
  name: string
  /** 文种代字（朱红角标） */
  code?: string
  /** 分类名 */
  category?: string
  /** 版本 */
  version?: string
  /** 页数 */
  pages?: number
  /** 引用次数 */
  useCount?: number
  /** 是否现行有效 */
  effective?: boolean
  /** 是否选中 */
  active?: boolean
  /** 占位符行数（正文纹理） */
  lines?: number
  /** 分类色（CSS 变量名或色值） */
  tone?: string
}
const props = withDefaults(defineProps<Props>(), {
  effective: true, lines: 7, tone: 'var(--zh-primary)'
})
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <div class="pp" :class="{ 'is-active': active, 'is-void': !effective }"
    :style="{ '--pp-tone': tone }" @click="$emit('click')">
    <!-- 朱红文种角标 -->
    <div v-if="code" class="pp__code">{{ code }}</div>

    <!-- 纸面 -->
    <div class="pp__sheet">
      <div class="pp__redhead">芜湖市医疗保障局</div>
      <div class="pp__redline" />
      <div class="pp__title">{{ name }}</div>
      <div class="pp__no">〔2026〕〇〇〇号</div>
      <div class="pp__body">
        <span v-for="i in lines" :key="i" class="pp__line"
          :style="{ width: (i === lines ? 42 : 62 + ((i * 13) % 34)) + '%' }" />
      </div>
      <div class="pp__sign">
        <span class="pp__seal" />
      </div>
      <div v-if="!effective" class="pp__void">已废止</div>
    </div>

    <!-- 底部信息条 -->
    <div class="pp__meta">
      <span class="pp__cat">{{ category }}</span>
      <span class="pp__v num">{{ version }}</span>
    </div>
    <div class="pp__foot">
      <span><el-icon><Document /></el-icon>{{ pages }} 页</span>
      <span><el-icon><Connection /></el-icon><b class="num">{{ useCount }}</b> 次引用</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pp {
  position: relative;
  cursor: pointer;
  padding: 9px 9px 0;
  border-radius: var(--zh-radius);
  background: linear-gradient(180deg, #fff, var(--doc-paper-warm));
  border: 1px solid var(--doc-paper-edge);
  box-shadow: var(--doc-shadow-paper);
  transition: transform .26s cubic-bezier(.2, .8, .2, 1), box-shadow .26s, border-color .2s;

  /* 纸叠层次：底部两张"垫纸" */
  &::before, &::after {
    content: ''; position: absolute; inset: auto 6px -3px 6px; height: 8px;
    border-radius: 0 0 6px 6px; background: var(--doc-paper-warm);
    border: 1px solid var(--doc-paper-edge); border-top: none; z-index: -1;
  }
  &::after { inset: auto 11px -6px 11px; opacity: .72; }

  &:hover {
    transform: translateY(-7px) rotate(-.5deg);
    box-shadow: var(--doc-shadow-paper-lift);
    border-color: var(--pp-tone);
  }

  &.is-active {
    border-color: var(--pp-tone);
    box-shadow: var(--doc-shadow-paper-lift), 0 0 0 2px color-mix(in srgb, var(--pp-tone) 26%, transparent);
    transform: translateY(-4px);
  }

  &.is-void { filter: grayscale(.55); opacity: .82; }

  /* 朱红文种角标 */
  &__code {
    position: absolute; top: -6px; right: -6px; z-index: 3;
    min-width: 26px; height: 26px; padding: 0 6px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    background: var(--doc-vermilion);
    color: #fff; font-family: var(--doc-font-song);
    font-size: 12px; font-weight: 700; letter-spacing: 1px;
    box-shadow: 0 2px 8px rgba(200, 22, 29, .38);
    transform: rotate(4deg);
  }

  /* 纸面 */
  &__sheet {
    position: relative;
    padding: 13px 12px 10px;
    background: var(--doc-paper);
    border: 1px solid var(--doc-paper-line);
    border-radius: 3px;
    min-height: 148px;
    /* 纸纹 */
    background-image:
      repeating-linear-gradient(0deg, transparent 0 15px, rgba(232, 224, 205, .5) 15px 16px);
    overflow: hidden;
  }

  &__redhead {
    text-align: center;
    font-family: var(--doc-font-song);
    font-size: 11px; font-weight: 700; letter-spacing: 2.5px;
    color: var(--doc-vermilion);
  }
  &__redline {
    height: 1.5px; margin: 5px 0 8px;
    background: var(--doc-vermilion);
    box-shadow: 0 .5px 0 rgba(200, 22, 29, .35);
  }
  &__title {
    text-align: center;
    font-family: var(--doc-font-song);
    font-size: 12px; font-weight: 700; color: var(--doc-ink);
    line-height: 1.4;
  }
  &__no {
    text-align: center; margin-top: 3px;
    font-family: var(--doc-font-fang);
    font-size: 9px; color: var(--doc-ink-faint);
  }

  &__body {
    display: flex; flex-direction: column; gap: 5px;
    margin: 9px 0 0; padding-left: 8px;
  }
  &__line {
    height: 3px; border-radius: 2px;
    background: linear-gradient(90deg, var(--doc-ink-faint), rgba(140, 147, 161, .32));
    opacity: .5;
  }

  &__sign {
    display: flex; justify-content: flex-end;
    margin-top: 8px; padding-right: 4px;
  }
  &__seal {
    width: 26px; height: 26px; border-radius: 50%;
    border: 1.6px solid var(--doc-seal);
    position: relative;
    transform: rotate(-12deg);
    &::after {
      content: '章'; position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--doc-font-song); font-size: 10px; font-weight: 700;
      color: var(--doc-seal);
    }
  }

  &__void {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-18deg);
    padding: 3px 14px;
    border: 2px solid var(--doc-ink-faint); border-radius: 4px;
    font-family: var(--doc-font-song); font-size: 15px; font-weight: 700;
    color: var(--doc-ink-faint); letter-spacing: 3px;
    opacity: .6;
  }

  /* 信息条 */
  &__meta {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 2px 5px;
    border-bottom: 1px dashed var(--doc-paper-edge);
  }
  &__cat {
    font-size: 10px; font-weight: 700; color: var(--pp-tone);
    padding: 1px 6px; border-radius: 3px;
    background: color-mix(in srgb, var(--pp-tone) 11%, transparent);
  }
  &__v { font-size: 10px; color: var(--doc-ink-faint); font-weight: 700; }

  &__foot {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 2px 8px;
    font-size: 10px; color: var(--doc-ink-soft);
    span { display: inline-flex; align-items: center; gap: 3px; }
    b { color: var(--pp-tone); font-size: 11px; }
    :deep(.el-icon) { font-size: 11px; color: var(--doc-ink-faint); }
  }
}
</style>
