<script setup lang="ts">
import {
  getScoreStats, getScoreList, getScoreDetail, runAiRate, confirmScore
} from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', grade: '', district: '', violationType: '', flaggedOnly: '', page: 1, pageSize: 12 })

const GRADE_TONE: Record<string, string> = { 优秀: 'lime', 良好: 'blue', 合格: 'amber', 不合格: 'red' }
const GRADE_HEX: Record<string, string> = { 优秀: '#12a150', 良好: '#1668dc', 合格: '#d48806', 不合格: '#e5484d' }

async function loadStats() { st.value = await getScoreStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getScoreList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', grade: '', district: '', violationType: '', flaggedOnly: '', page: 1 })
  load()
}
function pickGrade(g: string) {
  q.grade = q.grade === g ? '' : g
  q.page = 1
  load()
}

/* ---------- 评分详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const dLoading = ref(false)

async function openDetail(row: any) {
  drawer.value = true
  dLoading.value = true
  try { cur.value = await getScoreDetail(row.scoreId) } finally { dLoading.value = false }
}

const aiRunning = ref(false)
async function doAiRate() {
  if (!cur.value) return
  aiRunning.value = true
  try {
    const res: any = await runAiRate({ scoreId: cur.value.scoreId })
    msg.success(res.message)
    cur.value = { ...cur.value, aiScore: res.aiScore }
  } finally { aiRunning.value = false }
}

/* ---------- 人工复核 ---------- */
const rvVisible = ref(false)
const rvSaving = ref(false)
const rvForm = ref<any[]>([])

function openReview() {
  if (!cur.value) return
  rvForm.value = cur.value.dimensions.map((d: any) => ({ ...d }))
  rvVisible.value = true
}

const rvTotal = computed(() => rvForm.value.reduce((s, d) => s + Number(d.score || 0), 0))
const rvGrade = computed(() => {
  const t = rvTotal.value
  return t >= 90 ? '优秀' : t >= 80 ? '良好' : t >= 70 ? '合格' : '不合格'
})

async function doConfirm() {
  rvSaving.value = true
  try {
    const res: any = await confirmScore({ scoreId: cur.value.scoreId, dimensions: rvForm.value })
    msg.success(res.message)
    rvVisible.value = false
    cur.value = await getScoreDetail(cur.value.scoreId)
    await Promise.all([loadStats(), load()])
  } finally { rvSaving.value = false }
}

/* ========== 图表 ========== */
const AXIS_DARK = {
  axisLine: { lineStyle: { color: '#cdd7e6' } },
  axisTick: { show: false },
  axisLabel: { color: '#6b7a90', fontSize: 10 },
  splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
}
const TT = {
  backgroundColor: '#ffffff', borderColor: '#e2e8f2',
  textStyle: { color: '#1a2230', fontSize: 11 }
}

/** 分数段直方图（含等级分界背景） */
const histOption = computed(() => {
  const d = st.value?.histogram || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.06)' } }, ...TT,
      formatter: (p: any) => `${p[0].name} 分<br/>${p[0].value} 件案件` },
    grid: { left: 36, right: 12, top: 26, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.range), ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, fontSize: 9 } },
    yAxis: { type: 'value', name: '件', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [{
      type: 'bar', barWidth: '62%',
      itemStyle: {
        borderRadius: [3, 3, 0, 0],
        color: (p: any) => {
          const from = d[p.dataIndex]?.from ?? 0
          return from >= 90 ? '#12a150' : from >= 80 ? '#1668dc' : from >= 70 ? '#d48806' : '#e5484d'
        },
        shadowBlur: 10, shadowColor: 'rgba(22,104,220,.16)'
      },
      label: { show: true, position: 'top', color: '#43516b', fontSize: 9, fontWeight: 700 },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: '#9aa7b8', type: 'dashed', width: 1 },
        label: { color: '#6b7a90', fontSize: 9, formatter: '{b}' },
        data: [
          { xAxis: '65-69', name: '70 合格线' },
          { xAxis: '75-79', name: '80 良好线' },
          { xAxis: '85-89', name: '90 优秀线' }
        ]
      },
      data: d.map((i: any) => i.count)
    }]
  }
})

/** 五维短板雷达（全市平均 vs 满分） */
const dimRadarOption = computed(() => {
  const d = st.value?.dimensionAvg || []
  if (!d.length) return {}
  return {
    tooltip: { ...TT },
    radar: {
      indicator: d.map((x: any) => ({ name: x.dimension, max: 20 })),
      radius: '66%', center: ['50%', '52%'],
      axisName: { color: '#6b7a90', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['rgba(22,104,220,.04)', 'rgba(114,46,209,.05)'] } },
      axisLine: { lineStyle: { color: '#cdd7e6' } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: d.map((x: any) => x.avg), name: '全市平均',
          areaStyle: { color: 'rgba(22,104,220,.15)' },
          lineStyle: { color: '#0891b2', width: 2, shadowColor: '#0891b2', shadowBlur: 10 },
          itemStyle: { color: '#0891b2' },
          label: { show: true, color: '#1a2230', fontSize: 10, fontWeight: 700 }
        },
        {
          value: d.map(() => 20), name: '满分标准',
          areaStyle: { color: 'rgba(22,104,220,.05)' },
          lineStyle: { color: '#9aa7b8', width: 1, type: 'dashed' },
          itemStyle: { color: '#6b7a90' }
        }
      ]
    }]
  }
})

/** 评分趋势（堆叠柱 + 均分折线） */
const trendOption = computed(() => {
  const d = st.value?.scoreTrend || []
  const cs = { excellent: '#12a150', good: '#1668dc', pass: '#d48806', fail: '#e5484d' }
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: {
      data: ['优秀', '良好', '合格', '不合格', '平均分'], top: 0, right: 0,
      itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 }
    },
    grid: { left: 34, right: 40, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'), ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '件', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '分', min: 76, max: 90, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      ...(['excellent', 'good', 'pass', 'fail'] as const).map((k, i) => ({
        name: ['优秀', '良好', '合格', '不合格'][i],
        type: 'bar', stack: 'g', barWidth: 16,
        itemStyle: { color: cs[k], borderRadius: k === 'fail' ? [3, 3, 0, 0] : 0 },
        data: d.map((x: any) => x[k])
      })),
      {
        name: '平均分', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 6,
        lineStyle: { color: '#722ed1', width: 2.4, shadowColor: '#722ed1', shadowBlur: 10 },
        itemStyle: { color: '#722ed1' },
        label: { show: true, color: '#c9a8ff', fontSize: 9, fontWeight: 700 },
        data: d.map((x: any) => x.avgScore)
      }
    ]
  }
})

/** 区县平均分（横条 + 不合格数） */
const districtOption = computed(() => {
  const d = [...(st.value?.byDistrict || [])].sort((a: any, b: any) => a.avgScore - b.avgScore)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `${it.district}<br/>平均分 ${it.avgScore}<br/>案件 ${it.count} 件 · 不合格 ${it.failCount} 件`
      } },
    grid: { left: 8, right: 44, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', min: 70, ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.district), ...AXIS_DARK, splitLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: (p: any) => {
          const v = d[p.dataIndex].avgScore
          return v >= 84 ? '#12a150' : v >= 82 ? '#1668dc' : '#d48806'
        }
      },
      label: { show: true, position: 'right', formatter: '{c}', color: '#43516b', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.avgScore)
    }]
  }
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="viz-page">
    <!-- ============ 页头 ============ -->
    <header class="viz-head">
      <div class="viz-head__t">
        案件质量评分
        <span class="viz-head__sub">五维等权量化 · AI 初评 + 人工复核 · 绩效与复盘联动</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Files /></el-icon>已评 <b>{{ st?.scoreTotal || 0 }}</b> 件</span>
        <span><el-icon><Odometer /></el-icon>均分 <b>{{ st?.avgScore || 0 }}</b></span>
        <span><el-icon><WarnTriangleFilled /></el-icon>自动复盘 <b>{{ st?.autoFlaggedCount || 0 }}</b></span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
    </header>

    <!-- ============ 等级分布卡（可点筛选） ============ -->
    <div class="viz-grid viz-grid--4 gd">
      <div v-for="g in (st?.gradeStandard || [])" :key="g.grade" class="gc"
        :class="[`gc--${GRADE_TONE[g.grade]}`, { 'is-active': q.grade === g.grade }]"
        @click="pickGrade(g.grade)">
        <div class="gc__hd">
          <span class="gc__g">{{ g.grade }}</span>
          <span class="gc__r viz-num">{{ g.min }}{{ g.max === 100 ? '+' : `-${g.max}` }} 分</span>
        </div>
        <div class="gc__v viz-num">
          {{ (st?.gradeDist || []).find((x: any) => x.name === g.grade)?.value || 0 }}
          <small>件</small>
        </div>
        <div class="gc__bar">
          <span :style="{ width: (((st?.gradeDist || []).find((x: any) => x.name === g.grade)?.value || 0) / (st?.scoreTotal || 1)) * 100 + '%' }" />
        </div>
        <div class="gc__h">{{ g.handling }}</div>
      </div>
    </div>

    <!-- ============ 图表区 ============ -->
    <div class="sc-charts">
      <VizPanel title="全市分数段分布" tone="cyan" extra="每 5 分一档 · 含等级分界" glow>
        <EChart :option="histOption" height="228px" />
      </VizPanel>

      <VizPanel title="五维能力短板" tone="violet" extra="全市平均 vs 满分 20" glow>
        <EChart :option="dimRadarOption" height="228px" />
      </VizPanel>

      <VizPanel title="维度失分排行" tone="amber" extra="失分越高越需改进">
        <div class="dl viz-scroll">
          <div v-for="(dm, i) in [...(st?.dimensionAvg || [])].sort((a: any, b: any) => b.lossTotal - a.lossTotal)"
            :key="dm.dimension" class="dm" :style="{ animationDelay: i * 80 + 'ms' }">
            <div class="dm__h">
              <el-icon class="dm__i"><component :is="dm.icon === 'Scale' ? 'Odometer' : dm.icon" /></el-icon>
              <span class="dm__n">{{ dm.dimension }}</span>
              <b class="dm__v viz-num">{{ dm.avg }}<small>/20</small></b>
            </div>
            <div class="dm__track">
              <span class="dm__fill" :style="{ width: dm.rate + '%', '--dc': dm.rate >= 92 ? '#12a150' : dm.rate >= 88 ? '#1668dc' : '#d48806' }" />
            </div>
            <div class="dm__f">
              <span>满分率 <b class="viz-num">{{ dm.perfectRate }}%</b></span>
              <span>累计失分 <b class="viz-num">{{ dm.lossTotal }}</b></span>
            </div>
            <div class="dm__p">{{ dm.points }}</div>
          </div>
        </div>
      </VizPanel>
    </div>

    <div class="sc-charts2">
      <VizPanel title="月度评分趋势" tone="blue" extra="等级构成 + 平均分">
        <EChart :option="trendOption" height="212px" />
      </VizPanel>
      <VizPanel title="各区县质量对比" tone="lime" extra="按平均分升序">
        <EChart :option="districtOption" height="212px" />
      </VizPanel>
    </div>

    <!-- ============ 查询 + 列表 ============ -->
    <VizPanel title="评分记录" tone="cyan" :extra="`共 ${total} 条`">
      <el-form class="viz-form sc-q" :model="q" @submit.prevent>
        <el-input v-model="q.keyword" placeholder="评分ID / 案件号 / 案件名 / 机构" clearable size="small"
          :prefix-icon="'Search'" style="width: 240px" @keyup.enter="doQuery" />
        <el-select v-model="q.grade" placeholder="全部等级" clearable size="small" style="width: 116px">
          <el-option v-for="g in (st?.gradeStandard || [])" :key="g.grade" :label="g.grade" :value="g.grade" />
        </el-select>
        <el-select v-model="q.district" placeholder="全部区县" clearable size="small" style="width: 116px">
          <el-option v-for="dd in (st?.byDistrict || [])" :key="dd.district" :label="dd.district" :value="dd.district" />
        </el-select>
        <el-select v-model="q.flaggedOnly" placeholder="全部案件" clearable size="small" style="width: 138px">
          <el-option label="仅看自动复盘" value="true" />
        </el-select>
        <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="doQuery">查　询</el-button>
        <el-button class="viz-btn" size="small" :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
      </el-form>

      <el-table class="viz-table" :data="list" size="small" border stripe v-loading="loading"
        element-loading-background="rgba(255,255,255,.65)">
        <el-table-column label="排名" width="66" align="center">
          <template #default="{ row }">
            <span class="rk" :class="`is-${row.rank}`">{{ row.rank }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="scoreId" label="评分ID" width="138">
          <template #default="{ row }">
            <span class="viz-link" @click="openDetail(row)">{{ row.scoreId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="caseName" label="案件名称" min-width="230" show-overflow-tooltip />
        <el-table-column label="总分" width="170">
          <template #default="{ row }">
            <div class="tsc">
              <b class="tsc__v viz-num" :style="{ color: GRADE_HEX[row.grade] }">{{ row.totalScore }}</b>
              <span class="tsc__bar">
                <span class="tsc__fill" :style="{ width: row.totalScore + '%', background: GRADE_HEX[row.grade], boxShadow: `0 0 8px ${GRADE_HEX[row.grade]}` }" />
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="grade" label="等级" width="82" align="center">
          <template #default="{ row }">
            <span class="viz-tag viz-tag--solid" :class="`viz-tag--${GRADE_TONE[row.grade]}`">{{ row.grade }}</span>
          </template>
        </el-table-column>
        <el-table-column label="五维得分" width="164">
          <template #default="{ row }">
            <span class="dots">
              <i v-for="(dm, i) in row.dimensions" :key="i"
                :title="`${dm.dimension} ${dm.score}/20`"
                :style="{ '--h': (dm.score / 20) * 100 + '%', '--c': dm.score >= 20 ? '#12a150' : dm.score >= 17 ? '#1668dc' : dm.score >= 14 ? '#d48806' : '#e5484d' }" />
            </span>
          </template>
        </el-table-column>
        <el-table-column label="AI / 人工" width="96" align="center">
          <template #default="{ row }">
            <span class="viz-num viz-mini viz-dim">{{ row.aiScore }} / {{ row.manualScore }}</span>
          </template>
        </el-table-column>
        <el-table-column label="异常" width="112" align="center">
          <template #default="{ row }">
            <span v-if="row.litigationLost" class="viz-tag viz-tag--red">诉讼败诉</span>
            <span v-else-if="row.reconsiderationRevoked" class="viz-tag viz-tag--red">复议撤销</span>
            <span v-else-if="row.appealChanged" class="viz-tag viz-tag--amber">申诉改判</span>
            <span v-else class="viz-faint viz-mini">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="violationType" label="违规类型" width="112" show-overflow-tooltip>
          <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.violationType }}</span></template>
        </el-table-column>
        <el-table-column prop="district" label="区县" width="86" align="center">
          <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.district }}</span></template>
        </el-table-column>
        <el-table-column prop="reviewer" label="复核人" width="112">
          <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.reviewer }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="72" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link :icon="'View'" style="color: var(--viz-cyan)" @click="openDetail(row)">评分</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无符合条件的评分记录</div></template>
      </el-table>

      <div class="viz-pager">
        <span class="viz-pager__c">共 {{ total }} 条 · 优秀 {{ st?.excellentCount }} 件 · 不合格 {{ st?.failCount }} 件</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[12, 24, 48]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </VizPanel>

    <!-- ============ 评分详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="660px" class="viz-drawer" title="案件质量评分详情">
      <template v-if="cur">
        <div v-loading="dLoading" element-loading-background="rgba(255,255,255,.65)">
          <!-- 案件头 -->
          <div class="sh" :class="`sh--${GRADE_TONE[cur.grade]}`">
            <div class="sh__n">{{ cur.caseName }}</div>
            <div class="sh__m">
              <span><el-icon><Ticket /></el-icon>{{ cur.scoreId }}</span>
              <span><el-icon><Folder /></el-icon>{{ cur.caseId }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
              <span><el-icon><Calendar /></el-icon>{{ cur.closeDate }}</span>
            </div>
            <div class="sh__tags">
              <span class="viz-tag viz-tag--faint">{{ cur.orgType }}</span>
              <span class="viz-tag viz-tag--cyan">{{ cur.violationType }}</span>
              <span v-if="cur.appealChanged" class="viz-tag viz-tag--amber">申诉改判</span>
              <span v-if="cur.reconsiderationRevoked" class="viz-tag viz-tag--red">复议撤销</span>
              <span v-if="cur.litigationLost" class="viz-tag viz-tag--red">诉讼败诉</span>
              <span v-if="cur.inExcellentLib" class="viz-tag viz-tag--lime">优秀案例库</span>
            </div>
          </div>

          <!-- 花瓣评分盘 -->
          <div class="viz-sub">五维评分盘<span class="viz-sub__x" /><span class="viz-sub__e">花瓣长度 = 该维得分 / 20</span></div>
          <ScoreDial :total="cur.totalScore" :grade="cur.grade" :dimensions="cur.dimensions"
            :size="290" :avg="cur.avgScore" />

          <!-- 排名定位 -->
          <div class="rkbox">
            <div class="rkbox__i">
              <span class="rkbox__l">同期排名</span>
              <b class="rkbox__v viz-num">{{ cur.rank }}<small>/{{ cur.totalCases }}</small></b>
            </div>
            <div class="rkbox__i">
              <span class="rkbox__l">百分位</span>
              <b class="rkbox__v viz-num">前 {{ (100 - cur.percentile).toFixed(1) }}%</b>
            </div>
            <div class="rkbox__i">
              <span class="rkbox__l">AI 初评</span>
              <b class="rkbox__v viz-num">{{ cur.aiScore }}</b>
            </div>
            <div class="rkbox__i">
              <span class="rkbox__l">人工复核</span>
              <b class="rkbox__v viz-num">{{ cur.manualScore }}</b>
            </div>
          </div>

          <!-- 处置结论 -->
          <div class="hd" :class="`hd--${GRADE_TONE[cur.grade]}`">
            <el-icon><component :is="cur.grade === '不合格' ? 'WarnTriangleFilled' : cur.grade === '优秀' ? 'Trophy' : 'InfoFilled'" /></el-icon>
            <div>
              <b>{{ cur.grade }}（{{ cur.totalScore }} 分）</b>
              <div>{{ cur.handling }}</div>
            </div>
          </div>

          <!-- 逐维扣分 -->
          <div class="viz-sub">逐维得分与扣分理由<span class="viz-sub__x" /></div>
          <div class="dims">
            <div v-for="(dm, i) in cur.dimensions" :key="i" class="di"
              :class="dm.score >= 20 ? 'is-full' : dm.score >= 17 ? 'is-good' : dm.score >= 14 ? 'is-warn' : 'is-bad'">
              <div class="di__h">
                <span class="di__n">{{ dm.dimension }}</span>
                <span class="di__s viz-num">{{ dm.score }}<small>/{{ dm.fullScore }}</small></span>
              </div>
              <div class="di__track"><span :style="{ width: (dm.score / dm.fullScore) * 100 + '%' }" /></div>
              <div v-if="dm.deductionReason" class="di__r">
                <el-icon :size="10"><Minus /></el-icon>{{ dm.deductionReason }}
              </div>
              <div v-else class="di__ok"><el-icon :size="10"><Select /></el-icon>该维度无扣分</div>
            </div>
          </div>

          <!-- 案件金额 -->
          <div class="viz-sub">案件基本情况<span class="viz-sub__x" /></div>
          <el-descriptions class="viz-desc" :column="2" border size="small">
            <el-descriptions-item label="被检机构">{{ cur.orgName }}</el-descriptions-item>
            <el-descriptions-item label="机构类型">{{ cur.orgType }}</el-descriptions-item>
            <el-descriptions-item label="违规金额">
              <span class="viz-num">{{ cur.violationAmount }} 万元</span>
            </el-descriptions-item>
            <el-descriptions-item label="已追回">
              <span class="viz-num" style="color: var(--viz-lime)">{{ cur.recoveredAmount }} 万元</span>
            </el-descriptions-item>
            <el-descriptions-item label="复核人">{{ cur.reviewer }}</el-descriptions-item>
            <el-descriptions-item label="复核时间">
              <span class="viz-num viz-mini">{{ cur.reviewTime }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 联动复盘 -->
          <div v-if="cur.relatedReviewId" class="viz-note">
            <el-icon><Link /></el-icon>
            本案已触发重点复盘（{{ cur.relatedReviewId }}），可在「重点案件复盘」中查看问题剖析与改进措施。
          </div>

          <div class="dr-act">
            <el-button class="viz-btn" :icon="'MagicStick'" :loading="aiRunning" @click="doAiRate">重新 AI 初评</el-button>
            <el-button class="viz-btn is-hot" :icon="'EditPen'" @click="openReview">人工复核评分</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 人工复核弹窗 ============ -->
    <el-dialog v-model="rvVisible" title="人工复核评分" width="620px" class="viz-dialog">
      <el-alert class="viz-alert" type="info" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">五维各 20 分、总分 100 分；&lt;70 分自动进入重点复盘，≥90 分纳入优秀案例库</span>
        </template>
      </el-alert>

      <div class="rv">
        <div v-for="(dm, i) in rvForm" :key="i" class="rv__i">
          <div class="rv__h">
            <span class="rv__n">{{ dm.dimension }}</span>
            <el-input-number v-model="dm.score" :min="0" :max="20" :step="1" size="small"
              :controls="false" style="width: 62px" />
            <span class="viz-faint viz-mini">/ 20</span>
          </div>
          <el-slider v-model="dm.score" :min="0" :max="20" :step="1" size="small" show-stops />
          <el-input v-model="dm.deductionReason" size="small" placeholder="扣分理由（满分可留空）" class="viz-form" />
        </div>
      </div>

      <div class="rv__sum" :class="`is-${GRADE_TONE[rvGrade]}`">
        <span>复核总分</span>
        <b class="viz-num">{{ rvTotal }}</b>
        <span class="viz-tag viz-tag--solid" :class="`viz-tag--${GRADE_TONE[rvGrade]}`">{{ rvGrade }}</span>
        <span v-if="rvTotal < 70" class="rv__warn">
          <el-icon :size="11"><WarnTriangleFilled /></el-icon>将自动推送重点复盘
        </span>
        <span v-else-if="rvTotal >= 90" class="rv__good">
          <el-icon :size="11"><Trophy /></el-icon>将纳入优秀案例库
        </span>
      </div>

      <template #footer>
        <el-button class="viz-btn" @click="rvVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="rvSaving" @click="doConfirm">确认复核结果</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
/* ---------- 等级卡 ---------- */
.gd { margin-bottom: 12px; }

.gc {
  position: relative; cursor: pointer;
  padding: 11px 13px 12px;
  border-radius: 4px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--gcc) 16%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--gcc) 26%, transparent);
  transition: transform .22s, box-shadow .22s, border-color .22s;

  &--lime { --gcc: var(--viz-lime); }
  &--blue { --gcc: var(--viz-blue); }
  &--amber { --gcc: var(--viz-amber); }
  &--red { --gcc: var(--viz-red); }

  &:hover { transform: translateY(-3px); box-shadow: 0 8px 24px -10px color-mix(in srgb, var(--gcc) 50%, transparent); }
  &.is-active {
    border-color: var(--gcc);
    box-shadow: 0 0 0 1px var(--gcc), 0 8px 26px -10px color-mix(in srgb, var(--gcc) 55%, transparent);
  }

  &__hd { display: flex; align-items: center; justify-content: space-between; }
  &__g { font-size: 13px; font-weight: 800; color: var(--gcc); }
  &__r { font-size: 10px; color: var(--viz-text-faint); }

  &__v {
    margin-top: 4px; font-size: 26px; font-weight: 800; color: var(--viz-text); line-height: 1.1;
    small { font-size: 11px; font-weight: 400; color: var(--viz-text-dim); margin-left: 3px; }
  }

  &__bar {
    margin-top: 7px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--gcc); box-shadow: 0 0 8px var(--gcc);
      transition: width .8s cubic-bezier(.22, .8, .3, 1);
    }
  }

  &__h { margin-top: 7px; font-size: 10px; line-height: 1.65; color: var(--viz-text-faint); }
}

/* ---------- 图表布局 ---------- */
.sc-charts {
  display: grid; grid-template-columns: 1.25fr 1fr 1.05fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.sc-charts2 {
  display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

/* ---------- 维度失分列表 ---------- */
.dl { display: flex; flex-direction: column; gap: 8px; max-height: 228px; }

.dm {
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  animation: dmIn .5s cubic-bezier(.2, .9, .3, 1) both;

  &__h { display: flex; align-items: center; gap: 6px; }
  &__i { font-size: 13px; color: var(--viz-cyan); }
  &__n { flex: 1; font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__v {
    font-size: 14px; font-weight: 800; color: var(--viz-text);
    small { font-size: 9px; font-weight: 400; color: var(--viz-text-faint); }
  }

  &__track {
    margin-top: 5px; height: 4px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
  }
  &__fill {
    display: block; height: 100%; border-radius: 2px;
    background: var(--dc); box-shadow: 0 0 8px var(--dc);
    animation: dmGrow .9s cubic-bezier(.22, .8, .3, 1) both;
  }

  &__f {
    display: flex; gap: 14px; margin-top: 5px;
    font-size: 9.5px; color: var(--viz-text-faint);
    b { color: var(--viz-text-dim); }
  }

  &__p { margin-top: 4px; font-size: 9.5px; line-height: 1.6; color: var(--viz-text-faint); }
}

@keyframes dmIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes dmGrow { from { width: 0 !important; } }

/* ---------- 查询条 ---------- */
.sc-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

/* ---------- 表格内评分条 ---------- */
.tsc {
  display: flex; align-items: center; gap: 8px;

  &__v { font-size: 15px; font-weight: 800; min-width: 24px; }
  &__bar {
    flex: 1; height: 4px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
  }
  &__fill { display: block; height: 100%; border-radius: 2px; }
}

/* 五维迷你柱 */
.dots {
  display: inline-flex; align-items: flex-end; gap: 3px; height: 20px;
  i {
    width: 6px; border-radius: 1px;
    height: var(--h); background: var(--c);
    box-shadow: 0 0 6px var(--c);
    transition: height .5s;
  }
}

/* ---------- 抽屉：案件头 ---------- */
.sh {
  padding: 12px 14px; border-radius: 5px;
  background: linear-gradient(130deg, color-mix(in srgb, var(--shc) 18%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--shc) 38%, transparent);

  &--lime { --shc: var(--viz-lime); }
  &--blue { --shc: var(--viz-blue); }
  &--amber { --shc: var(--viz-amber); }
  &--red { --shc: var(--viz-red); }

  &__n { font-size: 15px; font-weight: 700; color: var(--viz-text); line-height: 1.5; }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--shc); }
  }
  &__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
}

/* ---------- 排名盒 ---------- */
.rkbox {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px;

  &__i {
    padding: 7px 4px; text-align: center; border-radius: 4px;
    background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__l { display: block; font-size: 9.5px; color: var(--viz-text-faint); }
  &__v {
    display: block; margin-top: 2px; font-size: 16px; font-weight: 800; color: var(--viz-cyan);
    small { font-size: 9px; font-weight: 400; color: var(--viz-text-faint); }
  }
}

/* ---------- 处置结论 ---------- */
.hd {
  display: flex; align-items: flex-start; gap: 8px; margin-top: 12px;
  padding: 10px 12px; border-radius: 4px;
  background: color-mix(in srgb, var(--hdc) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--hdc) 34%, transparent);

  &--lime { --hdc: var(--viz-lime); }
  &--blue { --hdc: var(--viz-blue); }
  &--amber { --hdc: var(--viz-amber); }
  &--red { --hdc: var(--viz-red); }

  > :deep(.el-icon) { font-size: 17px; color: var(--hdc); flex-shrink: 0; margin-top: 1px; }
  b { font-size: 12px; color: var(--hdc); }
  div > div { margin-top: 3px; font-size: 11px; line-height: 1.7; color: var(--viz-text-dim); }
}

/* ---------- 逐维扣分 ---------- */
.dims { display: flex; flex-direction: column; gap: 7px; }

.di {
  padding: 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--dic);

  &.is-full { --dic: var(--viz-lime); }
  &.is-good { --dic: var(--viz-blue); }
  &.is-warn { --dic: var(--viz-amber); }
  &.is-bad { --dic: var(--viz-red); }

  &__h { display: flex; align-items: center; justify-content: space-between; }
  &__n { font-size: 11.5px; font-weight: 600; color: var(--viz-text); }
  &__s {
    font-size: 14px; font-weight: 800; color: var(--dic);
    small { font-size: 9px; font-weight: 400; color: var(--viz-text-faint); }
  }

  &__track {
    margin-top: 5px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--dic); box-shadow: 0 0 8px var(--dic);
    }
  }

  &__r {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    font-size: 10.5px; line-height: 1.65; color: var(--viz-amber);
    :deep(.el-icon) { flex-shrink: 0; margin-top: 3px; }
  }
  &__ok {
    display: flex; align-items: center; gap: 4px; margin-top: 5px;
    font-size: 10.5px; color: var(--viz-lime);
  }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 复核弹窗 ---------- */
.rv {
  display: flex; flex-direction: column; gap: 10px; margin-top: 12px;

  &__i {
    padding: 8px 10px; border-radius: 4px;
    background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__h { display: flex; align-items: center; gap: 7px; }
  &__n { flex: 1; font-size: 12px; font-weight: 600; color: var(--viz-text); }

  &__sum {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px;
    padding: 10px 12px; border-radius: 4px;
    background: color-mix(in srgb, var(--sumc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sumc) 36%, transparent);
    font-size: 12px; color: var(--viz-text-dim);

    &.is-lime { --sumc: var(--viz-lime); }
    &.is-blue { --sumc: var(--viz-blue); }
    &.is-amber { --sumc: var(--viz-amber); }
    &.is-red { --sumc: var(--viz-red); }

    b { font-size: 24px; font-weight: 800; color: var(--sumc); }
  }

  &__warn, &__good {
    display: inline-flex; align-items: center; gap: 4px; margin-left: auto;
    font-size: 10.5px; font-weight: 600;
  }
  &__warn { color: var(--viz-red); }
  &__good { color: var(--viz-lime); }
}

:deep(.el-slider) {
  --el-slider-main-bg-color: var(--viz-cyan);
  --el-slider-runway-bg-color: var(--zh-border-light);
  --el-slider-stop-bg-color: var(--zh-border-strong);
  margin: 6px 0 7px;
}
:deep(.el-input-number .el-input__inner) { color: var(--viz-text) !important; font-weight: 700; }
</style>
