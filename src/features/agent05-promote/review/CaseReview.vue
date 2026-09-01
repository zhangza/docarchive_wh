<script setup lang="ts">
import {
  getReviewStats, getReviewList, getReviewDetail, createReview,
  updateMeasure, getMeasures, getLessons
} from '@/api/agent05-promote/promote'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('review')

const TRIGGER_TONE: Record<string, string> = {
  '质量评分<70分': 'red', 申诉改判: 'amber', '复议撤销/变更': 'red',
  诉讼败诉: 'red', 社会影响大: 'violet', 新型违规首例: 'blue', 指定复盘: 'faint'
}
const SEV_TONE: Record<string, string> = { 高: 'red', 中: 'amber', 低: 'blue' }
const CAT_TONE: Record<string, string> = {
  定性: 'violet', 证据: 'cyan', 程序: 'amber', 文书: 'blue', 处置: 'pink'
}
const ST_TONE: Record<string, string> = { 已完成: 'lime', 进行中: 'cyan', 未开始: 'faint' }
const RV_TONE: Record<string, string> = { 已闭环: 'lime', 整改中: 'cyan', 待启动: 'amber' }

async function loadStats() { st.value = await getReviewStats() }

/* ================= 复盘列表 ================= */
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', status: '', trigger: '', grade: '', page: 1, pageSize: 10 })

async function load() {
  loading.value = true
  try {
    const res: any = await getReviewList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', status: '', trigger: '', grade: '', page: 1 })
  load()
}

/* ---------- 复盘详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const dLoading = ref(false)
const stepIdx = ref(0)

const FIVE_STEPS = [
  { name: '案件回顾', icon: 'Document', desc: '还原案件全流程与处置结果' },
  { name: '问题剖析', icon: 'Search', desc: '逐项定位定性/证据/程序/文书/处置问题' },
  { name: '原因分析', icon: 'Share', desc: '归因至制度、流程、人员、技术四类' },
  { name: '改进措施', icon: 'Tools', desc: '明确责任部门与完成时限' },
  { name: '经验教训', icon: 'Star', desc: '提炼可复用经验，纳入培训素材库' }
]

async function openDetail(row: any) {
  drawer.value = true
  dLoading.value = true
  stepIdx.value = 0
  try { cur.value = await getReviewDetail(row.reviewId) } finally { dLoading.value = false }
}

/* ---------- 新建复盘 ---------- */
const crVisible = ref(false)
const crRunning = ref(false)
const crForm = reactive({ caseId: '', reviewType: '重点复盘（指定复盘）' })

async function doCreate() {
  if (!crForm.caseId.trim()) { msg.warning('请填写案件编号'); return }
  crRunning.value = true
  try {
    const res: any = await createReview(crForm)
    msg.success(`${res.message}（问题 ${res.problemCount} 项 / 措施 ${res.measureCount} 项 / 经验 ${res.lessonCount} 条）`)
    crVisible.value = false
    await Promise.all([loadStats(), load()])
  } finally { crRunning.value = false }
}

/* ---------- 措施进度更新 ---------- */
const mpVisible = ref(false)
const mpSaving = ref(false)
const mpForm = reactive({ reviewId: '', measureId: '', measure: '', progress: 0 })

function openProgress(m: any, reviewId: string) {
  Object.assign(mpForm, { reviewId, measureId: m.id, measure: m.measure, progress: m.progress })
  mpVisible.value = true
}

async function doUpdateProgress() {
  mpSaving.value = true
  try {
    const res: any = await updateMeasure(mpForm)
    msg.success(res.message)
    mpVisible.value = false
    if (cur.value) cur.value = await getReviewDetail(cur.value.reviewId)
    await Promise.all([loadStats(), loadMeasures()])
  } finally { mpSaving.value = false }
}

/* ================= 措施看板 ================= */
const mList = ref<any[]>([])
const mTotal = ref(0)
const mLoading = ref(false)
const mDeptStat = ref<any[]>([])
const mQ = reactive({ keyword: '', status: '', dept: '', priority: '', page: 1, pageSize: 12 })

async function loadMeasures() {
  mLoading.value = true
  try {
    const res: any = await getMeasures(mQ)
    mList.value = res?.list || []
    mTotal.value = res?.total || 0
    mDeptStat.value = res?.deptStat || []
  } finally { mLoading.value = false }
}

/* ================= 经验教训墙 ================= */
const lList = ref<any[]>([])
const lTotal = ref(0)
const lLoading = ref(false)
const lTags = ref<any[]>([])
const lQ = reactive({ keyword: '', tag: '', inLibOnly: '', page: 1, pageSize: 12 })

async function loadLessons() {
  lLoading.value = true
  try {
    const res: any = await getLessons(lQ)
    lList.value = res?.list || []
    lTotal.value = res?.total || 0
    lTags.value = res?.tags || []
  } finally { lLoading.value = false }
}

function pickTag(t: string) {
  lQ.tag = lQ.tag === t ? '' : t
  lQ.page = 1
  loadLessons()
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

/** 问题分类 × 严重程度 堆叠柱 */
const matrixOption = computed(() => {
  const d = st.value?.problemMatrix || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: { data: ['高', '中', '低'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 34, right: 12, top: 26, bottom: 22 },
    xAxis: { type: 'category', data: d.map((i: any) => i.category), ...AXIS_DARK },
    yAxis: { type: 'value', name: '项', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    series: [
      { name: '高', type: 'bar', stack: 'p', barWidth: 22, itemStyle: { color: '#e5484d' }, data: d.map((i: any) => i.high) },
      { name: '中', type: 'bar', stack: 'p', itemStyle: { color: '#d48806' }, data: d.map((i: any) => i.medium) },
      { name: '低', type: 'bar', stack: 'p', itemStyle: { color: '#1668dc', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.low) }
    ]
  }
})

/** 触发条件分布（横条） */
const triggerOption = computed(() => {
  const d = [...(st.value?.triggerDist || [])].filter((x: any) => x.value > 0).sort((a: any, b: any) => a.value - b.value)
  const HEX: Record<string, string> = {
    red: '#e5484d', amber: '#d48806', violet: '#722ed1', blue: '#1668dc',
    faint: '#8290a5', primary: '#1668dc', danger: '#e5484d', warning: '#d48806', info: '#8290a5', purple: '#722ed1'
  }
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: d.map((i: any) => i.name), ...AXIS_DARK, splitLine: { show: false } },
    series: [{
      type: 'bar', barWidth: 12,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: (p: any) => HEX[d[p.dataIndex].tone] || '#1668dc'
      },
      label: { show: true, position: 'right', color: '#43516b', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.value)
    }]
  }
})

/** 部门措施完成度（雷达） */
const deptOption = computed(() => {
  const d = mDeptStat.value.filter((x) => x.total > 0)
  if (!d.length) return {}
  return {
    tooltip: { ...TT },
    radar: {
      indicator: d.map((x) => ({ name: x.dept.length > 8 ? x.dept.slice(0, 8) + '…' : x.dept, max: 100 })),
      radius: '62%', center: ['50%', '54%'],
      axisName: { color: '#6b7a90', fontSize: 9.5 },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['rgba(22,104,220,.04)', 'rgba(114,46,209,.05)'] } },
      axisLine: { lineStyle: { color: '#cdd7e6' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: d.map((x) => x.avgProgress), name: '平均进度',
        areaStyle: { color: 'rgba(76,245,168,.24)' },
        lineStyle: { color: '#12a150', width: 2, shadowColor: '#12a150', shadowBlur: 10 },
        itemStyle: { color: '#12a150' },
        label: { show: true, color: '#1a2230', fontSize: 9.5, fontWeight: 700, formatter: '{c}%' }
      }]
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'measure' && !mList.value.length) loadMeasures()
  else if (v === 'lesson' && !lList.value.length) loadLessons()
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="viz-page">
    <!-- ============ 页头 ============ -->
    <header class="viz-head">
      <div class="viz-head__t">
        重点案件复盘
        <span class="viz-head__sub">复盘五步法 · 问题剖析 → 原因归因 → 改进措施 → 经验沉淀</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Refresh /></el-icon>复盘 <b>{{ st?.reviewTotal || 0 }}</b> 件</span>
        <span><el-icon><CircleCheck /></el-icon>已闭环 <b>{{ st?.reviewClosed || 0 }}</b></span>
        <span><el-icon><Tools /></el-icon>措施 <b>{{ st?.measureCompleted || 0 }}/{{ st?.measureTotal || 0 }}</b></span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'Plus'" @click="crVisible = true">发起复盘</el-button>
    </header>

    <!-- ============ 指标 ============ -->
    <div class="viz-grid viz-grid--4 rv-kpi">
      <VizMetric label="重点复盘案件" :value="st?.reviewTotal || 0" unit="件" icon="Refresh" tone="cyan"
        :desc="`整改中 ${st?.reviewOngoing || 0} · 已闭环 ${st?.reviewClosed || 0}`"
        :progress="st?.reviewTotal ? (st.reviewClosed / st.reviewTotal) * 100 : 0" />
      <VizMetric label="改进措施总数" :value="st?.measureTotal || 0" unit="项" icon="Tools" tone="blue"
        :desc="`已完成 ${st?.measureCompleted || 0} · 进行中 ${st?.measureInProgress || 0} · 未开始 ${st?.measureNotStarted || 0}`"
        :progress="st?.measureTotal ? (st.measureCompleted / st.measureTotal) * 100 : 0" />
      <VizMetric label="经验教训卡" :value="st?.lessonTotal || 0" unit="条" icon="Star" tone="violet"
        :desc="`已纳入培训库 ${st?.lessonInTrainingLib || 0} 条`"
        :progress="st?.lessonTotal ? (st.lessonInTrainingLib / st.lessonTotal) * 100 : 0" />
      <VizMetric label="措施闭环率" :value="st?.measureTotal ? Number(((st.measureCompleted / st.measureTotal) * 100).toFixed(1)) : 0"
        unit="%" icon="CircleCheckFilled" tone="lime" :precision="1"
        desc="措施全部完成方可判定复盘闭环" />
    </div>

    <el-tabs v-model="activeTab" class="viz-tabs">
      <!-- ================= 复盘台账 ================= -->
      <el-tab-pane label="复盘台账" name="review">
        <!-- 鱼骨图：全市共性原因 -->
        <VizPanel title="全市复盘共性原因分析（因果鱼骨图）" tone="violet"
          extra="鼠标悬停骨支可聚焦 · 四类归因" glow class="rv-fish">
          <FishBone effect="案件质量失分与被改判" :causes="st?.causeStat || []" :height="330" />
        </VizPanel>

        <div class="rv-charts">
          <VizPanel title="问题分类 × 严重程度" tone="red" extra="高危问题优先整改">
            <EChart :option="matrixOption" height="206px" />
          </VizPanel>
          <VizPanel title="复盘触发条件分布" tone="amber" extra="7 类触发条件">
            <EChart :option="triggerOption" height="206px" />
          </VizPanel>
          <VizPanel title="五步法复盘流程" tone="cyan" extra="标准化流程">
            <div class="fs">
              <div v-for="(s, i) in FIVE_STEPS" :key="s.name" class="fst" :style="{ animationDelay: i * 90 + 'ms' }">
                <span class="fst__no viz-num">{{ i + 1 }}</span>
                <div class="fst__b">
                  <div class="fst__n"><el-icon :size="12"><component :is="s.icon" /></el-icon>{{ s.name }}</div>
                  <div class="fst__d">{{ s.desc }}</div>
                </div>
                <span v-if="i < FIVE_STEPS.length - 1" class="fst__arrow"><el-icon :size="11"><ArrowDown /></el-icon></span>
              </div>
            </div>
          </VizPanel>
        </div>

        <VizPanel title="复盘记录" tone="cyan" :extra="`共 ${total} 件`">
          <el-form class="viz-form rv-q" :model="q" @submit.prevent>
            <el-input v-model="q.keyword" placeholder="复盘ID / 案件号 / 案件名" clearable size="small"
              :prefix-icon="'Search'" style="width: 220px" @keyup.enter="doQuery" />
            <el-select v-model="q.status" placeholder="全部状态" clearable size="small" style="width: 112px">
              <el-option v-for="s in ['已闭环', '整改中', '待启动']" :key="s" :label="s" :value="s" />
            </el-select>
            <el-select v-model="q.trigger" placeholder="全部触发条件" clearable size="small" style="width: 154px">
              <el-option v-for="t in (st?.triggers || [])" :key="t.trigger" :label="t.trigger" :value="t.trigger" />
            </el-select>
            <el-select v-model="q.grade" placeholder="全部等级" clearable size="small" style="width: 110px">
              <el-option v-for="g in ['优秀', '良好', '合格', '不合格']" :key="g" :label="g" :value="g" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="doQuery">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
          </el-form>

          <el-table class="viz-table" :data="list" size="small" border stripe v-loading="loading"
            element-loading-background="rgba(255,255,255,.65)">
            <el-table-column prop="reviewId" label="复盘ID" width="152">
              <template #default="{ row }">
                <span class="viz-link" @click="openDetail(row)">{{ row.reviewId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="216" show-overflow-tooltip />
            <el-table-column label="评分" width="86" align="center">
              <template #default="{ row }">
                <span class="viz-num" :style="{ color: row.totalScore >= 70 ? '#d48806' : '#e5484d', fontWeight: 800, fontSize: '13px' }">
                  {{ row.totalScore }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="触发条件" min-width="180">
              <template #default="{ row }">
                <span v-for="t in row.triggers.slice(0, 2)" :key="t" class="viz-tag mr4"
                  :class="`viz-tag--${TRIGGER_TONE[t] || 'faint'}`">{{ t }}</span>
                <span v-if="row.triggers.length > 2" class="viz-tag viz-tag--faint">+{{ row.triggers.length - 2 }}</span>
              </template>
            </el-table-column>
            <el-table-column label="问题" width="122" align="center">
              <template #default="{ row }">
                <span class="pbar">
                  <span v-for="p in row.problems" :key="p.id" class="pbar__d"
                    :class="`is-${SEV_TONE[p.severity]}`" :title="`${p.category}·${p.severity}`" />
                </span>
              </template>
            </el-table-column>
            <el-table-column label="措施完成" width="150">
              <template #default="{ row }">
                <div class="mprog">
                  <span class="mprog__t viz-num">{{ row.followUp.completed }}/{{ row.followUp.totalMeasures }}</span>
                  <span class="mprog__bar">
                    <span class="mprog__f" :style="{ width: row.followUp.completionRate + '%' }" />
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="86" align="center">
              <template #default="{ row }">
                <span class="viz-tag viz-tag--solid" :class="`viz-tag--${RV_TONE[row.status]}`">{{ row.status }}</span>
              </template>
            </el-table-column>
            <el-table-column label="经验" width="70" align="center">
              <template #default="{ row }">
                <span class="viz-num viz-mini viz-dim">{{ row.lessonsLearned.length }} 条</span>
              </template>
            </el-table-column>
            <el-table-column prop="reviewTime" label="复盘时间" width="146">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.reviewTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="72" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link :icon="'View'" style="color: var(--viz-cyan)" @click="openDetail(row)">复盘</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无复盘记录</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ total }} 件</span>
            <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
          </div>
        </VizPanel>
      </el-tab-pane>

      <!-- ================= 改进措施看板 ================= -->
      <el-tab-pane label="改进措施看板" name="measure">
        <div class="rv-mboard">
          <VizPanel title="责任部门措施完成度" tone="lime" extra="平均进度 %" glow>
            <EChart :option="deptOption" height="248px" />
          </VizPanel>

          <VizPanel title="部门措施台账" tone="blue" extra="按部门汇总">
            <div class="dp viz-scroll">
              <div v-for="dp in mDeptStat.filter((x) => x.total > 0)" :key="dp.dept" class="dpi">
                <div class="dpi__h">
                  <span class="dpi__n">{{ dp.dept }}</span>
                  <b class="dpi__v viz-num">{{ dp.completed }}/{{ dp.total }}</b>
                </div>
                <div class="dpi__track">
                  <span :style="{ width: dp.avgProgress + '%', '--pc': dp.avgProgress >= 70 ? '#12a150' : dp.avgProgress >= 40 ? '#1668dc' : '#d48806' }" />
                </div>
                <div class="dpi__f viz-num">平均进度 {{ dp.avgProgress }}%</div>
              </div>
              <div v-if="!mDeptStat.length" class="viz-empty">暂无部门数据</div>
            </div>
          </VizPanel>
        </div>

        <VizPanel title="改进措施跟踪表" tone="cyan" :extra="`共 ${mTotal} 项`">
          <el-form class="viz-form rv-q" :model="mQ" @submit.prevent>
            <el-input v-model="mQ.keyword" placeholder="措施内容 / 案件名" clearable size="small"
              :prefix-icon="'Search'" style="width: 220px" @keyup.enter="mQ.page = 1; loadMeasures()" />
            <el-select v-model="mQ.status" placeholder="全部状态" clearable size="small" style="width: 110px">
              <el-option v-for="s in ['已完成', '进行中', '未开始']" :key="s" :label="s" :value="s" />
            </el-select>
            <el-select v-model="mQ.dept" placeholder="全部责任部门" clearable size="small" style="width: 172px">
              <el-option v-for="dp in mDeptStat" :key="dp.dept" :label="dp.dept" :value="dp.dept" />
            </el-select>
            <el-select v-model="mQ.priority" placeholder="全部优先级" clearable size="small" style="width: 116px">
              <el-option v-for="pr in ['高', '中', '低']" :key="pr" :label="pr" :value="pr" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="mQ.page = 1; loadMeasures()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(mQ, { keyword: '', status: '', dept: '', priority: '', page: 1 }); loadMeasures()">重　置</el-button>
          </el-form>

          <el-table class="viz-table" :data="mList" size="small" border stripe v-loading="mLoading"
            element-loading-background="rgba(255,255,255,.65)">
            <el-table-column prop="id" label="编号" width="70" align="center">
              <template #default="{ row }"><span class="viz-num viz-mini">{{ row.id }}</span></template>
            </el-table-column>
            <el-table-column prop="measure" label="改进措施" min-width="280" show-overflow-tooltip />
            <el-table-column prop="dept" label="责任部门" width="164" show-overflow-tooltip>
              <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.dept }}</span></template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="82" align="center">
              <template #default="{ row }">
                <span class="viz-tag" :class="`viz-tag--${SEV_TONE[row.priority]}`">{{ row.priority }}</span>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="152">
              <template #default="{ row }">
                <div class="mprog">
                  <span class="mprog__t viz-num">{{ row.progress }}%</span>
                  <span class="mprog__bar">
                    <span class="mprog__f" :style="{ width: row.progress + '%', '--mfc': row.progress >= 100 ? '#12a150' : row.progress > 0 ? '#0891b2' : '#8290a5' }" />
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="86" align="center">
              <template #default="{ row }">
                <span class="viz-tag" :class="`viz-tag--${ST_TONE[row.status]}`">{{ row.status }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="deadline" label="完成时限" width="106">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.deadline }}</span></template>
            </el-table-column>
            <el-table-column prop="caseName" label="来源案件" min-width="180" show-overflow-tooltip>
              <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.caseName }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link :icon="'EditPen'" style="color: var(--viz-cyan)"
                  @click="openProgress(row, row.reviewId)">更新</el-button>
              </template>
            </el-table-column>
            <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无改进措施</div></template>
          </el-table>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ mTotal }} 项</span>
            <el-pagination v-model:current-page="mQ.page" v-model:page-size="mQ.pageSize" :total="mTotal"
              :page-sizes="[12, 24, 48]" layout="sizes, prev, pager, next, jumper" small background @change="loadMeasures" />
          </div>
        </VizPanel>
      </el-tab-pane>

      <!-- ================= 经验教训墙 ================= -->
      <el-tab-pane label="经验教训墙" name="lesson">
        <VizPanel title="经验标签云" tone="violet" extra="点击标签筛选 · 字号 = 出现频次" glow>
          <div class="cloud">
            <span v-for="(t, i) in lTags" :key="t.tag" class="cw"
              :class="{ 'is-active': lQ.tag === t.tag }"
              :style="{
                fontSize: 11 + Math.min(11, t.count * 1.4) + 'px',
                '--cwc': ['#0891b2', '#12a150', '#722ed1', '#d48806', '#d43878', '#1668dc'][i % 6],
                animationDelay: i * 45 + 'ms'
              }"
              @click="pickTag(t.tag)">
              {{ t.tag }}<b class="viz-num">{{ t.count }}</b>
            </span>
            <div v-if="!lTags.length" class="viz-empty">暂无标签</div>
          </div>
        </VizPanel>

        <VizPanel title="经验教训卡" tone="lime" :extra="`共 ${lTotal} 条 · 按引用次数排序`">
          <el-form class="viz-form rv-q" :model="lQ" @submit.prevent>
            <el-input v-model="lQ.keyword" placeholder="标题 / 内容关键词" clearable size="small"
              :prefix-icon="'Search'" style="width: 240px" @keyup.enter="lQ.page = 1; loadLessons()" />
            <el-select v-model="lQ.inLibOnly" placeholder="全部" clearable size="small" style="width: 150px">
              <el-option label="仅看已纳入培训库" value="true" />
            </el-select>
            <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="lQ.page = 1; loadLessons()">查　询</el-button>
            <el-button class="viz-btn" size="small" :icon="'RefreshLeft'"
              @click="Object.assign(lQ, { keyword: '', tag: '', inLibOnly: '', page: 1 }); loadLessons()">重　置</el-button>
          </el-form>

          <div class="lw" v-loading="lLoading" element-loading-background="rgba(255,255,255,.65)">
            <article v-for="(l, i) in lList" :key="l.reviewId + l.id" class="lc"
              :style="{ animationDelay: i * 60 + 'ms' }">
              <div class="lc__q">"</div>
              <div class="lc__h">
                <span class="lc__t">{{ l.title }}</span>
                <span v-if="l.inTrainingLib" class="viz-tag viz-tag--lime">培训库</span>
              </div>
              <p class="lc__c">{{ l.content }}</p>
              <div class="lc__tags">
                <span v-for="t in l.tags" :key="t" class="lc__tag" @click="pickTag(t)">#{{ t }}</span>
              </div>
              <div class="lc__f">
                <span class="lc__src">{{ l.caseName }}</span>
                <span class="lc__cite viz-num"><el-icon :size="10"><Star /></el-icon>被引用 {{ l.citedCount }} 次</span>
              </div>
            </article>
            <div v-if="!lList.length && !lLoading" class="viz-empty" style="grid-column: 1 / -1">
              <el-icon><DocumentDelete /></el-icon>暂无经验教训卡
            </div>
          </div>

          <div class="viz-pager">
            <span class="viz-pager__c">共 {{ lTotal }} 条 · 已纳入培训库 {{ st?.lessonInTrainingLib || 0 }} 条</span>
            <el-pagination v-model:current-page="lQ.page" v-model:page-size="lQ.pageSize" :total="lTotal"
              :page-sizes="[12, 24, 48]" layout="sizes, prev, pager, next" small background @change="loadLessons" />
          </div>
        </VizPanel>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 复盘详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="740px" class="viz-drawer" title="重点案件复盘">
      <template v-if="cur">
        <div v-loading="dLoading" element-loading-background="rgba(255,255,255,.65)">
          <div class="rh" :class="`rh--${RV_TONE[cur.status]}`">
            <div class="rh__n">{{ cur.caseName }}</div>
            <div class="rh__m">
              <span><el-icon><Ticket /></el-icon>{{ cur.reviewId }}</span>
              <span><el-icon><Odometer /></el-icon>{{ cur.totalScore }} 分（{{ cur.grade }}）</span>
              <span><el-icon><Clock /></el-icon>{{ cur.reviewTime }}</span>
            </div>
            <div class="rh__tags">
              <span v-for="t in cur.triggers" :key="t" class="viz-tag" :class="`viz-tag--${TRIGGER_TONE[t] || 'faint'}`">{{ t }}</span>
            </div>
            <div class="rh__rv">
              <el-icon :size="11"><UserFilled /></el-icon>复盘小组：{{ cur.reviewers.join('、') }}
            </div>
          </div>

          <!-- 五步法进度 -->
          <div class="steps">
            <div v-for="(s, i) in FIVE_STEPS" :key="s.name" class="stp"
              :class="{ 'is-active': stepIdx === i }" @click="stepIdx = i">
              <span class="stp__no viz-num">{{ i + 1 }}</span>
              <span class="stp__n">{{ s.name }}</span>
            </div>
          </div>

          <!-- 步骤 1：案件回顾 -->
          <template v-if="stepIdx === 0">
            <div class="viz-sub">案件回顾<span class="viz-sub__x" /></div>
            <div class="rcv">{{ cur.caseReview }}</div>
            <el-descriptions v-if="cur.scoreDetail" class="viz-desc" :column="2" border size="small">
              <el-descriptions-item label="被检机构">{{ cur.scoreDetail.orgName }}</el-descriptions-item>
              <el-descriptions-item label="机构类型">{{ cur.scoreDetail.orgType }}</el-descriptions-item>
              <el-descriptions-item label="违规类型">{{ cur.scoreDetail.violationType }}</el-descriptions-item>
              <el-descriptions-item label="所属区县">{{ cur.scoreDetail.district }}</el-descriptions-item>
              <el-descriptions-item label="违规金额">
                <span class="viz-num">{{ cur.scoreDetail.violationAmount }} 万元</span>
              </el-descriptions-item>
              <el-descriptions-item label="已追回">
                <span class="viz-num" style="color: var(--viz-lime)">{{ cur.scoreDetail.recoveredAmount }} 万元</span>
              </el-descriptions-item>
            </el-descriptions>
            <div v-if="cur.scoreDetail" class="viz-sub">质量评分盘<span class="viz-sub__x" /></div>
            <ScoreDial v-if="cur.scoreDetail" :total="cur.scoreDetail.totalScore" :grade="cur.scoreDetail.grade"
              :dimensions="cur.scoreDetail.dimensions" :size="250" />
          </template>

          <!-- 步骤 2：问题剖析 -->
          <template v-else-if="stepIdx === 1">
            <div class="viz-sub">
              问题清单<span class="viz-sub__x" />
              <span class="viz-sub__e">共 {{ cur.problems.length }} 项</span>
            </div>
            <div class="pbs">
              <div v-for="p in cur.problems" :key="p.id" class="pb" :class="`pb--${SEV_TONE[p.severity]}`">
                <div class="pb__h">
                  <span class="pb__id viz-num">{{ p.id }}</span>
                  <span class="viz-tag" :class="`viz-tag--${CAT_TONE[p.category]}`">{{ p.category }}</span>
                  <span class="viz-tag viz-tag--solid" :class="`viz-tag--${SEV_TONE[p.severity]}`">{{ p.severity }}危</span>
                  <span class="viz-tag viz-tag--faint">{{ p.causeType }}</span>
                </div>
                <div class="pb__p">{{ p.problem }}</div>
                <div class="pb__r"><el-icon :size="10"><Share /></el-icon>根因：{{ p.rootCause }}</div>
              </div>
            </div>
          </template>

          <!-- 步骤 3：原因分析 -->
          <template v-else-if="stepIdx === 2">
            <div class="viz-sub">
              原因四分类归因<span class="viz-sub__x" />
              <span class="viz-sub__e">制度 / 流程 / 人员 / 技术</span>
            </div>
            <div class="cz">
              <div v-for="ct in ['制度', '流程', '人员', '技术']" :key="ct" class="czi"
                :class="`czi--${ct === '制度' ? 'violet' : ct === '流程' ? 'cyan' : ct === '人员' ? 'amber' : 'lime'}`">
                <div class="czi__h">
                  <span class="czi__t">{{ ct }}</span>
                  <b class="czi__c viz-num">{{ cur.problems.filter((p: any) => p.causeType === ct).length }}</b>
                </div>
                <div v-for="p in cur.problems.filter((x: any) => x.causeType === ct)" :key="p.id" class="czi__p">
                  <el-icon :size="9"><CaretRight /></el-icon>{{ p.rootCause }}
                </div>
                <div v-if="!cur.problems.filter((p: any) => p.causeType === ct).length" class="czi__e">本次未归因至该类</div>
              </div>
            </div>
          </template>

          <!-- 步骤 4：改进措施 -->
          <template v-else-if="stepIdx === 3">
            <div class="viz-sub">
              改进措施跟踪<span class="viz-sub__x" />
              <span class="viz-sub__e">
                已完成 {{ cur.followUp.completed }} · 进行中 {{ cur.followUp.inProgress }} · 未开始 {{ cur.followUp.notStarted }}
              </span>
            </div>
            <div class="fu">
              <div class="fu__bar">
                <span class="fu__seg is-done" :style="{ width: (cur.followUp.completed / cur.followUp.totalMeasures) * 100 + '%' }" />
                <span class="fu__seg is-run" :style="{ width: (cur.followUp.inProgress / cur.followUp.totalMeasures) * 100 + '%' }" />
                <span class="fu__seg is-wait" :style="{ width: (cur.followUp.notStarted / cur.followUp.totalMeasures) * 100 + '%' }" />
              </div>
              <div class="fu__f">
                <span>闭环率 <b class="viz-num">{{ cur.followUp.completionRate }}%</b></span>
                <span>下次复查 <b class="viz-num">{{ cur.followUp.nextReviewDate }}</b></span>
              </div>
            </div>

            <div class="ims">
              <div v-for="m in cur.improvementMeasures" :key="m.id" class="im" :class="`im--${ST_TONE[m.status]}`">
                <div class="im__h">
                  <span class="im__id viz-num">{{ m.id }}</span>
                  <span class="viz-tag" :class="`viz-tag--${SEV_TONE[m.priority]}`">{{ m.priority }}</span>
                  <span class="viz-tag viz-tag--faint">关联 {{ m.relatedProblem }}</span>
                  <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[m.status]}`">{{ m.status }}</span>
                </div>
                <div class="im__m">{{ m.measure }}</div>
                <div class="im__track">
                  <span :style="{ width: m.progress + '%' }" />
                  <b class="viz-num">{{ m.progress }}%</b>
                </div>
                <div class="im__f">
                  <span><el-icon :size="10"><OfficeBuilding /></el-icon>{{ m.dept }}</span>
                  <span><el-icon :size="10"><User /></el-icon>{{ m.owner }}</span>
                  <span class="viz-num"><el-icon :size="10"><Calendar /></el-icon>{{ m.deadline }}</span>
                  <el-button link size="small" :icon="'EditPen'" style="color: var(--viz-cyan); margin-left: auto"
                    @click="openProgress(m, cur.reviewId)">更新进度</el-button>
                </div>
              </div>
            </div>
          </template>

          <!-- 步骤 5：经验教训 -->
          <template v-else>
            <div class="viz-sub">
              经验教训提炼<span class="viz-sub__x" />
              <span class="viz-sub__e">共 {{ cur.lessonsLearned.length }} 条</span>
            </div>
            <div class="lls">
              <div v-for="l in cur.lessonsLearned" :key="l.id" class="ll">
                <div class="ll__h">
                  <span class="ll__id viz-num">{{ l.id }}</span>
                  <span class="ll__t">{{ l.title }}</span>
                  <span v-if="l.inTrainingLib" class="viz-tag viz-tag--lime">培训库</span>
                </div>
                <p class="ll__c">{{ l.content }}</p>
                <div class="ll__f">
                  <span v-for="t in l.tags" :key="t" class="viz-tag viz-tag--violet">#{{ t }}</span>
                  <span class="ll__cite viz-num">被引用 {{ l.citedCount }} 次</span>
                </div>
              </div>
            </div>
            <div class="viz-note">
              <el-icon><InfoFilled /></el-icon>
              经验教训卡自动汇入「经验教训墙」并可纳入培训素材库；标签用于同类案件检索与复用。
            </div>
          </template>

          <div class="dr-act">
            <el-button class="viz-btn" :icon="'ArrowLeft'" :disabled="stepIdx === 0" @click="stepIdx--">上一步</el-button>
            <el-button class="viz-btn is-hot" :icon="'ArrowRight'" :disabled="stepIdx === 4" @click="stepIdx++">下一步</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 发起复盘 ============ -->
    <el-dialog v-model="crVisible" title="发起重点案件复盘" width="560px" class="viz-dialog">
      <el-alert class="viz-alert" type="info" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">评分&lt;70 分、申诉改判、复议撤销、诉讼败诉的案件会自动触发复盘；此处用于「指定复盘」</span>
        </template>
      </el-alert>
      <el-form class="viz-form" label-width="94px" style="margin-top: 12px">
        <el-form-item label="案件编号" required>
          <el-input v-model="crForm.caseId" placeholder="如 CASE202607100005" />
        </el-form-item>
        <el-form-item label="复盘类型">
          <el-select v-model="crForm.reviewType" style="width: 100%">
            <el-option v-for="t in (st?.triggers || [])" :key="t.trigger"
              :label="`重点复盘（${t.trigger}）`" :value="`重点复盘（${t.trigger}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="复盘说明">
          <div class="viz-note">
            <el-icon><InfoFilled /></el-icon>
            系统将按五步法自动生成问题清单、原因归因、改进措施与经验教训草稿，由复盘小组确认后形成正式复盘记录。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="crVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="crRunning" @click="doCreate">发起复盘</el-button>
      </template>
    </el-dialog>

    <!-- ============ 更新措施进度 ============ -->
    <el-dialog v-model="mpVisible" title="更新措施进度" width="520px" class="viz-dialog">
      <div class="mpm">{{ mpForm.measure }}</div>
      <el-form class="viz-form" label-width="80px" style="margin-top: 14px">
        <el-form-item label="完成进度">
          <el-slider v-model="mpForm.progress" :min="0" :max="100" :step="5" show-input
            :marks="{ 0: '未开始', 50: '过半', 100: '已完成' }" />
        </el-form-item>
      </el-form>
      <div class="mps" :class="mpForm.progress >= 100 ? 'is-done' : mpForm.progress > 0 ? 'is-run' : 'is-wait'">
        <el-icon><component :is="mpForm.progress >= 100 ? 'CircleCheckFilled' : mpForm.progress > 0 ? 'Loading' : 'Clock'" /></el-icon>
        更新后状态：<b>{{ mpForm.progress >= 100 ? '已完成' : mpForm.progress > 0 ? '进行中' : '未开始' }}</b>
        <span v-if="mpForm.progress >= 100" class="viz-mini">（将计入复盘闭环统计）</span>
      </div>
      <template #footer>
        <el-button class="viz-btn" @click="mpVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="mpSaving" @click="doUpdateProgress">保存进度</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mr4 { margin-right: 4px; }

.rv-kpi { margin-bottom: 12px; }
.rv-fish { margin-bottom: 12px; }

.rv-charts {
  display: grid; grid-template-columns: 1.1fr 1fr 1.05fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.rv-mboard {
  display: grid; grid-template-columns: 1fr 1.15fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.rv-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

/* ---------- 五步法流程 ---------- */
.fs { display: flex; flex-direction: column; gap: 3px; }

.fst {
  position: relative;
  display: flex; align-items: flex-start; gap: 8px;
  padding: 5px 8px; border-radius: 4px;
  background: var(--zh-bg-soft);
  animation: fstIn .5s cubic-bezier(.2, .9, .3, 1) both;

  &__no {
    width: 17px; height: 17px; flex-shrink: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9.5px; font-weight: 800; color: #fff;
    background: var(--viz-cyan);
  }
  &__b { min-width: 0; }
  &__n {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
  &__d { margin-top: 2px; font-size: 9.5px; line-height: 1.55; color: var(--viz-text-faint); }
  &__arrow {
    position: absolute; left: 15px; bottom: -6px;
    :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
}

@keyframes fstIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }

/* ---------- 问题严重度小点 ---------- */
.pbar {
  display: inline-flex; gap: 3px;
  &__d {
    width: 7px; height: 7px; border-radius: 2px;
    &.is-red { background: var(--viz-red); box-shadow: 0 0 6px var(--viz-red); }
    &.is-amber { background: var(--viz-amber); box-shadow: 0 0 6px var(--viz-amber); }
    &.is-blue { background: var(--viz-blue); box-shadow: 0 0 6px var(--viz-blue); }
  }
}

/* ---------- 措施进度条 ---------- */
.mprog {
  display: flex; align-items: center; gap: 7px;
  &__t { font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim); min-width: 34px; }
  &__bar {
    flex: 1; height: 4px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
  }
  &__f {
    display: block; height: 100%; border-radius: 2px;
    background: var(--mfc, var(--viz-lime));
    box-shadow: 0 0 8px var(--mfc, var(--viz-lime));
  }
}

/* ---------- 部门台账 ---------- */
.dp { display: flex; flex-direction: column; gap: 8px; max-height: 248px; }

.dpi {
  padding: 7px 9px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__h { display: flex; align-items: center; justify-content: space-between; }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__v { font-size: 12px; font-weight: 800; color: var(--viz-cyan); }
  &__track {
    margin-top: 5px; height: 4px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--pc); box-shadow: 0 0 8px var(--pc);
    }
  }
  &__f { margin-top: 4px; font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 标签云 ---------- */
.cloud {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 8px 4px; min-height: 92px;
}

.cw {
  display: inline-flex; align-items: baseline; gap: 3px; cursor: pointer;
  padding: 3px 9px; border-radius: 12px;
  font-weight: 700; color: var(--cwc);
  background: color-mix(in srgb, var(--cwc) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--cwc) 26%, transparent);
  transition: transform .2s, box-shadow .2s;
  animation: cwIn .45s cubic-bezier(.2, .9, .3, 1) both;

  b { font-size: 9.5px; opacity: .75; }
  &:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 0 16px -4px var(--cwc); }
  &.is-active {
    color: #fff; background: var(--cwc); border-color: var(--cwc);
    b { opacity: .85; }
  }
}

@keyframes cwIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }

/* ---------- 经验墙 ---------- */
.lw {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(316px, 1fr)); gap: 10px;
  min-height: 120px;
}

.lc {
  position: relative;
  padding: 12px 13px 10px; border-radius: 5px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--viz-lime);
  overflow: hidden;
  animation: lcIn .5s cubic-bezier(.2, .9, .3, 1) both;
  transition: transform .22s, box-shadow .22s;
  &:hover { transform: translateY(-3px); box-shadow: 0 10px 28px -12px rgba(76, 245, 168, .5); }

  &__q {
    position: absolute; right: 8px; top: -6px;
    font-size: 52px; font-family: Georgia, serif; line-height: 1;
    color: rgba(76, 245, 168, .13); pointer-events: none;
  }

  &__h { display: flex; align-items: flex-start; gap: 6px; }
  &__t {
    flex: 1; font-size: 12.5px; font-weight: 700; line-height: 1.5; color: var(--viz-text);
  }
  &__c {
    margin: 7px 0 0; font-size: 10.5px; line-height: 1.85; color: var(--viz-text-dim);
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }
  &__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  &__tag {
    font-size: 9.5px; color: var(--viz-violet); cursor: pointer;
    &:hover { text-decoration: underline; }
  }
  &__f {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin-top: 8px; padding-top: 7px;
    border-top: 1px dashed var(--zh-border-light);
    font-size: 9.5px; color: var(--viz-text-faint);
  }
  &__src { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__cite {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
    color: var(--viz-amber);
  }
}

@keyframes lcIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* ---------- 抽屉：复盘头 ---------- */
.rh {
  padding: 12px 14px; border-radius: 5px;
  background: linear-gradient(130deg, color-mix(in srgb, var(--rhc) 18%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--rhc) 38%, transparent);

  &--lime { --rhc: var(--viz-lime); }
  &--cyan { --rhc: var(--viz-cyan); }
  &--amber { --rhc: var(--viz-amber); }

  &__n { font-size: 15px; font-weight: 700; color: var(--viz-text); line-height: 1.5; }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--rhc); }
  }
  &__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  &__rv {
    display: flex; align-items: center; gap: 4px; margin-top: 8px; padding-top: 7px;
    border-top: 1px dashed color-mix(in srgb, var(--rhc) 30%, transparent);
    font-size: 10px; color: var(--viz-text-faint);
    :deep(.el-icon) { color: var(--rhc); }
  }
}

/* ---------- 五步 Tab ---------- */
.steps {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0;
}

.stp {
  display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer;
  padding: 7px 4px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  transition: all .2s;

  &__no {
    width: 19px; height: 19px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
    color: var(--viz-text-dim); background: var(--zh-border-light);
  }
  &__n { font-size: 10px; color: var(--viz-text-dim); }

  &:hover { border-color: var(--viz-line-strong); }
  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--viz-cyan);
    box-shadow: 0 0 16px -6px var(--viz-cyan);
    .stp__no { color: #fff; background: var(--viz-cyan); }
    .stp__n { color: var(--viz-cyan); font-weight: 700; }
  }
}

.rcv {
  padding: 10px 12px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--viz-cyan);
  font-size: 11.5px; line-height: 1.9; color: var(--viz-text-dim);
  margin-bottom: 12px;
}

/* ---------- 问题清单 ---------- */
.pbs { display: flex; flex-direction: column; gap: 8px; }

.pb {
  padding: 9px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--pbc);

  &--red { --pbc: var(--viz-red); }
  &--amber { --pbc: var(--viz-amber); }
  &--blue { --pbc: var(--viz-blue); }

  &__h { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  &__id { font-size: 10px; font-weight: 800; color: var(--pbc); }
  &__p { margin-top: 6px; font-size: 11.5px; line-height: 1.75; color: var(--viz-text); }
  &__r {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10.5px; line-height: 1.7; color: var(--viz-text-faint);
    :deep(.el-icon) { color: var(--pbc); flex-shrink: 0; margin-top: 3px; }
  }
}

/* ---------- 原因四分类 ---------- */
.cz {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.czi {
  padding: 9px 11px; border-radius: 4px;
  background: color-mix(in srgb, var(--czc) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--czc) 28%, transparent);

  &--violet { --czc: var(--viz-violet); }
  &--cyan { --czc: var(--viz-cyan); }
  &--amber { --czc: var(--viz-amber); }
  &--lime { --czc: var(--viz-lime); }

  &__h {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 6px; border-bottom: 1px dashed color-mix(in srgb, var(--czc) 30%, transparent);
  }
  &__t { font-size: 12px; font-weight: 800; color: var(--czc); }
  &__c { font-size: 15px; font-weight: 800; color: var(--czc); }
  &__p {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 6px;
    font-size: 10.5px; line-height: 1.7; color: var(--viz-text-dim);
    :deep(.el-icon) { color: var(--czc); flex-shrink: 0; margin-top: 3px; }
  }
  &__e { margin-top: 6px; font-size: 10px; color: var(--viz-text-faint); }
}

/* ---------- 措施跟进 ---------- */
.fu {
  padding: 9px 11px; border-radius: 4px; margin-bottom: 10px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__bar {
    display: flex; height: 8px; border-radius: 4px; overflow: hidden;
    background: var(--zh-border-light);
  }
  &__seg {
    height: 100%;
    &.is-done { background: var(--viz-lime); box-shadow: 0 0 10px var(--viz-lime); }
    &.is-run { background: var(--viz-cyan); }
    &.is-wait { background: var(--zh-border-strong); }
  }
  &__f {
    display: flex; gap: 18px; margin-top: 7px;
    font-size: 10.5px; color: var(--viz-text-faint);
    b { color: var(--viz-lime); font-size: 12px; }
  }
}

.ims { display: flex; flex-direction: column; gap: 8px; }

.im {
  padding: 9px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--imc);

  &--lime { --imc: var(--viz-lime); }
  &--cyan { --imc: var(--viz-cyan); }
  &--faint { --imc: var(--viz-text-faint); }

  &__h { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  &__id { font-size: 10px; font-weight: 800; color: var(--imc); }
  &__m { margin-top: 6px; font-size: 11.5px; line-height: 1.7; color: var(--viz-text); }

  &__track {
    display: flex; align-items: center; gap: 7px; margin-top: 6px;
    height: 5px; border-radius: 3px;
    background: var(--zh-border-light);
    position: relative;
    span {
      display: block; height: 100%; border-radius: 3px;
      background: var(--imc); box-shadow: 0 0 8px var(--imc);
    }
    b {
      position: absolute; right: -32px; top: -5px;
      font-size: 10px; font-weight: 800; color: var(--imc);
    }
  }

  &__f {
    display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 9px;
    font-size: 10px; color: var(--viz-text-faint);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--imc); }
  }
}

/* ---------- 经验教训 ---------- */
.lls { display: flex; flex-direction: column; gap: 9px; }

.ll {
  padding: 10px 12px; border-radius: 4px;
  background: rgba(76, 245, 168, .06);
  border: 1px solid rgba(76, 245, 168, .22);
  border-left: 2px solid var(--viz-lime);

  &__h { display: flex; align-items: flex-start; gap: 6px; }
  &__id { font-size: 10px; font-weight: 800; color: var(--viz-lime); }
  &__t { flex: 1; font-size: 12.5px; font-weight: 700; line-height: 1.5; color: var(--viz-text); }
  &__c { margin: 7px 0 0; font-size: 11px; line-height: 1.85; color: var(--viz-text-dim); }
  &__f {
    display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 8px;
    padding-top: 7px; border-top: 1px dashed rgba(76, 245, 168, .2);
  }
  &__cite { margin-left: auto; font-size: 10px; color: var(--viz-amber); }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 进度弹窗 ---------- */
.mpm {
  padding: 10px 12px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--viz-cyan);
  font-size: 12px; line-height: 1.8; color: var(--viz-text);
}

.mps {
  display: flex; align-items: center; gap: 7px; margin-top: 4px;
  padding: 9px 11px; border-radius: 4px;
  font-size: 11.5px; color: var(--viz-text-dim);

  &.is-done { background: rgba(76, 245, 168, .1); border: 1px solid rgba(76, 245, 168, .3); :deep(.el-icon) { color: var(--viz-lime); } b { color: var(--viz-lime); } }
  &.is-run { background: var(--zh-primary-lighter); border: 1px solid var(--viz-line-strong); :deep(.el-icon) { color: var(--viz-cyan); } b { color: var(--viz-cyan); } }
  &.is-wait { background: rgba(143, 171, 212, .08); border: 1px solid rgba(143, 171, 212, .22); :deep(.el-icon) { color: var(--viz-text-faint); } b { color: var(--viz-text-dim); } }
}

:deep(.el-slider) {
  --el-slider-main-bg-color: var(--viz-cyan);
  --el-slider-runway-bg-color: var(--zh-border-light);
  --el-slider-stop-bg-color: var(--zh-border-strong);
}
:deep(.el-slider__marks-text) { color: var(--viz-text-faint) !important; font-size: 9.5px; }
:deep(.el-input-number .el-input__inner) { color: var(--viz-text) !important; }
</style>
