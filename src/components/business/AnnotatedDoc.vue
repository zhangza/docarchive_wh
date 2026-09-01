<script setup lang="ts">
/**
 * 批注式公文校对纸 —— 左侧公文正文（错误处高亮下划波浪线），右侧批注气泡
 * 用于智能校对页，取代传统"表格列问题"的呈现方式
 */
export interface MarkItem {
  /** 唯一 id */
  id: string
  /** 命中的原文片段（用于在正文中高亮） */
  target: string
  /** 问题等级 */
  level: '错误' | '警告' | '提示'
  /** 问题类型 */
  type: string
  /** 问题描述 */
  desc: string
  /** 修正建议 */
  suggestion?: string
  /** 建议替换后的文本 */
  replaceTo?: string
  /** 是否可一键修正 */
  fixable?: boolean
  /** 是否已修正 */
  fixed?: boolean
}

export interface DocParagraph {
  /** 章节名 */
  title?: string
  /** 段落文本 */
  text: string
}

interface Props {
  /** 公文标题 */
  docTitle: string
  /** 文号 */
  docNo?: string
  /** 主送机关 */
  recipient?: string
  /** 正文段落 */
  paragraphs: DocParagraph[]
  /** 批注清单 */
  marks: MarkItem[]
  /** 当前聚焦的批注 id */
  activeId?: string
}
const props = withDefaults(defineProps<Props>(), { marks: () => [], paragraphs: () => [] })
const emit = defineEmits<{
  (e: 'focus', id: string): void
  (e: 'fix', m: MarkItem): void
  (e: 'ignore', m: MarkItem): void
}>()

const LV_CLS: Record<string, string> = { 错误: 'err', 警告: 'warn', 提示: 'tip' }

/** 把段落文本按 marks.target 切片，命中处包裹标记 */
function slice(text: string) {
  const hits: { start: number; end: number; m: MarkItem }[] = []
  props.marks.forEach((m) => {
    if (!m.target) return
    let from = 0
    // 只标记第一次出现，避免重复标注
    const i = text.indexOf(m.target, from)
    if (i >= 0) hits.push({ start: i, end: i + m.target.length, m })
  })
  hits.sort((a, b) => a.start - b.start)

  const out: { t: string; m?: MarkItem }[] = []
  let pos = 0
  hits.forEach((h) => {
    if (h.start < pos) return // 重叠跳过
    if (h.start > pos) out.push({ t: text.slice(pos, h.start) })
    out.push({ t: text.slice(h.start, h.end), m: h.m })
    pos = h.end
  })
  if (pos < text.length) out.push({ t: text.slice(pos) })
  return out
}

const marksSorted = computed(() => {
  const order = { 错误: 0, 警告: 1, 提示: 2 } as Record<string, number>
  return [...props.marks].sort((a, b) => order[a.level] - order[b.level])
})

const counts = computed(() => ({
  err: props.marks.filter((m) => m.level === '错误' && !m.fixed).length,
  warn: props.marks.filter((m) => m.level === '警告' && !m.fixed).length,
  tip: props.marks.filter((m) => m.level === '提示' && !m.fixed).length,
  fixed: props.marks.filter((m) => m.fixed).length
}))
</script>

<template>
  <div class="an">
    <!-- 计数条 -->
    <div class="an__bar">
      <span class="an__cnt is-err"><b class="num">{{ counts.err }}</b> 错误</span>
      <span class="an__cnt is-warn"><b class="num">{{ counts.warn }}</b> 警告</span>
      <span class="an__cnt is-tip"><b class="num">{{ counts.tip }}</b> 提示</span>
      <span v-if="counts.fixed" class="an__cnt is-ok"><b class="num">{{ counts.fixed }}</b> 已修正</span>
      <span class="an__hint">
        <el-icon><InfoFilled /></el-icon>
        正文中带波浪线处为系统标注，点击可定位到右侧批注
      </span>
    </div>

    <div class="an__grid">
      <!-- ============ 左：公文正文 ============ -->
      <div class="an__paper">
        <div class="pg">
          <div class="pg__redhead">芜湖市医疗保障局</div>
          <div class="pg__title">{{ docTitle }}</div>
          <div v-if="docNo" class="pg__no">{{ docNo }}</div>
          <div class="pg__redline" />
          <div v-if="recipient" class="pg__to">{{ recipient }}：</div>

          <div v-for="(p, pi) in paragraphs" :key="pi" class="pg__sec">
            <div v-if="p.title" class="pg__st">{{ p.title }}</div>
            <p class="pg__p">
              <template v-for="(s, si) in slice(p.text)" :key="si">
                <span v-if="s.m" class="mk"
                  :class="[`is-${LV_CLS[s.m.level]}`, { 'is-active': activeId === s.m.id, 'is-fixed': s.m.fixed }]"
                  @click="emit('focus', s.m.id)">
                  {{ s.m.fixed && s.m.replaceTo ? s.m.replaceTo : s.t }}
                  <span class="mk__badge">{{ s.m.fixed ? '✓' : (s.m.level === '错误' ? '!' : s.m.level === '警告' ? '?' : 'i') }}</span>
                </span>
                <template v-else>{{ s.t }}</template>
              </template>
            </p>
          </div>

          <div class="pg__sign">
            <div>芜湖市医疗保障局</div>
            <div class="pg__date">二〇二六年九月二十日</div>
          </div>
        </div>
      </div>

      <!-- ============ 右：批注栏 ============ -->
      <div class="an__side">
        <div v-for="m in marksSorted" :key="m.id" class="cm"
          :class="[`is-${LV_CLS[m.level]}`, { 'is-active': activeId === m.id, 'is-fixed': m.fixed }]"
          @click="emit('focus', m.id)">
          <span class="cm__tail" />
          <div class="cm__h">
            <span class="cm__lv">{{ m.level }}</span>
            <span class="cm__ty">{{ m.type }}</span>
            <el-icon v-if="m.fixed" class="cm__ok"><CircleCheckFilled /></el-icon>
          </div>
          <div class="cm__t">「{{ m.target }}」</div>
          <div class="cm__d">{{ m.desc }}</div>
          <div v-if="m.suggestion" class="cm__s">
            <el-icon><Opportunity /></el-icon>{{ m.suggestion }}
          </div>
          <div v-if="m.replaceTo" class="cm__rp">
            <span class="cm__old">{{ m.target }}</span>
            <el-icon><Right /></el-icon>
            <span class="cm__new">{{ m.replaceTo }}</span>
          </div>
          <div v-if="!m.fixed" class="cm__a">
            <el-button v-if="m.fixable" size="small" type="primary" plain
              @click.stop="emit('fix', m)">采纳修正</el-button>
            <el-button size="small" plain @click.stop="emit('ignore', m)">忽略</el-button>
          </div>
        </div>

        <EmptyState v-if="!marks.length" text="未发现问题，校对通过" height="140px" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.an {
  &__bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 8px 12px; margin-bottom: 12px;
    border-radius: var(--zh-radius);
    background: var(--doc-paper-warm);
    border: 1px solid var(--doc-paper-edge);
  }

  &__cnt {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; color: var(--doc-ink-soft);
    padding: 2px 9px; border-radius: 20px; background: #fff;
    border: 1px solid var(--doc-paper-edge);
    b { font-size: 14px; font-weight: 800; }

    &.is-err b { color: var(--doc-vermilion); }
    &.is-warn b { color: var(--zh-warning); }
    &.is-tip b { color: var(--zh-primary); }
    &.is-ok b { color: var(--zh-success); }
  }

  &__hint {
    margin-left: auto;
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--doc-ink-faint);
    :deep(.el-icon) { color: var(--zh-primary); }
  }

  &__grid {
    display: grid; grid-template-columns: 1fr 296px; gap: 14px; align-items: start;
    @media (max-width: 1240px) { grid-template-columns: 1fr; }
  }

  &__paper { min-width: 0; }

  &__side {
    display: flex; flex-direction: column; gap: 10px;
    max-height: 620px; overflow-y: auto; padding-right: 3px;
    &::-webkit-scrollbar { width: 5px; }
    &::-webkit-scrollbar-thumb { background: var(--doc-paper-edge); border-radius: 3px; }
  }
}

/* ---------- 公文纸 ---------- */
.pg {
  padding: 34px 42px 30px;
  background: var(--doc-paper);
  border: 1px solid var(--doc-paper-line);
  border-radius: 3px;
  box-shadow: var(--doc-shadow-paper);
  font-family: var(--doc-font-fang);
  /* 竖向装订线 */
  background-image: linear-gradient(90deg, transparent 0 26px, rgba(200, 22, 29, .06) 26px 27px, transparent 27px);

  &__redhead {
    text-align: center;
    font-family: var(--doc-font-song);
    font-size: 22px; font-weight: 700; letter-spacing: 6px;
    color: var(--doc-vermilion);
  }
  &__title {
    text-align: center; margin-top: 14px;
    font-family: var(--doc-font-song);
    font-size: 19px; font-weight: 700; color: var(--doc-ink);
  }
  &__no {
    text-align: center; margin-top: 6px;
    font-size: 12px; color: var(--doc-ink-soft);
  }
  &__redline {
    height: 2px; margin: 12px 0 20px;
    background: var(--doc-vermilion);
  }
  &__to {
    font-size: 14px; color: var(--doc-ink); margin-bottom: 10px; font-weight: 600;
  }
  &__sec + &__sec { margin-top: 14px; }
  &__st {
    font-family: var(--doc-font-hei);
    font-size: 13px; font-weight: 700; color: var(--doc-ink);
    margin-bottom: 5px;
  }
  &__p {
    margin: 0; text-indent: 2em;
    font-size: 13.5px; line-height: 2.15; color: var(--doc-ink);
    text-align: justify;
  }
  &__sign {
    margin-top: 30px; text-align: right;
    font-size: 13px; line-height: 2; color: var(--doc-ink);
  }
  &__date { color: var(--doc-ink-soft); }
}

/* ---------- 正文标注 ---------- */
.mk {
  position: relative;
  cursor: pointer;
  padding: 1px 2px; border-radius: 2px;
  transition: background .18s, box-shadow .18s;
  /* 波浪下划线 */
  text-decoration: underline wavy var(--mk-c);
  text-decoration-thickness: 1.4px;
  text-underline-offset: 3px;

  &.is-err { --mk-c: var(--doc-vermilion); background: rgba(200, 22, 29, .07); }
  &.is-warn { --mk-c: var(--zh-warning); background: rgba(232, 163, 12, .1); }
  &.is-tip { --mk-c: var(--zh-primary); background: rgba(22, 104, 220, .07); }

  &.is-fixed {
    --mk-c: var(--zh-success);
    background: rgba(18, 161, 80, .1);
    text-decoration-style: solid;
    text-decoration-thickness: 1px;
  }

  &:hover { background: color-mix(in srgb, var(--mk-c) 18%, transparent); }

  &.is-active {
    background: color-mix(in srgb, var(--mk-c) 22%, transparent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--mk-c) 34%, transparent);
  }

  &__badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 13px; height: 13px; margin-left: 2px;
    vertical-align: super;
    border-radius: 50%;
    background: var(--mk-c); color: #fff;
    font-family: var(--zh-font); font-size: 8px; font-weight: 800;
    line-height: 1;
  }
}

/* ---------- 批注气泡 ---------- */
.cm {
  position: relative;
  cursor: pointer;
  padding: 9px 11px;
  border-radius: 7px;
  background: #fff;
  border: 1px solid var(--cm-c);
  border-left-width: 3px;
  box-shadow: var(--zh-shadow-xs);
  transition: transform .2s, box-shadow .2s;

  &.is-err { --cm-c: var(--doc-vermilion); }
  &.is-warn { --cm-c: var(--zh-warning); }
  &.is-tip { --cm-c: var(--zh-primary); }
  &.is-fixed { --cm-c: var(--zh-success); background: var(--zh-success-light); }

  &:hover { transform: translateX(-3px); box-shadow: var(--zh-shadow-sm); }
  &.is-active {
    transform: translateX(-5px);
    box-shadow: var(--zh-shadow), 0 0 0 2px color-mix(in srgb, var(--cm-c) 26%, transparent);
  }

  /* 指向正文的小尾巴 */
  &__tail {
    position: absolute; left: -7px; top: 14px;
    width: 10px; height: 10px;
    background: inherit;
    border-left: 1px solid var(--cm-c);
    border-bottom: 1px solid var(--cm-c);
    transform: rotate(45deg);
    @media (max-width: 1240px) { display: none; }
  }

  &__h { display: flex; align-items: center; gap: 6px; }
  &__lv {
    padding: 1px 7px; border-radius: 3px;
    background: var(--cm-c); color: #fff;
    font-size: 10px; font-weight: 700;
  }
  &__ty { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); }
  &__ok { margin-left: auto; color: var(--zh-success); }

  &__t {
    margin-top: 6px;
    font-family: var(--doc-font-fang);
    font-size: 11px; color: var(--cm-c); font-weight: 600;
    word-break: break-all;
  }
  &__d { margin-top: 4px; font-size: 11px; line-height: 1.75; color: var(--zh-text-regular); }
  &__s {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    font-size: 10px; line-height: 1.7; color: var(--zh-primary);
    :deep(.el-icon) { flex-shrink: 0; margin-top: 2px; }
  }
  &__rp {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    margin-top: 6px; padding: 5px 7px; border-radius: 4px;
    background: var(--zh-bg-soft); border: 1px dashed var(--cm-c);
    font-size: 10px;
    :deep(.el-icon) { color: var(--zh-text-placeholder); font-size: 10px; }
  }
  &__old { color: var(--doc-vermilion); text-decoration: line-through; }
  &__new { color: var(--zh-success); font-weight: 700; }

  &__a {
    display: flex; gap: 6px; margin-top: 8px;
    :deep(.el-button) { flex: 1; margin-left: 0 !important; }
    :deep(.el-button--small) { padding: 4px 8px; font-size: 10px; }
  }
}
</style>
