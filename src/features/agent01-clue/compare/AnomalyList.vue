<script setup lang="ts">
import { getAnomalies, transferAnomalies } from '@/api/agent01-clue/compare'
import { useDictStore } from '@/stores/dict'
import { fmtNum, fmtMoney, downloadHint } from '@/utils/format'

const dict = useDictStore()
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const expand = ref(false)
const selection = ref<any[]>([])
const transferring = ref(false)
const detailVisible = ref(false)
const current = ref<any>(null)

const q = reactive<any>({
  keyword: '',
  compareType: '',
  riskLevel: '',
  district: '',
  anomalyType: '',
  orgType: '',
  transferred: '',
  amountMin: undefined,
  amountMax: undefined,
  dateRange: [] as string[],
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
    const res = await getAnomalies(p)
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function doQuery() {
  q.page = 1
  load()
}

function doReset() {
  Object.assign(q, {
    keyword: '', compareType: '', riskLevel: '', district: '', anomalyType: '',
    orgType: '', transferred: '', amountMin: undefined, amountMax: undefined,
    dateRange: [], page: 1
  })
  load()
}

const untransferred = computed(() => selection.value.filter((i) => !i.transferred))

async function doTransfer() {
  if (!untransferred.value.length) return ElMessage.warning('请选择尚未转化的疑点记录')
  await ElMessageBox.confirm(
    `已选中 ${untransferred.value.length} 条未转化疑点，转化后将生成标准化线索并按风险等级自动分派至稽核人员，是否继续？`,
    '批量转化为线索',
    { type: 'warning', confirmButtonText: '确认转化' }
  )
  transferring.value = true
  try {
    const res = await transferAnomalies({ ids: untransferred.value.map((i) => i.anomalyId) })
    ElMessage.success(res.message)
    selection.value = []
    load()
  } finally {
    transferring.value = false
  }
}

function openDetail(row: any) {
  current.value = row
  detailVisible.value = true
}

const summary = computed(() => {
  const high = list.value.filter((i) => i.riskLevel === '高').length
  const amount = list.value.reduce((s, i) => s + (i.diffAmount || 0), 0)
  const tr = list.value.filter((i) => i.transferred).length
  return { high, amount, tr }
})

const violationOptions = computed(() => {
  if (!q.compareType) return dict.allViolationTypes || []
  const map: Record<string, string[]> = {
    药品进销存比对: ['虚假购药', '超量购药', '串换药品', '药品回流'],
    病历结算比对: ['虚假诊疗', '虚记费用', '分解住院', '挂床住院'],
    处方结算比对: ['超量开药', '超适应症用药', '重复开药', '串换药品'],
    检查检验比对: ['过度检查', '虚记检查', '重复检查', '串换项目收费'],
    就医行为比对: ['频繁就医', '冒名就医', '多机构重复就医']
  }
  return map[q.compareType] || dict.allViolationTypes || []
})

watch(() => q.compareType, () => { q.anomalyType = '' })

onMounted(() => {
  dict.load()
  load()
})
</script>

<template>
  <div class="zh-page">
    <PageHeader title="比对疑点清单" subtitle="疑点明细核验 · 双源数据差异比对 · 批量转化标准化线索" tag="M02" />

    <!-- 查询 -->
    <div class="section-card section-card--tight">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">查询条件</span>
        <span class="section-title__desc">支持疑点编号 / 机构 / 项目 / 患者模糊检索</span>
      </div>
      <el-form class="query-form" :model="q" label-width="76px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="疑点编号/机构/项目/患者" clearable :prefix-icon="'Search'"
            @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="比对场景">
          <el-select v-model="q.compareType" placeholder="全部场景" clearable>
            <el-option v-for="t in dict.compareTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="q.riskLevel" placeholder="全部等级" clearable>
            <el-option label="高风险" value="高" />
            <el-option label="中风险" value="中" />
            <el-option label="低风险" value="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="转化状态">
          <el-select v-model="q.transferred" placeholder="全部" clearable>
            <el-option label="已转线索" value="true" />
            <el-option label="未转化" value="false" />
          </el-select>
        </el-form-item>

        <template v-if="expand">
          <el-form-item label="疑点类型">
            <el-select v-model="q.anomalyType" placeholder="全部类型" clearable filterable>
              <el-option v-for="t in violationOptions" :key="t" :label="t" :value="t" />
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
          <el-form-item label="差异金额" class="is-wide">
            <div class="range">
              <el-input-number v-model="q.amountMin" :min="0" :controls="false" placeholder="最小" />
              <span class="range__sep">~</span>
              <el-input-number v-model="q.amountMax" :min="0" :controls="false" placeholder="最大" />
            </div>
          </el-form-item>
          <el-form-item label="比对时间" class="is-wide">
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
          <span>共 <b class="num">{{ fmtNum(total) }}</b> 条疑点</span>
          <el-divider direction="vertical" />
          <span>本页高风险 <b class="num" style="color: var(--zh-danger)">{{ summary.high }}</b> 条</span>
          <el-divider direction="vertical" />
          <span>本页差异金额 <b class="num num--money">{{ fmtMoney(summary.amount) }}</b> 元</span>
          <el-divider direction="vertical" />
          <span>已转线索 <b class="num" style="color: var(--zh-success)">{{ summary.tr }}</b> 条</span>
        </div>
        <div class="table-toolbar__right">
          <el-tag v-if="selection.length" type="primary" effect="light" size="small">
            已选 {{ selection.length }} 条（可转化 {{ untransferred.length }}）
          </el-tag>
          <el-button type="primary" :icon="'Promotion'" :disabled="!untransferred.length"
            :loading="transferring" @click="doTransfer">批量转线索</el-button>
          <el-button :icon="'Download'" @click="downloadHint('比对疑点清单')">导出</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" size="small" border stripe row-key="anomalyId"
        @selection-change="(v: any[]) => (selection = v)">
        <el-table-column type="selection" width="42" :selectable="() => true" />
        <el-table-column type="index" label="#" width="46" align="center"
          :index="(i: number) => (q.page - 1) * q.pageSize + i + 1" />
        <el-table-column prop="anomalyId" label="疑点编号" width="140">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.anomalyId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="compareType" label="比对场景" width="126" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.compareType.replace('比对', '') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="anomalyType" label="疑点类型" width="122" align="center" />
        <el-table-column prop="riskLevel" label="风险" width="82" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="orgName" label="涉及机构" min-width="188" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.orgName }}</span>
              <span class="cell-org__meta num">{{ row.orgCode }} · {{ row.district }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="itemName" label="涉及项目" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-org">
              <span class="cell-org__name">{{ row.itemName }}</span>
              <span class="cell-org__meta num">{{ row.itemCode }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="双源数值对比" width="176" align="center">
          <template #default="{ row }">
            <div class="cell-diff">
              <span class="cell-diff__l">{{ row.leftValue }}</span>
              <el-icon class="cell-diff__arrow"><Right /></el-icon>
              <span class="cell-diff__r">{{ row.rightValue }}</span>
            </div>
            <div class="cell-diff__ratio">偏差率 <b class="num">{{ row.diffRatio }}%</b></div>
          </template>
        </el-table-column>
        <el-table-column prop="diffAmount" label="差异金额(元)" width="118" align="right" sortable>
          <template #default="{ row }">
            <span class="num num--money">{{ fmtMoney(row.diffAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="compareTime" label="比对时间" width="150">
          <template #default="{ row }"><span class="num text-mini">{{ row.compareTime }}</span></template>
        </el-table-column>
        <el-table-column prop="transferred" label="转化状态" width="132" align="center">
          <template #default="{ row }">
            <template v-if="row.transferred">
              <el-tag size="small" type="success" effect="light">已转线索</el-tag>
              <div class="num text-mini" style="margin-top: 2px">{{ row.clueId }}</div>
            </template>
            <el-tag v-else size="small" type="info" effect="plain">未转化</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="112" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button v-if="!row.transferred" link type="success" size="small"
              @click="selection = [row]; doTransfer()">转线索</el-button>
            <el-button v-else link type="info" size="small"
              @click="$router.push({ name: 'M06', params: { clueId: row.clueId } })">看线索</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="未查询到符合条件的疑点记录" desc="请调整查询条件后重试" /></template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper"
          background @current-change="load" @size-change="doQuery" />
      </div>
    </div>

    <!-- 疑点详情 -->
    <el-drawer v-model="detailVisible" title="比对疑点详情" size="620px">
      <template v-if="current">
        <div class="dt-head">
          <div class="dt-head__id num">{{ current.anomalyId }}</div>
          <div class="dt-head__tags">
            <RiskTag :level="current.riskLevel" />
            <el-tag size="small" effect="plain">{{ current.compareType }}</el-tag>
            <el-tag size="small" type="warning" effect="light">{{ current.anomalyType }}</el-tag>
          </div>
        </div>

        <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px">
          {{ current.anomalyDesc }}
        </el-alert>

        <el-descriptions :column="2" border size="small" class="dt-desc">
          <el-descriptions-item label="比对任务">
            <span class="num">{{ current.compareTaskId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="比对时间">
            <span class="num">{{ current.compareTime }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="涉及机构" :span="2">
            {{ current.orgName }}<span class="num text-mini">（{{ current.orgCode }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="机构类型">{{ current.orgType }}</el-descriptions-item>
          <el-descriptions-item label="所属辖区">{{ current.district }}</el-descriptions-item>
          <el-descriptions-item label="涉及项目" :span="2">
            {{ current.itemName }}<span class="num text-mini">（{{ current.itemCode }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联参保人">{{ current.patientName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="关联医师">{{ current.doctorName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="命中规则" :span="2">
            <el-tag size="small" type="primary" effect="plain">{{ current.ruleHit }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="section-title" style="margin-top: 16px">
          <span class="section-title__dot" />
          <span class="section-title__text">双源数据差异</span>
        </div>
        <div class="dt-diff">
          <div class="dt-diff__box">
            <div class="dt-diff__label">源数据（机构上报）</div>
            <div class="dt-diff__val num">{{ current.leftValue }}</div>
          </div>
          <div class="dt-diff__mid">
            <div class="dt-diff__gap num">+{{ current.diffQty }}</div>
            <div class="dt-diff__gaptxt">差异量</div>
          </div>
          <div class="dt-diff__box dt-diff__box--r">
            <div class="dt-diff__label">目标数据（医保结算）</div>
            <div class="dt-diff__val num">{{ current.rightValue }}</div>
          </div>
        </div>
        <div class="dt-amount">
          <span>差异涉及可疑金额</span>
          <b class="num num--money">¥ {{ fmtMoney(current.diffAmount) }}</b>
          <span class="dt-amount__ratio">偏差率 {{ current.diffRatio }}%</span>
        </div>
      </template>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="current && !current.transferred" type="primary" :icon="'Promotion'"
          @click="selection = [current]; detailVisible = false; doTransfer()">转化为线索</el-button>
        <el-button v-else-if="current" type="primary"
          @click="$router.push({ name: 'M06', params: { clueId: current.clueId } })">查看关联线索</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
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

.cell-diff {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  &__l { color: var(--zh-text-regular); }
  &__r { color: var(--zh-danger); font-weight: 700; }
  &__arrow { color: var(--zh-text-placeholder); font-size: 11px; }
  &__ratio { font-size: 10px; color: var(--zh-text-placeholder); margin-top: 1px; }
}

.dt-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px; margin-bottom: 12px;
  padding-bottom: 10px; border-bottom: 1px dashed var(--zh-border);
  &__id { font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary); letter-spacing: .5px; }
  &__tags { display: flex; gap: 6px; }
}

.dt-diff {
  display: grid; grid-template-columns: 1fr 76px 1fr; gap: 8px; align-items: stretch;
  &__box {
    padding: 12px; border-radius: var(--zh-radius);
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    text-align: center;
    &--r { background: var(--zh-risk-high-bg); border-color: var(--zh-risk-high-border); }
  }
  &__label { font-size: var(--zh-font-xs); color: var(--zh-text-secondary); }
  &__val { font-size: 22px; font-weight: 700; color: var(--zh-text-primary); margin-top: 6px; }
  &__mid { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  &__gap { font-size: 18px; font-weight: 700; color: var(--zh-danger); }
  &__gaptxt { font-size: 10px; color: var(--zh-text-placeholder); }
}

.dt-amount {
  margin-top: 12px; padding: 12px 14px;
  border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter);
  border: 1px solid var(--zh-primary-light);
  display: flex; align-items: center; gap: 10px;
  font-size: var(--zh-font-sm); color: var(--zh-text-secondary);
  b { font-size: 20px; color: var(--zh-danger); }
  &__ratio { margin-left: auto; font-size: var(--zh-font-xs); color: var(--zh-text-placeholder); }
}
</style>
