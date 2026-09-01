<script setup lang="ts">
import {
  getInspectionStats, getInspectionTasks, getInspectionDetail, createInspection
} from '@/api/agent01-clue/inspection'
import { getClueList } from '@/api/agent01-clue/clue'
import { fmtMoney, CHART_COLORS, CHART_GRID } from '@/utils/format'
import { useDictStore } from '@/stores/dict'

const router = useRouter()
const dict = useDictStore()
/** 模板中可用的消息提示别名 */
const msg = ElMessage

const st = ref<any>(null)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const expand = ref(false)

const INS_TYPES = ['现场核查', '延伸核查', '飞行检查', '专家会诊核查', '复查']
const INS_STATUS = ['待安排', '待出发', '核查中', '待提交结论', '已完成', '已挂起']
const INS_RESULT = ['确认违规', '部分违规', '未发现违规', '证据不足']

const q = reactive({
  keyword: '', status: '', riskLevel: '', inspectType: '', result: '',
  district: '', orgType: '', group: '', mine: '',
  amountMin: undefined as any, amountMax: undefined as any,
  dateRange: [] as string[], page: 1, pageSize: 15
})

async function loadStats() { st.value = await getInspectionStats() }
async function load() {
  loading.value = true
  try {
    const { dateRange, ...rest } = q
    const res: any = await getInspectionTasks({
      ...rest, startDate: dateRange?.[0] || '', endDate: dateRange?.[1] || ''
    })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}
function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, {
    keyword: '', status: '', riskLevel: '', inspectType: '', result: '', district: '',
    orgType: '', group: '', mine: '', amountMin: undefined, amountMax: undefined, dateRange: [], page: 1
  })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'pending') q.status = '待安排'
  if (t === 'ongoing') q.status = '核查中'
  if (t === 'done') q.status = '已完成'
  if (t === 'mine') q.mine = 'true'
  load()
}

/* ===== 图表 ===== */
const typeOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 项 ({d}%)' },
  legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
  color: CHART_COLORS,
  series: [{
    type: 'pie', radius: ['42%', '70%'], center: ['50%', '43%'], roseType: 'radius',
    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
    label: { show: false },
    data: (st.value?.typeDist || []).map((i: any) => ({ name: i.name, value: i.value }))
  }]
}))

const evidenceOption = computed(() => {
  const rows = [...(st.value?.evidenceTypeDist || [])].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 76, right: 62, top: 10, bottom: 18 },
    xAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    yAxis: { type: 'category', data: rows.map((i: any) => i.name), axisLabel: { fontSize: 11 }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 15,
      itemStyle: {
        borderRadius: [0, 5, 5, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#13c2c2' }, { offset: 1, color: '#1668dc' }] }
      },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700 },
      data: rows.map((i: any) => i.value)
    }]
  }
})

/* ===== 新建核查任务 ===== */
const createVisible = ref(false)
const creating = ref(false)
const cLoading = ref(false)
const candidates = ref<any[]>([])
const cSel = ref<any[]>([])
const cForm = reactive({
  inspectType: '现场核查', inspectDate: '2026-08-30', planTime: '09:00',
  leader: '稽核组长·张建国', inspectors: ['稽核员·王振华', '稽核员·李明华'], remark: ''
})
const AUDITOR_OPTS = ['稽核员·王振华', '稽核员·李明华', '稽核员·陈晓东', '稽核员·刘丽娟', '稽核员·周文斌', '稽核员·徐海燕']

async function openCreate() {
  createVisible.value = true
  if (candidates.value.length) return
  cLoading.value = true
  try {
    const res: any = await getClueList({ status: '线下核查中', page: 1, pageSize: 30 })
    candidates.value = res.list
  } finally { cLoading.value = false }
}
async function doCreate() {
  if (!cSel.value.length) return ElMessage.warning('请选择需现场核查的线索')
  if (cForm.inspectors.length < 2) return ElMessage.warning('现场核查须 2 人以上共同执行')
  creating.value = true
  try {
    const res: any = await createInspection({ clueIds: cSel.value.map((i) => i.clueId), ...cForm })
    ElMessage.success(res.message)
    createVisible.value = false
    cSel.value = []
    loadStats(); load()
  } finally { creating.value = false }
}

/* ===== 详情抽屉 ===== */
const drawer = ref(false)
const detailLoading = ref(false)
const cur = ref<any>(null)
const tab = ref('check')

async function openDetail(row: any) {
  drawer.value = true
  tab.value = 'check'
  detailLoading.value = true
  cur.value = null
  try { cur.value = await getInspectionDetail({ taskId: row.taskId }) }
  finally { detailLoading.value = false }
}

const STATUS_TONE: Record<string, any> = {
  待安排: 'info', 待出发: 'warning', 核查中: 'primary', 待提交结论: 'warning', 已完成: 'success', 已挂起: 'danger'
}
const RESULT_TONE: Record<string, any> = {
  确认违规: 'danger', 部分违规: 'warning', 未发现违规: 'success', 证据不足: 'info'
}
const progressColor = (p: number) => (p >= 100 ? '#12a150' : p >= 60 ? '#1668dc' : p > 0 ? '#e8a30c' : '#cdd7e6')

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="线下核查取证管理" subtitle="核查任务编排 · OCR 单据识别 · 证据链哈希固化 · 核查结论认定" tag="M11">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Iphone'" @click="router.push('/inspection/mobile')">移动核查端</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openCreate">新建核查任务</el-button>
      </template>
    </PageHeader>

    <div class="kpi-grid">
      <StatCard label="核查任务总量" :value="st?.totalTask || 0" unit="项" icon="Suitcase" tone="primary" />
      <StatCard label="待安排" :value="st?.pending || 0" unit="项" icon="Calendar" tone="warning" clickable @click="quick('pending')" />
      <StatCard label="核查中" :value="st?.ongoing || 0" unit="项" icon="Location" tone="accent" clickable @click="quick('ongoing')" />
      <StatCard label="今日出勤计划" :value="st?.todayPlan || 0" unit="组" icon="Van" tone="purple" desc="双人以上执法" />
      <StatCard label="证据总数" :value="st?.evidenceCount || 0" unit="件" icon="Folder" tone="primary"
        :desc="`OCR 识别 ${st?.ocrCount || 0} 份`" />
      <StatCard label="OCR 识别准确率" :value="st?.ocrAccuracy || 0" unit="%" icon="Camera" tone="success" :precision="1" />
      <StatCard label="平均核查时长" :value="st?.avgDurationHours || 0" unit="h" icon="Timer" tone="accent" :precision="1" />
      <StatCard label="违规确认率" :value="st?.confirmRate || 0" unit="%" icon="CircleCheck" tone="danger" :precision="1"
        clickable @click="quick('done')" />
    </div>

    <div class="chart-row">
      <SectionCard title="核查类型构成" desc="按核查方式分布" tight>
        <EChart :option="typeOption" height="220px" />
      </SectionCard>
      <SectionCard title="证据类型分布" desc="书证 / 电子数据 / 言词证据 / 视听资料 / 物证" tight>
        <EChart :option="evidenceOption" height="220px" />
      </SectionCard>
      <SectionCard title="核查作业规范提示" tight>
        <div class="tips">
          <div class="tip">
            <el-icon><UserFilled /></el-icon>
            <div><b>双人执法</b><span>现场核查须 2 名以上稽核人员共同执行并出示执法证件</span></div>
          </div>
          <div class="tip">
            <el-icon><Camera /></el-icon>
            <div><b>原件影像</b><span>处方、台账、病历须拍摄原件并经 OCR 结构化比对</span></div>
          </div>
          <div class="tip">
            <el-icon><Lock /></el-icon>
            <div><b>哈希固化</b><span>证据上传即生成 SHA256 摘要并上链存证，不可篡改</span></div>
          </div>
          <div class="tip">
            <el-icon><EditPen /></el-icon>
            <div><b>笔录签认</b><span>问询笔录须经被询问人逐页确认并电子签名</span></div>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">核查任务检索</span>
        <span class="section-title__desc">支持核查任务号、线索号、机构、地址模糊检索</span>
      </div>
      <el-form class="query-form" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="核查任务号 / 线索号 / 机构 / 地址" clearable @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="q.status" placeholder="全部" clearable>
            <el-option v-for="s in INS_STATUS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="核查类型">
          <el-select v-model="q.inspectType" placeholder="全部" clearable>
            <el-option v-for="t in INS_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="核查结论">
          <el-select v-model="q.result" placeholder="全部" clearable>
            <el-option v-for="r in INS_RESULT" :key="r" :label="r" :value="r" />
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
          <el-form-item label="承办组">
            <el-select v-model="q.group" placeholder="全部" clearable>
              <el-option v-for="g in ['稽核一组', '稽核二组', '稽核三组', '基金监管处', '飞行检查组']" :key="g" :label="g" :value="g" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅看我的">
            <el-select v-model="q.mine" placeholder="全部" clearable>
              <el-option label="我参与的核查" value="true" />
            </el-select>
          </el-form-item>
          <el-form-item label="核查日期" class="is-wide">
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
        <span>共 <b class="num">{{ total }}</b> 项核查任务</span>
        <div class="table-toolbar__right">
          <span class="text-mini">双击行查看核查全过程与证据链</span>
        </div>
      </div>
      <el-table :data="list" v-loading="loading" size="small" border stripe @row-dblclick="openDetail">
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="taskId" label="核查任务号" width="152">
          <template #default="{ row }">
            <span class="text-link num" @click="openDetail(row)">{{ row.taskId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索" width="146">
          <template #default="{ row }">
            <span class="text-link num text-mini" @click="router.push({ name: 'M06', params: { clueId: row.clueId } })">{{ row.clueId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="被查机构" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.orgName }}</div>
            <div class="text-mini">{{ row.address }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="inspectType" label="核查类型" width="106" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.inspectType }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="violationType" label="核查事项" width="118" show-overflow-tooltip />
        <el-table-column label="风险" width="76" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="planTime" label="计划时间" width="132">
          <template #default="{ row }"><span class="num text-mini">{{ row.planTime }}</span></template>
        </el-table-column>
        <el-table-column label="核查组" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="text-mini">{{ row.leader }}</div>
            <div class="text-mini text-muted">{{ row.inspectors.join('、') }}</div>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="128" align="center">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="9" :color="progressColor(row.progress)" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="94" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="证据/OCR" width="90" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.evidenceCount }}</span>
            <span class="text-muted"> / </span>
            <span class="num text-mini">{{ row.ocrCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="核查结论" width="106" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.result" :type="RESULT_TONE[row.result] || 'info'" size="small" effect="dark">{{ row.result }}</el-tag>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="confirmAmount" label="确认金额(元)" width="116" align="right" sortable>
          <template #default="{ row }">
            <span v-if="row.confirmAmount" class="num num--money">{{ fmtMoney(row.confirmAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'View'" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无核查任务" desc="可点击右上角「新建核查任务」编排现场核查" /></template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 新建核查 -->
    <el-dialog v-model="createVisible" title="新建线下核查任务" width="920px" top="6vh">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
        线下核查须双人以上共同执行；任务创建后将实时推送至核查人员移动端，支持现场 OCR 取证与证据哈希固化。
      </el-alert>
      <el-table :data="candidates" v-loading="cLoading" size="small" border height="300"
        @selection-change="(v: any) => (cSel = v)">
        <el-table-column type="selection" width="42" align="center" />
        <el-table-column prop="clueId" label="线索号" width="146">
          <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="orgName" label="机构" min-width="170" show-overflow-tooltip />
        <el-table-column prop="violationType" label="违规类型" width="116" />
        <el-table-column label="风险" width="76" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="suspectedAmount" label="疑似金额(元)" width="112" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
      </el-table>
      <el-form label-width="96px" class="c-form">
        <el-form-item label="核查类型">
          <el-radio-group v-model="cForm.inspectType">
            <el-radio v-for="t in INS_TYPES" :key="t" :value="t" border size="small">{{ t }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <div class="c-row">
          <el-form-item label="核查日期">
            <el-date-picker v-model="cForm.inspectDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="出发时间">
            <el-time-select v-model="cForm.planTime" start="08:00" step="00:30" end="18:00" style="width: 100%" />
          </el-form-item>
          <el-form-item label="核查组长">
            <el-select v-model="cForm.leader" style="width: 100%">
              <el-option v-for="l in ['稽核组长·张建国', '稽核组长·赵桂芳']" :key="l" :label="l" :value="l" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="核查人员">
          <el-select v-model="cForm.inspectors" multiple style="width: 100%" placeholder="至少选择 2 名稽核人员">
            <el-option v-for="a in AUDITOR_OPTS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="核查要点">
          <el-input v-model="cForm.remark" type="textarea" :rows="3"
            placeholder="重点核对处方原件与结算数量一致性、发药执行记录、药品进销存台账，并对开方医师进行问询…" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="text-mini fl">已选 <b class="num">{{ cSel.length }}</b> 条线索 · {{ cForm.inspectors.length }} 人执法</span>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" :icon="'Promotion'" @click="doCreate">创建并推送移动端</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawer" :title="`核查任务详情 · ${cur?.taskId || ''}`" size="1020px">
      <div v-loading="detailLoading" class="dt">
        <template v-if="cur">
          <div class="dt-hero" :class="`is-${cur.riskLevel}`">
            <div>
              <div class="dt-hero__title">
                {{ cur.orgName }}
                <RiskTag :level="cur.riskLevel" />
                <el-tag :type="STATUS_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
                <el-tag v-if="cur.result" :type="RESULT_TONE[cur.result] || 'info'" size="small" effect="dark">{{ cur.result }}</el-tag>
              </div>
              <div class="dt-hero__meta">
                <span><el-icon><Location /></el-icon>{{ cur.address }}</span>
                <span><el-icon><Files /></el-icon>{{ cur.clueId }}</span>
                <span><el-icon><Calendar /></el-icon>{{ cur.planTime }}</span>
                <span><el-icon><UserFilled /></el-icon>{{ cur.leader }} · {{ cur.inspectors.join('、') }}</span>
              </div>
            </div>
            <div class="dt-hero__nums">
              <div class="rn"><span class="rn__l">疑似金额</span><span class="rn__v">{{ fmtMoney(cur.suspectedAmount) }}</span></div>
              <div class="rn"><span class="rn__l">确认金额</span><span class="rn__v is-red">{{ cur.confirmAmount ? fmtMoney(cur.confirmAmount) : '—' }}</span></div>
              <div class="rn"><span class="rn__l">证据/OCR</span><span class="rn__v">{{ cur.evidenceCount }}/{{ cur.ocrCount }}</span></div>
            </div>
          </div>

          <div class="section-card section-card--tight">
            <el-tabs v-model="tab">
              <el-tab-pane :label="`核查清单(${cur.checklist?.length || 0})`" name="check">
                <el-table :data="cur.checklist || []" size="small" border>
                  <el-table-column type="index" label="#" width="44" align="center" />
                  <el-table-column prop="item" label="核查事项" width="164" />
                  <el-table-column prop="desc" label="核查要求" min-width="230" show-overflow-tooltip />
                  <el-table-column prop="result" label="核查结果" width="98" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.result === '一致' || row.result === '已签认' ? 'success' : row.result === '未开始' ? 'info' : 'danger'"
                        size="small" effect="light">{{ row.result }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="finding" label="发现问题" min-width="190" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span :class="row.finding ? '' : 'text-muted'">{{ row.finding || '—' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="86" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.status === '已完成' ? 'success' : 'warning'" size="small" effect="plain">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane :label="`OCR 识别(${cur.ocrRecords?.length || 0})`" name="ocr">
                <el-table v-if="cur.ocrRecords?.length" :data="cur.ocrRecords" size="small" border>
                  <el-table-column prop="ocrId" label="识别编号" width="164">
                    <template #default="{ row }"><span class="num text-mini">{{ row.ocrId }}</span></template>
                  </el-table-column>
                  <el-table-column prop="docType" label="单据类型" width="120" />
                  <el-table-column prop="fileName" label="文件" min-width="150" />
                  <el-table-column prop="fields" label="结构化字段" width="104" align="center">
                    <template #default="{ row }"><span class="num">{{ row.fields }}</span></template>
                  </el-table-column>
                  <el-table-column label="置信度" width="150" align="center">
                    <template #default="{ row }">
                      <el-progress :percentage="row.confidence" :stroke-width="8"
                        :color="row.confidence >= 92 ? '#12a150' : row.confidence >= 88 ? '#e8a30c' : '#e5484d'" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="92" align="center">
                    <template #default="{ row }"><el-tag type="success" size="small" effect="light">{{ row.status }}</el-tag></template>
                  </el-table-column>
                  <el-table-column prop="time" label="识别时间" width="150">
                    <template #default="{ row }"><span class="num text-mini">{{ row.time }}</span></template>
                  </el-table-column>
                </el-table>
                <EmptyState v-else text="尚未进行 OCR 单据识别" desc="核查人员到达现场后可通过移动端拍照识别" />
              </el-tab-pane>

              <el-tab-pane :label="`证据链(${cur.evidences?.length || 0})`" name="evidence">
                <div v-if="cur.evidences?.length" class="ev-grid">
                  <EvidenceCard v-for="e in cur.evidences" :key="e.evidenceId" v-bind="e">
                    <template #action>
                      <el-button type="primary" link size="small" :icon="'View'"
                        @click="msg.info('正在调取证据原件，请稍候')">查看</el-button>
                    </template>
                  </EvidenceCard>
                </div>
                <EmptyState v-else text="暂无证据" desc="现场取证后证据将自动哈希固化并上链存证" />
              </el-tab-pane>

              <el-tab-pane :label="`问询笔录(${cur.interviews?.length || 0})`" name="interview">
                <div v-if="cur.interviews?.length" class="iv-list">
                  <div v-for="iv in cur.interviews" :key="iv.recordId" class="iv">
                    <div class="iv__head">
                      <span class="iv__name">{{ iv.interviewee }}</span>
                      <el-tag size="small" effect="plain">{{ iv.role }}</el-tag>
                      <span class="text-mini">{{ iv.duration }}</span>
                      <el-tag v-if="iv.signed" type="success" size="small" effect="dark">已签认</el-tag>
                      <span class="iv__time num text-mini">{{ iv.time }}</span>
                    </div>
                    <div class="iv__body">{{ iv.summary }}</div>
                    <div class="iv__foot">
                      <span class="num text-mini text-muted">{{ iv.recordId }}</span>
                      <el-button type="primary" link size="small" :icon="'Headset'"
                        @click="msg.info('正在加载访谈录音，请稍候')">录音回放</el-button>
                    </div>
                  </div>
                </div>
                <EmptyState v-else text="暂无问询笔录" desc="现场问询后须经被询问人电子签认" />
              </el-tab-pane>

              <el-tab-pane label="核查结论" name="conclusion">
                <template v-if="cur.conclusion">
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="核查结论">
                      <el-tag :type="RESULT_TONE[cur.conclusion.result] || 'info'" size="small" effect="dark">{{ cur.conclusion.result }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="确认违规金额">
                      <span class="num num--money">{{ fmtMoney(cur.conclusion.confirmAmount) }} 元</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="违规类型">
                      <el-tag v-for="v in cur.conclusion.violationTypes" :key="v" size="small" effect="plain" class="ml4">{{ v }}</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="提交人">{{ cur.conclusion.submitter }}</el-descriptions-item>
                    <el-descriptions-item label="提交时间">
                      <span class="num">{{ cur.conclusion.submitTime }}</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="核查时长">
                      <span class="num">{{ cur.durationHours }} 小时</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="结论详情" :span="2">
                      <div class="conc">{{ cur.conclusion.detail }}</div>
                    </el-descriptions-item>
                  </el-descriptions>
                  <div class="conc-next">
                    <el-icon><Right /></el-icon>
                    该核查结论已同步至线索全周期档案；确认违规线索将推送至<b>违规处置智能体</b>启动追回流程。
                    <el-button type="primary" link size="small" :icon="'Guide'"
                      @click="router.push('/lifecycle/track')">查看全周期轨迹</el-button>
                  </div>
                </template>
                <EmptyState v-else text="核查尚未结束" desc="核查完成后由核查组长提交结论认定" />
              </el-tab-pane>
            </el-tabs>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.fl { float: left; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
}
.chart-row {
  display: grid; grid-template-columns: 300px 1fr 400px; gap: 12px;
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

.c-form { margin-top: 14px; }
.c-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
}

.dt { display: flex; flex-direction: column; gap: 12px; }
.dt-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 16px; border-radius: var(--zh-radius-lg);
  border: 1px solid var(--zh-border); border-left: 4px solid var(--zh-info);
  background: var(--zh-bg-soft);
  &.is-高 { border-left-color: var(--zh-danger); background: linear-gradient(96deg, var(--zh-risk-high-bg), #fff); }
  &.is-中 { border-left-color: var(--zh-warning); background: linear-gradient(96deg, var(--zh-risk-mid-bg), #fff); }
  &.is-低 { border-left-color: var(--zh-success); background: linear-gradient(96deg, var(--zh-risk-low-bg), #fff); }
  &__title {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary);
  }
  &__meta {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 4px; }
    :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
  &__nums { display: flex; gap: 20px; flex-shrink: 0; }
}
.rn {
  display: flex; flex-direction: column; align-items: flex-end;
  &__l { font-size: 11px; color: var(--zh-text-secondary); }
  &__v {
    font-size: 17px; font-weight: 700; color: var(--zh-primary); font-family: var(--zh-font-num);
    &.is-red { color: var(--zh-danger); }
  }
}

.ev-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px;
}
.iv-list { display: flex; flex-direction: column; gap: 10px; }
.iv {
  padding: 11px 13px; border-radius: var(--zh-radius);
  border: 1px solid var(--zh-border); background: var(--zh-bg-soft);
  &__head {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  }
  &__name { font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); }
  &__time { margin-left: auto; }
  &__body {
    margin-top: 8px; padding: 9px 11px; border-radius: var(--zh-radius-sm);
    background: #fff; border: 1px solid var(--zh-border-light);
    font-size: var(--zh-font-sm); line-height: 1.8; color: var(--zh-text-regular);
  }
  &__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 7px; }
}
.conc { font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular); }
.conc-next {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 12px;
  padding: 9px 12px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px dashed var(--zh-primary);
  font-size: var(--zh-font-xs); color: var(--zh-text-regular);
  b { color: var(--zh-primary); }
  :deep(.el-icon) { color: var(--zh-primary); }
}
</style>
