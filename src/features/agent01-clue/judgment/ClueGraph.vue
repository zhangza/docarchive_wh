<script setup lang="ts">
import { getClueGraph } from '@/api/agent01-clue/clue'
import { CHART_COLORS, riskColor } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const DEFAULT_CLUE_ID = 'CL20260829000001'
const clueId = computed(() => (route.params.clueId as string) || DEFAULT_CLUE_ID)

const loading = ref(false)
const graph = ref<any>(null)
const active = ref<any>(null)
const layout = ref<'force' | 'circular'>('force')
const showLabel = ref(true)
const filterCats = ref<string[]>([])
const chartRef = ref<any>(null)

const CAT_ICON: Record<string, string> = {
  线索: 'Files', 参保人: 'User', 机构: 'OfficeBuilding', 医师: 'Avatar',
  药品: 'FirstAidKit', 结算: 'Tickets', 规则: 'SetUp', 项目: 'Cpu'
}

async function load() {
  loading.value = true
  try {
    graph.value = await getClueGraph({ clueId: clueId.value })
    filterCats.value = [...(graph.value?.categories || [])]
    active.value = graph.value?.nodes?.find((n: any) => n.id === graph.value.center) || null
  } finally { loading.value = false }
}
watch(clueId, load)

const catColor = (cat: string) => {
  const cs: string[] = graph.value?.categories || []
  return CHART_COLORS[cs.indexOf(cat) % CHART_COLORS.length]
}

const visibleNodes = computed(() => (graph.value?.nodes || []).filter((n: any) => filterCats.value.includes(n.type)))
const visibleIds = computed(() => new Set(visibleNodes.value.map((n: any) => n.id)))
const visibleLinks = computed(() =>
  (graph.value?.links || []).filter((l: any) => visibleIds.value.has(l.source) && visibleIds.value.has(l.target))
)

const option = computed(() => {
  const cats: string[] = graph.value?.categories || []
  return {
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === 'edge') return `<b>${p.data.label}</b>`
        const d = p.data
        return `<div style="font-weight:700;margin-bottom:3px">${d.rawName}</div>
          <div style="font-size:11px;color:#666">类型：${d.category} · 风险：${d.risk}</div>
          <div style="font-size:11px;color:#666">${d.detail || ''}</div>`
      }
    },
    legend: [{
      data: cats, bottom: 4, itemWidth: 10, itemHeight: 10, itemGap: 14,
      textStyle: { fontSize: 11, color: '#43516b' }, selectedMode: false
    }],
    color: CHART_COLORS,
    series: [{
      type: 'graph',
      layout: layout.value,
      roam: true,
      draggable: layout.value === 'force',
      focusNodeAdjacency: true,
      categories: cats.map((c) => ({ name: c })),
      symbolSize: 44,
      circular: { rotateLabel: true },
      force: { repulsion: 620, edgeLength: [110, 200], gravity: 0.06, layoutAnimation: true },
      label: {
        show: showLabel.value, position: 'bottom', fontSize: 11, fontWeight: 600,
        color: '#1a2230', lineHeight: 14, formatter: (p: any) => p.data.name
      },
      edgeLabel: { show: showLabel.value, fontSize: 9, color: '#8b98ab', formatter: (p: any) => p.data.label },
      edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 7,
      emphasis: { scale: 1.16, label: { fontSize: 12, fontWeight: 700 }, lineStyle: { width: 3 } },
      lineStyle: { color: 'source', width: 1.4, curveness: 0.14, opacity: 0.62 },
      data: visibleNodes.value.map((n: any) => ({
        id: n.id,
        name: n.name,
        rawName: (n.name || '').replace(/\n/g, ' '),
        category: n.type,
        detail: n.detail,
        risk: n.risk,
        value: n.value,
        symbolSize: n.level === 0 ? 66 : n.level === 1 ? 46 : 34,
        itemStyle: {
          color: n.level === 0 ? '#e5484d' : catColor(n.type),
          borderColor: riskColor(n.risk),
          borderWidth: n.risk === '高' ? 3 : 1.6,
          shadowBlur: n.level === 0 ? 18 : 6,
          shadowColor: n.level === 0 ? 'rgba(229,72,77,.5)' : 'rgba(22,104,220,.2)'
        }
      })),
      links: visibleLinks.value.map((l: any) => ({ ...l }))
    }]
  }
})

function onNodeClick(p: any) {
  if (p.dataType === 'edge') return
  const n = (graph.value?.nodes || []).find((x: any) => x.id === p.data.id)
  if (n) active.value = n
}

/** 与当前节点直接相连的关系 */
const relations = computed(() => {
  if (!active.value) return []
  const id = active.value.id
  const nodes: any[] = graph.value?.nodes || []
  const find = (i: string) => nodes.find((n) => n.id === i)
  return (graph.value?.links || [])
    .filter((l: any) => l.source === id || l.target === id)
    .map((l: any) => {
      const other = l.source === id ? l.target : l.source
      return { label: l.label, dir: l.source === id ? 'out' : 'in', node: find(other) }
    })
    .filter((r: any) => r.node)
})

const stat = computed(() => {
  const nodes: any[] = graph.value?.nodes || []
  return {
    node: nodes.length,
    link: (graph.value?.links || []).length,
    high: nodes.filter((n) => n.risk === '高').length,
    clue: nodes.filter((n) => n.type === '线索').length,
    depth: Math.max(0, ...nodes.map((n) => n.level)) 
  }
})

const INSIGHT_TONE: Record<string, { type: any; icon: string; label: string }> = {
  danger: { type: 'error', icon: 'CircleCloseFilled', label: '高危发现' },
  warn: { type: 'warning', icon: 'WarningFilled', label: '风险提示' },
  info: { type: 'info', icon: 'InfoFilled', label: '关联洞察' }
}

function gotoClue(id: string) {
  if (!id.startsWith('CL')) return
  router.push({ name: 'M06', params: { clueId: id } })
}

onMounted(load)
</script>

<template>
  <div class="zh-page" v-loading="loading">
    <PageHeader :title="`关联知识图谱 · ${clueId}`"
      subtitle="以线索为中心构建「参保人-机构-医师-药品-结算-规则」多维关联网络，识别团伙化、系统性违规特征" tag="M07" back>
      <template #actions>
        <el-button :icon="'Document'" @click="router.push({ name: 'M06', params: { clueId } })">返回线索详情</el-button>
        <el-button :icon="'Refresh'" @click="load">重新构建</el-button>
      </template>
    </PageHeader>

    <div class="g-stat">
      <div class="gs"><span class="gs__v num">{{ stat.node }}</span><span class="gs__l">图谱节点</span></div>
      <div class="gs"><span class="gs__v num">{{ stat.link }}</span><span class="gs__l">关联边数</span></div>
      <div class="gs is-danger"><span class="gs__v num">{{ stat.high }}</span><span class="gs__l">高风险节点</span></div>
      <div class="gs is-warn"><span class="gs__v num">{{ stat.clue }}</span><span class="gs__l">关联线索</span></div>
      <div class="gs"><span class="gs__v num">{{ stat.depth }}</span><span class="gs__l">关联层级</span></div>
      <div class="gs-hint">
        <el-icon><MagicStick /></el-icon>
        图谱基于 8 类实体、16 条关系边自动构建，支持拖拽、缩放与节点下钻
      </div>
    </div>

    <div class="main-row">
      <div class="left-col">
        <div class="section-card section-card--tight graph-card">
          <div class="section-title">
            <i class="section-title__dot" />
            <span class="section-title__text">关联网络图</span>
            <span class="section-title__desc">点击节点查看详情 · 滚轮缩放 · 拖拽平移</span>
            <div class="section-title__extra graph-tools">
              <el-radio-group v-model="layout" size="small">
                <el-radio-button value="force">力导布局</el-radio-button>
                <el-radio-button value="circular">环形布局</el-radio-button>
              </el-radio-group>
              <el-switch v-model="showLabel" size="small" active-text="标签" inline-prompt />
            </div>
          </div>

          <div class="cat-filter">
            <span class="cat-filter__label">实体筛选</span>
            <el-checkbox-group v-model="filterCats" size="small">
              <el-checkbox-button v-for="c in graph?.categories || []" :key="c" :value="c">
                <span class="cat-dot" :style="{ background: catColor(c) }" />{{ c }}
              </el-checkbox-button>
            </el-checkbox-group>
          </div>

          <EChart ref="chartRef" :option="option" height="520px" @click="onNodeClick" />
        </div>

        <SectionCard title="图谱智能洞察" desc="AI 基于关联网络拓扑特征自动生成的风险发现" tight>
          <div class="insights">
            <div v-for="(it, i) in graph?.insights || []" :key="i" class="ins" :class="`is-${it.icon}`">
              <div class="ins__icon">
                <el-icon><component :is="INSIGHT_TONE[it.icon]?.icon || 'InfoFilled'" /></el-icon>
              </div>
              <div class="ins__body">
                <span class="ins__label">{{ INSIGHT_TONE[it.icon]?.label || '关联洞察' }}</span>
                <span class="ins__text">{{ it.text }}</span>
              </div>
            </div>
            <EmptyState v-if="!graph?.insights?.length" text="暂无洞察结论" height="120px" />
          </div>
        </SectionCard>
      </div>

      <div class="right-col">
        <SectionCard title="节点详情" desc="当前选中实体的属性与关联" tight>
          <template v-if="active">
            <div class="node-head" :style="{ '--c': catColor(active.type) }">
              <div class="node-head__icon">
                <el-icon :size="20"><component :is="CAT_ICON[active.type] || 'Cpu'" /></el-icon>
              </div>
              <div class="node-head__info">
                <div class="node-head__name">{{ (active.name || '').replace(/\n/g, ' ') }}</div>
                <div class="node-head__tags">
                  <el-tag size="small" effect="light" :style="{ color: catColor(active.type), borderColor: catColor(active.type) }">
                    {{ active.type }}
                  </el-tag>
                  <RiskTag :level="active.risk" size="small" />
                  <el-tag size="small" type="info" effect="plain">L{{ active.level }} 层</el-tag>
                </div>
              </div>
            </div>

            <div class="node-score">
              <span class="ns__label">风险权重</span>
              <el-progress :percentage="active.value" :stroke-width="10" :color="riskColor(active.risk)" />
            </div>

            <el-descriptions :column="1" border size="small" class="node-desc">
              <el-descriptions-item label="实体标识"><span class="num">{{ active.id }}</span></el-descriptions-item>
              <el-descriptions-item label="属性描述">{{ active.detail }}</el-descriptions-item>
            </el-descriptions>

            <el-button v-if="active.id.startsWith('CL') && active.id !== clueId" type="primary" plain size="small"
              :icon="'Right'" class="jump-btn" @click="gotoClue(active.id)">
              下钻查看该关联线索
            </el-button>

            <div class="rel-title">
              <i class="section-title__dot" />
              直接关联 <b>{{ relations.length }}</b> 项
            </div>
            <div class="rel-list">
              <div v-for="(r, i) in relations" :key="i" class="rel" @click="active = r.node">
                <span class="rel__arrow" :class="r.dir">{{ r.dir === 'out' ? '→' : '←' }}</span>
                <span class="rel__label">{{ r.label }}</span>
                <span class="rel__node">
                  <span class="rel-dot" :style="{ background: catColor(r.node.type) }" />
                  {{ (r.node.name || '').replace(/\n/g, ' ') }}
                </span>
                <RiskTag :level="r.node.risk" size="small" />
              </div>
            </div>
          </template>
          <EmptyState v-else text="请在图谱中点击任意节点" desc="查看该实体的属性、风险权重与关联关系" height="260px" />
        </SectionCard>

        <SectionCard title="实体图例" tight flat>
          <div class="legend">
            <div v-for="c in graph?.categories || []" :key="c" class="lg">
              <span class="lg__dot" :style="{ background: catColor(c) }" />
              <el-icon :size="13"><component :is="CAT_ICON[c] || 'Cpu'" /></el-icon>
              <span class="lg__name">{{ c }}</span>
              <span class="lg__count num">{{ (graph?.nodes || []).filter((n: any) => n.type === c).length }}</span>
            </div>
          </div>
          <div class="legend-tip">
            节点大小表示关联层级（核心线索最大），描边颜色表示风险等级（红=高 / 黄=中 / 绿=低）
          </div>
        </SectionCard>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.g-stat {
  display: flex; align-items: center; gap: 0; flex-wrap: wrap;
  padding: 10px 18px; background: var(--zh-bg-card);
  border: 1px solid var(--zh-border); border-radius: var(--zh-radius-lg);
  box-shadow: var(--zh-shadow-xs);
}
.gs {
  display: flex; flex-direction: column; padding: 0 26px 0 0; margin-right: 26px;
  border-right: 1px solid var(--zh-border-light);
  &__v { font-size: 22px; font-weight: 700; color: var(--zh-primary); line-height: 1.2; }
  &__l { font-size: 11px; color: var(--zh-text-secondary); }
  &.is-danger &__v { color: var(--zh-danger); }
  &.is-warn &__v { color: var(--zh-warning); }
}
.gs-hint {
  display: inline-flex; align-items: center; gap: 5px; margin-left: auto;
  font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-accent); }
}

.main-row {
  display: grid; grid-template-columns: 1fr 372px; gap: 12px; align-items: start;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}
.left-col, .right-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.graph-card { background: linear-gradient(180deg, #fbfdff 0%, #fff 100%); }
.graph-tools { display: flex; align-items: center; gap: 10px; }

.cat-filter {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 10px; margin-bottom: 4px;
  background: var(--zh-bg-soft); border-radius: var(--zh-radius);
  &__label { font-size: var(--zh-font-xs); color: var(--zh-text-secondary); font-weight: 600; }
  :deep(.el-checkbox-button__inner) { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
}
.cat-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

.insights { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ins {
  display: flex; gap: 9px; padding: 10px 12px; border-radius: var(--zh-radius);
  border: 1px solid var(--b); background: var(--bg);
  --b: var(--zh-border); --bg: var(--zh-bg-soft); --c: var(--zh-info);
  &.is-danger { --b: var(--zh-risk-high-border); --bg: var(--zh-risk-high-bg); --c: var(--zh-danger); }
  &.is-warn { --b: var(--zh-risk-mid-border); --bg: var(--zh-risk-mid-bg); --c: var(--zh-warning); }
  &.is-info { --b: #bcd6ff; --bg: var(--zh-primary-lighter); --c: var(--zh-primary); }
  &__icon { color: var(--c); flex-shrink: 0; margin-top: 1px; }
  &__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  &__label { font-size: 11px; font-weight: 700; color: var(--c); }
  &__text { font-size: var(--zh-font-xs); color: var(--zh-text-regular); line-height: 1.65; }
  @media (max-width: 1100px) { grid-column: span 1; }
}

.node-head {
  display: flex; gap: 10px; padding: 11px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border-left: 3px solid var(--c);
  &__icon {
    width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--c); color: #fff;
  }
  &__info { min-width: 0; }
  &__name { font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary); line-height: 1.4; }
  &__tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
}
.node-score {
  display: flex; align-items: center; gap: 10px; margin: 12px 0 10px;
  .ns__label { font-size: var(--zh-font-xs); color: var(--zh-text-secondary); flex-shrink: 0; }
  :deep(.el-progress) { flex: 1; }
}
.node-desc { margin-bottom: 10px; }
.jump-btn { width: 100%; margin-bottom: 12px; }

.rel-title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 7px;
  font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary);
  b { color: var(--zh-primary); }
}
.rel-list { display: flex; flex-direction: column; gap: 5px; max-height: 292px; overflow-y: auto; padding-right: 2px; }
.rel {
  display: flex; align-items: center; gap: 7px; cursor: pointer;
  padding: 7px 9px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid transparent;
  transition: all .18s;
  &:hover { background: var(--zh-primary-lighter); border-color: #bcd6ff; transform: translateX(2px); }
  &__arrow {
    font-size: 13px; font-weight: 700; flex-shrink: 0;
    &.out { color: var(--zh-primary); }
    &.in { color: var(--zh-accent); }
  }
  &__label {
    font-size: 10px; padding: 1px 5px; border-radius: 3px; flex-shrink: 0;
    background: #fff; border: 1px solid var(--zh-border); color: var(--zh-text-secondary);
  }
  &__node {
    display: inline-flex; align-items: center; gap: 5px; flex: 1; min-width: 0;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary); font-weight: 600;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
}
.rel-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.lg {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: var(--zh-radius-sm); background: var(--zh-bg-soft);
  font-size: var(--zh-font-xs); color: var(--zh-text-regular);
  &__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  &__name { flex: 1; }
  &__count { font-weight: 700; color: var(--zh-primary); }
  :deep(.el-icon) { color: var(--zh-text-placeholder); }
}
.legend-tip {
  margin-top: 8px; font-size: 11px; line-height: 1.6;
  color: var(--zh-text-placeholder);
}
</style>
