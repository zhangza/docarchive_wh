<script setup lang="ts">
/**
 * 档案卷盒 —— 拟物化档案盒（书脊视角），用于案卷归档「档案书架」
 * 支持按状态着色书脊、烫金档号、借出倾斜、缺失材料红标
 */
interface Props {
  /** 档号（烫金） */
  archiveNo: string
  /** 案件名称 */
  caseName: string
  /** 案卷号 */
  caseFileNo?: string
  /** 状态 */
  status: string
  /** 册数 */
  volumeCount?: number
  /** 总页数 */
  totalPages?: number
  /** 保管年限 */
  retentionYears?: number
  /** 组装校验是否通过 */
  passed?: boolean
  /** 缺失材料数 */
  missingCount?: number
  /** 是否已 OCR */
  ocr?: boolean
  /** 是否选中 */
  active?: boolean
}
const props = withDefaults(defineProps<Props>(), { passed: true, missingCount: 0 })
defineEmits<{ (e: 'click'): void }>()

const SPINE: Record<string, string> = {
  组装中: 'var(--doc-box-assembling)',
  待归档: 'var(--doc-box-pending)',
  已归档: 'var(--doc-box-archived)',
  已移交: 'var(--doc-box-moved)',
  借出中: 'var(--doc-box-borrowed)'
}
const spineColor = computed(() => SPINE[props.status] || 'var(--zh-info)')
/** 页数越多，盒子越"厚" */
const thick = computed(() => {
  const p = props.totalPages || 0
  return Math.min(9, Math.max(4, Math.round(p / 32)))
})
</script>

<template>
  <div class="bx" :class="{ 'is-active': active, 'is-out': status === '借出中' }"
    :style="{ '--bx-c': spineColor, '--bx-th': thick + 'px' }" @click="$emit('click')">
    <!-- 书脊 -->
    <div class="bx__spine">
      <span class="bx__band" />
      <span class="bx__no">{{ archiveNo }}</span>
      <span class="bx__band" />
    </div>

    <!-- 盒面 -->
    <div class="bx__face">
      <div class="bx__head">
        <span class="bx__tag">{{ status }}</span>
        <span v-if="ocr" class="bx__ocr" title="已 OCR 识别">OCR</span>
      </div>
      <div class="bx__name">{{ caseName }}</div>
      <div v-if="caseFileNo" class="bx__cf num">{{ caseFileNo }}</div>

      <div class="bx__rows">
        <span><b class="num">{{ volumeCount }}</b> 册</span>
        <span><b class="num">{{ totalPages }}</b> 页</span>
        <span><b class="num">{{ retentionYears }}</b> 年</span>
      </div>

      <div class="bx__chk" :class="passed ? 'is-ok' : 'is-no'">
        <el-icon><component :is="passed ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
        {{ passed ? '组装校验通过' : `缺失 ${missingCount} 项材料` }}
      </div>
    </div>

    <!-- 侧边纸页层 -->
    <div class="bx__pages">
      <span v-for="i in 5" :key="i" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.bx {
  position: relative;
  display: flex;
  cursor: pointer;
  border-radius: 5px 7px 7px 5px;
  overflow: hidden;
  background: linear-gradient(150deg, var(--doc-paper), var(--doc-paper-warm));
  border: 1px solid var(--doc-paper-edge);
  box-shadow: var(--doc-shadow-paper);
  transition: transform .26s cubic-bezier(.2, .8, .2, 1), box-shadow .26s;

  &:hover {
    transform: translateY(-5px) rotateY(-3deg);
    box-shadow: var(--doc-shadow-paper-lift);
  }
  &.is-active {
    box-shadow: var(--doc-shadow-paper-lift), 0 0 0 2px color-mix(in srgb, var(--bx-c) 34%, transparent);
    transform: translateY(-3px);
  }
  &.is-out { transform: rotate(-1.6deg); &:hover { transform: translateY(-5px) rotate(-1.6deg); } }

  /* ---- 书脊 ---- */
  &__spine {
    position: relative;
    flex-shrink: 0;
    width: 30px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 7px;
    padding: 10px 0;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--bx-c) 88%, #000),
      var(--bx-c) 22%,
      color-mix(in srgb, var(--bx-c) 76%, #000));
    /* 书脊高光 */
    &::after {
      content: ''; position: absolute; inset: 0 auto 0 4px; width: 1.5px;
      background: rgba(255, 255, 255, .3);
    }
  }

  &__band {
    width: 18px; height: 2px; border-radius: 1px;
    background: var(--doc-gold); opacity: .75;
  }

  &__no {
    writing-mode: vertical-rl;
    font-family: var(--doc-font-song);
    font-size: 10px; font-weight: 700; letter-spacing: 1.4px;
    color: var(--doc-gold-light);
    text-shadow: 0 0 4px rgba(0, 0, 0, .4);
  }

  /* ---- 盒面 ---- */
  &__face {
    flex: 1; min-width: 0;
    padding: 10px 11px 10px 12px;
  }

  &__head { display: flex; align-items: center; gap: 5px; }
  &__tag {
    padding: 1px 7px; border-radius: 3px;
    background: color-mix(in srgb, var(--bx-c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--bx-c) 40%, transparent);
    color: var(--bx-c);
    font-size: 10px; font-weight: 700;
  }
  &__ocr {
    padding: 1px 5px; border-radius: 3px;
    background: var(--doc-gold-light); border: 1px solid var(--doc-gold);
    color: var(--doc-gold); font-size: 9px; font-weight: 800; letter-spacing: .5px;
  }

  &__name {
    margin-top: 7px;
    font-family: var(--doc-font-song);
    font-size: 12.5px; font-weight: 700; color: var(--doc-ink);
    line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 36px;
  }
  &__cf { margin-top: 3px; font-size: 10px; color: var(--doc-ink-faint); }

  &__rows {
    display: flex; gap: 10px; margin-top: 7px;
    padding-top: 6px; border-top: 1px dashed var(--doc-paper-edge);
    font-size: 10px; color: var(--doc-ink-soft);
    b { color: var(--doc-ink); font-size: 12px; }
  }

  &__chk {
    display: flex; align-items: center; gap: 4px;
    margin-top: 7px; padding: 3px 7px; border-radius: 3px;
    font-size: 10px; font-weight: 600;

    &.is-ok { background: var(--zh-success-light); color: var(--zh-success); }
    &.is-no { background: var(--doc-vermilion-bg); color: var(--doc-vermilion); }
    :deep(.el-icon) { font-size: 11px; }
  }

  /* ---- 侧边纸页 ---- */
  &__pages {
    position: absolute; right: 0; top: 8px; bottom: 8px;
    width: var(--bx-th);
    display: flex; flex-direction: column; justify-content: space-evenly;
    background: linear-gradient(90deg, transparent, rgba(236, 229, 213, .8));
    span {
      height: 1px; margin-right: 1px;
      background: var(--doc-paper-line);
    }
  }
}
</style>
