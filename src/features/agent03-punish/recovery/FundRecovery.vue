<script setup lang="ts">
import {
  getRecoveryStats, getRecoveryList, getRecoveryDetail, writeOffRecovery, urgeRecovery
} from '@/api/agent03-punish/punish'
import { fmtMoney, fmtWan, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { exportCsv } from '@/utils/legalDoc'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const selection = ref<any[]>([])
const expand = ref(false)

const q = reactive({
  keyword: '', status: '', recoveryMethod: '', district: '', orgType: '', overdue: '',
  page: 1, pageSize: 15
})

const STATUS_TONE: Record<string, string> = {
  待追回: 'info', 追回中: 'warning', 已追回: 'success', 部分追回: 'warning',
  逾期未追回: 'danger', '核销（无法追回）': 'danger'
}

async function loadStats() { st.value = await getRecoveryStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getRecoveryList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', status: '', recoveryMethod: '', district: '', orgType: '', overdue: '', page: 1 })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'overdue') q.overdue = 'true'
  else if (t === 'part') q.status = '部分追回'
  else if (t === 'pending') q.status = '待追回'
  load()
}

/* ---------- 详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  try { cur.value = await getRecoveryDetail(row.recoveryId) } finally { detailLoading.value = false }
}

/* ---------- 到账核销 ---------- */
const woVisible = ref(false)
const woSaving = ref(false)
const woResult = ref<any>(null)
const woForm = reactive({
  paymentDate: '',
  paymentAmount: 0,
  payer: '',
  voucherNo: '',
  method: '主动退回',
  operator: '稽核员·王振华',
  reviewer: '',
  summary: ''
})

function openWo(row?: any) {
  const target = row || cur.value
  if (!target) return
  woTarget.value = target
  woResult.value = null
  Object.assign(woForm, {
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentAmount: target.amount.unrecoveredTotal,
    payer: target.orgName,
    voucherNo: '',
    method: target.recoveryMethod,
    operator: '稽核员·王振华',
    reviewer: '',
    summary: `${target.orgName}违规医保基金退回`
  })
  woVisible.value = true
}
const woTarget = ref<any>(null)

async function doWriteOff() {
  if (!woForm.voucherNo.trim()) { msg.warning('请填写到账凭证号'); return }
  if (!woForm.reviewer) { msg.warning('核销需双人确认，请选择复核人'); return }
  if (woForm.paymentAmount <= 0) { msg.warning('到账金额须大于 0'); return }
  woSaving.value = true
  try {
    const res: any = await writeOffRecovery({ recoveryId: woTarget.value.recoveryId, ...woForm })
    woResult.value = res
    msg.success(res?.message || '核销完成')
    await Promise.all([loadStats(), load()])
    if (cur.value?.recoveryId === woTarget.value.recoveryId) {
      cur.value = await getRecoveryDetail(cur.value.recoveryId)
    }
  } finally { woSaving.value = false }
}

/* ---------- 催缴 ---------- */
const urging = ref(false)
async function doUrge(row?: any) {
  const targets = row ? [row] : selection.value
  if (!targets.length) { msg.warning('请先勾选需催缴的台账'); return }
  urging.value = true
  try {
    const res: any = await urgeRecovery({ recoveryIds: targets.map((t) => t.recoveryId) })
    msg.success(res?.message || '催缴通知已发送')
    selection.value = []
  } finally { urging.value = false }
}

const MEMBERS = ['稽核员·李明华', '稽核员·陈晓东', '稽核员·刘丽娟', '稽核组长·张建国']

/** 导出基金追回台账 */
function doExportLedger() {
  if (!list.value.length) { msg.warning('当前无可导出数据'); return }
  exportCsv(
    `基金追回台账_${new Date().toISOString().slice(0, 10)}`,
    ['追回编号', '关联确认书', '被追回机构', '机构编码', '所属辖区', '违规类型',
      '违规本金(元)', '罚款(元)', '利息(元)', '应追合计(元)',
      '已追回(元)', '未追回(元)', '追回率(%)',
      '追回方式', '追回状态', '追缴期限', '是否逾期', '逾期天数'],
    list.value.map((r: any) => [
      r.recoveryId, r.confirmationId, r.orgName, r.orgCode, r.district, r.violationType,
      r.amount.shouldPrincipal, r.amount.shouldFine, r.amount.shouldInterest, r.amount.shouldTotal,
      r.amount.recoveredTotal, r.amount.unrecoveredTotal, r.amount.recoveryRate,
      r.recoveryMethod, r.status, r.plan.deadline, r.overdue ? '是' : '否', r.overdueDays
    ])
  )
  msg.success(`已导出 ${list.value.length} 条基金追回台账`)
}

/* ---------- 图表 ---------- */
const statusOption = computed(() => {
  const d = (st.value?.statusDist || []).filter((i: any) => i.value > 0)
  const colors: Record<string, string> = {
    待追回: '#5a7189', 追回中: '#e8a30c', 已追回: '#12a150', 部分追回: '#3c88ff',
    逾期未追回: '#e5484d', '核销（无法追回）': '#d4380d'
  }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 笔 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['44%', '66%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] } }))
    }]
  }
})

const trendOption = computed(() => {
  const d = st.value?.monthTrend || []
  return {
    color: ['#e5484d', '#12a150'],
    tooltip: { trigger: 'axis', formatter: (ps: any) => ps.map((p: any) => `${p.seriesName}: ${(p.value / 10000).toFixed(1)} 万元`).join('<br/>') },
    legend: { data: ['违规金额', '已追回'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 48, bottom: 28 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.month.slice(5) + '月'),
      axisLabel: { fontSize: 10, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '万元', nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000).toFixed(0) }
    },
    series: [
      { name: '违规金额', type: 'bar', barWidth: 16, itemStyle: { color: '#e5484d', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.violationAmount) },
      { name: '已追回', type: 'bar', barWidth: 16, itemStyle: { color: '#12a150', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.recoveredAmount) }
    ]
  }
})

const methodOption = computed(() => {
  const d = (st.value?.methodDist || []).filter((i: any) => i.value > 0)
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 106, right: 28, top: 10, bottom: 22 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: {
      type: 'category', data: d.map((i: any) => i.name).reverse(),
      axisLabel: { fontSize: 10, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: 13,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: (p: any) => CHART_COLORS[p.dataIndex % CHART_COLORS.length] },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.value).reverse()
    }]
  }
})

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="基金追回台账" tag="M21"
      subtitle="应追已追未追全量登记 · 到账凭证核销 · 双人确认 · 逾期自动催缴升级">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Warning'" @click="quick('overdue')">逾期未追</el-button>
        <el-button type="primary" :icon="'BellFilled'" :disabled="!selection.length" :loading="urging" @click="doUrge()">
          催缴<template v-if="selection.length">（{{ selection.length }}）</template>
        </el-button>
      </template>
    </PageHeader>

    <!-- 指标 -->
    <div class="kpi-grid">
      <StatCard label="应追缴总额" :value="fmtWan(st?.shouldRecoverTotal || 0)" unit="元" icon="Coin" tone="danger" />
      <StatCard label="已追回" :value="fmtWan(st?.recoveredTotal || 0)" unit="元" icon="CircleCheck" tone="success" />
      <StatCard label="未追回" :value="fmtWan(st?.unrecoveredTotal || 0)" unit="元" icon="Warning" tone="warning" />
      <StatCard label="追回率" :value="st?.recoveryRate || 0" unit="%" icon="TrendCharts" tone="primary" :precision="1" />
      <StatCard label="台账笔数" :value="st?.total || 0" unit="笔" icon="Tickets" tone="accent" />
      <StatCard label="逾期笔数" :value="st?.overdueCount || 0" unit="笔" icon="AlarmClock" tone="danger" clickable @click="quick('overdue')" />
    </div>

    <!-- 图表 -->
    <div class="chart-grid">
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">追回状态分布</span>
        </div>
        <EChart :option="statusOption" height="212px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">违规与追回金额趋势</span>
        </div>
        <EChart :option="trendOption" height="212px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">追回方式分布</span>
        </div>
        <EChart :option="methodOption" height="212px" />
      </div>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">追回台账查询</span>
        <span class="section-title__desc">应追金额 = 违规本金 + 罚款金额 + 利息；追回率 = 已追 / 应追</span>
      </div>
      <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="追回编号/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="追回状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in ['待追回', '追回中', '已追回', '部分追回', '逾期未追回', '核销（无法追回）']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="追回方式">
          <el-select v-model="q.recoveryMethod" placeholder="全部方式" clearable>
            <el-option v-for="m in ['主动退回', '医保结算扣缴', '银行划拨', '法院强制执行', '其他']" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否逾期">
          <el-select v-model="q.overdue" placeholder="全部" clearable>
            <el-option label="仅看逾期" value="true" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="所属辖区">
            <el-select v-model="q.district" placeholder="全部辖区" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="机构类型">
            <el-select v-model="q.orgType" placeholder="全部" clearable>
              <el-option label="医院" value="医院" />
              <el-option label="药店" value="药店" />
            </el-select>
          </el-form-item>
        </template>

        <div class="query-form__actions">
          <el-button link type="primary" @click="expand = !expand">
            {{ expand ? '收起' : '展开' }}
            <el-icon><component :is="expand ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          </el-button>
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </div>
      </el-form>
    </div>

    <!-- 台账 -->
    <div class="section-card">
      <div class="table-toolbar">
        <el-button :icon="'Money'" @click="quick('part')">仅看部分追回</el-button>
        <el-button :icon="'BellFilled'" :disabled="!selection.length" :loading="urging" @click="doUrge()">批量催缴</el-button>
        <span class="text-mini">已选 {{ selection.length }} 笔</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Download'" @click="doExportLedger">导出台账</el-button>
        </div>
      </div>

      <el-table :data="list" size="small" border stripe v-loading="loading"
        :row-class-name="({ row }: any) => (row.overdue ? 'row-over' : '')"
        @selection-change="(v: any[]) => (selection = v)">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="recoveryId" label="追回编号" width="150">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.recoveryId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="被追回机构" min-width="170" show-overflow-tooltip />
        <el-table-column prop="violationType" label="违规类型" width="106" align="center">
          <template #default="{ row }"><el-tag size="small" type="warning" effect="plain">{{ row.violationType }}</el-tag></template>
        </el-table-column>
        <el-table-column label="应追缴" width="118" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount.shouldTotal) }}</span></template>
        </el-table-column>
        <el-table-column label="已追回" width="118" align="right">
          <template #default="{ row }">
            <span class="num" style="color: var(--zh-success); font-weight: 700">{{ fmtMoney(row.amount.recoveredTotal) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="未追回" width="118" align="right">
          <template #default="{ row }">
            <span v-if="row.amount.unrecoveredTotal" class="num num--money">{{ fmtMoney(row.amount.unrecoveredTotal) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="追回率" width="128">
          <template #default="{ row }">
            <el-progress :percentage="row.amount.recoveryRate" :stroke-width="10" :text-inside="true"
              :status="row.amount.recoveryRate >= 100 ? 'success' : row.overdue ? 'exception' : undefined" />
          </template>
        </el-table-column>
        <el-table-column prop="recoveryMethod" label="追回方式" width="120" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.recoveryMethod }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="118" align="center">
          <template #default="{ row }">
            <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="追缴期限" width="112">
          <template #default="{ row }">
            <span class="num text-mini" :class="{ 'is-over': row.overdue }">{{ row.plan.deadline }}</span>
            <span v-if="row.overdue" class="over-tag">逾期{{ row.overdueDays }}天</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
            <el-button link type="success" :icon="'Money'"
              :disabled="row.amount.unrecoveredTotal <= 0" @click="openWo(row)">核销</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无符合条件的追回台账" height="140px" /></template>
      </el-table>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 条</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="620px" title="追回台账详情">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <div class="rc-hero" :class="{ 'is-over': cur.overdue }">
            <div class="rc-hero__t">
              {{ cur.orgName }}
              <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              <el-tag v-if="cur.overdue" size="small" type="danger" effect="dark">逾期 {{ cur.overdueDays }} 天</el-tag>
            </div>
            <div class="rc-hero__m">
              <span><el-icon><Tickets /></el-icon>{{ cur.recoveryId }}</span>
              <span><el-icon><Files /></el-icon>{{ cur.confirmationId }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
              <span><el-icon><Clock /></el-icon>期限 {{ cur.plan.deadline }}</span>
            </div>
            <el-progress :percentage="cur.amount.recoveryRate" :stroke-width="9" class="rc-hero__pg"
              :status="cur.amount.recoveryRate >= 100 ? 'success' : cur.overdue ? 'exception' : undefined" />
          </div>

          <div class="sub-title">金额构成</div>
          <div class="amt-grid">
            <div class="amt-c">
              <div class="amt-c__l">违规本金</div>
              <div class="amt-c__v num num--money">{{ fmtMoney(cur.amount.shouldPrincipal) }}</div>
            </div>
            <div class="amt-c">
              <div class="amt-c__l">罚款金额</div>
              <div class="amt-c__v num num--money">{{ cur.amount.shouldFine ? fmtMoney(cur.amount.shouldFine) : '—' }}</div>
            </div>
            <div class="amt-c">
              <div class="amt-c__l">利息</div>
              <div class="amt-c__v num num--money">{{ cur.amount.shouldInterest ? fmtMoney(cur.amount.shouldInterest) : '—' }}</div>
            </div>
            <div class="amt-c is-total">
              <div class="amt-c__l">应追缴合计</div>
              <div class="amt-c__v num num--money">{{ fmtMoney(cur.amount.shouldTotal) }}</div>
            </div>
            <div class="amt-c is-ok">
              <div class="amt-c__l">已追回</div>
              <div class="amt-c__v num num--money">{{ fmtMoney(cur.amount.recoveredTotal) }}</div>
            </div>
            <div class="amt-c is-warn">
              <div class="amt-c__l">未追回</div>
              <div class="amt-c__v num num--money">{{ fmtMoney(cur.amount.unrecoveredTotal) }}</div>
            </div>
          </div>

          <div class="sub-title">险种拆分</div>
          <el-table :data="Object.keys(cur.byInsurance).map((k) => ({ name: k, ...cur.byInsurance[k] }))"
            size="small" border stripe>
            <el-table-column prop="name" label="险种" width="120" />
            <el-table-column prop="should" label="应追缴" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.should) }}</span></template>
            </el-table-column>
            <el-table-column prop="recovered" label="已追回" align="right">
              <template #default="{ row }"><span class="num num--money-mild">{{ fmtMoney(row.recovered) }}</span></template>
            </el-table-column>
          </el-table>

          <div class="sub-title">追回计划</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="追缴期限"><span class="num">{{ cur.plan.deadline }}</span></el-descriptions-item>
            <el-descriptions-item label="追回方式">{{ cur.plan.method }}</el-descriptions-item>
            <el-descriptions-item label="是否分期">
              <el-tag size="small" :type="cur.plan.installment ? 'warning' : 'info'" effect="plain">
                {{ cur.plan.installment ? '分期追缴' : '一次性追缴' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="逾期状态">
              <el-tag size="small" :type="cur.overdue ? 'danger' : 'success'" effect="dark">
                {{ cur.overdue ? `逾期 ${cur.overdueDays} 天` : '正常' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="sub-title">到账记录</div>
          <el-table :data="cur.records" size="small" border stripe>
            <el-table-column prop="date" label="到账日期" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.date }}</span></template>
            </el-table-column>
            <el-table-column prop="amount" label="到账金额" width="116" align="right">
              <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column prop="method" label="方式" width="118" />
            <el-table-column prop="voucherNo" label="凭证号" min-width="170" show-overflow-tooltip>
              <template #default="{ row }"><span class="num text-mini">{{ row.voucherNo }}</span></template>
            </el-table-column>
            <el-table-column label="双人确认" width="146">
              <template #default="{ row }">
                <div class="cf-two">
                  <span>经办 {{ row.operator }}</span>
                  <span>复核 {{ row.confirmer }}</span>
                </div>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无到账记录" height="90px" /></template>
          </el-table>

          <el-alert v-if="cur.overdue" type="error" :closable="false" show-icon class="mt12">
            <template #title>
              <span class="text-mini">
                已逾期 <b class="num">{{ cur.overdueDays }}</b> 天，超期 30 天将自动升级处置措施（暂停结算 / 暂停服务协议）
              </span>
            </template>
          </el-alert>

          <div class="dr-actions">
            <el-button type="primary" :icon="'Money'" :disabled="cur.amount.unrecoveredTotal <= 0" @click="openWo()">
              登记到账并核销
            </el-button>
            <el-button :icon="'BellFilled'" :loading="urging" @click="doUrge(cur)">催缴提醒</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 核销弹窗 ============ -->
    <el-dialog v-model="woVisible" title="到账登记与核销" width="600px">
      <template v-if="woTarget">
        <el-alert type="warning" :closable="false" show-icon class="mb12">
          <template #title>
            <span class="text-mini">
              {{ woTarget.orgName }} · 应追缴 <b class="num">{{ fmtMoney(woTarget.amount.shouldTotal) }}</b>
              · 待追回 <b class="num">{{ fmtMoney(woTarget.amount.unrecoveredTotal) }}</b>
            </span>
          </template>
        </el-alert>

        <el-form label-width="96px">
          <div class="form-row">
            <el-form-item label="到账日期" required>
              <el-date-picker v-model="woForm.paymentDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="到账金额" required>
              <el-input-number v-model="woForm.paymentAmount" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="付款方" required>
              <el-input v-model="woForm.payer" />
            </el-form-item>
            <el-form-item label="到账方式" required>
              <el-select v-model="woForm.method" style="width: 100%">
                <el-option v-for="m in ['主动退回', '医保结算扣缴', '银行划拨', '法院强制执行', '其他']" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="凭证号" required>
            <el-input v-model="woForm.voucherNo" placeholder="如：工行回单20260910001" />
          </el-form-item>
          <el-form-item label="银行回单">
            <el-upload action="#" :auto-upload="false" :limit="3">
              <el-button :icon="'Upload'" size="small">上传银行回单</el-button>
              <template #tip><span class="text-mini">支持 JPG / PDF，最多 3 份</span></template>
            </el-upload>
          </el-form-item>
          <div class="form-row">
            <el-form-item label="经办人">
              <el-input v-model="woForm.operator" disabled />
            </el-form-item>
            <el-form-item label="复核人" required>
              <el-select v-model="woForm.reviewer" placeholder="核销需双人确认" style="width: 100%">
                <el-option v-for="m in MEMBERS" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="摘要">
            <el-input v-model="woForm.summary" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>

        <!-- 核销规则提示 -->
        <div class="wo-rule">
          <div class="wo-rule__t"><el-icon><InfoFilled /></el-icon>核销规则</div>
          <div class="wo-rule__l">
            <span :class="{ 'is-hit': woForm.paymentAmount >= woTarget.amount.unrecoveredTotal && woForm.paymentAmount <= woTarget.amount.unrecoveredTotal }">
              到账 = 应追 → 全额核销，状态更新为「已追回」
            </span>
            <span :class="{ 'is-hit': woForm.paymentAmount > 0 && woForm.paymentAmount < woTarget.amount.unrecoveredTotal }">
              到账 &lt; 应追 → 部分核销，状态更新为「部分追回」，剩余继续追缴
            </span>
            <span :class="{ 'is-hit': woForm.paymentAmount > woTarget.amount.unrecoveredTotal }">
              到账 &gt; 应追 → 标记异常，人工核实多缴 / 错缴
            </span>
          </div>
        </div>

        <!-- 核销结果 -->
        <div v-if="woResult" class="wo-res">
          <div class="wo-res__h">
            <el-icon><CircleCheckFilled /></el-icon>
            <b>{{ woResult.writeOffType }}</b>
            <el-tag size="small" type="success" effect="dark">{{ woResult.newStatus }}</el-tag>
          </div>
          <div class="wo-res__r">
            <span>核销金额 <b class="num num--money">{{ fmtMoney(woResult.writeOffAmount) }}</b></span>
            <span>剩余待追 <b class="num num--money">{{ fmtMoney(woResult.remainingAmount) }}</b></span>
          </div>
          <div class="wo-res__m">
            {{ woResult.matching.matchMethod }} · 匹配置信度 <b class="num">{{ woResult.matching.matchConfidence }}%</b>
          </div>
        </div>
      </template>

      <template #footer>
        <el-button @click="woVisible = false">关闭</el-button>
        <el-button type="primary" :loading="woSaving" @click="doWriteOff">确认核销并签名</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.45fr 1.15fr; gap: 12px;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}

:deep(.row-over) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

.is-over { color: var(--zh-danger) !important; font-weight: 700; }

.over-tag {
  display: inline-block; margin-left: 4px;
  padding: 0 4px; border-radius: 3px;
  background: var(--zh-danger); color: #fff; font-size: 9px; font-weight: 700;
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

/* ---------- 详情 ---------- */
.rc-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-over { background: linear-gradient(120deg, var(--zh-risk-high-bg), #fff); border-color: var(--zh-risk-high-border); }

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__pg { margin-top: 10px; }
}

.amt-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
}

.amt-c {
  padding: 9px 8px; border-radius: 6px; text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--ac, var(--zh-primary));

  &.is-total { --ac: var(--zh-danger); background: var(--zh-risk-high-bg); }
  &.is-ok { --ac: var(--zh-success); background: var(--zh-success-light); }
  &.is-warn { --ac: var(--zh-warning); background: var(--zh-warning-light); }

  &__l { font-size: 10px; color: var(--zh-text-secondary); }
  &__v { font-size: 13px; font-weight: 700; margin-top: 3px; }
}

.cf-two {
  display: flex; flex-direction: column; gap: 1px;
  font-size: 9px; color: var(--zh-text-secondary); line-height: 1.5;
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 核销 ---------- */
.wo-rule {
  padding: 8px 11px; border-radius: 6px; margin-top: 4px;
  background: var(--zh-info-light); border: 1px solid var(--zh-border-light);

  &__t {
    display: flex; align-items: center; gap: 5px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__l {
    display: flex; flex-direction: column; gap: 3px; margin-top: 6px;
    font-size: 10px; line-height: 1.75; color: var(--zh-text-secondary);
    span {
      padding: 2px 6px; border-radius: 3px; transition: all .18s;
      &.is-hit {
        background: var(--zh-primary-light); color: var(--zh-primary);
        font-weight: 700; border-left: 2px solid var(--zh-primary);
      }
    }
  }
}

.wo-res {
  margin-top: 11px; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-success); }
    b { color: var(--zh-text-primary); }
  }
  &__r {
    display: flex; gap: 18px; flex-wrap: wrap; margin-top: 6px;
    font-size: 11px; color: var(--zh-text-secondary);
  }
  &__m { margin-top: 5px; font-size: 10px; color: var(--zh-text-secondary); b { color: var(--zh-primary); } }
}
</style>
