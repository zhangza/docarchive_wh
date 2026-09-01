<script setup lang="ts">
import {
  getMaterialStats, getMaterialList, getMaterialDetail, generateMaterial, reviewMaterial,
  getPushStats, getPushList, getPushDetail, sendPush, toggleSchedule,
  getEduStats, exportEduStats
} from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const activeTab = ref('material')
const mSt = ref<any>(null)
const pSt = ref<any>(null)
const eSt = ref<any>(null)

const ST_TONE: Record<string, string> = {
  已发布: 'lime', 待审核: 'amber', 审核中: 'cyan', 草稿: 'faint', 已驳回: 'red'
}
const END_TONE: Record<string, any> = { 医院端: 'blue', 医保端: 'violet', 公众端: 'cyan' }

/* ================= 3.4.1 宣教素材 ================= */
const mList = ref<any[]>([])
const mTotal = ref(0)
const mLoading = ref(false)
const mQ = reactive({ keyword: '', materialType: '', status: '', audience: '', format: '', page: 1, pageSize: 12 })

async function loadMSt() { mSt.value = await getMaterialStats() }
async function loadM() {
  mLoading.value = true
  try {
    const res: any = await getMaterialList(mQ)
    mList.value = res?.list || []
    mTotal.value = res?.total || 0
  } finally { mLoading.value = false }
}

function pickType(t: string) {
  mQ.materialType = mQ.materialType === t ? '' : t
  mQ.page = 1
  loadM()
}

/* ---------- 素材详情（H5 手机预览） ---------- */
const mDrawer = ref(false)
const curM = ref<any>(null)
const mLoad2 = ref(false)

async function openM(row: any) {
  mDrawer.value = true
  mLoad2.value = true
  try { curM.value = await getMaterialDetail(row.materialId) } finally { mLoad2.value = false }
}

const reviewing = ref(false)
async function doReview(result: string) {
  reviewing.value = true
  try {
    const res: any = await reviewMaterial({ materialId: curM.value.materialId, result })
    msg.success(res.message)
    curM.value = await getMaterialDetail(curM.value.materialId)
    await Promise.all([loadMSt(), loadM()])
  } finally { reviewing.value = false }
}

/* ---------- AI 生成素材 ---------- */
const genVisible = ref(false)
const genRunning = ref(false)
const genRes = ref<any>(null)
const genForm = reactive({ materialType: '典型案例', topic: '' })

async function doGenerate() {
  genRunning.value = true
  genRes.value = null
  try {
    genRes.value = await generateMaterial(genForm)
    msg.success(genRes.value.message)
    await Promise.all([loadMSt(), loadM()])
  } finally { genRunning.value = false }
}

/* ================= 3.4.2 多端推送 ================= */
const pList = ref<any[]>([])
const pTotal = ref(0)
const pLoading = ref(false)
const pQ = reactive({ keyword: '', status: '', end: '', page: 1, pageSize: 8 })

async function loadPSt() { pSt.value = await getPushStats() }
async function loadP() {
  pLoading.value = true
  try {
    const res: any = await getPushList(pQ)
    pList.value = res?.list || []
    pTotal.value = res?.total || 0
    if (!curP.value && pList.value.length) curP.value = await getPushDetail(pList.value[0].pushId)
  } finally { pLoading.value = false }
}

const curP = ref<any>(null)
async function pickPush(row: any) { curP.value = await getPushDetail(row.pushId) }

const sendVisible = ref(false)
const sending = ref(false)
const sendRes = ref<any>(null)
const sendForm = reactive({ ends: ['医院端', '医保端', '公众端'] as string[] })

async function doSend() {
  if (!sendForm.ends.length) { msg.warning('请至少选择一个推送端'); return }
  sending.value = true
  sendRes.value = null
  try {
    sendRes.value = await sendPush(sendForm)
    msg.success(sendRes.value.message)
    await Promise.all([loadPSt(), loadP()])
  } finally { sending.value = false }
}

async function doToggle(s: any) {
  const enabled = s.status !== '已启用'
  const res: any = await toggleSchedule({ id: s.id, enabled })
  msg.success(res.message)
  await loadPSt()
}

/* ================= 3.4.3 效果统计 ================= */
async function loadESt() { eSt.value = await getEduStats() }

const exporting = ref(false)
async function doExportStats() {
  exporting.value = true
  try {
    const res: any = await exportEduStats()
    msg.success(res.message)
  } finally { exporting.value = false }
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
const TONE_HEX: Record<string, string> = {
  cyan: '#0891b2', blue: '#1668dc', violet: '#722ed1', lime: '#12a150',
  amber: '#d48806', pink: '#d43878', red: '#e5484d', faint: '#8290a5'
}

/** 素材类型分布（玫瑰图） */
const mtOption = computed(() => {
  const d = (mSt.value?.typeDist || []).filter((x: any) => x.value > 0)
  return {
    tooltip: { trigger: 'item', ...TT, formatter: '{b}<br/>{c} 份（{d}%）' },
    legend: {
      type: 'scroll', orient: 'vertical', right: 0, top: 'middle',
      itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 }, pageIconColor: '#0891b2'
    },
    series: [{
      type: 'pie', radius: ['32%', '68%'], center: ['32%', '50%'], roseType: 'radius',
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
      label: { show: true, position: 'inside', formatter: '{c}', color: '#1a2230', fontSize: 10, fontWeight: 700 },
      emphasis: { scaleSize: 7, itemStyle: { shadowBlur: 16, shadowColor: 'rgba(22,104,220,.3)' } },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: TONE_HEX[i.tone] || '#1668dc' } }))
    }]
  }
})

/** 素材类型效果（阅读率 vs 评分气泡） */
const mtEffOption = computed(() => {
  const d = eSt.value?.byMaterialType || []
  const max = Math.max(...d.map((x: any) => x.read), 1)
  return {
    tooltip: { ...TT,
      formatter: (p: any) => `${p.data.name}<br/>阅读 ${fmtNum(p.data.value[2])} 次<br/>阅读率 ${(p.data.value[0] * 100).toFixed(1)}%<br/>评分 ${p.data.value[1]}<br/>素材 ${p.data.count} 份 · 推送 ${p.data.pushes} 次` },
    grid: { left: 46, right: 20, top: 22, bottom: 32 },
    xAxis: {
      type: 'value', name: '阅读率', nameLocation: 'middle', nameGap: 20,
      nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK,
      axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => (v * 100).toFixed(0) + '%' }
    },
    yAxis: { type: 'value', name: '平均评分', min: 4, max: 4.9, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [{
      type: 'scatter',
      symbolSize: (v: any) => 14 + (v[2] / max) * 30,
      itemStyle: {
        color: (p: any) => ['#e5484d', '#722ed1', '#d48806', '#1668dc', '#0891b2', '#12a150'][p.dataIndex % 6],
        shadowBlur: 12, shadowColor: 'rgba(22,104,220,.28)', opacity: .86
      },
      label: {
        show: true, formatter: '{b}', position: 'top', distance: 5,
        color: '#43516b', fontSize: 9.5, fontWeight: 600,
        textShadowColor: 'rgba(255,255,255,.9)', textShadowBlur: 4
      },
      data: d.map((i: any) => ({
        name: i.type, value: [i.readRate, i.avgScore, i.read],
        count: i.count, pushes: i.pushes
      }))
    }]
  }
})

/** 渠道效果对比 */
const chOption = computed(() => {
  const d = [...(eSt.value?.byChannel || [])].sort((a: any, b: any) => a.readRate - b.readRate)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[p[0].dataIndex]
        return `${it.channel}<br/>推送 ${it.push} 次<br/>送达 ${fmtNum(it.delivered)}<br/>阅读 ${fmtNum(it.read)}<br/>阅读率 ${(it.readRate * 100).toFixed(1)}%`
      } },
    grid: { left: 8, right: 48, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.channel), ...AXIS_DARK, splitLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: (p: any) => {
          const v = d[p.dataIndex].readRate
          return v >= 0.8 ? '#12a150' : v >= 0.4 ? '#0891b2' : v >= 0.26 ? '#d48806' : '#d43878'
        }
      },
      label: { show: true, position: 'right', formatter: (p: any) => (p.value * 100).toFixed(1) + '%', color: '#43516b', fontSize: 9.5, fontWeight: 700 },
      data: d.map((i: any) => i.readRate)
    }]
  }
})

/** 宣教趋势 */
const trendOption = computed(() => {
  const t = eSt.value?.trend
  if (!t) return {}
  return {
    tooltip: { trigger: 'axis', ...TT },
    legend: { data: ['推送次数', '阅读量', '阅读率', '学习完成率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 48, right: 44, top: 28, bottom: 22 },
    xAxis: { type: 'category', data: t.xAxis, boundaryGap: false, ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '阅读量', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, axisLabel: { ...AXIS_DARK.axisLabel, formatter: (v: number) => (v / 10000) + '万' } },
      { type: 'value', name: '%', min: 0, max: 100, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      { name: '推送次数', type: 'bar', barWidth: 14, yAxisIndex: 1, itemStyle: { color: 'rgba(22,104,220,.3)', borderRadius: [3, 3, 0, 0] }, data: t.pushCount },
      {
        name: '阅读量', type: 'line', smooth: true, symbolSize: 5,
        lineStyle: { color: '#0891b2', width: 2.4, shadowColor: '#0891b2', shadowBlur: 10 }, itemStyle: { color: '#0891b2' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,104,220,.16)' }, { offset: 1, color: 'rgba(22,104,220,.02)' }] } },
        data: t.readCount
      },
      {
        name: '阅读率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5,
        lineStyle: { color: '#d48806', width: 2 }, itemStyle: { color: '#d48806' },
        label: { show: true, formatter: (p: any) => (p.value * 100).toFixed(1), color: '#d48806', fontSize: 9 },
        data: t.readRate.map((v: number) => Number((v * 100).toFixed(1)))
      },
      {
        name: '学习完成率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5,
        lineStyle: { color: '#12a150', width: 2, type: 'dashed' }, itemStyle: { color: '#12a150' },
        data: t.completionRate.map((v: number) => Number((v * 100).toFixed(1)))
      }
    ]
  }
})

/** 学习完成情况（按机构类型） */
const learnOption = computed(() => {
  const d = eSt.value?.learningStats?.byOrgType || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: { data: ['学习完成率', '考试通过率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 8, right: 46, top: 28, bottom: 6, containLabel: true },
    xAxis: { type: 'value', max: 1, ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.type), ...AXIS_DARK, splitLine: { show: false }, inverse: true },
    series: [
      {
        name: '学习完成率', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: '#0891b2' },
        label: { show: true, position: 'right', formatter: (p: any) => (p.value * 100).toFixed(0) + '%', color: '#0891b2', fontSize: 9.5 },
        data: d.map((i: any) => i.completion)
      },
      {
        name: '考试通过率', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: '#12a150' },
        label: { show: true, position: 'right', formatter: (p: any) => (p.value * 100).toFixed(0) + '%', color: '#12a150', fontSize: 9.5 },
        data: d.map((i: any) => i.passRate)
      }
    ]
  }
})

/** 受众偏好词云（自绘） */
const prefMax = computed(() => Math.max(...(eSt.value?.audiencePreference || []).map((x: any) => x.weight), 1))

watch(activeTab, (v) => {
  if (v === 'push' && !pList.value.length) { loadPSt(); loadP() }
  else if (v === 'stats' && !eSt.value) loadESt()
})

onMounted(() => { loadMSt(); loadM() })
</script>

<template>
  <div class="viz-page">
    <header class="viz-head">
      <div class="viz-head__t">
        宣教素材与推送
        <span class="viz-head__sub">AI 生成脱敏素材 · 医院/医保/公众三端精准推送 · 效果闭环统计</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Files /></el-icon>素材 <b>{{ mSt?.materialTotal || 0 }}</b></span>
        <span><el-icon><Promotion /></el-icon>推送 <b>{{ pSt?.pushTotal ?? '—' }}</b></span>
        <span><el-icon><View /></el-icon>阅读 <b>{{ eSt ? fmtNum(eSt.overall.totalRead) : '—' }}</b></span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadMSt(); loadM()">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'MagicStick'"
        @click="genRes = null; genVisible = true">AI 生成素材</el-button>
    </header>

    <el-tabs v-model="activeTab" class="viz-tabs">
      <!-- ================= 素材生成 ================= -->
      <el-tab-pane label="宣教素材生成" name="material">
        <div class="viz-grid viz-grid--4 ed-kpi">
          <VizMetric label="素材总数" :value="mSt?.materialTotal || 0" unit="份" icon="Files" tone="cyan"
            :desc="`已发布 ${mSt?.materialPublished || 0} · 待审 ${mSt?.materialPending || 0}`"
            :progress="mSt?.materialTotal ? (mSt.materialPublished / mSt.materialTotal) * 100 : 0" />
          <VizMetric label="已发布素材" :value="mSt?.materialPublished || 0" unit="份" icon="Promotion" tone="lime"
            desc="全部经脱敏与人工审核" />
          <VizMetric label="累计阅读量" :value="mSt?.totalRead || 0" unit="次" icon="View" tone="violet"
            desc="含三端全渠道阅读" />
          <VizMetric label="素材平均评分" :value="mSt?.avgScore || 0" unit="分" icon="Star" tone="amber" :precision="2"
            desc="5 分制受众评分" :progress="((mSt?.avgScore || 0) / 5) * 100" />
        </div>

        <div class="ed-c1">
          <VizPanel title="素材类型构成" tone="violet" extra="8 类素材" glow>
            <EChart :option="mtOption" height="228px" />
          </VizPanel>

          <VizPanel title="素材类型导航" tone="cyan" extra="点击卡片筛选 · 三端定向">
            <div class="tcards">
              <div v-for="t in (mSt?.typeDist || [])" :key="t.name" class="tc"
                :class="{ 'is-active': mQ.materialType === t.name }"
                :style="{ '--tcc': TONE_HEX[t.tone] || '#1668dc' }" @click="pickType(t.name)">
                <el-icon class="tc__i" :size="15">
                  <component :is="mSt?.typeMeta?.[t.name]?.icon || 'Document'" />
                </el-icon>
                <div class="tc__n">{{ t.name }}</div>
                <div class="tc__v viz-num">{{ t.value }}<small>份</small></div>
                <div class="tc__a">
                  <span v-for="a in (mSt?.typeMeta?.[t.name]?.audience || [])" :key="a" class="tc__ai">
                    {{ a.replace('端', '') }}
                  </span>
                </div>
                <div class="tc__p">{{ mSt?.typeMeta?.[t.name]?.prefix }}</div>
              </div>
            </div>
          </VizPanel>
        </div>

        <VizPanel title="素材库" tone="lime" :extra="`共 ${mTotal} 份`">
          <el-form class="viz-form ed-q" :model="mQ" @submit.prevent>
            <el-input v-model="mQ.keyword" placeholder="素材ID / 名称 / 标题" clearable size="small"
              :prefix-icon="'Search'" style="width: 224px" @keyup.enter="mQ.page = 1; loadM()" />
            <el-select v-model="mQ.materialType" placeholder="全部类型" clearable size="small" style="width: 122px">
              <el-option v-for="t in (mSt?.materialTypes || [])" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="mQ.status" placeholder="全部状态" clearable size="small" style="width: 110px">
              <el-option v-for="s in (mSt?.statusList || [])" :key="s" :label="s" :value="s" />
            </el-select>
            <el-select v-model="mQ.audience" placeholder="全部受众" clearable size="small" style="width: 110px">
              <el-option v-for="a in (mSt?.audiences || [])" :key="a" :label="a" :value="a" />
            </el-select>
            <el-select v-model="mQ.format" placeholder="全部形式" clearable size="small" style="width: 124px">
              <el-option v-for="f in (mSt?.formats || [])" :key="f" :label="f" :value="f" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="mQ.page = 1; loadM()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(mQ, { keyword: '', materialType: '', status: '', audience: '', format: '', page: 1 }); loadM()">重　置</el-button>
          </el-form>

          <el-table class="viz-table" :data="mList" size="small" border stripe v-loading="mLoading"
            element-loading-background="rgba(255,255,255,.65)">
            <el-table-column prop="materialId" label="素材ID" width="146">
              <template #default="{ row }">
                <span class="viz-link" @click="openM(row)">{{ row.materialId }}</span>
              </template>
            </el-table-column>
            <el-table-column label="素材标题" min-width="270" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="viz-tag mr4" :class="`viz-tag--${mSt?.typeMeta?.[row.materialType]?.tone || 'cyan'}`">
                  {{ row.materialType }}
                </span>
                <span>{{ row.content.title.replace(/^【.*?】/, '') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="受众" width="146">
              <template #default="{ row }">
                <span v-for="a in row.audience" :key="a" class="viz-tag mr4"
                  :class="`viz-tag--${END_TONE[a]}`">{{ a.replace('端', '') }}</span>
              </template>
            </el-table-column>
            <el-table-column label="形式" width="106" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--faint">{{ row.format.type }}</span>
              </template>
            </el-table-column>
            <el-table-column label="脱敏" width="72" align="center">
              <template #default="{ row }">
                <span v-if="row.desensitization.applied" class="viz-tag viz-tag--lime">
                  <el-icon :size="9"><Lock /></el-icon>已脱敏
                </span>
              </template>
            </el-table-column>
            <el-table-column label="阅读 / 评分" width="130">
              <template #default="{ row }">
                <template v-if="row.stats.read">
                  <div class="viz-num viz-mini" style="color: var(--viz-cyan)">{{ fmtNum(row.stats.read) }} 次</div>
                  <div class="stars">
                    <el-icon v-for="i in 5" :key="i" :size="8"
                      :style="{ color: i <= Math.round(row.stats.score) ? 'var(--viz-amber)' : 'rgba(143,171,212,.3)' }">
                      <StarFilled />
                    </el-icon>
                    <span class="viz-num">{{ row.stats.score }}</span>
                  </div>
                </template>
                <span v-else class="viz-faint viz-mini">未发布</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="82" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[row.status]}`">{{ row.status }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="generateTime" label="生成时间" width="146">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.generateTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="72" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link :icon="'View'" style="color: var(--viz-cyan)" @click="openM(row)">预览</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无宣教素材</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ mTotal }} 份</span>
            <el-pagination v-model:current-page="mQ.page" v-model:page-size="mQ.pageSize" :total="mTotal"
              :page-sizes="[12, 24, 48]" layout="sizes, prev, pager, next, jumper" small background @change="loadM" />
          </div>
        </VizPanel>
      </el-tab-pane>

      <!-- ================= 多端推送 ================= -->
      <el-tab-pane label="多端分类推送" name="push">
        <div class="viz-grid viz-grid--4 ed-kpi">
          <VizMetric label="推送批次" :value="pSt?.pushTotal || 0" unit="次" icon="Promotion" tone="cyan"
            :desc="`已完成 ${pSt?.pushDone || 0} 次`"
            :progress="pSt?.pushTotal ? (pSt.pushDone / pSt.pushTotal) * 100 : 0" />
          <VizMetric v-for="e in (pSt?.endStat || [])" :key="e.end"
            :label="`${e.end}触达`" :value="e.totalSuccess" unit="人次" :icon="e.icon" :tone="e.tone"
            :desc="`阅读 ${fmtNum(e.totalRead)} · 阅读率 ${(e.avgReadRate * 100).toFixed(1)}%`"
            :progress="e.avgReadRate * 100" />
        </div>

        <!-- 三端设备预览 -->
        <VizPanel title="三端推送内容预览" tone="cyan" extra="医院端 / 医保端 → 机构工作台 · 公众端 → 微信公众号" glow class="ed-dev">
          <div class="devs">
            <DeviceFrame v-for="(t, i) in (curP?.targets || [])" :key="t.end"
              :end="t.end" :variant="t.end === '公众端' ? 'phone' : 'tablet'"
              :tone="END_TONE[t.end]"
              :app-name="t.end === '公众端' ? '芜湖医保公众号' : t.end === '医院端' ? '医保机构服务端' : '医保监管工作台'"
              :items="t.content" :target-count="t.successCount" :read-rate="t.readRate"
              :status="t.pushStatus" />
            <div v-if="!curP" class="viz-empty" style="width: 100%">
              <el-icon><Cellphone /></el-icon>请从下方推送批次中选择一条查看三端内容
            </div>
          </div>
          <div v-if="curP" class="pinfo">
            <span><el-icon :size="11"><Ticket /></el-icon>{{ curP.pushId }}</span>
            <span><el-icon :size="11"><Bell /></el-icon>{{ curP.pushName }}</span>
            <span><el-icon :size="11"><Timer /></el-icon>{{ curP.pushStrategy.timing }}</span>
            <span class="pinfo__sum viz-num">
              触达 {{ fmtNum(curP.summary.totalSuccess) }} · 阅读 {{ fmtNum(curP.summary.totalRead) }}
              · 综合阅读率 {{ (curP.summary.overallReadRate * 100).toFixed(1) }}%
            </span>
          </div>
        </VizPanel>

        <div class="ed-c2">
          <VizPanel title="三端推送策略" tone="violet" extra="按角色 / 机构类型 / 区域精准分发">
            <div class="ends">
              <div v-for="e in (pSt?.ends || [])" :key="e.end" class="en" :class="`en--${e.tone}`">
                <div class="en__h">
                  <el-icon :size="14"><component :is="e.icon" /></el-icon>
                  <b>{{ e.end }}</b>
                  <span class="en__c viz-num">{{ typeof e.targetCount === 'number' ? fmtNum(e.targetCount) : e.targetCount }}</span>
                </div>
                <div class="en__s">{{ e.targetScope }}</div>
                <div class="en__l">
                  <span class="en__ll">内容类型</span>
                  <span v-for="c in e.contentTypes" :key="c" class="viz-tag" :class="`viz-tag--${e.tone}`">{{ c }}</span>
                </div>
                <div class="en__l">
                  <span class="en__ll">推送渠道</span>
                  <span v-for="c in e.channels" :key="c" class="viz-tag viz-tag--faint">{{ c }}</span>
                </div>
                <div class="en__f"><el-icon :size="10"><Filter /></el-icon>{{ e.filter }}</div>
              </div>
            </div>
          </VizPanel>

          <VizPanel title="定时推送任务" tone="amber" :extra="`已启用 ${pSt?.scheduledEnabled || 0}/${pSt?.scheduledTotal || 0}`">
            <div class="schs viz-scroll">
              <div v-for="s in (pSt?.scheduledPushes || [])" :key="s.id" class="sch"
                :class="s.status === '已启用' ? 'is-on' : 'is-off'">
                <div class="sch__h">
                  <span class="sch__id viz-num">{{ s.id }}</span>
                  <b class="sch__n">{{ s.name }}</b>
                  <el-switch :model-value="s.status === '已启用'" size="small" @change="doToggle(s)" />
                </div>
                <div class="sch__m">
                  <span class="viz-tag" :class="`viz-tag--${END_TONE[s.target]}`">{{ s.target }}</span>
                  <span class="viz-tag viz-tag--faint">{{ s.materialType }}</span>
                  <span class="sch__cron viz-num">{{ s.cron }}</span>
                </div>
                <div class="sch__f viz-num">
                  <span><el-icon :size="10"><Timer /></el-icon>{{ s.schedule }}</span>
                  <span v-if="s.nextRun">下次 {{ s.nextRun.slice(5, 16) }}</span>
                  <span>已执行 {{ s.runCount }} 次</span>
                </div>
              </div>
            </div>
          </VizPanel>
        </div>

        <VizPanel title="推送批次记录" tone="lime" :extra="`共 ${pTotal} 次`">
          <el-form class="viz-form ed-q" :model="pQ" @submit.prevent>
            <el-input v-model="pQ.keyword" placeholder="推送ID / 推送名称" clearable size="small"
              :prefix-icon="'Search'" style="width: 218px" @keyup.enter="pQ.page = 1; loadP()" />
            <el-select v-model="pQ.status" placeholder="全部状态" clearable size="small" style="width: 112px">
              <el-option v-for="s in ['推送完成', '推送中', '待推送']" :key="s" :label="s" :value="s" />
            </el-select>
            <el-select v-model="pQ.end" placeholder="全部端" clearable size="small" style="width: 108px">
              <el-option v-for="e in ['医院端', '医保端', '公众端']" :key="e" :label="e" :value="e" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="pQ.page = 1; loadP()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(pQ, { keyword: '', status: '', end: '', page: 1 }); loadP()">重　置</el-button>
            <div style="flex: 1" />
            <el-button class="viz-btn is-hot" size="small" :icon="'Promotion'"
              @click="sendRes = null; sendVisible = true">发起推送</el-button>
          </el-form>

          <el-table class="viz-table" :data="pList" size="small" border stripe v-loading="pLoading"
            element-loading-background="rgba(255,255,255,.65)" highlight-current-row @row-click="pickPush">
            <el-table-column prop="pushId" label="推送ID" width="152">
              <template #default="{ row }">
                <span class="viz-link" @click="pickPush(row)">{{ row.pushId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="pushName" label="推送名称" min-width="230" show-overflow-tooltip />
            <el-table-column label="三端触达" width="200">
              <template #default="{ row }">
                <div class="ebar">
                  <span v-for="t in row.targets" :key="t.end" class="ebar__i"
                    :class="`is-${END_TONE[t.end]}`" :title="`${t.end}：${fmtNum(t.successCount)} 触达 / ${(t.readRate * 100).toFixed(1)}% 阅读率`">
                    <span class="ebar__f" :style="{ width: (t.readRate * 100) + '%' }" />
                  </span>
                </div>
                <div class="ebar__t viz-num">{{ fmtNum(row.summary.totalSuccess) }} 人次</div>
              </template>
            </el-table-column>
            <el-table-column label="阅读率" width="98" align="center">
              <template #default="{ row }">
                <span class="viz-num" :style="{ color: row.summary.overallReadRate >= 0.3 ? 'var(--viz-lime)' : 'var(--viz-amber)', fontWeight: 700 }">
                  {{ (row.summary.overallReadRate * 100).toFixed(1) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column label="素材数" width="80" align="center">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.materials.length }}</span></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="88" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--solid"
                  :class="row.status === '推送完成' ? 'viz-tag--lime' : row.status === '推送中' ? 'viz-tag--cyan' : 'viz-tag--faint'">
                  {{ row.status }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="creator" label="创建人" width="112">
              <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.creator }}</span></template>
            </el-table-column>
            <el-table-column prop="createTime" label="创建时间" width="146">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.createTime }}</span></template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无推送记录</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ pTotal }} 次 · 点击行可在上方预览三端内容</span>
            <el-pagination v-model:current-page="pQ.page" v-model:page-size="pQ.pageSize" :total="pTotal"
              :page-sizes="[8, 16, 32]" layout="sizes, prev, pager, next" small background @change="loadP" />
          </div>
        </VizPanel>
      </el-tab-pane>

      <!-- ================= 效果统计 ================= -->
      <el-tab-pane label="宣教效果统计" name="stats">
        <template v-if="eSt">
          <div class="viz-grid viz-grid--8 ed-kpi">
            <VizMetric label="素材数" :value="eSt.overall.totalMaterials" unit="份" icon="Files" tone="cyan" compact />
            <VizMetric label="推送次数" :value="eSt.overall.totalPushes" unit="次" icon="Promotion" tone="blue" compact />
            <VizMetric label="送达量" :value="eSt.overall.totalDelivered" unit="人次" icon="Message" tone="violet" compact />
            <VizMetric label="阅读量" :value="eSt.overall.totalRead" unit="次" icon="View" tone="lime" compact />
            <VizMetric label="点赞量" :value="eSt.overall.totalLikes" unit="次" icon="Star" tone="amber" compact />
            <VizMetric label="分享量" :value="eSt.overall.totalShares" unit="次" icon="Share" tone="pink" compact />
            <VizMetric label="收藏量" :value="eSt.overall.totalFavorites" unit="次" icon="Collection" tone="cyan" compact />
            <VizMetric label="综合阅读率" :value="eSt.overall.overallReadRate * 100" unit="%" icon="TrendCharts"
              tone="lime" :precision="1" compact />
          </div>

          <!-- 效果评价 -->
          <div class="eff-hero">
            <div class="eff-hero__ring" :style="{ '--p': eSt.effectEvaluation.score + '%' }">
              <b class="viz-num">{{ eSt.effectEvaluation.score }}</b>
              <small>{{ eSt.effectEvaluation.overallEffect }}</small>
            </div>
            <div class="eff-hero__cols">
              <div class="ec ec--lime">
                <div class="ec__h"><el-icon :size="12"><Star /></el-icon>亮点成效</div>
                <div v-for="(h, i) in eSt.effectEvaluation.highlights" :key="i" class="ec__i">
                  <span class="ec__d" />{{ h }}
                </div>
              </div>
              <div class="ec ec--amber">
                <div class="ec__h"><el-icon :size="12"><WarnTriangleFilled /></el-icon>待改进</div>
                <div v-for="(h, i) in eSt.effectEvaluation.improvements" :key="i" class="ec__i">
                  <span class="ec__d" />{{ h }}
                </div>
              </div>
              <div class="ec ec--cyan">
                <div class="ec__h"><el-icon :size="12"><Opportunity /></el-icon>优化建议</div>
                <div v-for="(h, i) in eSt.effectEvaluation.suggestions" :key="i" class="ec__i">
                  <span class="ec__d" />{{ h }}
                </div>
              </div>
            </div>
            <div class="eff-hero__act">
              <el-button class="viz-btn is-hot" size="small" :icon="'Download'" :loading="exporting" @click="doExportStats">
                导出统计报表
              </el-button>
              <div class="eff-hero__m viz-num">{{ eSt.statsPeriod }} · 平均阅读时长 {{ eSt.overall.avgReadTime }}</div>
            </div>
          </div>

          <div class="ed-c3">
            <VizPanel title="素材类型效果气泡图" tone="pink" extra="X 阅读率 · Y 评分 · 气泡=阅读量" glow>
              <EChart :option="mtEffOption" height="230px" />
            </VizPanel>
            <VizPanel title="渠道阅读率对比" tone="cyan" extra="7 个推送渠道" glow>
              <EChart :option="chOption" height="230px" />
            </VizPanel>
          </div>

          <div class="ed-c4">
            <VizPanel title="宣教效果趋势" tone="lime" extra="3-8月 · 四指标" glow>
              <EChart :option="trendOption" height="238px" />
            </VizPanel>
            <VizPanel title="学习与考试情况" tone="blue" extra="按机构类型">
              <EChart :option="learnOption" height="180px" />
              <div class="lstat">
                <div class="ls"><b class="viz-num">{{ fmtNum(eSt.learningStats.totalLearners) }}</b><span>学习人数</span></div>
                <div class="ls is-ok"><b class="viz-num">{{ (eSt.learningStats.completionRate * 100).toFixed(0) }}%</b><span>完成率</span></div>
                <div class="ls is-ok"><b class="viz-num">{{ (eSt.learningStats.examStats.passRate * 100).toFixed(0) }}%</b><span>通过率</span></div>
                <div class="ls is-amber"><b class="viz-num">{{ eSt.learningStats.examStats.avgScore }}</b><span>平均分</span></div>
              </div>
            </VizPanel>
          </div>

          <div class="ed-c5">
            <VizPanel title="热门素材 TOP10" tone="amber" extra="按阅读量排序" glow>
              <div class="hots viz-scroll">
                <div v-for="h in eSt.hotMaterialsTOP10" :key="h.id" class="hot"
                  :class="{ 'is-top': h.rank <= 3 }">
                  <span class="hot__rk" :class="`is-${h.rank}`">{{ h.rank }}</span>
                  <div class="hot__b">
                    <div class="hot__t">{{ h.title }}</div>
                    <div class="hot__m viz-num">
                      <span><el-icon :size="9"><View /></el-icon>{{ fmtNum(h.read) }}</span>
                      <span><el-icon :size="9"><Star /></el-icon>{{ fmtNum(h.likes) }}</span>
                      <span><el-icon :size="9"><Share /></el-icon>{{ fmtNum(h.shares) }}</span>
                      <span class="hot__sc">{{ h.score }} 分</span>
                    </div>
                  </div>
                </div>
              </div>
            </VizPanel>

            <VizPanel title="受众兴趣偏好" tone="violet" extra="字号 = 关注热度" glow>
              <div class="cloud">
                <span v-for="(t, i) in eSt.audiencePreference" :key="t.tag" class="cw"
                  :style="{
                    fontSize: 11 + (t.weight / prefMax) * 11 + 'px',
                    '--cwc': ['#0891b2', '#12a150', '#722ed1', '#d48806', '#d43878', '#1668dc'][i % 6],
                    animationDelay: i * 45 + 'ms'
                  }">
                  {{ t.tag }}<b class="viz-num">{{ t.weight }}</b>
                </span>
              </div>
              <div class="viz-note" style="margin-top: 10px">
                <el-icon><InfoFilled /></el-icon>
                欺诈骗保案例、医保卡使用禁区关注度最高，建议加大典型案例与防骗提示类素材投放比重。
              </div>
            </VizPanel>

            <VizPanel title="三端效果对比" tone="cyan" extra="阅读率 / 学习 / 考试">
              <div class="ecmp">
                <div v-for="e in eSt.byEnd" :key="e.end" class="ee" :class="`ee--${END_TONE[e.end]}`">
                  <div class="ee__h">
                    <b>{{ e.end }}</b>
                    <span class="viz-num">{{ fmtNum(e.delivered) }} 送达</span>
                  </div>
                  <div class="ee__r">
                    <span class="ee__l">阅读率</span>
                    <span class="ee__bar"><span :style="{ width: (e.readRate * 100) + '%' }" /></span>
                    <b class="viz-num">{{ (e.readRate * 100).toFixed(1) }}%</b>
                  </div>
                  <div class="ee__r">
                    <span class="ee__l">学习完成</span>
                    <template v-if="e.learningCompletion !== null">
                      <span class="ee__bar"><span class="is-l" :style="{ width: (e.learningCompletion * 100) + '%' }" /></span>
                      <b class="viz-num">{{ (e.learningCompletion * 100).toFixed(0) }}%</b>
                    </template>
                    <span v-else class="ee__na">公众端不适用</span>
                  </div>
                  <div class="ee__r">
                    <span class="ee__l">考试通过</span>
                    <template v-if="e.examPassRate !== null">
                      <span class="ee__bar"><span class="is-e" :style="{ width: (e.examPassRate * 100) + '%' }" /></span>
                      <b class="viz-num">{{ (e.examPassRate * 100).toFixed(0) }}%</b>
                    </template>
                    <span v-else class="ee__na">公众端不适用</span>
                  </div>
                </div>
              </div>
            </VizPanel>
          </div>
        </template>
        <div v-else class="viz-empty" style="padding: 60px 0">
          <el-icon><Loading /></el-icon>正在加载宣教效果统计…
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 素材详情（H5 预览） ============ -->
    <el-drawer v-model="mDrawer" size="780px" class="viz-drawer" title="宣教素材预览">
      <template v-if="curM">
        <div v-loading="mLoad2" element-loading-background="rgba(255,255,255,.65)">
          <div class="mh" :style="{ '--mhc': TONE_HEX[mSt?.typeMeta?.[curM.materialType]?.tone || 'cyan'] }">
            <div class="mh__top">
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${mSt?.typeMeta?.[curM.materialType]?.tone || 'cyan'}`">
                {{ curM.materialType }}
              </span>
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[curM.status]}`">{{ curM.status }}</span>
              <span class="viz-tag viz-tag--faint">{{ curM.format.type }}</span>
              <span v-if="curM.desensitization.applied" class="viz-tag viz-tag--lime">
                <el-icon :size="9"><Lock /></el-icon>已脱敏
              </span>
            </div>
            <h3 class="mh__t">{{ curM.content.title }}</h3>
            <div class="mh__m">
              <span><el-icon><Ticket /></el-icon>{{ curM.materialId }}</span>
              <span><el-icon><MagicStick /></el-icon>{{ curM.review.aiVersion }}</span>
              <span><el-icon><EditPen /></el-icon>{{ curM.format.wordCount }} 字 · {{ curM.format.images }} 图</span>
              <span><el-icon><Clock /></el-icon>{{ curM.generateTime }}</span>
            </div>
            <div class="mh__aud">
              <span class="mh__al">投放受众</span>
              <span v-for="a in curM.audience" :key="a" class="viz-tag" :class="`viz-tag--${END_TONE[a]}`">{{ a }}</span>
            </div>
          </div>

          <!-- H5 手机预览 + 正文 -->
          <div class="mprev">
            <!-- 手机壳 -->
            <div class="h5">
              <div class="h5__shell">
                <span class="h5__notch" />
                <div class="h5__screen viz-scroll">
                  <div class="h5__hd">
                    <el-icon :size="11"><ArrowLeft /></el-icon>
                    <span>芜湖医保</span>
                    <el-icon :size="11"><MoreFilled /></el-icon>
                  </div>
                  <div class="h5__body">
                    <h4 class="h5__t">{{ curM.content.title }}</h4>
                    <div class="h5__meta">
                      <span>芜湖市医疗保障局</span><span>{{ curM.generateTime?.slice(0, 10) }}</span>
                    </div>
                    <div class="h5__cover">
                      <el-icon :size="24"><Picture /></el-icon>
                      <span>主图 · {{ curM.format.images }} 张</span>
                    </div>
                    <p class="h5__sum">{{ curM.content.summary }}</p>

                    <template v-if="curM.content.caseBackground">
                      <div class="h5__st">案件背景</div>
                      <p class="h5__p">{{ curM.content.caseBackground }}</p>
                    </template>

                    <template v-if="curM.content.violationFacts">
                      <div class="h5__st">违规事实</div>
                      <div v-for="(f, i) in curM.content.violationFacts" :key="i" class="h5__li">
                        <span class="h5__no">{{ i + 1 }}</span>{{ f }}
                      </div>
                    </template>

                    <template v-if="curM.content.handlingResult">
                      <div class="h5__st">处理结果</div>
                      <div class="h5__hr">
                        <div v-for="(v, k) in curM.content.handlingResult" :key="k" class="h5__hri">
                          <el-icon :size="9"><CaretRight /></el-icon>{{ v }}
                        </div>
                      </div>
                    </template>

                    <template v-if="curM.content.legalBasis">
                      <div class="h5__st">法律依据</div>
                      <p class="h5__law">{{ curM.content.legalBasis }}</p>
                    </template>

                    <template v-if="curM.content.caseWarning">
                      <div class="h5__st">案件警示</div>
                      <div v-for="(w, i) in curM.content.caseWarning" :key="i" class="h5__warn">
                        <el-icon :size="10"><WarnTriangleFilled /></el-icon>{{ w }}
                      </div>
                    </template>

                    <template v-if="curM.content.complianceTips">
                      <div class="h5__st">合规提示</div>
                      <div v-for="(t, i) in curM.content.complianceTips" :key="i" class="h5__tip">
                        <el-icon :size="10"><Select /></el-icon>{{ t }}
                      </div>
                    </template>

                    <div class="h5__foot">
                      <div class="h5__acts">
                        <span><el-icon :size="11"><Star /></el-icon>{{ fmtNum(curM.stats.likes) }}</span>
                        <span><el-icon :size="11"><Share /></el-icon>{{ fmtNum(curM.stats.shares) }}</span>
                        <span><el-icon :size="11"><ChatDotRound /></el-icon>{{ fmtNum(curM.stats.comments) }}</span>
                        <span><el-icon :size="11"><Collection /></el-icon>{{ fmtNum(curM.stats.favorites) }}</span>
                      </div>
                      <div class="h5__src">芜湖市医疗保障局 · 医保基金监管</div>
                    </div>
                  </div>
                </div>
                <span class="h5__home" />
              </div>
              <div class="h5__url viz-num" v-if="curM.format.h5Url">{{ curM.format.h5Url }}</div>
            </div>

            <!-- 右侧信息 -->
            <div class="minfo">
              <div class="viz-sub">脱敏处理<span class="viz-sub__x" /></div>
              <div class="desen">
                <div class="dsn">
                  <span class="dsn__l">机构名称</span>
                  <span class="dsn__o">{{ curM.desensitization.originalOrgName }}</span>
                  <el-icon :size="11"><Right /></el-icon>
                  <span class="dsn__n">{{ curM.desensitization.displayOrgName }}</span>
                </div>
                <div class="dsn">
                  <span class="dsn__l">人员姓名</span>
                  <span class="dsn__o">{{ curM.desensitization.originalPersonNames.join('、') }}</span>
                  <el-icon :size="11"><Right /></el-icon>
                  <span class="dsn__n">{{ curM.desensitization.displayPersonNames.join('、') }}</span>
                </div>
                <div class="dsn dsn--rm">
                  <span class="dsn__l">已移除</span>
                  <span v-for="f in curM.desensitization.sensitiveInfoRemoved" :key="f" class="viz-tag viz-tag--red">{{ f }}</span>
                </div>
              </div>

              <div class="viz-sub">审核留痕<span class="viz-sub__x" /></div>
              <el-descriptions class="viz-desc" :column="1" border size="small">
                <el-descriptions-item label="生成方式">{{ curM.generateMode }}</el-descriptions-item>
                <el-descriptions-item label="AI 版本">
                  <span class="viz-num">{{ curM.review.aiVersion }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="审核人">{{ curM.review.reviewer || '未审核' }}</el-descriptions-item>
                <el-descriptions-item label="审核意见">
                  <span :style="{ color: curM.status === '已驳回' ? 'var(--viz-red)' : 'var(--viz-text-dim)' }">
                    {{ curM.review.reviewOpinion || '待审核' }}
                  </span>
                </el-descriptions-item>
              </el-descriptions>

              <div class="viz-sub">审核修改记录<span class="viz-sub__x" /></div>
              <div class="mods">
                <div v-for="(md, i) in curM.review.modifications" :key="i" class="mod">
                  <span class="mod__o">{{ md.original }}</span>
                  <el-icon :size="10"><Right /></el-icon>
                  <span class="mod__n">{{ md.modified }}</span>
                  <span class="mod__r">{{ md.reason }}</span>
                </div>
              </div>

              <template v-if="curM.publishInfo.publishTime">
                <div class="viz-sub">发布渠道<span class="viz-sub__x" /></div>
                <div class="chs">
                  <span v-for="c in curM.publishInfo.channels" :key="c" class="viz-tag viz-tag--cyan">{{ c }}</span>
                </div>
                <div class="mstats">
                  <div class="ms"><b class="viz-num">{{ fmtNum(curM.stats.read) }}</b><span>阅读</span></div>
                  <div class="ms"><b class="viz-num">{{ fmtNum(curM.stats.likes) }}</b><span>点赞</span></div>
                  <div class="ms"><b class="viz-num">{{ fmtNum(curM.stats.shares) }}</b><span>分享</span></div>
                  <div class="ms"><b class="viz-num">{{ curM.stats.score }}</b><span>评分</span></div>
                </div>
              </template>

              <div class="viz-sub">素材标签<span class="viz-sub__x" /></div>
              <div class="chs">
                <span v-for="t in curM.tags" :key="t" class="viz-tag viz-tag--violet">#{{ t }}</span>
              </div>
            </div>
          </div>

          <div class="dr-act">
            <el-button class="viz-btn" :icon="'Link'" @click="msg.info('已复制 H5 链接到剪贴板')">复制 H5 链接</el-button>
            <template v-if="curM.status !== '已发布'">
              <el-button class="viz-btn" :icon="'CircleClose'" :loading="reviewing" @click="doReview('驳回')">驳回</el-button>
              <el-button class="viz-btn is-hot" :icon="'CircleCheck'" :loading="reviewing" @click="doReview('通过')">
                审核通过并发布
              </el-button>
            </template>
            <el-button v-else class="viz-btn is-hot" :icon="'Promotion'"
              @click="mDrawer = false; activeTab = 'push'; loadPSt(); loadP(); sendVisible = true">发起多端推送</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ AI 生成素材 ============ -->
    <el-dialog v-model="genVisible" title="AI 生成宣教素材" width="580px" class="viz-dialog">
      <el-form class="viz-form" label-width="94px">
        <el-form-item label="素材类型" required>
          <el-select v-model="genForm.materialType" style="width: 100%">
            <el-option v-for="t in (mSt?.materialTypes || [])" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="素材主题">
          <el-input v-model="genForm.topic" placeholder="如：串换药品骗医保，药店被解除协议并罚款" />
        </el-form-item>
        <el-form-item label="投放受众">
          <div class="chs">
            <span v-for="a in (mSt?.typeMeta?.[genForm.materialType]?.audience || [])" :key="a"
              class="viz-tag" :class="`viz-tag--${END_TONE[a]}`">{{ a }}</span>
          </div>
        </el-form-item>
        <el-form-item label="生成说明">
          <div class="viz-note">
            <el-icon><InfoFilled /></el-icon>
            AI 将自动生成标题、摘要、正文与合规提示，并对机构名称、人员姓名、详细地址、联系方式、身份证号等
            敏感信息做脱敏处理；生成后进入待审核状态，宣传科审核通过后方可发布推送。
          </div>
        </el-form-item>
        <el-form-item v-if="genRes" label="生成结果">
          <div class="gres">
            <div class="gres__h">
              <el-icon :size="14"><CircleCheckFilled /></el-icon>
              <b>{{ genRes.status }}</b>
              <span class="viz-tag viz-tag--lime">已脱敏</span>
            </div>
            <div class="gres__t">{{ genRes.title }}</div>
            <div class="gres__m viz-num">
              {{ genRes.materialId }} · {{ genRes.wordCount }} 字 · 受众 {{ genRes.audience.join('/') }}
            </div>
            <div class="gres__f">
              <span v-for="f in genRes.desensitizedFields" :key="f" class="viz-tag viz-tag--faint">{{ f }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="genVisible = false">关闭</el-button>
        <el-button class="viz-btn is-hot" :loading="genRunning" :icon="'MagicStick'" @click="doGenerate">
          {{ genRunning ? '生成中…' : '开始生成' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ============ 发起推送 ============ -->
    <el-dialog v-model="sendVisible" title="发起多端分类推送" width="600px" class="viz-dialog">
      <el-alert class="viz-alert" type="info" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">系统按端自动匹配对应类型素材：医院端合规指引、医保端业务培训、公众端防骗提示</span>
        </template>
      </el-alert>
      <el-form class="viz-form" label-width="86px" style="margin-top: 12px">
        <el-form-item label="推送端" required>
          <el-checkbox-group v-model="sendForm.ends">
            <el-checkbox v-for="e in ['医院端', '医保端', '公众端']" :key="e" :value="e" :label="e" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="推送时间">
          <div class="viz-note">
            <el-icon><Timer /></el-icon>
            工作日 15:00-17:00 推送（阅读高峰），支持定时推送、批量推送与按兴趣标签个性化推送。
          </div>
        </el-form-item>
        <el-form-item v-if="sendRes" label="推送结果">
          <div class="sres">
            <div class="sres__h">
              <el-icon :size="14"><CircleCheckFilled /></el-icon>
              <b>{{ sendRes.status }}</b>
              <span class="viz-num viz-mini">{{ sendRes.pushId }}</span>
            </div>
            <div v-for="r in sendRes.results" :key="r.end" class="sres__r">
              <span class="viz-tag" :class="`viz-tag--${END_TONE[r.end]}`">{{ r.end }}</span>
              <span class="viz-num">成功 {{ fmtNum(r.successCount) }}</span>
              <span v-if="r.failCount" class="viz-num" style="color: var(--viz-red)">失败 {{ r.failCount }}</span>
              <span class="sres__ch viz-mini viz-faint">{{ r.channels.join('、') }}</span>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="sendVisible = false">关闭</el-button>
        <el-button class="viz-btn is-hot" :loading="sending" :icon="'Promotion'" @click="doSend">确认推送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mr4 { margin-right: 4px; }
.ed-kpi { margin-bottom: 12px; }
.ed-dev { margin-bottom: 12px; }

.ed-c1 {
  display: grid; grid-template-columns: 1fr 1.6fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}
.ed-c2 {
  display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}
.ed-c3, .ed-c4 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}
.ed-c5 {
  display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px;
  @media (max-width: 1340px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.ed-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

/* ---------- 素材类型卡 ---------- */
.tcards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.tc {
  padding: 9px 8px; border-radius: 4px; text-align: center; cursor: pointer;
  background: color-mix(in srgb, var(--tcc) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--tcc) 24%, transparent);
  transition: all .22s;

  &:hover { transform: translateY(-3px); border-color: var(--tcc); }
  &.is-active {
    background: color-mix(in srgb, var(--tcc) 22%, transparent);
    border-color: var(--tcc);
    box-shadow: 0 0 18px -6px var(--tcc);
  }

  &__i { color: var(--tcc); }
  &__n { margin-top: 3px; font-size: 10.5px; font-weight: 700; color: var(--viz-text); }
  &__v {
    margin-top: 2px; font-size: 17px; font-weight: 800; color: var(--tcc);
    small { font-size: 9px; font-weight: 400; color: var(--viz-text-faint); margin-left: 1px; }
  }
  &__a { display: flex; justify-content: center; gap: 3px; margin-top: 3px; }
  &__ai {
    padding: 0 4px; border-radius: 2px; font-size: 8px;
    color: var(--viz-text-dim); background: var(--zh-border-light);
  }
  &__p { margin-top: 3px; font-size: 8.5px; color: var(--viz-text-faint); }
}

/* ---------- 星级 ---------- */
.stars {
  display: flex; align-items: center; gap: 1px; margin-top: 2px;
  span { margin-left: 3px; font-size: 9px; color: var(--viz-amber); }
}

/* ---------- 三端设备 ---------- */
.devs {
  display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
  padding: 6px 0 4px;
}

.pinfo {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 12px;
  padding: 8px 12px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  font-size: 10.5px; color: var(--viz-text-dim);
  span { display: inline-flex; align-items: center; gap: 4px; }
  :deep(.el-icon) { color: var(--viz-cyan); }
  &__sum { margin-left: auto; color: var(--viz-lime); font-weight: 700; }
}

/* ---------- 三端策略 ---------- */
.ends { display: flex; flex-direction: column; gap: 9px; }

.en {
  padding: 10px 12px; border-radius: 4px;
  background: color-mix(in srgb, var(--enc) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--enc) 26%, transparent);
  border-left: 2px solid var(--enc);

  &--blue { --enc: var(--viz-blue); }
  &--violet { --enc: var(--viz-violet); }
  &--cyan { --enc: var(--viz-cyan); }

  &__h {
    display: flex; align-items: center; gap: 7px;
    :deep(.el-icon) { color: var(--enc); }
    b { font-size: 12.5px; color: var(--viz-text); }
  }
  &__c { margin-left: auto; font-size: 14px; font-weight: 800; color: var(--enc); }
  &__s { margin-top: 4px; font-size: 10px; color: var(--viz-text-faint); }
  &__l {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 6px;
  }
  &__ll { font-size: 9px; color: var(--viz-text-faint); min-width: 48px; }
  &__f {
    display: inline-flex; align-items: center; gap: 4px; margin-top: 7px;
    padding-top: 6px; border-top: 1px dashed color-mix(in srgb, var(--enc) 26%, transparent);
    font-size: 9.5px; color: var(--viz-text-faint);
    font-family: var(--zh-font-mono, monospace);
    :deep(.el-icon) { color: var(--enc); }
  }
}

/* ---------- 定时任务 ---------- */
.schs { display: flex; flex-direction: column; gap: 7px; max-height: 306px; }

.sch {
  padding: 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--scc);

  &.is-on { --scc: var(--viz-lime); }
  &.is-off { --scc: var(--viz-text-faint); opacity: .68; }

  &__h { display: flex; align-items: center; gap: 6px; }
  &__id { font-size: 9.5px; color: var(--scc); font-weight: 700; }
  &__n { flex: 1; font-size: 11px; color: var(--viz-text); }
  &__m { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  &__cron {
    padding: 0 5px; border-radius: 2px; font-size: 9px;
    color: var(--viz-text-faint); background: var(--zh-border-light);
    font-family: var(--zh-font-mono, monospace);
  }
  &__f {
    display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px;
    font-size: 9.5px; color: var(--viz-text-faint);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--scc); }
  }
}

/* ---------- 三端触达条 ---------- */
.ebar {
  display: flex; gap: 3px;
  &__i {
    flex: 1; height: 6px; border-radius: 3px; overflow: hidden;
    background: var(--zh-border-light);
    &.is-blue .ebar__f { background: var(--viz-blue); box-shadow: 0 0 6px var(--viz-blue); }
    &.is-violet .ebar__f { background: var(--viz-violet); box-shadow: 0 0 6px var(--viz-violet); }
    &.is-cyan .ebar__f { background: var(--viz-cyan); box-shadow: 0 0 6px var(--viz-cyan); }
  }
  &__f { display: block; height: 100%; border-radius: 3px; }
  &__t { margin-top: 3px; font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 效果英雄区 ---------- */
.eff-hero {
  display: grid; grid-template-columns: auto 1fr 168px; gap: 18px; align-items: center;
  padding: 14px 18px; margin-bottom: 12px; border-radius: 5px;
  background:
    radial-gradient(560px 200px at 10% 50%, var(--zh-success-light), transparent 66%),
    linear-gradient(120deg, var(--zh-primary-lighter), var(--zh-bg-soft) 58%, rgba(212, 56, 120, .06));
  border: 1px solid var(--zh-risk-low-border);
  @media (max-width: 1300px) { grid-template-columns: auto 1fr; }
  @media (max-width: 860px) { grid-template-columns: 1fr; }

  &__ring {
    width: 112px; height: 112px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: conic-gradient(from -90deg, #12a150 var(--p), var(--zh-border-light) 0);
    position: relative;
    box-shadow: 0 0 36px -12px rgba(18, 161, 80, .3);

    &::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: radial-gradient(circle, #ffffff, #f7faff); }
    b { position: relative; font-size: 34px; font-weight: 800; color: #12a150; }
    small { position: relative; margin-top: 2px; font-size: 10px; color: var(--viz-text-dim); }
  }

  &__cols {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    @media (max-width: 1000px) { grid-template-columns: 1fr; }
  }

  &__act { text-align: center; }
  &__m { margin-top: 8px; font-size: 9.5px; color: var(--viz-text-faint); }
}

.ec {
  padding: 9px 11px; border-radius: 4px;
  background: color-mix(in srgb, var(--ecc) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--ecc) 24%, transparent);

  &--lime { --ecc: var(--viz-lime); }
  &--amber { --ecc: var(--viz-amber); }
  &--cyan { --ecc: var(--viz-cyan); }

  &__h {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 700; color: var(--ecc);
    padding-bottom: 6px; border-bottom: 1px dashed color-mix(in srgb, var(--ecc) 26%, transparent);
  }
  &__i {
    display: flex; align-items: flex-start; gap: 5px; margin-top: 5px;
    font-size: 9.5px; line-height: 1.65; color: var(--viz-text-dim);
  }
  &__d {
    width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
    background: var(--ecc);
  }
}

/* ---------- 学习统计 ---------- */
.lstat {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 9px;
}

.ls {
  padding: 7px 4px; text-align: center; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  b { display: block; font-size: 15px; font-weight: 800; color: var(--viz-cyan); }
  span { font-size: 9px; color: var(--viz-text-faint); }
  &.is-ok b { color: var(--viz-lime); }
  &.is-amber b { color: var(--viz-amber); }
}

/* ---------- 热门素材 ---------- */
.hots { display: flex; flex-direction: column; gap: 6px; max-height: 300px; }

.hot {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  transition: background .2s;
  &:hover { background: var(--zh-primary-lighter); }
  &.is-top { background: var(--zh-warning-light); }

  &__rk {
    width: 19px; height: 19px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; color: #061022;
    background: var(--zh-border-strong);
    &.is-1 { background: linear-gradient(135deg, #ffd66b, #d48806); box-shadow: 0 0 10px rgba(212, 136, 6, .3); }
    &.is-2 { background: linear-gradient(135deg, #dfe9f7, #a9c3e0); }
    &.is-3 { background: linear-gradient(135deg, #f0b98a, #d99055); }
  }
  &__b { flex: 1; min-width: 0; }
  &__t {
    font-size: 10.5px; line-height: 1.5; color: var(--viz-text);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  &__m {
    display: flex; gap: 11px; flex-wrap: wrap; margin-top: 4px;
    font-size: 9px; color: var(--viz-text-faint);
    span { display: inline-flex; align-items: center; gap: 2px; }
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
  &__sc { color: var(--viz-amber) !important; font-weight: 700; }
}

/* ---------- 词云 ---------- */
.cloud {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 6px 2px; min-height: 96px;
}

.cw {
  display: inline-flex; align-items: baseline; gap: 3px;
  padding: 3px 9px; border-radius: 12px;
  font-weight: 700; color: var(--cwc);
  background: color-mix(in srgb, var(--cwc) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--cwc) 26%, transparent);
  animation: cwIn .45s cubic-bezier(.2, .9, .3, 1) both;
  transition: transform .2s;
  b { font-size: 9px; opacity: .72; }
  &:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 0 16px -4px var(--cwc); }
}

@keyframes cwIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }

/* ---------- 三端效果对比 ---------- */
.ecmp { display: flex; flex-direction: column; gap: 9px; }

.ee {
  padding: 9px 11px; border-radius: 4px;
  background: color-mix(in srgb, var(--eec) 9%, transparent);
  border-left: 2px solid var(--eec);

  &--blue { --eec: var(--viz-blue); }
  &--violet { --eec: var(--viz-violet); }
  &--cyan { --eec: var(--viz-cyan); }

  &__h {
    display: flex; align-items: center; justify-content: space-between;
    b { font-size: 11.5px; color: var(--viz-text); }
    span { font-size: 9.5px; color: var(--viz-text-faint); }
  }
  &__r {
    display: grid; grid-template-columns: 54px 1fr 42px;
    align-items: center; gap: 7px; margin-top: 5px;
  }
  &__l { font-size: 9.5px; color: var(--viz-text-faint); }
  &__bar {
    height: 4px; border-radius: 2px; background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--eec); box-shadow: 0 0 6px var(--eec);
      &.is-l { background: var(--viz-cyan); }
      &.is-e { background: var(--viz-lime); }
    }
  }
  b { text-align: right; font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim); }
  &__na { grid-column: 2 / -1; font-size: 9px; color: var(--viz-text-faint); }
}

/* ---------- 素材抽屉头 ---------- */
.mh {
  position: relative; overflow: hidden;
  padding: 14px 16px; border-radius: 5px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--mhc) 16%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--mhc) 32%, transparent);

  &__top { display: flex; gap: 5px; flex-wrap: wrap; }
  &__t {
    margin: 10px 0 0; font-size: 16px; font-weight: 800; line-height: 1.55;
    color: var(--zh-text-primary); letter-spacing: .4px;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 9px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--mhc); }
  }
  &__aud {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 9px;
    padding-top: 8px; border-top: 1px dashed color-mix(in srgb, var(--mhc) 26%, transparent);
  }
  &__al { font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- H5 预览 ---------- */
.mprev {
  display: grid; grid-template-columns: 232px 1fr; gap: 16px; margin-top: 14px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
}

.h5 {
  &__shell {
    position: relative; width: 224px;
    padding: 8px 5px; border-radius: 18px;
    background: var(--zh-bg-card);
    border: 1px solid var(--viz-line-strong);
    box-shadow: 0 12px 28px -16px rgba(22, 104, 220, .3);
  }
  &__notch {
    position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
    width: 46px; height: 3px; border-radius: 2px; background: var(--zh-border-strong);
  }
  &__home {
    display: block; margin: 5px auto 0; width: 54px; height: 3px;
    border-radius: 2px; background: var(--zh-border-strong);
  }
  &__screen {
    border-radius: 11px; overflow-y: auto; max-height: 500px;
    background: #f6f8fb;
  }
  &__hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 9px; background: #fff;
    border-bottom: 1px solid #e8eef6;
    font-size: 10px; font-weight: 600; color: #1a2c52;
    :deep(.el-icon) { color: #6b7a90; }
  }
  &__body { padding: 11px 12px 14px; background: #fff; }
  &__t { margin: 0; font-size: 13px; font-weight: 800; line-height: 1.55; color: #16233a; }
  &__meta {
    display: flex; justify-content: space-between; margin-top: 6px;
    font-size: 8.5px; color: #9aa7b8;
  }
  &__cover {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    margin: 9px 0; padding: 18px 0; border-radius: 5px;
    background: linear-gradient(135deg, #e8f1ff, #f3f8ff);
    border: 1px dashed #c3d8f5;
    :deep(.el-icon) { color: #6ea8f5; }
    span { font-size: 8.5px; color: #7d93b3; }
  }
  &__sum {
    margin: 0; padding: 7px 9px; border-radius: 4px;
    background: #f2f6fc; border-left: 2px solid #1668dc;
    font-size: 9.5px; line-height: 1.85; color: #43516b; text-align: justify;
  }
  &__st {
    margin: 11px 0 5px; padding-left: 6px;
    border-left: 2px solid #e5484d;
    font-size: 10.5px; font-weight: 800; color: #16233a;
  }
  &__p {
    margin: 0; font-size: 9.5px; line-height: 1.9; color: #43516b; text-align: justify; text-indent: 2em;
  }
  &__li {
    display: flex; align-items: flex-start; gap: 5px; margin-top: 5px;
    font-size: 9.5px; line-height: 1.75; color: #43516b;
  }
  &__no {
    width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: #e5484d; color: #fff; font-size: 8px; font-weight: 700;
  }
  &__hr {
    padding: 7px 9px; border-radius: 4px; background: #fff7e6; border: 1px solid #ffdfa0;
  }
  &__hri {
    display: flex; align-items: flex-start; gap: 3px;
    font-size: 9.5px; line-height: 1.75; color: #8a5a00;
    + .h5__hri { margin-top: 3px; }
    :deep(.el-icon) { color: #e8a30c; flex-shrink: 0; margin-top: 3px; }
  }
  &__law {
    margin: 0; padding: 7px 9px; border-radius: 4px;
    background: #f6efff; border-left: 2px solid #722ed1;
    font-size: 9px; line-height: 1.85; color: #4a3170; text-align: justify;
  }
  &__warn, &__tip {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    font-size: 9.5px; line-height: 1.75;
  }
  &__warn { color: #a13a3d; :deep(.el-icon) { color: #e5484d; flex-shrink: 0; margin-top: 3px; } }
  &__tip { color: #0d6b3a; :deep(.el-icon) { color: #12a150; flex-shrink: 0; margin-top: 3px; } }

  &__foot {
    margin-top: 13px; padding-top: 9px; border-top: 1px solid #e8eef6;
  }
  &__acts {
    display: flex; justify-content: space-around;
    span {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 9px; color: #6b7a90;
    }
    :deep(.el-icon) { color: #1668dc; }
  }
  &__src { margin-top: 8px; text-align: center; font-size: 8px; color: #9aa7b8; }

  &__url {
    margin-top: 8px; padding: 5px 7px; border-radius: 3px;
    background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
    font-size: 8.5px; color: var(--viz-cyan); word-break: break-all; text-align: center;
  }
}

/* ---------- 脱敏 ---------- */
.desen { display: flex; flex-direction: column; gap: 6px; }

.dsn {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  font-size: 10.5px;

  &__l { min-width: 54px; font-size: 9.5px; color: var(--viz-text-faint); }
  &__o { color: var(--viz-text-faint); text-decoration: line-through; }
  &__n { color: var(--viz-lime); font-weight: 700; }
  :deep(.el-icon) { color: var(--viz-cyan); }
  &--rm { gap: 5px; }
}

/* ---------- 修改记录 ---------- */
.mods { display: flex; flex-direction: column; gap: 5px; }

.mod {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 9px; border-radius: 4px;
  background: rgba(255, 184, 56, .07);
  border: 1px solid rgba(255, 184, 56, .2);
  font-size: 10px;

  &__o { color: var(--viz-text-faint); text-decoration: line-through; }
  &__n { color: var(--viz-lime); font-weight: 700; }
  &__r { margin-left: auto; font-size: 9px; color: var(--viz-amber); }
  :deep(.el-icon) { color: var(--viz-text-faint); }
}

.chs { display: flex; flex-wrap: wrap; gap: 5px; }

.mstats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 9px;
}

.ms {
  padding: 7px 4px; text-align: center; border-radius: 4px;
  background: var(--zh-primary-lighter);
  border: 1px solid var(--zh-primary-light);
  b { display: block; font-size: 14px; font-weight: 800; color: var(--viz-cyan); }
  span { font-size: 9px; color: var(--viz-text-faint); }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 生成 / 推送结果 ---------- */
.gres, .sres {
  width: 100%; padding: 10px 12px; border-radius: 4px;
  background: rgba(76, 245, 168, .1);
  border: 1px solid rgba(76, 245, 168, .3);

  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-lime); }
    b { color: var(--viz-lime); }
  }
  &__t { margin-top: 7px; font-size: 11.5px; font-weight: 700; color: var(--viz-text); line-height: 1.6; }
  &__m { margin-top: 5px; font-size: 9.5px; color: var(--viz-text-faint); }
  &__f { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  &__r {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 7px;
    font-size: 10.5px; color: var(--viz-text-dim);
  }
  &__ch { margin-left: auto; }
}

:deep(.el-switch) {
  --el-switch-on-color: var(--viz-lime);
  --el-switch-off-color: var(--zh-border-strong);
}
</style>
