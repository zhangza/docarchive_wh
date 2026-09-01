<script setup lang="ts">
/**
 * 电子印章 —— 拟真圆形公章，支持"盖章"动效
 * 用于签章页展示已盖 / 待盖状态
 */
interface Props {
  /** 印章文字（环形排列的机关名） */
  text?: string
  /** 中心文字 */
  center?: string
  /** 尺寸 px */
  size?: number
  /** 是否已盖章（触发落章动效 + 实色） */
  stamped?: boolean
  /** 印章类型色调 */
  tone?: 'vermilion' | 'blue' | 'black'
  /** 旋转角度 */
  rotate?: number
}
const props = withDefaults(defineProps<Props>(), {
  text: '芜湖市医疗保障局', center: '医保', size: 92,
  stamped: true, tone: 'vermilion', rotate: -14
})

/** 环形文字：把机关名沿上半圆铺开 */
const chars = computed(() => {
  const t = props.text.split('')
  const n = t.length
  // 上半圆铺开，总张角 250°，居中于顶部
  const span = Math.min(250, n * 26)
  const start = -span / 2
  const step = n > 1 ? span / (n - 1) : 0
  return t.map((c, i) => ({ c, deg: start + step * i }))
})

const COLOR = { vermilion: 'var(--doc-vermilion)', blue: '#1c4fa1', black: '#2a2f38' }
</script>

<template>
  <div class="sl" :class="{ 'is-stamped': stamped }"
    :style="{
      '--sl-size': size + 'px',
      '--sl-color': COLOR[tone],
      '--sl-rotate': rotate + 'deg'
    }">
    <div class="sl__ring">
      <!-- 外圈 -->
      <span class="sl__o" />
      <!-- 内圈 -->
      <span class="sl__i" />
      <!-- 五角星 -->
      <svg class="sl__star" viewBox="0 0 24 24">
        <path d="M12 2.6l2.9 6.1 6.7.9-4.9 4.7 1.2 6.6L12 17.7l-5.9 3.2 1.2-6.6L2.4 9.6l6.7-.9z" />
      </svg>
      <!-- 环形文字 -->
      <span v-for="(x, i) in chars" :key="i" class="sl__c"
        :style="{ transform: `rotate(${x.deg}deg) translateY(calc(var(--sl-size) * -0.375))` }">
        {{ x.c }}
      </span>
      <!-- 中心文字 -->
      <span class="sl__ct">{{ center }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sl {
  width: var(--sl-size); height: var(--sl-size);
  flex-shrink: 0;
  display: grid; place-items: center;

  &__ring {
    position: relative;
    width: 100%; height: 100%;
    color: var(--sl-color);
    transform: rotate(var(--sl-rotate)) scale(1);
    opacity: .18;
    filter: none;
    transition: none;
  }

  &.is-stamped .sl__ring {
    opacity: .85;
    animation: sl-drop .62s cubic-bezier(.2, 1.5, .4, 1) both;
    /* 印泥不均匀感 */
    filter: contrast(1.06);
  }

  &__o, &__i {
    position: absolute; border-radius: 50%;
    border: calc(var(--sl-size) * 0.032) solid currentColor;
  }
  &__o { inset: 0; }
  &__i { inset: 11%; border-width: calc(var(--sl-size) * 0.014); opacity: .55; }

  &__star {
    position: absolute; top: 50%; left: 50%;
    width: 26%; height: 26%;
    transform: translate(-50%, -74%);
    fill: currentColor;
  }

  &__c {
    position: absolute; top: 50%; left: 50%;
    margin: calc(var(--sl-size) * -0.055) 0 0 calc(var(--sl-size) * -0.045);
    width: calc(var(--sl-size) * 0.09);
    text-align: center;
    transform-origin: 50% calc(var(--sl-size) * 0.375);
    font-family: var(--doc-font-song);
    font-size: calc(var(--sl-size) * 0.105);
    font-weight: 700;
    line-height: 1;
  }

  &__ct {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, 4%);
    font-family: var(--doc-font-song);
    font-size: calc(var(--sl-size) * 0.145);
    font-weight: 700;
    letter-spacing: 1px;
  }
}

@keyframes sl-drop {
  0% { transform: rotate(calc(var(--sl-rotate) - 22deg)) scale(2.1); opacity: 0; }
  55% { transform: rotate(var(--sl-rotate)) scale(.93); opacity: .95; }
  75% { transform: rotate(var(--sl-rotate)) scale(1.04); opacity: .8; }
  100% { transform: rotate(var(--sl-rotate)) scale(1); opacity: .85; }
}
</style>
