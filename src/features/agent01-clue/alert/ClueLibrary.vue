<script setup lang="ts">
import { getClueList, getClueStat, assignClue } from '@/api/agent01-clue/clue'
import { getAuditors } from '@/api/shared/common'
import { useDictStore } from '@/stores/dict'
import { fmtNum, fmtMoney, fmtWan, downloadHint } from '@/utils/format'

const router = useRouter()
const dict = useDictStore()
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const stat = ref<any>(null)
const expand = ref(false)
const selection = ref<any[]>([])
const auditors = ref<any[]>([])

const assignVisible = ref(false)
const assigning = ref(false)
const assignForm = reactive({ assignee: '', assignGroup: '稽核一组', deadline: '2026-09-05', remark: '' })

const q = reactive<any>({
  keyword: '',
  riskLevel: '',
  status: '',
  violationCategory: '',
  violationType: '',
  compareType: '',
  district: '',
  orgType: '',
  assignee: '',
  overdue: '',
  amountMin: undefined,
  amountMax: undefined,
  dateRange: [] as string[],
  sortBy: 'detectTime',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20
})

async function load() {
  loading.value = true
  try {
    const p: any = { ...q }
    p.startTime = q.dateRange?.[0] || ''
    p.endTime = q.dateRange?.[1] || ''
    delete p.dateRange
    const [res, s] = await Promise.all([getClueList(p), getClueStat(p)])
    list.value = res.list
    total.value = res.total
    stat.value = s
  } finally {
    loading.value = false
  }
}

function doQuery() { q.page = 1; load() }

function doReset() {
  Object.assign(q, {
    keyword: '', riskLevel: '', status: '', violationCategory: '', violationType: '',
    compareType: '', district: '', orgType: '', assignee: '', overdue: '',
    amountMin: undefined, amountMax: undefined, dateRange: [], page: 1
  })
  load()
}

function onSort({ prop, order }: any) {
  if (!prop || !order) { q.sortBy = 'detectTime'; q.sortOrder = 'desc' }
  else { q.sortBy = prop; q.sortOrder = order === 'ascending' ? 'asc' : 'desc' }
  load()
}

/** 快捷筛选卡片 */
function quickFilter(type: string) {
  doReset()
  if (type === 'high') q.riskLevel = '高'
  else if (type === 'pending') q.status = '待研判'
  else if (type === 'overdue') q.overdue = 'true'
  else if (type === 'closed') q.status = '已结案'
  q.page = 1
  load()
}

async function openAssign() {
  if (!selection.value.length) return ElMessage.warning('请先选择需要分派的线索')
  if (!auditors.value.length) auditors.value = await getAuditors()
  assignForm.assignee = ''
  assignVisible.value = true
}

async function submitAssign() {
  if (!assignForm.assignee) return ElMessage.warning('请选择承办稽核员')
  assigning.value = true
  try {
    const res = await assignClue({ clueIds: selection.value.map((i) => i.clueId), ...assignForm })
    ElMessage.success(res.message || `已成功分派 ${selection.value.length} 条线索`)
    assignVisible.value = false
    selection.value = []
    load()
  } finally {
    assigning.value = false
  }
}

const violationOptions = computed(() => {
  if (!q.violationCategory) return dict.allViolationTypes || []
  const node = (dict.violationTree || []).find((n: any) => n.category === q.violationCategory)
  return node?.types || []
})
watch(() => q.violationCategory, () => { q.violationType = '' })

onMounted(() => { dict.load(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="疑点线索库" subtitle="标准化线索统一台账 · 多维检索 · 批量分派" tag="M04">
      <template #actions>
        <el-button :icon="'Refresh'" @click="load">刷新</el-button>
        <el-button :icon="'Download'" @click="downloadHint('疑点线索库')">导出台账</el-button>
        <el-button type="primary" :icon="'Monitor'" @click="router.push('/judgment/workbench')">研判工作台</el-button>
      </template>
    </PageHeader>

    <!-- 概览卡（可点击快筛） -->
    <div class="kpi-grid">
      <StatCard label="线索总量" :value="stat?.total || 0" unit="条" icon="Files" tone="primary"
        :desc="`可疑金额 ${fmtWan(stat?.totalAmount)}`" clickable :active="!q.riskLevel && !q.status && !q.overdue"
        @click="doReset()" />
      <StatCard label="高风险线索" :value="stat?.high || 0" unit="条" icon="Warning" tone="danger"
        :desc="`占比 ${stat?.total ? ((stat.high / stat.total) * 100).toFixed(1) : 0}%`" clickable
        :active="q.riskLevel === '高'" @click="quickFilter('high')" />
      <StatCard label="待研判" :value="stat?.pending || 0" unit="条" icon="Clock" tone="warning"
        desc="等待稽核人员研判" clickable :active="q.status === '待研判'" @click="quickFilter('pending')" />
      <StatCard label="超期线索" :value="stat?.overdue || 0" unit="条" icon="AlarmClock" tone="danger"
        desc="超出办理时限" clickable :active="q.overdue === 'true'" @click="quickFilter('overdue')" />
      <StatCard label="已结案" :value="stat?.closed || 0" unit="条" icon="CircleCheck" tone="success"
        :desc="`结案率 ${stat?.total ? ((stat.closed / stat.total) * 100).toFixed(1) : 0}%`" clickable
        :active="q.status === '已结案'" @click="quickFilter('closed')" />
      <StatCard label="平均置信度" :value="stat?.avgConfidence || 0" unit="%" icon="DataAnalysis" tone="accent"
        :precision="1" desc="AI 模型识别置信度" />
    </div>

    <!-- 查询 -->
    <div class="section-card section-card--tight">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">线索检索</span>
        <span class="section-title__desc">支持线索编号 / 机构 / 参保人 / 医师 / 项目模糊检索</span>
      </div>
      <el-form class="query-form" :model="q" label-width="76px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="线索编号/机构/参保人/医师" clearable :prefix-icon="'Search'"
            @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="q.riskLevel" placeholder="全部等级" clearable>
            <el-option label="高风险" value="高" />
            <el-option label="中风险" value="中" />
            <el-option label="低风险" value="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="线索状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in dict.clueStatus" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="违规大类">
          <el-select v-model="q.violationCategory" placeholder="全部大类" clearable>
            <el-option v-for="n in dict.violationTree" :key="n.category" :label="n.category" :value="n.category" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="违规类型">
            <el-select v-model="q.violationType" placeholder="全部类型" clearable filterable>
              <el-option v-for="t in violationOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="比对场景">
            <el-select v-model="q.compareType" placeholder="全部场景" clearable>
              <el-option v-for="t in dict.compareTypes" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
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
          <el-form-item label="承办人">
            <el-input v-model="q.assignee" placeholder="稽核员姓名" clearable />
          </el-form-item>
          <el-form-item label="是否超期">
            <el-select v-model="q.overdue" placeholder="全部" clearable>
              <el-option label="已超期" value="true" />
              <el-option label="未超期" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="可疑金额" class="is-wide">
            <div class="range">
              <el-input-number v-model="q.amountMin" :min="0" :controls="false" placeholder="最小" />
              <span class="range__sep">~</span>
              <el-input-number v-model="q.amountMax" :min="0" :controls="false" placeholder="最大" />
            </div>
          </el-form-item>
          <el-form-item label="识别时间" class="is-wide">
            <el-date-picker v-model="q.dateRange" type="daterange" value-format="YYYY-MM-DD"
              start-placeholder="开始" end-placeholder="结束" />
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

    <!-- 表格 -->
    <div class="section-card">
      <div class="table-toolbar">
        <div class="toolbar-summary">
          <span>共 <b class="num">{{ fmtNum(total) }}</b> 条线索</span>
          <el-divider direction="vertical" />
          <span>本页可疑金额 <b class="num num--money">{{ fmtMoney(list.reduce((s, i) => s + i.suspectedAmount, 0)) }}</b> 元</span>
        </div>
        <div class="table-toolbar__right">
          <el-tag v-if="selection.length" type="primary" effect="light" size="small">已选 {{ selection.length }} 条</el-tag>
          <el-button type="primary" :icon="'User'" :disabled="!selection.length" @click="openAssign">批量分派</el-button>
          <el-button :icon="'Download'" @click="downloadHint('线索清单')">导出</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" size="small" border stripe row-key="clueId"
        @selection-change="(v: any[]) => (selection = v)" @sort-change="onSort">
        <el-table-column type="selection" width="42" />
        <el-table-column type="index" label="#" width="46" align="center"
          :index="(i: number) => (q.page - 1) * q.pageSize + i + 1" />
        <el-table-column prop="clueId" label="线索编号" width="152">
          <template #default="{ row }">
            <span class="num text-link" @click="router.push({ name: 'M06', params: { clueId: row.clueId } })">
              {{ row.clueId }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="riskLevel" label="风险" width="80" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="riskScore" label="风险分" width="76" align="center" sortable="custom">
          <template #default="{ row }">
            <span class="score" :style="{ color: row.riskScore >= 80 ? 'var(--zh-danger)' : row.riskScore >= 60 ? 'var(--zh-warning)' : 'var(--zh-success)' }">
              {{ row.riskScore }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="violationType" label="违规类型" width="118" align="center">
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.violationType }}</span>
              <span class="cell-org__meta">{{ row.violationCategory }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="涉及机构" min-width="184" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.orgName }}</span>
              <span class="cell-org__meta">{{ row.district }} · {{ row.deptName || row.orgType }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="patientName" label="参保人 / 医师" width="130">
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.patientName }}</span>
              <span class="cell-org__meta">{{ row.doctorName || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="itemName" label="涉及项目" min-width="150" show-overflow-tooltip />
        <el-table-column prop="suspectedAmount" label="可疑金额(元)" width="118" align="right" sortable="custom">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="confidence" label="置信度" width="92" align="center" sortable="custom">
          <template #default="{ row }">
            <el-progress :percentage="row.confidence" :stroke-width="4" :show-text="false"
              :color="row.confidence >= 90 ? '#e5484d' : row.confidence >= 70 ? '#e8a30c' : '#1668dc'" />
            <span class="num text-mini">{{ row.confidence }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="106" align="center">
          <template #default="{ row }"><StatusTag :status="row.status" /></template>
        </el-table-column>
        <el-table-column prop="assignee" label="承办人" width="118">
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.assignee || '待分派' }}</span>
              <span class="cell-org__meta">{{ row.assignGroup || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="detectTime" label="识别时间" width="146" sortable="custom">
          <template #default="{ row }"><span class="num text-mini">{{ row.detectTime }}</span></template>
        </el-table-column>
        <el-table-column prop="deadline" label="办理时限" width="120" align="center">
          <template #default="{ row }">
            <span class="num text-mini" :style="{ color: row.overdue ? 'var(--zh-overdue)' : 'var(--zh-text-secondary)' }">
              {{ row.deadline?.slice(5, 10) || '—' }}
            </span>
            <el-tag v-if="row.overdue" size="small" type="danger" effect="dark" class="inline-tag">超期</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="122" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small"
              @click="router.push({ name: 'M06', params: { clueId: row.clueId } })">详情</el-button>
            <el-button link type="success" size="small"
              @click="router.push({ name: 'M07', params: { clueId: row.clueId } })">图谱</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="未查询到符合条件的线索" desc="请调整查询条件后重试" /></template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper"
          background @current-change="load" @size-change="doQuery" />
      </div>
    </div>

    <!-- 分派 -->
    <el-dialog v-model="assignVisible" title="批量分派线索" width="500px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px">
        已选择 <b>{{ selection.length }}</b> 条线索，其中高风险
        <b style="color: var(--zh-danger)">{{ selection.filter(i => i.riskLevel === '高').length }}</b> 条。
        高风险线索建议指派资深稽核员，并优先启动线上筛查核实。
      </el-alert>
      <el-form :model="assignForm" label-width="94px">
        <el-form-item label="承办稽核员" required>
          <el-select v-model="assignForm.assignee" placeholder="请选择" style="width: 100%" filterable>
            <el-option v-for="a in auditors" :key="a.name || a" :label="a.displayName || a.name || a"
              :value="a.displayName || a.name || a">
              <div class="opt">
                <span>{{ a.displayName || a.name || a }}</span>
                <span class="opt__meta">{{ a.group }} · 在办 {{ a.workload ?? '—' }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="所属稽核组">
          <el-select v-model="assignForm.assignGroup" style="width: 100%">
            <el-option v-for="g in ['稽核一组', '稽核二组', '稽核三组', '基金监管处', '飞行检查组']" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="办理时限">
          <el-date-picker v-model="assignForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="分派说明">
          <el-input v-model="assignForm.remark" type="textarea" :rows="3" placeholder="可填写办理要求、重点关注事项等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="submitAssign">确认分派</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}
.range {
  display: flex; align-items: center; gap: 6px; width: 100%;
  :deep(.el-input-number) { flex: 1; }
  &__sep { color: var(--zh-text-placeholder); }
}
.toolbar-summary {
  display: flex; align-items: center; flex-wrap: wrap;
  font-size: var(--zh-font-sm); color: var(--zh-text-secondary);
  b { color: var(--zh-text-primary); font-weight: 700; }
}
.cell-org {
  display: flex; flex-direction: column; line-height: 1.35;
  &__name { color: var(--zh-text-primary); }
  &__meta { font-size: 10px; color: var(--zh-text-placeholder); }
}
.score { font-family: var(--zh-font-num); font-size: var(--zh-font-lg); font-weight: 700; }
.inline-tag { margin-left: 4px; transform: scale(.86); }
.opt { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  &__meta { font-size: 11px; color: var(--zh-text-placeholder); } }
</style>
