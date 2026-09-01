<script setup lang="ts">
interface Row {
  field: string
  left: string | number
  right: string | number
  diff: boolean
  gap?: string | number
}
interface Side {
  title: string
  source?: string
  time?: string
  no?: string
}
interface Props {
  left: Side
  right: Side
  rows: Row[]
  compact?: boolean
}
const props = withDefaults(defineProps<Props>(), { compact: false })
const diffCount = computed(() => props.rows.filter((r) => r.diff).length)
</script>

<template>
  <div class="diff-table" :class="{ 'is-compact': compact }">
    <div class="diff-table__head">
      <div class="diff-table__col diff-table__col--field">比对字段</div>
      <div class="diff-table__col diff-table__col--left">
        <div class="diff-table__side-title">{{ left.title }}</div>
        <div class="diff-table__side-meta">
          <span v-if="left.source">{{ left.source }}</span>
          <span v-if="left.no" class="num">{{ left.no }}</span>
          <span v-if="left.time" class="num">{{ left.time }}</span>
        </div>
      </div>
      <div class="diff-table__col diff-table__col--right">
        <div class="diff-table__side-title">{{ right.title }}</div>
        <div class="diff-table__side-meta">
          <span v-if="right.source">{{ right.source }}</span>
          <span v-if="right.no" class="num">{{ right.no }}</span>
          <span v-if="right.time" class="num">{{ right.time }}</span>
        </div>
      </div>
      <div class="diff-table__col diff-table__col--gap">差异</div>
    </div>

    <div class="diff-table__body">
      <div v-for="(r, i) in rows" :key="i" class="diff-table__row" :class="{ 'is-diff': r.diff }">
        <div class="diff-table__col diff-table__col--field">{{ r.field }}</div>
        <div class="diff-table__col diff-table__col--left">{{ r.left }}</div>
        <div class="diff-table__col diff-table__col--right" :class="{ 'is-hl': r.diff }">{{ r.right }}</div>
        <div class="diff-table__col diff-table__col--gap">
          <span v-if="r.diff" class="diff-table__badge">{{ r.gap ?? '不一致' }}</span>
          <span v-else class="diff-table__ok">一致</span>
        </div>
      </div>
    </div>

    <div class="diff-table__foot">
      共比对 <b class="num">{{ rows.length }}</b> 项字段，发现
      <b class="num diff-table__foot-num">{{ diffCount }}</b> 项差异
    </div>
  </div>
</template>

<style scoped lang="scss">
.diff-table {
  border: 1px solid var(--zh-border);
  border-radius: var(--zh-radius);
  overflow: hidden;
  font-size: var(--zh-font-sm);

  &__head {
    display: flex;
    background: linear-gradient(180deg, #f6f9fe 0%, #eef4fc 100%);
    border-bottom: 1px solid var(--zh-border);
    align-items: stretch;
  }

  &__row {
    display: flex;
    border-bottom: 1px solid var(--zh-border-light);
    align-items: stretch;
    transition: background .18s;
    &:last-child { border-bottom: none; }
    &:hover { background: var(--zh-bg-hover); }
    &.is-diff { background: #fff8f8; &:hover { background: #fff1f1; } }
  }

  &__col {
    padding: 9px 12px;
    display: flex;
    align-items: center;
    min-width: 0;
    word-break: break-all;

    &--field { width: 168px; flex-shrink: 0; color: var(--zh-text-secondary); font-weight: 500; background: var(--zh-bg-soft); }
    &--left, &--right { flex: 1; flex-direction: column; align-items: flex-start; justify-content: center; gap: 2px; }
    &--right { border-left: 1px dashed var(--zh-border); }
    &--gap { width: 118px; flex-shrink: 0; justify-content: center; border-left: 1px dashed var(--zh-border); }
  }

  &__head &__col--field,
  &__head &__col--gap { color: var(--zh-text-secondary); font-weight: 600; font-size: var(--zh-font-xs); background: transparent; }

  &__side-title { font-weight: 700; color: var(--zh-text-primary); font-size: var(--zh-font-sm); }
  &__side-meta {
    display: flex; flex-wrap: wrap; gap: 8px;
    font-size: 11px; color: var(--zh-text-placeholder);
  }

  &__col--right.is-hl { color: var(--zh-danger); font-weight: 700; }

  &__badge {
    padding: 1px 7px;
    border-radius: var(--zh-radius-sm);
    background: var(--zh-danger-light);
    color: var(--zh-danger);
    border: 1px solid #ffccc7;
    font-size: 11px;
    font-weight: 700;
    font-family: var(--zh-font-num);
    white-space: nowrap;
  }
  &__ok { font-size: 11px; color: var(--zh-text-placeholder); }

  &__foot {
    padding: 8px 12px;
    background: var(--zh-bg-soft);
    border-top: 1px solid var(--zh-border);
    font-size: var(--zh-font-xs);
    color: var(--zh-text-secondary);
    b { font-family: var(--zh-font-num); color: var(--zh-text-primary); }
    &-num { color: var(--zh-danger) !important; }
  }

  &.is-compact &__col { padding: 6px 10px; }
}
</style>
