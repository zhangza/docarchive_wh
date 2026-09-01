<script setup lang="ts">
import {
  getRuleStats, getRuleList, getRuleDetail, toggleRule, saveRule,
  getParamList, getParamDetail, submitParamChange, approveParamChange,
  getTrialList, getTrialDetail, runTrial,
  getReleaseList, getReleaseDetail, releaseAction
} from '@/api/agent06-system/system'
import { CHART_COLORS, CHART_GRID } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('rule')
const st = ref<any>(null)

const TYPE_TONE: Record<string, any> = { 阈值类: 'primary', 比对类: 'success', 行为类: 'warning', 关联类: 'danger' }
const STATUS_TONE: Record<string, any> = { 已启用: 'success', 已停用: 'info', 已完成: 'success', 灰度进行中: 'warning', 已全量: 'success', 待审核: 'warning' }

async function loadStats() { st.value = await getRuleStats() }

/* ================= 规则配置 ================= */
const rList = ref<any[]>([])
const rTotal = ref(0)
const rLoading = ref(false)
const rQ = reactive({ keyword: '', ruleType: '', violationType: '', status: '', riskLevel: '', page: 1, pageSize: 10 })

async function loadRules() {
  rLoading.value = true
  try {
    const res: any = await getRuleList(rQ)
    rList.value = res?.list || []
    rTotal.value = res?.total || 0
  } finally { rLoading.value = false }
}

const rDrawer = ref(false)
const curRule = ref<any>(null)
const rDetailLoading = ref(false)
async function openRule(row: any) {
  rDrawer.value = true
  rDetailLoading.value = true
  try { curRule.value = await getRuleDetail(row.ruleId) } finally { rDetailLoading.value = false }
}

async function doToggleRule(row: any) {
  const enabled = row.status !== '已启用'
  if (!enabled) {
    await ElMessageBox.confirm(`停用后规则「${row.ruleName}」将立即停止产生新线索，确认停用？`, '停用确认', { type: 'warning', confirmButtonText: '确认停用', cancelButtonText: '取消' })
  }
  const res: any = await toggleRule({ ruleId: row.ruleId, enabled })
  msg.success(res.message)
  row.status = enabled ? '已启用' : '已停用'
}

/* ---------- 规则新增 / 编辑（可视化条件构建器） ---------- */
const rfVisible = ref(false)
const rfSaving = ref(false)
const rfEditing = ref<any>(null)
const emptyCond = () => ({ field: '', operator: '=', value: '', fieldType: '枚举', unit: '' })
const rf = reactive({
  ruleName: '', ruleType: '阈值类', violationType: '超量开药', category: '', riskLevel: '中',
  description: '', legalBasis: '', disposalSuggestion: '',
  logic: 'AND', conditions: [emptyCond()] as any[]
})

function openRuleForm(row?: any) {
  rfEditing.value = row || null
  if (row) {
    Object.assign(rf, {
      ruleName: row.ruleName, ruleType: row.ruleType, violationType: row.violationType,
      category: row.category || '', riskLevel: row.riskLevel, description: row.description || '',
      legalBasis: row.legalBasis || '', disposalSuggestion: row.disposalSuggestion || '',
      logic: row.triggerConditions?.logic || 'AND',
      conditions: (row.triggerConditions?.conditions || []).map((c: any) => ({ ...c })) || [emptyCond()]
    })
    if (!rf.conditions.length) rf.conditions = [emptyCond()]
  } else {
    Object.assign(rf, {
      ruleName: '', ruleType: '阈值类', violationType: '超量开药', category: '', riskLevel: '中',
      description: '', legalBasis: '', disposalSuggestion: '', logic: 'AND', conditions: [emptyCond()]
    })
  }
  rfVisible.value = true
}

function addCond() { rf.conditions.push(emptyCond()) }
function removeCond(i: number) {
  if (rf.conditions.length <= 1) { msg.warning('至少保留一个触发条件'); return }
  rf.conditions.splice(i, 1)
}

async function doSaveRule() {
  if (!rf.ruleName) { msg.warning('请填写规则名称'); return }
  if (rf.conditions.some((c) => !c.field || c.value === '' || c.value === undefined)) { msg.warning('请完善所有触发条件的字段与取值'); return }
  rfSaving.value = true
  try {
    const res: any = await saveRule({ ruleId: rfEditing.value?.ruleId, ...rf })
    msg.success(res.message)
    if (rfEditing.value) {
      const target = rList.value.find((r) => r.ruleId === rfEditing.value.ruleId)
      if (target) Object.assign(target, { ruleName: rf.ruleName, ruleType: rf.ruleType, violationType: rf.violationType, riskLevel: rf.riskLevel, description: rf.description, legalBasis: rf.legalBasis, disposalSuggestion: rf.disposalSuggestion })
    } else {
      rList.value.unshift({
        ruleId: res.ruleId, ruleName: rf.ruleName, ruleType: rf.ruleType, violationType: rf.violationType,
        riskLevel: rf.riskLevel, status: '已停用', version: 'v1.0', description: rf.description,
        legalBasis: rf.legalBasis, disposalSuggestion: rf.disposalSuggestion, category: rf.category,
        applicableScope: { orgTypes: ['全市'], areas: ['全市'], insuranceTypes: ['职工医保', '居民医保'], exceptions: [] },
        triggerConditions: { logic: rf.logic, conditions: rf.conditions.map((c) => ({ ...c })) },
        usageStats: { triggerCount: 0, confirmedCount: 0, positiveRate: 0, misjudgmentRate: 0 }, tags: []
      })
      rTotal.value += 1
    }
    rfVisible.value = false
    rDrawer.value = false
  } finally { rfSaving.value = false }
}

/* ================= 参数管理 ================= */
const pList = ref<any[]>([])
const pTotal = ref(0)
const pLoading = ref(false)
const pQ = reactive({ keyword: '', paramType: '', page: 1, pageSize: 10 })

async function loadParams() {
  pLoading.value = true
  try {
    const res: any = await getParamList(pQ)
    pList.value = res?.list || []
    pTotal.value = res?.total || 0
  } finally { pLoading.value = false }
}

const pDrawer = ref(false)
const curParam = ref<any>(null)
const pDetailLoading = ref(false)
async function openParam(row: any) {
  pDrawer.value = true
  pDetailLoading.value = true
  try { curParam.value = await getParamDetail(row.paramId) } finally { pDetailLoading.value = false }
}

/* 参数变更申请 */
const chgVisible = ref(false)
const chgSubmitting = ref(false)
const chgForm = reactive({ newValue: 7, changeType: '', reason: '' })
function openChg(row: any) {
  Object.assign(chgForm, { newValue: row.currentValue, changeType: '', reason: '' })
  curParam.value = row
  chgVisible.value = true
}
async function doSubmitChg() {
  if (!chgForm.changeType || !chgForm.reason) { msg.warning('请填写变更类型与变更理由'); return }
  chgSubmitting.value = true
  try {
    const res: any = await submitParamChange({ paramId: curParam.value.paramId, ...chgForm })
    msg.success(res.message)
    chgVisible.value = false
    loadParams()
  } finally { chgSubmitting.value = false }
}

/* 变更审核 */
const approving = ref(false)
async function doApprove(result: string) {
  approving.value = true
  try {
    const res: any = await approveParamChange({ requestId: curParam.value.pendingChange.requestId, result })
    msg.success(res.message)
    curParam.value = await getParamDetail(curParam.value.paramId)
    loadParams()
  } finally { approving.value = false }
}

/* ================= 试跑验证 ================= */
const tList = ref<any[]>([])
const tTotal = ref(0)
const tLoading = ref(false)
const tQ = reactive({ trialType: '', status: '', page: 1, pageSize: 10 })

async function loadTrials() {
  tLoading.value = true
  try {
    const res: any = await getTrialList(tQ)
    tList.value = res?.list || []
    tTotal.value = res?.total || 0
  } finally { tLoading.value = false }
}

const tDrawer = ref(false)
const curTrial = ref<any>(null)
const tDetailLoading = ref(false)
async function openTrial(row: any) {
  tDrawer.value = true
  tDetailLoading.value = true
  try { curTrial.value = await getTrialDetail(row.trialId) } finally { tDetailLoading.value = false }
}

const runVisible = ref(false)
const running = ref(false)
const runForm = reactive({ ruleId: '', trialMode: '全量历史数据试跑', startTime: '2026-06-01', endTime: '2026-08-31' })
async function doRunTrial() {
  if (!runForm.ruleId) { msg.warning('请选择试跑规则'); return }
  running.value = true
  try {
    const res: any = await runTrial(runForm)
    msg.success(res.message)
    runVisible.value = false
    loadTrials()
  } finally { running.value = false }
}

/* 试跑对比图 */
const trialCompareOption = computed(() => {
  const t = curTrial.value
  if (!t) return {}
  const metrics = ['触发量', '预估阳性数', '预估误报数']
  const cur = t.results.current
  const tri = t.results.trial
  return {
    color: ['#5a7189', '#1668dc'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: [`当前 ${t.currentVersion}`, `试跑 ${t.trialVersion}`], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 56, bottom: 24 },
    xAxis: { type: 'category', data: metrics, axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: [
      { name: `当前 ${t.currentVersion}`, type: 'bar', barWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: [cur.triggerCount, cur.estimatedPositive, cur.misjudgment] },
      { name: `试跑 ${t.trialVersion}`, type: 'bar', barWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: [tri.triggerCount, tri.estimatedPositive, tri.misjudgment] }
    ]
  }
})

/* ================= 灰度发布 ================= */
const gList = ref<any[]>([])
const gTotal = ref(0)
const gLoading = ref(false)

async function loadReleases() {
  gLoading.value = true
  try {
    const res: any = await getReleaseList({ page: 1, pageSize: 20 })
    gList.value = res?.list || []
    gTotal.value = res?.total || 0
  } finally { gLoading.value = false }
}

const gDrawer = ref(false)
const curRelease = ref<any>(null)
const gDetailLoading = ref(false)
async function openRelease(row: any) {
  gDrawer.value = true
  gDetailLoading.value = true
  try { curRelease.value = await getReleaseDetail(row.releaseId) } finally { gDetailLoading.value = false }
}

const acting = ref(false)
async function doReleaseAction(action: string) {
  const label = action === 'rollback' ? '回滚' : '全量发布'
  await ElMessageBox.confirm(
    action === 'rollback'
      ? '回滚后灰度版本立即停用，规则恢复至上一稳定版本，确认回滚？'
      : '灰度评估通过后将对全市范围生效，确认全量发布？',
    `${label}确认`, { type: 'warning', confirmButtonText: `确认${label}`, cancelButtonText: '取消' }
  )
  acting.value = true
  try {
    const res: any = await releaseAction({ releaseId: curRelease.value.releaseId, action })
    msg.success(res.message)
    gDrawer.value = false
    loadReleases()
  } finally { acting.value = false }
}

/* 灰度双版本对比图 */
const grayOption = computed(() => {
  const d = curRelease.value?.grayMetrics?.daily || []
  if (!d.length) return {}
  return {
    color: ['#5a7189', '#1668dc', '#e5484d', '#12a150'],
    tooltip: { trigger: 'axis' },
    legend: { data: [`${curRelease.value.fromVersion} 触发`, `${curRelease.value.toVersion} 触发`, `${curRelease.value.fromVersion} 误报`, `${curRelease.value.toVersion} 误报`], top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
    grid: { ...CHART_GRID, left: 42, bottom: 24 },
    xAxis: { type: 'category', data: d.map((i: any) => i.date), axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: [
      { name: `${curRelease.value.fromVersion} 触发`, type: 'line', smooth: true, symbolSize: 5, data: d.map((i: any) => i.v21Trigger) },
      { name: `${curRelease.value.toVersion} 触发`, type: 'line', smooth: true, symbolSize: 5, data: d.map((i: any) => i.v22Trigger) },
      { name: `${curRelease.value.fromVersion} 误报`, type: 'bar', barWidth: 8, itemStyle: { borderRadius: [2, 2, 0, 0] }, data: d.map((i: any) => i.v21Misjudge) },
      { name: `${curRelease.value.toVersion} 误报`, type: 'bar', barWidth: 8, itemStyle: { borderRadius: [2, 2, 0, 0] }, data: d.map((i: any) => i.v22Misjudge) }
    ]
  }
})

/* ================= 图表 ================= */
const ruleTypeOption = computed(() => {
  const d = st.value?.byType || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}: {c} 条（{d}%）' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['44%', '68%'], center: ['50%', '44%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.type, value: i.count }))
    }]
  }
})

const violationOption = computed(() => {
  const d = st.value?.byViolation || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 70, bottom: 24 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: { type: 'category', data: d.map((i: any) => i.type).reverse(), axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 12,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: '#1668dc' },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, color: '#43516b' },
      data: d.map((i: any) => i.count).reverse()
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'param' && !pList.value.length) loadParams()
  else if (v === 'trial' && !tList.value.length) loadTrials()
  else if (v === 'gray' && !gList.value.length) loadReleases()
})

onMounted(() => { loadStats(); loadRules() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="动态规则引擎" tag="M41"
      subtitle="可视化规则配置 · 参数审批变更 · 历史试跑验证 · 灰度发布与一键回滚">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadRules()">刷新</el-button>
        <el-button :icon="'VideoPlay'" @click="runVisible = true">发起试跑</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openRuleForm()">新增规则</el-button>
      </template>
    </PageHeader>

    <!-- 指标卡 -->
    <div class="kpi-grid">
      <StatCard label="规则总数" :value="st?.totalRules || 0" unit="条" icon="SetUp" tone="primary"
        :desc="`已启用 ${st?.enabledRules || 0} · 停用 ${st?.disabledRules || 0}`" />
      <StatCard label="今日触发" :value="st?.todayTrigger || 0" unit="条" icon="Lightning" tone="accent" />
      <StatCard label="平均阳性率" :value="(st?.avgPositiveRate || 0) * 100" unit="%" icon="Aim" tone="success" :precision="1" />
      <StatCard label="平均误报率" :value="(st?.avgMisjudgeRate || 0) * 100" unit="%" icon="Warning" tone="warning" :precision="1" />
      <StatCard label="待审核参数变更" :value="st?.pendingParamChanges || 0" unit="项" icon="EditPen" tone="warning"
        clickable @click="activeTab = 'param'" />
      <StatCard label="进行中灰度" :value="st?.grayReleases || 0" unit="个" icon="Promotion" tone="primary"
        clickable @click="activeTab = 'gray'" />
    </div>

    <el-tabs v-model="activeTab" class="rule-tabs">
      <!-- ================= 规则配置 ================= -->
      <el-tab-pane label="可视化规则配置" name="rule">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">规则类型构成</span>
            </div>
            <EChart :option="ruleTypeOption" height="210px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">违规类型规则分布</span>
            </div>
            <EChart :option="violationOption" height="210px" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">规则库</span>
            <span class="section-title__desc">阈值类 / 比对类 / 行为类 / 关联类，支持模板复用与分组启停</span>
          </div>
          <el-form class="query-form" :model="rQ" @submit.prevent>
            <el-input v-model="rQ.keyword" placeholder="规则名称 / 编号 / 编码" clearable :prefix-icon="'Search'"
              style="width: 230px" @keyup.enter="rQ.page = 1; loadRules()" />
            <el-select v-model="rQ.ruleType" placeholder="规则类型" clearable style="width: 120px">
              <el-option v-for="t in ['阈值类', '比对类', '行为类', '关联类']" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="rQ.violationType" placeholder="违规类型" clearable style="width: 130px">
              <el-option v-for="t in ['超量开药', '重复收费', '串换药品', '过度诊疗', '虚假诊疗', '分解住院']" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="rQ.status" placeholder="状态" clearable style="width: 106px">
              <el-option label="已启用" value="已启用" />
              <el-option label="已停用" value="已停用" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="rQ.page = 1; loadRules()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(rQ, { keyword: '', ruleType: '', violationType: '', status: '', riskLevel: '', page: 1 }); loadRules()">重　置</el-button>
          </el-form>

          <el-table :data="rList" size="small" border stripe v-loading="rLoading">
            <el-table-column prop="ruleId" label="规则编号" width="146">
              <template #default="{ row }">
                <span class="num text-link" @click="openRule(row)">{{ row.ruleId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="ruleName" label="规则名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="类型" width="86" align="center">
              <template #default="{ row }">
                <el-tag :type="TYPE_TONE[row.ruleType]" size="small" effect="plain">{{ row.ruleType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="violationType" label="违规类型" width="100" align="center" />
            <el-table-column label="版本" width="76" align="center">
              <template #default="{ row }"><span class="num">{{ row.version }}</span></template>
            </el-table-column>
            <el-table-column label="累计触发 / 阳性率" width="150">
              <template #default="{ row }">
                <span class="num">{{ row.usageStats.triggerCount.toLocaleString() }}</span>
                <span class="text-mini"> / </span>
                <span class="num" :style="{ color: row.usageStats.positiveRate >= 0.5 ? 'var(--zh-success)' : 'var(--zh-warning)' }">
                  {{ (row.usageStats.positiveRate * 100).toFixed(1) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column label="误报率" width="88" align="right">
              <template #default="{ row }">
                <span class="num" :style="{ color: row.usageStats.misjudgmentRate > 0.1 ? 'var(--zh-danger)' : 'var(--zh-text-regular)' }">
                  {{ (row.usageStats.misjudgmentRate * 100).toFixed(1) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="riskLevel" label="风险" width="66" align="center">
              <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-switch :model-value="row.status === '已启用'" size="small" @change="doToggleRule(row)" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="128" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openRule(row)">详情</el-button>
                <el-button link type="warning" :icon="'EditPen'" @click="openRuleForm(row)">编辑</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无规则" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ rTotal }} 条</span>
            <el-pagination v-model:current-page="rQ.page" v-model:page-size="rQ.pageSize" :total="rTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadRules" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 参数管理 ================= -->
      <el-tab-pane label="规则参数管理" name="param">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">参数清单</span>
            <span class="section-title__desc">阈值 / 时间窗口 / 权重集中管理，变更需审批，关键参数双人复核</span>
          </div>
          <el-form class="query-form" :model="pQ" @submit.prevent>
            <el-input v-model="pQ.keyword" placeholder="参数名称 / 编码 / 规则" clearable :prefix-icon="'Search'"
              style="width: 230px" @keyup.enter="pQ.page = 1; loadParams()" />
            <el-select v-model="pQ.paramType" placeholder="参数类型" clearable style="width: 120px">
              <el-option v-for="t in ['数值型', '时间型', '枚举型', '权重型', '布尔型']" :key="t" :label="t" :value="t" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="pQ.page = 1; loadParams()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(pQ, { keyword: '', paramType: '', page: 1 }); loadParams()">重　置</el-button>
          </el-form>

          <el-table :data="pList" size="small" border stripe v-loading="pLoading">
            <el-table-column prop="paramId" label="参数编号" width="180">
              <template #default="{ row }">
                <span class="num text-link" @click="openParam(row)">{{ row.paramId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paramName" label="参数名称" min-width="170" show-overflow-tooltip />
            <el-table-column prop="ruleName" label="所属规则" min-width="170" show-overflow-tooltip />
            <el-table-column label="类型" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain" type="info">{{ row.paramType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="当前值" width="110" align="right">
              <template #default="{ row }">
                <span class="num" style="font-weight: 700">{{ row.currentValue }} {{ row.unit }}</span>
              </template>
            </el-table-column>
            <el-table-column label="取值范围" width="120" align="center">
              <template #default="{ row }"><span class="num text-mini">{{ row.minValue }} - {{ row.maxValue }} {{ row.unit }}</span></template>
            </el-table-column>
            <el-table-column label="待审核变更" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.pendingChange" type="warning" size="small" effect="dark">待审核</el-tag>
                <span v-else class="text-mini">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="lastUpdated" label="最近更新" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.lastUpdated }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openParam(row)">详情</el-button>
                <el-button link type="warning" :icon="'EditPen'" @click="openChg(row)">变更</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无参数" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ pTotal }} 条</span>
            <el-pagination v-model:current-page="pQ.page" v-model:page-size="pQ.pageSize" :total="pTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadParams" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 试跑验证 ================= -->
      <el-tab-pane label="规则试跑验证" name="trial">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">试跑记录</span>
            <span class="section-title__desc">历史数据试跑不影响生产环境，结果仅供上线决策参考</span>
            <span class="section-title__extra">
              <el-button type="primary" size="small" :icon="'VideoPlay'" @click="runVisible = true">发起试跑</el-button>
            </span>
          </div>

          <el-table :data="tList" size="small" border stripe v-loading="tLoading">
            <el-table-column prop="trialId" label="试跑编号" width="168">
              <template #default="{ row }">
                <span class="num text-link" @click="openTrial(row)">{{ row.trialId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="trialName" label="试跑名称" min-width="210" show-overflow-tooltip />
            <el-table-column prop="trialType" label="试跑方式" width="150" show-overflow-tooltip />
            <el-table-column label="版本对比" width="130" align="center">
              <template #default="{ row }">
                <span class="num">{{ row.currentVersion }}</span>
                <el-icon :size="11" style="margin: 0 3px; vertical-align: -1px"><Right /></el-icon>
                <span class="num" style="color: var(--zh-primary); font-weight: 700">{{ row.trialVersion }}</span>
              </template>
            </el-table-column>
            <el-table-column label="误报率变化" width="110" align="right">
              <template #default="{ row }">
                <span class="num" :style="{ color: row.results.comparison.misjudgmentRateChange < 0 ? 'var(--zh-success)' : 'var(--zh-danger)', fontWeight: 700 }">
                  {{ row.results.comparison.misjudgmentRateChange > 0 ? '+' : '' }}{{ (row.results.comparison.misjudgmentRateChange * 100).toFixed(1) }}pp
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="trialTime" label="试跑时间" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.trialTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="76" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openTrial(row)">报告</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无试跑记录" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ tTotal }} 条</span>
            <el-pagination v-model:current-page="tQ.page" v-model:page-size="tQ.pageSize" :total="tTotal"
              layout="prev, pager, next" small background @change="loadTrials" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 灰度发布 ================= -->
      <el-tab-pane label="版本灰度管理" name="gray">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">发布记录</span>
            <span class="section-title__desc">试跑验证 → 灰度发布 → 灰度观察 → 评估 → 全量 / 回滚</span>
          </div>

          <el-table :data="gList" size="small" border stripe v-loading="gLoading">
            <el-table-column prop="releaseId" label="发布编号" width="180">
              <template #default="{ row }">
                <span class="num text-link" @click="openRelease(row)">{{ row.releaseId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="releaseName" label="发布名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="版本" width="120" align="center">
              <template #default="{ row }">
                <span class="num">{{ row.fromVersion }}</span>
                <el-icon :size="11" style="margin: 0 3px; vertical-align: -1px"><Right /></el-icon>
                <span class="num" style="color: var(--zh-primary); font-weight: 700">{{ row.toVersion }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="grayStrategy.type" label="灰度策略" width="130" align="center" />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="approver" label="审批人" width="140" />
            <el-table-column prop="createTime" label="创建时间" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.createTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="76" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openRelease(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无发布记录" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ gTotal }} 条</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 规则详情抽屉 ============ -->
    <el-drawer v-model="rDrawer" size="680px" title="规则配置详情">
      <template v-if="curRule">
        <div v-loading="rDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curRule.ruleName }}
              <el-tag :type="TYPE_TONE[curRule.ruleType]" size="small" effect="plain">{{ curRule.ruleType }}</el-tag>
              <el-tag :type="curRule.status === '已启用' ? 'success' : 'info'" size="small" effect="dark">{{ curRule.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curRule.ruleId }}</span>
              <span><el-icon><PriceTag /></el-icon>{{ curRule.ruleCode }}</span>
              <span><el-icon><Files /></el-icon>当前 {{ curRule.version }}</span>
            </div>
            <div class="dt-hero__d">{{ curRule.description }}</div>
          </div>

          <div class="sub-title">触发条件（{{ curRule.triggerConditions.logic }}）</div>
          <div class="conds">
            <div v-for="(c, i) in curRule.triggerConditions.conditions" :key="i" class="cond">
              <span class="cond__no num">{{ i + 1 }}</span>
              <span class="cond__f">{{ c.field }}</span>
              <span class="cond__op num">{{ c.operator }}</span>
              <span class="cond__v num">{{ Array.isArray(c.value) ? c.value.join('、') : (c.value === null ? '同组' : c.value) }}{{ c.unit || '' }}</span>
              <el-tag size="small" type="info" effect="plain" style="margin-left: auto">{{ c.fieldType }}</el-tag>
            </div>
          </div>

          <div class="sub-title">适用范围</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="机构类型">
              <el-tag v-for="t in curRule.applicableScope.orgTypes" :key="t" size="small" effect="plain" class="mr4">{{ t }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="区域">{{ curRule.applicableScope.areas.join('、') }}</el-descriptions-item>
            <el-descriptions-item label="险种">{{ curRule.applicableScope.insuranceTypes.join('、') }}</el-descriptions-item>
            <el-descriptions-item v-if="curRule.applicableScope.exceptions?.length" label="排除情形">
              <el-tag v-for="t in curRule.applicableScope.exceptions" :key="t" size="small" type="warning" effect="plain" class="mr4">{{ t }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="sub-title">处置与依据</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="处置建议">{{ curRule.disposalSuggestion }}</el-descriptions-item>
            <el-descriptions-item label="取证模板">{{ curRule.evidenceTemplate }}</el-descriptions-item>
            <el-descriptions-item label="法律依据">{{ curRule.legalBasis }}</el-descriptions-item>
          </el-descriptions>

          <div class="sub-title">运行效果</div>
          <div class="dt-kpi">
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ curRule.usageStats.triggerCount.toLocaleString() }}</div><div class="dt-kpi__l">累计触发</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ curRule.usageStats.confirmedCount.toLocaleString() }}</div><div class="dt-kpi__l">确认违规</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-success)">{{ (curRule.usageStats.positiveRate * 100).toFixed(1) }}%</div><div class="dt-kpi__l">阳性率</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-warning)">{{ (curRule.usageStats.misjudgmentRate * 100).toFixed(1) }}%</div><div class="dt-kpi__l">误报率</div></div>
          </div>

          <div class="sub-title">标签</div>
          <el-tag v-for="t in curRule.tags" :key="t" size="small" effect="plain" class="mr4">{{ t }}</el-tag>

          <div class="dt-actions">
            <el-button type="primary" :icon="'EditPen'" @click="openRuleForm(curRule)">编辑规则</el-button>
            <el-button :icon="'VideoPlay'" @click="rDrawer = false; runForm.ruleId = curRule.ruleId; runVisible = true">基于此规则试跑</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 参数详情抽屉 ============ -->
    <el-drawer v-model="pDrawer" size="620px" title="参数详情与变更审批">
      <template v-if="curParam">
        <div v-loading="pDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curParam.paramName }}
              <el-tag size="small" type="info" effect="plain">{{ curParam.paramType }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curParam.paramId }}</span>
              <span><el-icon><SetUp /></el-icon>{{ curParam.ruleName }}</span>
            </div>
            <div class="dt-hero__d">{{ curParam.description }}</div>
          </div>

          <div class="dt-kpi">
            <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-primary)">{{ curParam.currentValue }} {{ curParam.unit }}</div><div class="dt-kpi__l">当前值</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ curParam.defaultValue }} {{ curParam.unit }}</div><div class="dt-kpi__l">默认值</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ curParam.minValue }} - {{ curParam.maxValue }}</div><div class="dt-kpi__l">取值范围（{{ curParam.unit }}）</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ curParam.changeHistory?.length || 0 }}</div><div class="dt-kpi__l">变更次数</div></div>
          </div>

          <template v-if="curParam.pendingChange">
            <div class="sub-title">待审核变更</div>
            <el-alert type="warning" :closable="false" show-icon class="mb12">
              <template #title>
                <b>{{ curParam.pendingChange.changeType }}</b>
                <span class="text-mini" style="margin-left: 8px">预计效果：{{ curParam.pendingChange.estimatedEffect }}</span>
              </template>
              <div class="text-mini">
                {{ curParam.pendingChange.reason }}<br>
                申请人：{{ curParam.pendingChange.requester }} · {{ curParam.pendingChange.requestTime }} · 待 {{ curParam.pendingChange.approver }} 审核
              </div>
            </el-alert>
            <div class="dt-actions">
              <el-button type="danger" plain :loading="approving" @click="doApprove('驳回')">驳回</el-button>
              <el-button type="primary" :loading="approving" @click="doApprove('通过')">审核通过并生效</el-button>
            </div>
          </template>

          <div class="sub-title">变更历史</div>
          <el-timeline>
            <el-timeline-item v-for="h in curParam.changeHistory" :key="h.version"
              :type="h.status === '已生效' ? 'primary' : 'info'" :timestamp="h.time" size="normal">
              <div class="tl__n">
                {{ h.version }} · {{ h.changeType }}为 {{ h.value }} {{ curParam.unit }}
                <el-tag :type="h.status === '已生效' ? 'success' : 'info'" size="small" effect="plain" style="margin-left: 6px">{{ h.status }}</el-tag>
              </div>
              <div class="tl__d">{{ h.reason }} · 操作人 {{ h.operator }} · 审批人 {{ h.approver }}</div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 参数变更弹窗 ============ -->
    <el-dialog v-model="chgVisible" title="发起参数变更申请" width="540px">
      <el-alert type="info" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">参数变更需经业务负责人审核后生效；关键参数触发双人复核（RC-002）</span>
        </template>
      </el-alert>
      <el-form label-width="92px">
        <el-form-item label="参数">
          <el-input :model-value="curParam ? curParam.paramName + '（当前 ' + curParam.currentValue + ' ' + curParam.unit + '）' : ''" disabled />
        </el-form-item>
        <el-form-item label="新值" required>
          <el-input-number v-model="chgForm.newValue" :min="curParam?.minValue" :max="curParam?.maxValue" style="width: 180px" />
          <span class="text-mini" style="margin-left: 8px">{{ curParam?.unit }}（范围 {{ curParam?.minValue }}-{{ curParam?.maxValue }}）</span>
        </el-form-item>
        <el-form-item label="变更类型" required>
          <el-input v-model="chgForm.changeType" placeholder="如：阈值调整 / 增加识别场景" />
        </el-form-item>
        <el-form-item label="变更理由" required>
          <el-input v-model="chgForm.reason" type="textarea" :rows="3" placeholder="请说明变更依据与预期效果" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="chgVisible = false">取消</el-button>
        <el-button type="primary" :loading="chgSubmitting" @click="doSubmitChg">提交审核</el-button>
      </template>
    </el-dialog>

    <!-- ============ 发起试跑弹窗 ============ -->
    <el-dialog v-model="runVisible" title="发起规则试跑" width="560px">
      <el-form label-width="92px">
        <el-form-item label="试跑规则" required>
          <el-select v-model="runForm.ruleId" placeholder="选择规则" style="width: 100%">
            <el-option v-for="r in rList" :key="r.ruleId" :label="`${r.ruleName}（${r.version}）`" :value="r.ruleId" />
          </el-select>
        </el-form-item>
        <el-form-item label="试跑方式" required>
          <el-radio-group v-model="runForm.trialMode">
            <el-radio-button label="全量历史数据试跑" />
            <el-radio-button label="抽样数据试跑" />
            <el-radio-button label="新旧规则对比试跑" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="数据范围">
          <el-date-picker v-model="runForm.startTime" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
          <span style="margin: 0 6px">至</span>
          <el-date-picker v-model="runForm.endTime" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runVisible = false">取消</el-button>
        <el-button type="primary" :loading="running" @click="doRunTrial">开始试跑</el-button>
      </template>
    </el-dialog>

    <!-- ============ 试跑报告抽屉 ============ -->
    <el-drawer v-model="tDrawer" size="720px" title="试跑验证报告">
      <template v-if="curTrial">
        <div v-loading="tDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curTrial.trialName }}
              <el-tag type="success" size="small" effect="dark">{{ curTrial.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curTrial.trialId }}</span>
              <span><el-icon><SetUp /></el-icon>{{ curTrial.ruleName }}</span>
              <span><el-icon><Timer /></el-icon>耗时 {{ curTrial.trialDuration }}</span>
            </div>
            <div class="dt-hero__d">{{ curTrial.changeContent }}</div>
          </div>

          <div class="sub-title">新旧版本效果对比</div>
          <EChart :option="trialCompareOption" height="230px" />
          <div class="cmp">
            <div class="cmp__i" v-for="c in [
              { l: '触发量变化', v: curTrial.results.comparison.triggerChange, good: curTrial.results.comparison.triggerChange < 0 },
              { l: '阳性率变化', v: (curTrial.results.comparison.positiveRateChange * 100).toFixed(1) + 'pp', good: curTrial.results.comparison.positiveRateChange > 0 },
              { l: '误报率变化', v: (curTrial.results.comparison.misjudgmentRateChange * 100).toFixed(1) + 'pp', good: curTrial.results.comparison.misjudgmentRateChange < 0 },
              { l: '确认违规损失', v: curTrial.results.comparison.confirmedLoss + ' 条（' + (curTrial.results.comparison.confirmedLossRate * 100).toFixed(1) + '%）', good: curTrial.results.comparison.confirmedLossRate < 0.05 }
            ]" :key="c.l">
              <span class="cmp__l">{{ c.l }}</span>
              <b class="cmp__v num" :style="{ color: c.good ? 'var(--zh-success)' : 'var(--zh-danger)' }">{{ typeof c.v === 'number' && c.v > 0 ? '+' : '' }}{{ c.v }}</b>
            </div>
          </div>
          <el-alert type="success" :closable="false" show-icon class="mb12">
            <template #title><span class="text-mini">{{ curTrial.results.comparison.conclusion }}</span></template>
          </el-alert>

          <div class="sub-title">抽样触发明细</div>
          <el-table :data="curTrial.sampleTriggers" size="small" border stripe>
            <el-table-column prop="clueId" label="线索编号" width="130">
              <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
            </el-table-column>
            <el-table-column prop="orgName" label="机构" min-width="130" show-overflow-tooltip />
            <el-table-column prop="drug" label="项目/药品" width="110" />
            <el-table-column prop="days" label="日量" width="64" align="right">
              <template #default="{ row }"><span class="num">{{ row.days }}</span></template>
            </el-table-column>
            <el-table-column :label="curTrial.currentVersion" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.currentTriggered ? 'danger' : 'info'" size="small" effect="plain">{{ row.currentTriggered ? '触发' : '未触发' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="curTrial.trialVersion" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.trialTriggered ? 'danger' : 'success'" size="small" effect="dark">{{ row.trialTriggered ? '触发' : '排除' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="判定理由" min-width="180" show-overflow-tooltip />
          </el-table>

          <div class="sub-title">风险提示与上线建议</div>
          <el-alert v-for="(w, i) in curTrial.riskWarnings" :key="i" type="warning" :closable="false" show-icon class="mb12">
            <template #title><span class="text-mini">{{ w.content }}</span></template>
            <div class="text-mini">建议：{{ w.suggestion }}</div>
          </el-alert>
          <el-alert type="primary" :closable="false" show-icon>
            <template #title><span class="text-mini"><b>上线建议：</b>{{ curTrial.onlineSuggestion }}</span></template>
          </el-alert>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 灰度详情抽屉 ============ -->
    <el-drawer v-model="gDrawer" size="720px" title="灰度发布详情">
      <template v-if="curRelease">
        <div v-loading="gDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curRelease.releaseName }}
              <el-tag :type="STATUS_TONE[curRelease.status] || 'info'" size="small" effect="dark">{{ curRelease.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curRelease.releaseId }}</span>
              <span><el-icon><SetUp /></el-icon>{{ curRelease.ruleName }}</span>
              <span><el-icon><User /></el-icon>审批人 {{ curRelease.approver }}</span>
            </div>
          </div>

          <div class="sub-title">灰度策略</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="策略类型">{{ curRelease.grayStrategy.type }}</el-descriptions-item>
            <el-descriptions-item label="灰度周期">{{ curRelease.grayStrategy.grayPeriod }}</el-descriptions-item>
            <el-descriptions-item v-if="curRelease.grayStrategy.pilotAreas" label="试点区域" :span="2">
              <el-tag v-for="a in curRelease.grayStrategy.pilotAreas" :key="a" size="small" effect="plain" class="mr4">{{ a }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="双版本并行" :span="2">{{ curRelease.grayStrategy.dualRunDescription }}</el-descriptions-item>
          </el-descriptions>

          <template v-if="curRelease.grayMetrics.daily?.length">
            <div class="sub-title">灰度观察指标（第 {{ curRelease.grayMetrics.elapsedDays }} 天 / 余 {{ curRelease.grayMetrics.remainingDays }} 天）</div>
            <EChart :option="grayOption" height="240px" />
          </template>

          <div class="sub-title">灰度评估</div>
          <el-alert :type="curRelease.grayEvaluation.status === '已完成' ? 'success' : 'warning'" :closable="false" show-icon class="mb12">
            <template #title>
              <span class="text-mini"><b>{{ curRelease.grayEvaluation.status }}</b> · {{ curRelease.grayEvaluation.preliminaryConclusion }}</span>
            </template>
          </el-alert>

          <div class="sub-title">版本列表</div>
          <el-timeline>
            <el-timeline-item v-for="v in curRelease.versionList" :key="v.version"
              :type="v.status === '当前全量' ? 'primary' : v.status === '灰度中' ? 'warning' : 'info'"
              :timestamp="v.releaseDate" size="normal">
              <div class="tl__n">
                {{ v.version }}
                <el-tag :type="v.status === '当前全量' ? 'success' : v.status === '灰度中' ? 'warning' : 'info'" size="small" effect="plain" style="margin-left: 6px">{{ v.status }}</el-tag>
              </div>
              <div class="tl__d">{{ v.changes }}</div>
            </el-timeline-item>
          </el-timeline>

          <template v-if="curRelease.status === '灰度进行中'">
            <div class="sub-title">操作</div>
            <el-alert type="info" :closable="false" show-icon class="mb12">
              <template #title><span class="text-mini">回滚触发条件：{{ curRelease.rollback.rollbackTrigger }}</span></template>
            </el-alert>
            <div class="dt-actions">
              <el-button type="danger" plain :loading="acting" @click="doReleaseAction('rollback')">一键回滚</el-button>
              <el-button type="primary" :loading="acting" @click="doReleaseAction('full')">评估通过 · 全量发布</el-button>
            </div>
          </template>
        </div>
      </template>
    </el-drawer>
    <!-- ============ 规则新增 / 编辑弹窗（可视化条件构建器） ============ -->
    <el-dialog v-model="rfVisible" :title="rfEditing ? '编辑规则' : '新增规则'" width="720px" top="6vh" destroy-on-close>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="规则名称" required>
              <el-input v-model="rf.ruleName" placeholder="如：慢性病开药不超过7日量" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="规则类型" required>
              <el-select v-model="rf.ruleType" style="width: 100%">
                <el-option v-for="t in ['阈值类', '比对类', '行为类', '关联类']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="风险等级" required>
              <el-select v-model="rf.riskLevel" style="width: 100%">
                <el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="违规类型" required>
              <el-select v-model="rf.violationType" style="width: 100%">
                <el-option v-for="t in ['超量开药', '重复收费', '串换药品', '过度诊疗', '虚假诊疗', '分解住院', '无指征收费']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规则分类">
              <el-select v-model="rf.category" style="width: 100%" placeholder="选择分类">
                <el-option v-for="c in ['药品监管', '收费监管', '诊疗监管', '住院监管']" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="规则描述">
          <el-input v-model="rf.description" type="textarea" :rows="2" placeholder="规则的识别目标与业务说明" />
        </el-form-item>

        <el-form-item label="触发条件" required>
          <div class="builder">
            <div class="builder__head">
              <span class="text-mini">条件组合逻辑</span>
              <el-radio-group v-model="rf.logic" size="small">
                <el-radio-button label="AND">全部满足（AND）</el-radio-button>
                <el-radio-button label="OR">任一满足（OR）</el-radio-button>
              </el-radio-group>
              <el-button link type="primary" size="small" :icon="'Plus'" style="margin-left: auto" @click="addCond">添加条件</el-button>
            </div>
            <div v-for="(c, i) in rf.conditions" :key="i" class="builder__row">
              <span class="builder__no num">{{ i + 1 }}</span>
              <el-input v-model="c.field" placeholder="字段，如 开药数量/日剂量" style="width: 200px" size="small" />
              <el-select v-model="c.operator" style="width: 92px" size="small">
                <el-option v-for="op in ['=', '!=', '>', '>=', '<', '<=', 'in', 'not in', 'same']" :key="op" :label="op" :value="op" />
              </el-select>
              <el-input v-model="c.value" placeholder="取值" style="flex: 1" size="small" />
              <el-input v-model="c.unit" placeholder="单位" style="width: 70px" size="small" />
              <el-select v-model="c.fieldType" style="width: 92px" size="small">
                <el-option v-for="t in ['枚举', '数值', '布尔', '集合', '分组']" :key="t" :label="t" :value="t" />
              </el-select>
              <el-button link type="danger" size="small" :icon="'Delete'" @click="removeCond(i)" />
            </div>
          </div>
        </el-form-item>

        <el-form-item label="法律依据">
          <el-input v-model="rf.legalBasis" placeholder="如：《处方管理办法》第十九条" />
        </el-form-item>
        <el-form-item label="处置建议">
          <el-input v-model="rf.disposalSuggestion" type="textarea" :rows="2" placeholder="触发后的建议核查与处置路径" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rfVisible = false">取消</el-button>
        <el-button type="primary" :loading="rfSaving" @click="doSaveRule">{{ rfEditing ? '保存新版本' : '创建规则' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mr4 { margin-right: 4px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.rule-tabs { margin-top: 2px; }

.sub-title {
  margin: 16px 0 10px;
  font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.dt-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-fs-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 14px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__d { margin-top: 8px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary); }
}

.dt-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px;

  &__c {
    padding: 9px 6px; text-align: center;
    border-radius: 6px; background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__v { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

.conds { display: flex; flex-direction: column; gap: 6px; }

.cond {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__no {
    width: 18px; height: 18px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 10px; font-weight: 800;
  }
  &__f { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); }
  &__op { font-size: 11px; color: var(--zh-accent); font-weight: 700; }
  &__v { font-size: 11px; color: var(--zh-text-regular); }
}

.cmp {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 12px;

  &__i {
    padding: 8px 10px; border-radius: 6px;
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  }
  &__l { display: block; font-size: 10px; color: var(--zh-text-secondary); }
  &__v { display: block; margin-top: 3px; font-size: 15px; font-weight: 800; }
}

.tl__n { font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-primary); }
.tl__d { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; line-height: 1.6; }

.dt-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 可视化条件构建器 ---------- */
.builder {
  width: 100%; padding: 10px; border-radius: 8px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__head {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  }

  &__row {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    padding: 6px 8px; border-radius: 6px;
    background: #fff; border: 1px solid var(--zh-border-light);
    transition: border-color .15s;

    &:hover { border-color: var(--zh-primary-light); }
  }

  &__no {
    width: 18px; height: 18px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 10px; font-weight: 800;
  }
}
</style>
