<script setup lang="ts">
import {
  getAppealStats, getAppealList, getAppealDetail,
  aiReviewAppeal, acceptAppeal, reviewAppeal
} from '@/api/agent01-clue/appeal'
import { fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const router = useRouter()
const dict = useDictStore()
/** 模板中可用的消息提示别名（模板无法直接访问自动导入的全局变量） */
const msg = ElMessage

const AP_TYPES = ['事实认定异议', '金额认定异议', '政策适用异议', '程序异议', '其他']
const AP_STATUS = ['待受理', '已受理', 'AI初核中', '复核中', '已复核', '已撤回', '已逾期']
const AP_RESULT = ['申诉成立·撤销原结论', '部分撤销原结论', '申诉不成立·维持原结论']

const st = ref<any>(null)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const expand = ref(false)

const q = reactive({
  keyword: '', status: '', appealType: '', result: '', riskLevel: '',
  district: '', orgType: '', overdue: '',
  amountMin: undefined as any, amountMax: undefined as any,
  dateRange: [] as string[], page: 1, pageSize: 15
})

async function loadStats() { st.value = await getAppealStats() }
async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getAppealList({
      ...rest, startTime: dateRange?.[0] || '', endTime: dateRange?.[1] || ''
    })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}
function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', status: '', appealType: '', result: '', riskLevel: '', district: '',
    orgType: '', overdue: '', amountMin: undefined, amountMax: undefined, dateRange: [], page: 1
  })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'pending') q.status = '待受理'
  if (t === 'reviewing') q.status = '复核中'
  if (t === 'done') q.status = '已复核'
  if (t === 'overdue') q.overdue = 'true'
  load()
}

/* ===== 图表 ===== */
const typeOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 件 ({d}%)' },
  legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
  color: CHART_COLORS,
  series: [{
    type: 'pie', radius: ['44%', '70%'], center: ['50%', '43%'],
    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
    label: { show: false },
    data: (st.value?.typeDist || []).map((i: any) => ({ name: i.name, value: i.value }))
  }]
}))

const trendOption = computed(() => {
  const rows: any[] = st.value?.resultTrend || []
  const keys = rows.length ? Object.keys(rows[0]).filter((k) => k !== 'month' && k !== 'name' && k !== 'date') : []
  const xKey = rows.length ? (rows[0].month !== undefined ? 'month' : rows[0].date !== undefined ? 'date' : 'name') : 'month'
  const LAB: Record<string, string> = { accept: '完全采信', partial: '部分采信', reject: '不予采信', total: '申诉总量' }
  const TONE: Record<string, string> = { accept: '#12a150', partial: '#e8a30c', reject: '#e5484d', total: '#1668dc' }
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 9, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, bottom: 44 },
    xAxis: { type: 'category', data: rows.map((r) => r[xKey]), axisLabel: { fontSize: 10 }, boundaryGap: keys.length > 1 },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: keys.map((k) => ({
      name: LAB[k] || k, type: 'bar', stack: k === 'total' ? undefined : 'r', barWidth: 17,
      itemStyle: { color: TONE[k] || '#1668dc', borderRadius: [3, 3, 0, 0] },
      data: rows.map((r) => r[k])
    }))
  }
})

/* ===== 复核抽屉 ===== */
const drawer = ref(false)
const detailLoading = ref(false)
const cur = ref<any>(null)
const tab = ref('reason')

async function openDetail(row: any) {
  drawer.value = true
  tab.value = 'reason'
  detailLoading.value = true
  cur.value = null
  aiRes.value = null
  try { cur.value = await getAppealDetail({ appealId: row.appealId }) }
  finally { detailLoading.value = false }
}

/* 受理 */
const accepting = ref(false)
async function doAccept() {
  accepting.value = true
  try {
    const r: any = await acceptAppeal({ appealId: cur.value.appealId })
    ElMessage.success(r.message)
    cur.value.status = r.status
    load(); loadStats()
    runAi()
  } finally { accepting.value = false }
}

/* AI 初核 */
const aiLoading = ref(false)
const aiRes = ref<any>(null)
async function runAi() {
  aiLoading.value = true
  aiRes.value = null
  try {
    const r: any = await aiReviewAppeal({ appealId: cur.value.appealId })
    aiRes.value = r
  } finally { aiLoading.value = false }
}
function adoptAi() {
  if (!aiRes.value) return
  rvForm.result = aiRes.value.recommendResult
  rvForm.finalAmount = aiRes.value.recommendAmount
  rvForm.opinion = `采纳 AI 智能初核意见（置信度 ${aiRes.value.confidence}%）：${aiRes.value.analysis}`
  reviewVisible.value = true
  ElMessage.success('已采纳 AI 初核建议，请确认复核决定')
}

/* 复核决定 */
const reviewVisible = ref(false)
const reviewing = ref(false)
const rvForm = reactive({ result: '', finalAmount: 0, opinion: '', approver: '稽核组长·张建国' })

function openReview() {
  rvForm.result = rvForm.result || ''
  rvForm.finalAmount = rvForm.finalAmount || cur.value?.originalAmount || 0
  reviewVisible.value = true
}
async function doReview() {
  if (!rvForm.result) return ElMessage.warning('请选择复核结论')
  if (rvForm.opinion.trim().length < 15) return ElMessage.warning('复核意见不少于 15 字')
  reviewing.value = true
  try {
    const r: any = await reviewAppeal({ appealId: cur.value.appealId, ...rvForm })
    ElMessage.success(r.message)
    reviewVisible.value = false
    drawer.value = false
    load(); loadStats()
  } finally { reviewing.value = false }
}

const STATUS_TONE: Record<string, any> = {
  待受理: 'info', 已受理: 'primary', AI初核中: 'primary', 复核中: 'warning',
  已复核: 'success', 已撤回: 'info', 已逾期: 'danger'
}
const RESULT_TONE: Record<string, any> = {
  '申诉成立·撤销原结论': 'success', '部分撤销原结论': 'warning', '申诉不成立·维持原结论': 'danger'
}
const AI_TONE: Record<string, any> = { 申诉成立: 'success', 申诉部分成立: 'warning', 申诉不成立: 'danger' }
const canAccept = computed(() => cur.value?.status === '待受理')

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="机构申诉复核" tag="M13"
      subtitle="申诉受理审查 · AI 智能初核 · 人工复核裁量 · 结论回告机构">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'ChatDotSquare'" @click="router.push('/appeal/org')">机构申诉端</el-button>
        <el-button type="primary" :icon="'Stamp'" @click="quick('pending')">待受理申诉</el-button>
      </template>
    </PageHeader>

    <div class="kpi-grid">
      <StatCard label="申诉总量" :value="st?.totalAppeal || 0" unit="件" icon="ChatDotSquare" tone="primary" />
      <StatCard label="待受理" :value="st?.pendingReview || 0" unit="件" icon="Clock" tone="warning"
        clickable @click="quick('pending')" desc="3 工作日内须受理" />
      <StatCard label="复核中" :value="st?.reviewing || 0" unit="件" icon="Stamp" tone="accent"
        clickable @click="quick('reviewing')" />
      <StatCard label="已复核" :value="st?.reviewed || 0" unit="件" icon="CircleCheck" tone="success"
        clickable @click="quick('done')" />
      <StatCard label="完全采信率" :value="st?.acceptRate || 0" unit="%" icon="Select" tone="success" :precision="1" />
      <StatCard label="部分采信率" :value="st?.partialRate || 0" unit="%" icon="Scissor" tone="warning" :precision="1" />
      <StatCard label="不予采信率" :value="st?.rejectRate || 0" unit="%" icon="CircleClose" tone="danger" :precision="1" />
      <StatCard label="AI 初核准确率" :value="st?.aiPreAccuracy || 0" unit="%" icon="Cpu" tone="purple" :precision="1"
        :desc="`平均复核 ${st?.avgReviewHours || 0} 小时`" />
    </div>

    <div class="chart-row">
      <SectionCard title="申诉类型分布" desc="按异议性质划分" tight>
        <EChart :option="typeOption" height="230px" />
      </SectionCard>
      <SectionCard title="复核结论趋势" desc="采信 / 部分采信 / 不予采信 变化" tight>
        <EChart :option="trendOption" height="230px" />
      </SectionCard>
      <SectionCard title="复核工作规范" tight>
        <div class="tips">
          <div class="tip">
            <el-icon><Timer /></el-icon>
            <div><b>受理时限</b><span>机构提交后 3 个工作日内完成受理审查，材料不全的一次性告知补正</span></div>
          </div>
          <div class="tip">
            <el-icon><Cpu /></el-icon>
            <div><b>AI 智能初核</b><span>自动比对申诉材料与原核查证据链，输出采信建议及置信度，供复核参考</span></div>
          </div>
          <div class="tip">
            <el-icon><UserFilled /></el-icon>
            <div><b>复核回避</b><span>原核查人员不得担任本案复核人；复核结论须经稽核组长审批</span></div>
          </div>
          <div class="tip">
            <el-icon><Promotion /></el-icon>
            <div><b>结论回告</b><span>复核决定生成后自动推送机构工作台，并同步更新线索全周期档案</span></div>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">申诉案件检索</span>
        <span class="section-title__desc">支持申诉编号、线索号、机构、申诉人模糊检索</span>
      </div>
      <el-form class="query-form" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="申诉编号 / 线索号 / 机构 / 申诉人" clearable @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="办理状态">
          <el-select v-model="q.status" placeholder="全部" clearable>
            <el-option v-for="s in AP_STATUS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="申诉类型">
          <el-select v-model="q.appealType" placeholder="全部" clearable>
            <el-option v-for="t in AP_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核结论">
          <el-select v-model="q.result" placeholder="全部" clearable>
            <el-option v-for="r in AP_RESULT" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="风险等级">
            <el-select v-model="q.riskLevel" placeholder="全部" clearable>
              <el-option v-for="r in ['高', '中', '低']" :key="r" :label="`${r}风险`" :value="r" />
            </el-select>
          </el-form-item>
          <el-form-item label="所属区县">
            <el-select v-model="q.district" placeholder="全部" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
          <el-form-item label="机构类型">
            <el-select v-model="q.orgType" placeholder="全部" clearable>
              <el-option v-for="t in dict.orgTypes" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否逾期">
            <el-select v-model="q.overdue" placeholder="全部" clearable>
              <el-option label="仅看逾期" value="true" />
            </el-select>
          </el-form-item>
          <el-form-item label="申诉金额" class="is-wide">
            <div class="amt">
              <el-input-number v-model="q.amountMin" :min="0" :controls="false" placeholder="最小" />
              <span>—</span>
              <el-input-number v-model="q.amountMax" :min="0" :controls="false" placeholder="最大" />
            </div>
          </el-form-item>
          <el-form-item label="提交时间" class="is-wide">
            <el-date-picker v-model="q.dateRange" type="daterange" value-format="YYYY-MM-DD"
              start-placeholder="开始" end-placeholder="结束" style="width: 100%" />
          </el-form-item>
        </template>

        <el-form-item class="query-form__actions">
          <el-button link type="primary" @click="expand = !expand">
            {{ expand ? '收起' : '展开' }}<el-icon class="ml4"><component :is="expand ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          </el-button>
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="section-card">
      <div class="table-toolbar">
        <span>共 <b class="num">{{ total }}</b> 件申诉案件</span>
        <div class="table-toolbar__right">
          <span class="text-mini">双击行进入复核工作台</span>
        </div>
      </div>
      <el-table :data="list" v-loading="loading" size="small" border stripe @row-dblclick="openDetail"
        :row-class-name="({ row }: any) => (row.overdue ? 'row-over' : '')">
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="appealId" label="申诉编号" width="146">
          <template #default="{ row }">
            <span class="text-link num" @click="openDetail(row)">{{ row.appealId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索" width="146">
          <template #default="{ row }">
            <span class="text-link num text-mini"
              @click="router.push({ name: 'M06', params: { clueId: row.clueId } })">{{ row.clueId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="申诉机构" min-width="176" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.orgName }}</div>
            <div class="text-mini">{{ row.district }} · {{ row.orgType }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="appealType" label="申诉类型" width="112" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.appealType }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="violationType" label="争议事项" width="120" show-overflow-tooltip />
        <el-table-column label="风险" width="72" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="originalAmount" label="原认定(元)" width="108" align="right">
          <template #default="{ row }"><span class="num">{{ fmtMoney(row.originalAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="appealAmount" label="申诉金额(元)" width="114" align="right" sortable>
          <template #default="{ row }"><span class="num num--money-mild">{{ fmtMoney(row.appealAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="applicant" label="申诉人" width="132" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="text-mini">{{ row.applicant }}</div>
            <div class="text-mini text-muted num">{{ row.contact }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="submitTime" label="提交时间" width="152">
          <template #default="{ row }"><span class="num text-mini">{{ row.submitTime }}</span></template>
        </el-table-column>
        <el-table-column label="AI 初核" width="150" align="center">
          <template #default="{ row }">
            <el-tag :type="AI_TONE[row.aiConclusion] || 'info'" size="small" effect="light">{{ row.aiConclusion }}</el-tag>
            <el-progress :percentage="row.aiConfidence" :stroke-width="6" :show-text="false" style="margin-top: 3px"
              :color="row.aiConfidence >= 88 ? '#12a150' : row.aiConfidence >= 70 ? '#e8a30c' : '#e5484d'" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="98" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
            <div v-if="row.remainDays" class="text-mini" :class="{ 'is-urgent': row.remainDays <= 3 }">
              余 {{ row.remainDays }} 天
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="复核结论" min-width="152" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.result" :type="RESULT_TONE[row.result] || 'info'" size="small" effect="dark">{{ row.result }}</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="finalAmount" label="最终认定(元)" width="118" align="right">
          <template #default="{ row }">
            <span v-if="row.finalAmount" class="num num--money">{{ fmtMoney(row.finalAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="86" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'Stamp'" @click="openDetail(row)">复核</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无申诉案件" desc="机构提交申诉后将在此列出" /></template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 复核抽屉 -->
    <el-drawer v-model="drawer" :title="`申诉复核 · ${cur?.appealId || ''}`" size="1040px">
      <div v-loading="detailLoading" class="rv-wrap">
        <template v-if="cur">
          <div class="rv-hero" :class="`is-${cur.riskLevel}`">
            <div>
              <div class="rv-hero__t">
                {{ cur.orgName }}
                <el-tag size="small" effect="plain">{{ cur.appealType }}</el-tag>
                <RiskTag :level="cur.riskLevel" />
                <el-tag :type="STATUS_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              </div>
              <div class="rv-hero__m">
                <span><el-icon><Files /></el-icon>{{ cur.clueId }}</span>
                <span><el-icon><Suitcase /></el-icon>{{ cur.inspectTaskId }}</span>
                <span><el-icon><User /></el-icon>{{ cur.applicant }} · {{ cur.contact }}</span>
                <span><el-icon><Clock /></el-icon>{{ cur.submitTime }}</span>
              </div>
            </div>
            <div class="rv-hero__n">
              <div class="hn"><span>原认定</span><b class="num">{{ fmtMoney(cur.originalAmount) }}</b></div>
              <div class="hn"><span>申诉金额</span><b class="num is-warn">{{ fmtMoney(cur.appealAmount) }}</b></div>
              <div class="hn"><span>最终认定</span>
                <b class="num" :class="cur.finalAmount ? 'is-red' : 'is-mute'">
                  {{ cur.finalAmount ? fmtMoney(cur.finalAmount) : '待定' }}
                </b>
              </div>
            </div>
          </div>

          <div class="rv-body">
            <!-- 左 -->
            <div class="section-card section-card--tight">
              <el-tabs v-model="tab">
                <el-tab-pane label="申诉理由与诉求" name="reason">
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="原认定结论">{{ cur.originalResult }}</el-descriptions-item>
                    <el-descriptions-item label="争议事项">{{ cur.violationType }}</el-descriptions-item>
                    <el-descriptions-item label="申诉时限">
                      <span class="num">{{ cur.deadline }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="材料份数">
                      <b class="num">{{ cur.materials?.length || 0 }}</b> 份
                    </el-descriptions-item>
                  </el-descriptions>
                  <div class="section-title mt12">
                    <i class="section-title__dot" /><span class="section-title__text">机构申诉理由</span>
                  </div>
                  <div class="reason">{{ cur.reason }}</div>
                </el-tab-pane>

                <el-tab-pane :label="`举证材料(${cur.materials?.length || 0})`" name="material">
                  <el-table :data="cur.materials || []" size="small" border>
                    <el-table-column type="index" label="#" width="44" align="center" />
                    <el-table-column prop="name" label="材料名称" min-width="210" show-overflow-tooltip />
                    <el-table-column prop="type" label="格式" width="76" align="center">
                      <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.type }}</el-tag></template>
                    </el-table-column>
                    <el-table-column prop="size" label="大小" width="92" align="right">
                      <template #default="{ row }"><span class="num text-mini">{{ row.size }}</span></template>
                    </el-table-column>
                    <el-table-column prop="uploadTime" label="上传时间" width="150">
                      <template #default="{ row }"><span class="num text-mini">{{ row.uploadTime }}</span></template>
                    </el-table-column>
                    <el-table-column prop="verify" label="合规校验" width="94" align="center">
                      <template #default="{ row }">
                        <el-tag :type="row.verify === '通过' ? 'success' : 'warning'" size="small" effect="light">{{ row.verify }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="72" align="center">
                      <template #default>
                        <el-button type="primary" link size="small" :icon="'View'"
                          @click="msg.info('正在调取材料原件，请稍候')">查看</el-button>
                      </template>
                    </el-table-column>
                    <template #empty><EmptyState text="暂无举证材料" height="140px" /></template>
                  </el-table>
                </el-tab-pane>

                <el-tab-pane label="办理轨迹" name="timeline">
                  <div class="tl">
                    <div v-for="(t, i) in cur.timeline" :key="i" class="tl-i" :class="`is-${t.status}`">
                      <div class="tl-i__dot" />
                      <div class="tl-i__b">
                        <div class="tl-i__t">
                          {{ t.title }}
                          <el-tag :type="t.status === 'done' ? 'success' : t.status === 'process' ? 'primary' : 'info'"
                            size="small" effect="plain">
                            {{ t.status === 'done' ? '已完成' : t.status === 'process' ? '进行中' : '待处理' }}
                          </el-tag>
                        </div>
                        <div class="tl-i__m">
                          <span class="num">{{ t.time || '—' }}</span>
                          <span>{{ t.operator }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </el-tab-pane>

                <el-tab-pane v-if="cur.review" label="复核决定" name="decision">
                  <div class="dec" :class="`is-${RESULT_TONE[cur.review.result] || 'info'}`">
                    <div class="dec__t">
                      <el-icon><Stamp /></el-icon>{{ cur.review.result }}
                      <span class="dec__amt num">最终认定 {{ fmtMoney(cur.review.finalAmount) }} 元</span>
                    </div>
                    <div class="dec__o">{{ cur.review.opinion }}</div>
                    <div class="dec__f">
                      <span>复核人：{{ cur.review.reviewer }}</span>
                      <span>审批人：{{ cur.review.approver }}</span>
                      <span class="num">{{ cur.review.time }}</span>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>

            <!-- 右 -->
            <div class="rv-side">
              <SectionCard title="AI 智能初核" desc="材料—证据链自动比对" tight>
                <template #extra>
                  <el-button type="primary" link size="small" :icon="'MagicStick'" :loading="aiLoading"
                    @click="runAi">重新初核</el-button>
                </template>
                <div v-if="aiLoading" class="ai-load">
                  <el-icon class="is-loading" :size="22"><Loading /></el-icon>
                  <span>AI 正在比对申诉材料与原核查证据链…</span>
                  <small>检索政策条款 · 匹配历史同类申诉 · 评估证据强度</small>
                </div>
                <template v-else-if="aiRes || cur.aiPreReview">
                  <div class="ai-c" :class="`is-${AI_TONE[(aiRes?.conclusion || cur.aiPreReview.conclusion)] || 'info'}`">
                    <el-icon :size="17"><Cpu /></el-icon>
                    <span>{{ aiRes?.conclusion || cur.aiPreReview.conclusion }}</span>
                  </div>
                  <div class="ai-cf">
                    <span class="text-mini">置信度</span>
                    <el-progress :percentage="aiRes?.confidence || cur.aiPreReview.confidence" :stroke-width="9"
                      :color="(aiRes?.confidence || cur.aiPreReview.confidence) >= 88 ? '#12a150' : '#e8a30c'" />
                  </div>
                  <div class="ai-a">{{ aiRes?.analysis || cur.aiPreReview.analysis }}</div>
                  <template v-if="!aiRes && cur.aiPreReview.points">
                    <div class="ai-pt">
                      <div v-for="(p, i) in cur.aiPreReview.points" :key="i" class="pt">
                        <el-icon :size="12"><CircleCheckFilled /></el-icon>{{ p }}
                      </div>
                    </div>
                  </template>
                  <template v-if="aiRes">
                    <div class="ai-rec">
                      <div class="rec-l">建议结论</div>
                      <div class="rec-v">{{ aiRes.recommendResult }}</div>
                      <div class="rec-l">建议认定金额</div>
                      <div class="rec-v num is-red">{{ fmtMoney(aiRes.recommendAmount) }} 元</div>
                    </div>
                    <div class="ai-cost text-mini">耗时 {{ aiRes.costMs }}ms · 引擎 v2.3.2</div>
                    <el-button type="primary" plain size="small" :icon="'Select'" style="width: 100%; margin-top: 8px"
                      @click="adoptAi">采纳 AI 建议</el-button>
                  </template>
                </template>
                <EmptyState v-else text="尚未进行 AI 初核" desc="受理后自动触发" height="130px" />
              </SectionCard>

              <SectionCard title="复核操作" tight>
                <el-alert v-if="canAccept" type="warning" :closable="false" show-icon style="margin-bottom: 10px">
                  该申诉尚未受理，受理后将自动触发 AI 智能初核。
                </el-alert>
                <el-button v-if="canAccept" type="primary" :loading="accepting" :icon="'CircleCheck'"
                  style="width: 100%" @click="doAccept">受理申诉并启动 AI 初核</el-button>

                <template v-else-if="!cur.review">
                  <div class="rs-btns">
                    <div v-for="r in AP_RESULT" :key="r" class="rs"
                      :class="[`rs-${RESULT_TONE[r]}`, { 'is-on': rvForm.result === r }]"
                      @click="rvForm.result = r; openReview()">
                      <el-icon :size="15">
                        <component :is="RESULT_TONE[r] === 'success' ? 'Select' : RESULT_TONE[r] === 'warning' ? 'Scissor' : 'CircleClose'" />
                      </el-icon>
                      <span>{{ r }}</span>
                    </div>
                  </div>
                  <div class="rv-hint">
                    <el-icon :size="12"><InfoFilled /></el-icon>
                    复核结论须经稽核组长审批；结论生成后自动推送机构工作台并同步线索全周期档案。
                  </div>
                </template>

                <template v-else>
                  <div class="done-tip">
                    <el-icon :size="18"><SuccessFilled /></el-icon>
                    <div>
                      <b>复核已完成</b>
                      <span>{{ cur.review.result }} · 最终认定 {{ fmtMoney(cur.review.finalAmount) }} 元</span>
                    </div>
                  </div>
                  <el-button :icon="'Guide'" style="width: 100%; margin-top: 8px"
                    @click="router.push('/lifecycle/track')">查看线索全周期轨迹</el-button>
                </template>
              </SectionCard>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>

    <!-- 复核决定弹窗 -->
    <el-dialog v-model="reviewVisible" title="出具复核决定" width="640px">
      <el-form label-width="106px">
        <el-form-item label="复核结论" required>
          <el-radio-group v-model="rvForm.result">
            <el-radio v-for="r in AP_RESULT" :key="r" :value="r" border size="small" class="rd">{{ r }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="最终认定金额" required>
          <el-input-number v-model="rvForm.finalAmount" :min="0" :precision="2" :step="10" style="width: 100%" />
          <div class="text-mini mt4">
            原认定 <span class="num">{{ fmtMoney(cur?.originalAmount || 0) }}</span> 元，
            机构申诉 <span class="num">{{ fmtMoney(cur?.appealAmount || 0) }}</span> 元，
            调减 <span class="num is-red">{{ fmtMoney(Math.max(0, (cur?.originalAmount || 0) - rvForm.finalAmount)) }}</span> 元
          </div>
        </el-form-item>
        <el-form-item label="审批人" required>
          <el-select v-model="rvForm.approver" style="width: 100%">
            <el-option v-for="a in ['稽核组长·张建国', '稽核组长·赵桂芳']" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核意见" required>
          <el-input v-model="rvForm.opinion" type="textarea" :rows="6" maxlength="800" show-word-limit
            placeholder="请阐明复核认定的事实、依据与裁量理由。例如：经复核，机构提交的 LIS 检验报告可证明糖化血红蛋白检测实际执行，该项 62.00 元收费应予撤销；超量开药事实证据充分，原认定应予维持，最终认定涉及医保基金 180.00 元。" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewing" :icon="'Stamp'" @click="doReview">提交复核决定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.mt4 { margin-top: 4px; }
.mt12 { margin-top: 12px; }
.is-urgent { color: var(--zh-danger); font-weight: 700; }
.is-red { color: var(--zh-danger); }

.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
}
.chart-row {
  display: grid; grid-template-columns: 320px 1fr 400px; gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
}
.tips { display: flex; flex-direction: column; gap: 8px; }
.tip {
  display: flex; gap: 9px; padding: 7px 10px;
  border-radius: var(--zh-radius); background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  b { display: block; font-size: var(--zh-font-sm); color: var(--zh-text-primary); }
  span { font-size: 11px; line-height: 1.55; color: var(--zh-text-secondary); }
}
.amt {
  display: flex; align-items: center; gap: 6px; width: 100%;
  :deep(.el-input-number) { flex: 1; }
  span { color: var(--zh-text-placeholder); }
}
:deep(.row-over) { background: var(--zh-risk-high-bg) !important; }

.rv-wrap { display: flex; flex-direction: column; gap: 12px; }
.rv-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 16px; border-radius: var(--zh-radius-lg);
  border: 1px solid var(--zh-border); border-left: 4px solid var(--zh-info);
  background: var(--zh-bg-soft);
  &.is-高 { border-left-color: var(--zh-danger); background: linear-gradient(96deg, var(--zh-risk-high-bg), #fff); }
  &.is-中 { border-left-color: var(--zh-warning); background: linear-gradient(96deg, var(--zh-risk-mid-bg), #fff); }
  &.is-低 { border-left-color: var(--zh-success); background: linear-gradient(96deg, var(--zh-risk-low-bg), #fff); }
  &__t {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 4px; }
    :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
  &__n { display: flex; gap: 18px; flex-shrink: 0; }
}
.hn {
  display: flex; flex-direction: column; align-items: flex-end;
  span { font-size: 11px; color: var(--zh-text-secondary); }
  b {
    font-size: 17px; font-weight: 700; font-family: var(--zh-font-num); color: var(--zh-text-primary);
    &.is-warn { color: var(--zh-warning); }
    &.is-red { color: var(--zh-danger); }
    &.is-mute { color: var(--zh-text-placeholder); font-size: 14px; }
  }
}
.rv-body {
  display: grid; grid-template-columns: 1fr 352px; gap: 12px; align-items: start;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}
.rv-side { display: flex; flex-direction: column; gap: 12px; }
.reason {
  padding: 11px 13px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: var(--zh-font-sm); line-height: 1.9; color: var(--zh-text-regular);
}

.tl { display: flex; flex-direction: column; padding-left: 4px; }
.tl-i {
  position: relative; display: flex; gap: 12px; padding-bottom: 16px;
  &:not(:last-child)::before {
    content: ''; position: absolute; left: 5px; top: 14px; bottom: 0;
    width: 2px; background: var(--zh-border);
  }
  &__dot {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 3px;
    background: var(--zh-border-strong); z-index: 1;
    box-shadow: 0 0 0 3px #fff;
  }
  &.is-done &__dot { background: var(--zh-success); }
  &.is-process &__dot { background: var(--zh-primary); animation: zh-pulse 1.4s infinite; }
  &__t {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; gap: 14px; margin-top: 3px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  }
}

.ai-load {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 26px 12px; text-align: center;
  span { font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-primary); }
  small { font-size: 11px; color: var(--zh-text-secondary); }
  :deep(.el-icon) { color: var(--zh-primary); }
}
.ai-c {
  display: flex; align-items: center; gap: 7px; padding: 10px 12px;
  border-radius: var(--zh-radius); font-size: var(--zh-font-md); font-weight: 700;
  &.is-success { background: var(--zh-risk-low-bg); border: 1px solid var(--zh-risk-low-border); color: var(--zh-success); }
  &.is-warning { background: var(--zh-risk-mid-bg); border: 1px solid var(--zh-risk-mid-border); color: var(--zh-warning); }
  &.is-danger { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-risk-high-border); color: var(--zh-danger); }
  &.is-info { background: var(--zh-info-light); border: 1px solid var(--zh-border); color: var(--zh-info); }
}
.ai-cf { margin-top: 9px; }
.ai-a {
  margin-top: 9px; padding: 9px 11px; border-radius: var(--zh-radius-sm);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: var(--zh-font-xs); line-height: 1.8; color: var(--zh-text-regular);
}
.ai-pt { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
.pt {
  display: flex; align-items: flex-start; gap: 5px;
  font-size: 11px; line-height: 1.6; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-accent); flex-shrink: 0; margin-top: 2px; }
}
.ai-rec {
  display: grid; grid-template-columns: 84px 1fr; gap: 6px 8px; align-items: center;
  margin-top: 10px; padding: 10px 11px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px dashed var(--zh-primary);
}
.rec-l { font-size: 11px; color: var(--zh-text-secondary); }
.rec-v {
  font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-primary);
  &.is-red { color: var(--zh-danger); }
}
.ai-cost { margin-top: 6px; text-align: right; }

.rs-btns { display: flex; flex-direction: column; gap: 8px; }
.rs {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 11px 12px; border-radius: var(--zh-radius);
  background: #fff; border: 1px solid var(--zh-border);
  font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-text-regular);
  transition: all .18s;
  &:hover { transform: translateX(3px); }
  &.rs-success:hover, &.rs-success.is-on { border-color: var(--zh-success); background: var(--zh-risk-low-bg); color: var(--zh-success); }
  &.rs-warning:hover, &.rs-warning.is-on { border-color: var(--zh-warning); background: var(--zh-risk-mid-bg); color: var(--zh-warning); }
  &.rs-danger:hover, &.rs-danger.is-on { border-color: var(--zh-danger); background: var(--zh-risk-high-bg); color: var(--zh-danger); }
}
.rv-hint {
  display: flex; gap: 5px; margin-top: 10px; padding: 8px 10px;
  border-radius: var(--zh-radius); border: 1px dashed var(--zh-border-strong);
  font-size: 11px; line-height: 1.6; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}
.done-tip {
  display: flex; align-items: center; gap: 10px; padding: 12px 13px;
  border-radius: var(--zh-radius); background: var(--zh-risk-low-bg);
  border: 1px solid var(--zh-risk-low-border);
  :deep(.el-icon) { color: var(--zh-success); }
  b { display: block; font-size: var(--zh-font-sm); color: var(--zh-text-primary); }
  span { font-size: 11px; color: var(--zh-text-secondary); }
}
.rd { margin: 0 8px 8px 0 !important; }

.dec {
  padding: 12px 14px; border-radius: var(--zh-radius);
  border: 1px solid var(--zh-border); border-left: 4px solid var(--zh-info);
  background: var(--zh-bg-soft);
  &.is-success { border-left-color: var(--zh-success); background: var(--zh-risk-low-bg); }
  &.is-warning { border-left-color: var(--zh-warning); background: var(--zh-risk-mid-bg); }
  &.is-danger { border-left-color: var(--zh-danger); background: var(--zh-risk-high-bg); }
  &__t {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
  &__amt { margin-left: auto; color: var(--zh-danger); }
  &__o { margin-top: 8px; font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular); }
  &__f {
    display: flex; gap: 16px; flex-wrap: wrap; margin-top: 9px;
    padding-top: 9px; border-top: 1px dashed var(--zh-border);
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  }
}
</style>
