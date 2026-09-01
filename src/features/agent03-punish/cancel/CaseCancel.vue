<script setup lang="ts">
import {
  getCancelStats, getCancelList, getCancelDetail,
  verifyCancel, submitCancel, approveCancel, linkCredit
} from '@/api/agent03-punish/punish'
import { fmtMoney, fmtWan } from '@/utils/format'
import { buildCancelApprovalDoc, exportCsv, type LegalDoc } from '@/utils/legalDoc'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const q = reactive({ keyword: '', status: '', district: '', page: 1, pageSize: 15 })

const STATUS_TONE: Record<string, string> = {
  条件核验中: 'warning', 待审批: 'primary', 审批中: 'primary', 已销号: 'success', 条件不满足: 'danger'
}
const LEVEL_COLOR: Record<string, string> = {
  A: '#12a150', B: '#1668dc', C: '#e8a30c', D: '#d4380d', E: '#e5484d'
}

async function loadStats() { st.value = await getCancelStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getCancelList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', status: '', district: '', page: 1 })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'pending') q.status = '待审批'
  else if (t === 'fail') q.status = '条件不满足'
  else if (t === 'done') q.status = '已销号'
  load()
}

/* ---------- 详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)
const activeTab = ref('verify')

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  activeTab.value = 'verify'
  try { cur.value = await getCancelDetail(row.cancelId) } finally { detailLoading.value = false }
}

/* ---------- 条件核验 ---------- */
const verifying = ref(false)
const verifyRes = ref<any>(null)
async function doVerify() {
  verifying.value = true
  verifyRes.value = null
  try {
    verifyRes.value = await verifyCancel({ cancelId: cur.value.cancelId })
    if (verifyRes.value?.allPassed) msg.success(verifyRes.value.message)
    else msg.warning(verifyRes.value?.message || '存在未满足条件')
  } finally { verifying.value = false }
}

/* ---------- 提交 / 审批 ---------- */
const submitting = ref(false)
async function doSubmit() {
  if (!cur.value?.allPassed) { msg.warning('销号条件未全部满足，暂不可提交审批'); return }
  submitting.value = true
  try {
    const res: any = await submitCancel({ cancelId: cur.value.cancelId })
    msg.success(res?.message || '已提交审批')
    cur.value.status = '待审批'
    await Promise.all([loadStats(), load()])
  } finally { submitting.value = false }
}

const apVisible = ref(false)
const approving = ref(false)
const apForm = reactive({ result: '核准销号', opinion: '' })

function openApprove() {
  apForm.result = '核准销号'
  apForm.opinion = '经复核，本案定性、处置、追回、整改、文书均已到位，符合销号条件，同意核准销号并同步信用联动'
  apVisible.value = true
}

async function doApprove() {
  if (!apForm.opinion.trim()) { msg.warning('请填写审批意见'); return }
  approving.value = true
  try {
    const res: any = await approveCancel({ cancelId: cur.value.cancelId, ...apForm })
    msg.success(`${res?.message || '已核准'}，销号文号 ${res?.cancelNo || ''}`)
    apVisible.value = false
    cur.value = await getCancelDetail(cur.value.cancelId)
    await Promise.all([loadStats(), load()])
  } finally { approving.value = false }
}

/* ---------- 信用联动 ---------- */
const linking = ref(false)
async function doLinkCredit() {
  linking.value = true
  try {
    const res: any = await linkCredit({ cancelId: cur.value.cancelId })
    msg.success(res?.message || '信用联动完成')
  } finally { linking.value = false }
}

/* ---------- 文书预览 ---------- */
const docVisible = ref(false)
const curDoc = ref<LegalDoc | null>(null)

function openApprovalDoc() {
  if (!cur.value) return
  curDoc.value = buildCancelApprovalDoc(cur.value)
  docVisible.value = true
}

/** 导出销号台账 */
function doExportLedger() {
  if (!list.value.length) { msg.warning('当前无可导出数据'); return }
  exportCsv(
    `案件销号台账_${new Date().toISOString().slice(0, 10)}`,
    ['销号编号', '案件名称', '被检机构', '辖区', '关联确认书',
      '销号条件满足数', '是否全部满足', '应追缴(元)', '已追回(元)',
      '审批层级', '销号状态', '销号文号', '销号时间',
      '信用扣分', '信用等级变化', '是否公示'],
    list.value.map((c: any) => [
      c.cancelId, c.caseName, c.orgName, c.district, c.confirmationId,
      `${(c.conditions || []).filter((x: any) => x.passed).length}/5`,
      c.allPassed ? '是' : '否',
      c.totalAmount, c.recoveredAmount,
      c.approval?.level || '', c.status, c.approval?.cancelNo || '—', c.approval?.cancelTime || '—',
      c.credit?.deduction ?? '—',
      c.credit ? `${c.credit.orgLevelBefore}→${c.credit.orgLevelAfter}` : '—',
      c.credit ? (c.credit.publicity ? '是' : '否') : '—'
    ])
  )
  msg.success(`已导出 ${list.value.length} 条销号台账`)
}

/* ---------- 图表 ---------- */
const creditOption = computed(() => {
  const d = (st.value?.creditLevelDist || []).filter((i: any) => i.value > 0)
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 家 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } }))
    }]
  }
})

const condOption = computed(() => {
  const conds = st.value?.conditions || []
  const passRates = [96, 88, 74, 82, 91]
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}<br/>满足率 {c}%' },
    grid: { left: 118, right: 42, top: 10, bottom: 22 },
    xAxis: {
      type: 'value', max: 100,
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: '{value}%' }
    },
    yAxis: {
      type: 'category', data: conds.map((c: any) => c.name).reverse(),
      axisLabel: { fontSize: 10, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: 14,
      itemStyle: {
        borderRadius: [0, 3, 3, 0],
        color: (p: any) => (p.value >= 90 ? '#12a150' : p.value >= 80 ? '#1668dc' : '#e8a30c')
      },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, formatter: '{c}%' },
      data: [...passRates].reverse()
    }]
  }
})

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="闭环销号" tag="M23"
      subtitle="销号条件自动核验 · 分级审批核准 · 处置结果信用联动">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'CircleClose'" @click="quick('fail')">条件不满足</el-button>
        <el-button type="primary" :icon="'Stamp'" @click="quick('pending')">待审批</el-button>
      </template>
    </PageHeader>

    <!-- 指标 + 图表 -->
    <div class="top-grid">
      <div class="kpi-col">
        <StatCard label="销号案件" :value="st?.total || 0" unit="件" icon="Files" tone="primary" />
        <StatCard label="已核准销号" :value="st?.canceled || 0" unit="件" icon="CircleCheck" tone="success" clickable @click="quick('done')" />
        <StatCard label="在办销号" :value="st?.pending || 0" unit="件" icon="Loading" tone="warning" clickable @click="quick('pending')" />
        <StatCard label="信用联动" :value="st?.creditRecords || 0" unit="条" icon="Medal" tone="purple" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">销号条件满足率</span>
        </div>
        <EChart :option="condOption" height="240px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">机构信用等级分布</span>
        </div>
        <EChart :option="creditOption" height="240px" />
      </div>
    </div>

    <!-- 销号条件说明 -->
    <div class="section-card section-card--tight">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">销号条件（五项全部满足方可销号）</span>
        <span class="section-title__desc">系统自动校验，任一项未满足即阻断销号流程</span>
      </div>
      <div class="cond-grid">
        <div v-for="(c, i) in (st?.conditions || [])" :key="c.key" class="cd">
          <div class="cd__no num">{{ i + 1 }}</div>
          <div class="cd__b">
            <div class="cd__n">{{ c.name }}</div>
            <div class="cd__d">{{ c.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">销号案件查询</span>
      </div>
      <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="销号编号/案件名称/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="销号状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in ['条件核验中', '待审批', '审批中', '已销号', '条件不满足']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属辖区">
          <el-select v-model="q.district" placeholder="全部辖区" clearable>
            <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <div class="query-form__actions">
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </div>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="section-card">
      <div class="table-toolbar">
        <span class="text-mini">共 {{ total }} 件销号案件</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Download'" @click="doExportLedger">导出台账</el-button>
        </div>
      </div>

      <el-table :data="list" size="small" border stripe v-loading="loading">
        <el-table-column prop="cancelId" label="销号编号" width="150">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.cancelId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="caseName" label="案件名称" min-width="212" show-overflow-tooltip />
        <el-table-column prop="district" label="辖区" width="86" align="center" />
        <el-table-column label="销号条件" width="132" align="center">
          <template #default="{ row }">
            <div class="cond-dots">
              <span v-for="c in row.conditions" :key="c.key" class="cdot"
                :class="c.passed ? 'is-ok' : 'is-no'" :title="c.name" />
            </div>
            <span class="text-mini">{{ row.conditions.filter((c: any) => c.passed).length }}/5</span>
          </template>
        </el-table-column>
        <el-table-column label="应追缴" width="118" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.totalAmount) }}</span></template>
        </el-table-column>
        <el-table-column label="已追回" width="118" align="right">
          <template #default="{ row }">
            <span class="num" style="color: var(--zh-success); font-weight: 700">{{ fmtMoney(row.recoveredAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="审批层级" width="104" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.approval.level }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="104" align="center">
          <template #default="{ row }">
            <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="信用联动" width="106" align="center">
          <template #default="{ row }">
            <template v-if="row.credit">
              <el-tag size="small" effect="dark"
                :style="{ background: LEVEL_COLOR[row.credit.orgLevelAfter], borderColor: LEVEL_COLOR[row.credit.orgLevelAfter] }">
                {{ row.credit.orgLevelBefore }} → {{ row.credit.orgLevelAfter }}
              </el-tag>
            </template>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="销号文号" width="156">
          <template #default="{ row }">
            <span v-if="row.approval.cancelNo" class="num text-mini">{{ row.approval.cancelNo }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">办理</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无符合条件的销号案件" height="140px" /></template>
      </el-table>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 条</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="680px" title="闭环销号办理">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <div class="cc-hero" :class="{ 'is-done': cur.status === '已销号' }">
            <div class="cc-hero__t">
              {{ cur.caseName }}
              <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
            </div>
            <div class="cc-hero__m">
              <span><el-icon><Tickets /></el-icon>{{ cur.cancelId }}</span>
              <span><el-icon><Files /></el-icon>{{ cur.confirmationId }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
              <span><el-icon><Stamp /></el-icon>{{ cur.approval.level }}</span>
            </div>
            <div v-if="cur.approval.cancelNo" class="cc-hero__no">
              <el-icon><Select /></el-icon>
              销号文号 <b class="num">{{ cur.approval.cancelNo }}</b> · {{ cur.approval.cancelTime }}
            </div>
          </div>

          <el-tabs v-model="activeTab" class="cc-tabs">
            <!-- 条件核验 -->
            <el-tab-pane label="销号条件核验" name="verify">
              <div class="vf-bar">
                <el-button type="primary" :icon="'Search'" :loading="verifying" @click="doVerify">
                  {{ verifying ? '核验中…' : '重新核验条件' }}
                </el-button>
                <el-tag :type="cur.allPassed ? 'success' : 'danger'" size="small" effect="dark">
                  {{ cur.conditions.filter((c: any) => c.passed).length }}/5 项满足
                </el-tag>
              </div>

              <div class="vf-list">
                <div v-for="(c, i) in (verifyRes?.conditions || cur.conditions)" :key="c.key" class="vf"
                  :class="c.passed ? 'is-ok' : 'is-no'">
                  <div class="vf__no num">{{ i + 1 }}</div>
                  <div class="vf__b">
                    <div class="vf__n">
                      {{ c.name }}
                      <el-tag :type="c.passed ? 'success' : 'danger'" size="small" effect="dark">
                        {{ c.passed ? '已满足' : '未满足' }}
                      </el-tag>
                    </div>
                    <div class="vf__d">{{ c.detail }}</div>
                  </div>
                  <el-icon class="vf__ck">
                    <component :is="c.passed ? 'CircleCheckFilled' : 'CircleCloseFilled'" />
                  </el-icon>
                </div>
              </div>

              <div class="amt-bar">
                <div class="amt-c">
                  <div class="amt-c__l">应追缴合计</div>
                  <div class="amt-c__v num num--money">{{ fmtMoney(cur.totalAmount) }}</div>
                </div>
                <div class="amt-c is-ok">
                  <div class="amt-c__l">已追回</div>
                  <div class="amt-c__v num num--money">{{ fmtMoney(cur.recoveredAmount) }}</div>
                </div>
                <div class="amt-c" :class="cur.totalAmount - cur.recoveredAmount > 0 ? 'is-warn' : 'is-ok'">
                  <div class="amt-c__l">未追回</div>
                  <div class="amt-c__v num num--money">{{ fmtMoney(cur.totalAmount - cur.recoveredAmount) }}</div>
                </div>
              </div>

              <el-alert v-if="!cur.allPassed" type="error" :closable="false" show-icon class="mt12">
                <template #title>
                  <span class="text-mini">存在未满足的销号条件，销号流程已阻断，请先完成相关环节</span>
                </template>
              </el-alert>

              <div class="tab-actions">
                <el-button v-if="cur.status === '条件核验中' || cur.status === '条件不满足'"
                  type="primary" :icon="'Promotion'" :loading="submitting" :disabled="!cur.allPassed" @click="doSubmit">
                  提交销号审批
                </el-button>
                <el-button v-else type="success" :icon="'Select'" disabled>已提交审批</el-button>
              </div>
            </el-tab-pane>

            <!-- 销号审批 -->
            <el-tab-pane label="销号审批" name="approve">
              <el-timeline class="ap-tl">
                <el-timeline-item v-for="(n, i) in cur.approval.nodes" :key="i"
                  :type="n.time ? (n.result.includes('核准') || n.result === '同意' ? 'success' : 'primary') : 'info'"
                  :hollow="!n.time" :timestamp="n.time || '待办理'" size="normal">
                  <div class="tl__n" :class="{ 'is-todo': !n.time }">
                    {{ n.role }} · {{ n.name }}
                    <el-tag v-if="n.time" :type="n.result.includes('核准') ? 'success' : 'primary'" size="small" effect="dark">
                      {{ n.result }}
                    </el-tag>
                  </div>
                  <div v-if="n.opinion" class="tl__o">{{ n.opinion }}</div>
                </el-timeline-item>
              </el-timeline>

              <el-descriptions :column="1" border size="small" class="mt12">
                <el-descriptions-item label="审批层级">
                  <el-tag size="small" effect="plain">{{ cur.approval.level }}</el-tag>
                  <span class="text-mini ml8">按问题性质与涉及金额自动匹配审批层级</span>
                </el-descriptions-item>
                <el-descriptions-item label="最终结果">
                  <el-tag :type="cur.approval.finalResult === '核准销号' ? 'success' : 'warning'" size="small" effect="dark">
                    {{ cur.approval.finalResult }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item v-if="cur.approval.cancelNo" label="销号文号">
                  <span class="num">{{ cur.approval.cancelNo }}</span>
                </el-descriptions-item>
              </el-descriptions>

              <div class="tab-actions">
                <el-button v-if="cur.status !== '已销号'" type="primary" :icon="'Stamp'"
                  :disabled="!cur.allPassed" @click="openApprove">核准销号</el-button>
                <el-button v-else type="success" :icon="'Select'" disabled>已核准销号</el-button>
                <el-button :icon="'Printer'" @click="openApprovalDoc">生成审批表</el-button>
              </div>
            </el-tab-pane>

            <!-- 信用联动 -->
            <el-tab-pane label="信用联动" name="credit">
              <template v-if="cur.credit">
                <div class="sub-title">机构信用扣分</div>
                <div class="cr-card">
                  <div class="cr-score">
                    <div class="cr-score__c">
                      <div class="cr-score__l">扣分前</div>
                      <div class="cr-score__v num">{{ cur.credit.orgScoreBefore }}</div>
                      <el-tag size="small" effect="dark"
                        :style="{ background: LEVEL_COLOR[cur.credit.orgLevelBefore], borderColor: LEVEL_COLOR[cur.credit.orgLevelBefore] }">
                        {{ cur.credit.orgLevelBefore }} 级
                      </el-tag>
                    </div>
                    <div class="cr-score__arrow">
                      <el-icon><DArrowRight /></el-icon>
                      <span class="cr-score__ded num">-{{ cur.credit.deduction }}</span>
                    </div>
                    <div class="cr-score__c is-after">
                      <div class="cr-score__l">扣分后</div>
                      <div class="cr-score__v num">{{ cur.credit.orgScoreAfter }}</div>
                      <el-tag size="small" effect="dark"
                        :style="{ background: LEVEL_COLOR[cur.credit.orgLevelAfter], borderColor: LEVEL_COLOR[cur.credit.orgLevelAfter] }">
                        {{ cur.credit.orgLevelAfter }} 级
                      </el-tag>
                    </div>
                  </div>
                  <div class="cr-card__r">{{ cur.credit.reason }}</div>
                </div>

                <div class="sub-title">个人执业信用记录</div>
                <el-table :data="cur.credit.personalRecords" size="small" border stripe>
                  <el-table-column prop="name" label="姓名" width="96" />
                  <el-table-column prop="dept" label="科室" width="118" />
                  <el-table-column prop="deduction" label="扣分" width="80" align="right">
                    <template #default="{ row }">
                      <span class="num" style="color: var(--zh-danger); font-weight: 700">-{{ row.deduction }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="measure" label="信用惩戒措施" min-width="190" show-overflow-tooltip />
                  <template #empty><EmptyState text="未涉及个人信用记录" height="90px" /></template>
                </el-table>

                <div class="sub-title">联动信息</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="联动编号"><span class="num">{{ cur.credit.creditId }}</span></el-descriptions-item>
                  <el-descriptions-item label="有效期至"><span class="num">{{ cur.credit.validUntil }}</span></el-descriptions-item>
                  <el-descriptions-item label="是否公示">
                    <el-tag :type="cur.credit.publicity ? 'danger' : 'info'" size="small" effect="dark">
                      {{ cur.credit.publicity ? '向社会公示' : '不予公示' }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="同步平台">信用监管平台 / 定点机构考核系统</el-descriptions-item>
                </el-descriptions>

                <el-alert v-if="cur.credit.orgLevelAfter === 'D' || cur.credit.orgLevelAfter === 'E'"
                  type="error" :closable="false" show-icon class="mt12">
                  <template #title>
                    <span class="text-mini">
                      信用等级已降至 {{ cur.credit.orgLevelAfter }} 级，将纳入重点监管对象，提高检查频次并限制新增医保业务
                    </span>
                  </template>
                </el-alert>

                <div class="tab-actions">
                  <el-button type="primary" :icon="'Medal'" :loading="linking" @click="doLinkCredit">
                    同步信用监管平台
                  </el-button>
                </div>
              </template>
              <template v-else>
                <EmptyState text="核准销号后自动生成信用联动记录" height="180px" />
              </template>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 审批弹窗 ============ -->
    <el-dialog v-model="apVisible" title="销号审批" width="560px">
      <template v-if="cur">
        <el-alert type="warning" :closable="false" show-icon class="mb12">
          <template #title>
            <span class="text-mini">
              {{ cur.caseName }} · 审批层级 <b>{{ cur.approval.level }}</b> ·
              应追缴 <b class="num">{{ fmtMoney(cur.totalAmount) }}</b>
            </span>
          </template>
        </el-alert>
        <el-form label-width="88px">
          <el-form-item label="审批结论" required>
            <el-radio-group v-model="apForm.result">
              <el-radio-button label="核准销号" />
              <el-radio-button label="退回补充" />
            </el-radio-group>
          </el-form-item>
          <el-form-item label="审批意见" required>
            <el-input v-model="apForm.opinion" type="textarea" :rows="4" />
          </el-form-item>
          <el-form-item label="信用联动">
            <div class="ap-tip">
              <el-icon><InfoFilled /></el-icon>
              核准销号后将按规定自动联动机构与个人信用记录，并同步至信用监管平台
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="apVisible = false">取消</el-button>
        <el-button type="primary" :loading="approving" @click="doApprove">提交审批并签名</el-button>
      </template>
    </el-dialog>

    <!-- 文书预览 -->
    <DocPreview v-model:visible="docVisible" :doc="curDoc" />
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }
.ml8 { margin-left: 8px; }

.top-grid {
  display: grid; grid-template-columns: 262px 1.4fr 1fr; gap: 12px; align-items: start;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.kpi-col { display: flex; flex-direction: column; gap: 12px; }

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

/* ---------- 条件说明 ---------- */
.cond-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px;
  @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 760px) { grid-template-columns: 1fr; }
}

.cd {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 11px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--zh-primary);

  &__no {
    flex-shrink: 0; width: 19px; height: 19px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 10px; font-weight: 700;
  }
  &__b { min-width: 0; }
  &__n { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__d { font-size: 10px; line-height: 1.65; color: var(--zh-text-secondary); margin-top: 3px; }
}

/* ---------- 条件圆点 ---------- */
.cond-dots { display: flex; gap: 3px; justify-content: center; margin-bottom: 2px; }

.cdot {
  width: 8px; height: 8px; border-radius: 50%;
  &.is-ok { background: var(--zh-success); }
  &.is-no { background: var(--zh-danger); }
}

/* ---------- 详情 ---------- */
.cc-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-done { background: linear-gradient(120deg, var(--zh-success-light), #fff); border-color: var(--zh-success); }

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
  &__no {
    display: flex; align-items: center; gap: 5px; margin-top: 9px;
    padding: 6px 9px; border-radius: 5px;
    background: #fff; border: 1px solid var(--zh-success);
    font-size: 11px; color: var(--zh-text-regular);
    :deep(.el-icon) { color: var(--zh-success); }
  }
}

.cc-tabs { margin-top: 12px; }

.vf-bar { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; margin-bottom: 11px; }

.vf-list { display: flex; flex-direction: column; gap: 8px; }

.vf {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 9px 11px; border-radius: 6px;

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); }

  &__no {
    flex-shrink: 0; width: 19px; height: 19px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 10px; font-weight: 700;
  }
  &.is-ok &__no { background: var(--zh-success); }
  &.is-no &__no { background: var(--zh-danger); }

  &__b { flex: 1; min-width: 0; }
  &__n {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  }
  &__d { font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); margin-top: 3px; }
  &__ck { flex-shrink: 0; font-size: 15px; }
  &.is-ok &__ck { color: var(--zh-success); }
  &.is-no &__ck { color: var(--zh-danger); }
}

.amt-bar {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;
}

.amt-c {
  padding: 9px 8px; border-radius: 6px; text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--ac, var(--zh-primary));

  &.is-ok { --ac: var(--zh-success); background: var(--zh-success-light); }
  &.is-warn { --ac: var(--zh-danger); background: var(--zh-risk-high-bg); }

  &__l { font-size: 10px; color: var(--zh-text-secondary); }
  &__v { font-size: 13px; font-weight: 700; margin-top: 3px; }
}

.tab-actions {
  display: flex; gap: 8px; margin-top: 15px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

.ap-tl {
  padding-left: 4px;
  :deep(.el-timeline-item) { padding-bottom: 14px; }
  :deep(.el-timeline-item__timestamp) { font-size: 10px; }
}

.tl__n {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  &.is-todo { color: var(--zh-text-placeholder); font-weight: 400; }
}
.tl__o {
  margin-top: 5px; padding: 6px 9px; border-radius: 4px;
  background: var(--zh-bg-soft); font-size: 10px; line-height: 1.75; color: var(--zh-text-secondary);
}

/* ---------- 信用 ---------- */
.cr-card {
  padding: 12px; border-radius: var(--zh-radius);
  background: var(--zh-purple-light); border: 1px solid var(--zh-purple);

  &__r {
    margin-top: 10px; padding-top: 8px;
    border-top: 1px dashed rgba(114, 46, 209, .25);
    font-size: 11px; line-height: 1.8; color: var(--zh-text-regular);
  }
}

.cr-score {
  display: flex; align-items: center; justify-content: center; gap: 14px;

  &__c {
    flex: 1; text-align: center; padding: 9px 6px;
    border-radius: 6px; background: #fff;
    border: 1px solid var(--zh-border-light);
    &.is-after { border-color: var(--zh-danger); }
  }
  &__l { font-size: 10px; color: var(--zh-text-secondary); }
  &__v { font-size: 24px; font-weight: 800; color: var(--zh-text-primary); line-height: 1.2; margin: 2px 0 4px; }
  &__arrow {
    display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0;
    :deep(.el-icon) { color: var(--zh-text-placeholder); font-size: 15px; }
  }
  &__ded { font-size: 13px; font-weight: 800; color: var(--zh-danger); }
}

.ap-tip {
  display: flex; align-items: flex-start; gap: 5px;
  font-size: 11px; line-height: 1.75; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-warning); flex-shrink: 0; margin-top: 2px; }
}
</style>
