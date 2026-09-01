<script setup lang="ts">
import { getWorkbenchStats, getWorkbenchQueue, batchJudge } from '@/api/agent01-clue/clue'
import { fmtNum, fmtMoney, fmtPercent, CHART_COLORS, CHART_GRID } from '@/utils/format'

const router = useRouter()
const loading = ref(false)
const st = ref<any>(null)
const queue = ref<any[]>([])
const total = ref(0)
const queueLoading = ref(false)
const selection = ref<any[]>([])
const batchVisible = ref(false)
const batching = ref(false)
const batchForm = reactive({ conclusion: '转线上筛查', opinion: '' })

const tab = ref('all')
const q = reactive<any>({ scope: 'mine', riskLevel: '', status: '', page: 1, pageSize: 15 })

async function loadStats() {
  loading.value = true
  try { st.value = await getWorkbenchStats() } finally { loading.value = false }
}

async function loadQueue() {
  queueLoading.value = true
  try {
    const p: any = { ...q }
    if (tab.value === 'high') p.riskLevel = '高'
    else if (tab.value === 'overdue') p.overdue = 'true'
    else if (tab.value === 'pending') p.status = '待研判'
    else if (tab.value === 'processing') p.status = '研判中'
    const res = await getWorkbenchQueue(p)
    queue.value = res.list
    total.value = res.total
  } finally { queueLoading.value = false }
}

watch(tab, () => { q.page = 1; loadQueue() })

async function submitBatch() {
  batching.value = true
  try {
    const res = await batchJudge({
      clueIds: selection.value.map((i) => i.clueId),
      conclusion: batchForm.conclusion,
      opinion: batchForm.opinion
    })
    ElMessage.success(res.message || `已完成 ${selection.value.length} 条线索批量研判`)
    batchVisible.value = false
    selection.value = []
    loadQueue(); loadStats()
  } finally { batching.value = false }
}

function openBatch() {
  if (!selection.value.length) return ElMessage.warning('请先选择线索')
  batchForm.opinion = ''
  batchVisible.value = true
}

function goDetail(row: any) {
  router.push({ name: 'M06', params: { clueId: row.clueId } })
}

/* ---------- 图表 ---------- */
const weekOption = computed(() => {
  const d = st.value?.weekTrend || []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['办结', '确认违规', '合理驳回'], right: 6, top: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    grid: { ...CHART_GRID, left: 34, top: 32, bottom: 24 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.date), boundaryGap: false,
      axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    series: [
      {
        name: '办结', type: 'line', smooth: true, symbolSize: 5, data: d.map((i: any) => i.done),
        lineStyle: { width: 2.2, color: '#1668dc' }, itemStyle: { color: '#1668dc' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,104,220,.22)' }, { offset: 1, color: 'rgba(22,104,220,.01)' }] } }
      },
      { name: '确认违规', type: 'line', smooth: true, symbolSize: 4, data: d.map((i: any) => i.confirmed), lineStyle: { width: 2, color: '#e5484d' }, itemStyle: { color: '#e5484d' } },
      { name: '合理驳回', type: 'line', smooth: true, symbolSize: 4, data: d.map((i: any) => i.rejected), lineStyle: { width: 2, color: '#12a150' }, itemStyle: { color: '#12a150' } }
    ]
  }
})

const sourceOption = computed(() => {
  const d = st.value?.sourceSplit || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}：{c} 条（{d}%）' },
    legend: { type: 'scroll', bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10, color: '#6b7a90' } },
    series: [{
      type: 'pie', radius: ['46%', '72%'], center: ['50%', '43%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
      data: d.map((i: any) => ({ name: i.name, value: i.value }))
    }]
  }
})

const levelOption = computed(() => {
  const s = st.value?.levelSplit || {}
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['0%', '68%'], center: ['50%', '48%'],
      label: { fontSize: 11, formatter: '{b}\n{c}条', color: '#43516b' },
      labelLine: { length: 6, length2: 8 },
      data: [
        { name: '高风险', value: s.high || 0, itemStyle: { color: '#e5484d' } },
        { name: '中风险', value: s.mid || 0, itemStyle: { color: '#e8a30c' } },
        { name: '低风险', value: s.low || 0, itemStyle: { color: '#12a150' } }
      ]
    }]
  }
})

const CONCLUSIONS = ['确认违规', '合理驳回', '转线上筛查', '转线下核查']

onMounted(() => { loadStats(); loadQueue() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="线索研判工作台" subtitle="我的待办 · AI 辅助研判 · 风险分级分流" tag="M05">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadQueue()">刷新</el-button>
      </template>
    </PageHeader>

    <!-- 个人绩效条 -->
    <div class="perf-bar" v-loading="loading">
      <div class="perf-bar__user">
        <div class="perf-bar__avatar">王</div>
        <div class="perf-bar__info">
          <div class="perf-bar__name">稽核员 · 王振华<el-tag size="small" type="primary" effect="dark" class="ml6">主办稽核员</el-tag></div>
          <div class="perf-bar__meta">芜湖市医疗保障局 · 基金监管处 · 稽核一组</div>
        </div>
      </div>
      <div class="perf-bar__metrics">
        <div class="pm">
          <span class="pm__label">研判准确率</span>
          <span class="pm__value num">{{ fmtPercent(st?.myAccuracy) }}</span>
        </div>
        <el-divider direction="vertical" class="pm-div" />
        <div class="pm">
          <span class="pm__label">平均办理时长</span>
          <span class="pm__value num">{{ st?.avgHandleHours ?? '—' }}<i>h</i></span>
        </div>
        <el-divider direction="vertical" class="pm-div" />
        <div class="pm">
          <span class="pm__label">组内排名</span>
          <span class="pm__value num">{{ st?.rankInGroup ?? '—' }}<i>/{{ st?.groupSize ?? '—' }}</i></span>
        </div>
        <el-divider direction="vertical" class="pm-div" />
        <div class="pm">
          <span class="pm__label">本周办结</span>
          <span class="pm__value num">{{ st?.myWeekDone ?? 0 }}<i>条</i></span>
        </div>
      </div>
    </div>

    <!-- KPI -->
    <div class="kpi-grid">
      <StatCard label="我的待研判" :value="st?.myPending || 0" unit="条" icon="Clock" tone="primary"
        :desc="`全市待研判 ${fmtNum(st?.totalPending)} 条`" clickable :active="tab === 'pending'" @click="tab = 'pending'" />
      <StatCard label="我的超期" :value="st?.myOverdue || 0" unit="条" icon="AlarmClock" tone="danger"
        :desc="`全市超期 ${fmtNum(st?.totalOverdue)} 条`" clickable :active="tab === 'overdue'" @click="tab = 'overdue'" />
      <StatCard label="研判中" :value="st?.myProcessing || 0" unit="条" icon="Loading" tone="warning"
        desc="已开始未提交结论" clickable :active="tab === 'processing'" @click="tab = 'processing'" />
      <StatCard label="今日办结" :value="st?.myTodayDone || 0" unit="条" icon="CircleCheck" tone="success"
        :desc="`本周累计 ${st?.myWeekDone} 条`" />
      <StatCard label="高风险待办" :value="st?.levelSplit?.high || 0" unit="条" icon="Warning" tone="danger"
        desc="需优先处理" clickable :active="tab === 'high'" @click="tab = 'high'" />
      <StatCard label="全部待办" :value="total" unit="条" icon="Files" tone="accent"
        desc="点击查看全部队列" clickable :active="tab === 'all'" @click="tab = 'all'" />
    </div>

    <div class="main-row">
      <!-- 待办队列 -->
      <div class="section-card queue-card">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">我的研判队列</span>
          <span class="section-title__desc">按风险等级 + 时限紧迫度智能排序</span>
          <span class="section-title__extra">
            <el-tag v-if="selection.length" type="primary" size="small" effect="light" class="mr6">
              已选 {{ selection.length }} 条
            </el-tag>
            <el-button size="small" type="primary" :disabled="!selection.length" :icon="'Check'" @click="openBatch">
              批量研判
            </el-button>
          </span>
        </div>

        <el-tabs v-model="tab" class="queue-tabs">
          <el-tab-pane label="全部待办" name="all" />
          <el-tab-pane label="待研判" name="pending" />
          <el-tab-pane label="研判中" name="processing" />
          <el-tab-pane name="high">
            <template #label><span class="tab-danger">高风险优先</span></template>
          </el-tab-pane>
          <el-tab-pane name="overdue">
            <template #label>
              <span class="tab-danger">超期预警
                <el-badge v-if="st?.myOverdue" :value="st.myOverdue" class="tab-badge" />
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>

        <el-table :data="queue" v-loading="queueLoading" size="small" border stripe row-key="clueId"
          @selection-change="(v: any[]) => (selection = v)" @row-dblclick="goDetail">
          <el-table-column type="selection" width="42" />
          <el-table-column label="紧迫度" width="76" align="center">
            <template #default="{ row }">
              <div class="urg" :class="row.overdue ? 'is-over' : row.riskLevel === '高' ? 'is-high' : row.pendingHours > 20 ? 'is-warn' : 'is-ok'">
                <span class="urg__icon">
                  <el-icon><component :is="row.overdue ? 'CircleCloseFilled' : row.riskLevel === '高' ? 'WarningFilled' : 'InfoFilled'" /></el-icon>
                </span>
                <span class="urg__txt">{{ row.overdue ? '超期' : row.riskLevel === '高' ? '紧急' : row.pendingHours > 20 ? '临期' : '正常' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="clueId" label="线索编号" width="150">
            <template #default="{ row }">
              <span class="num text-link" @click="goDetail(row)">{{ row.clueId }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="riskLevel" label="风险" width="78" align="center">
            <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
          </el-table-column>
          <el-table-column prop="violationType" label="违规类型" width="112" align="center" />
          <el-table-column prop="orgName" label="涉及机构" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="cell-org">
                <span class="cell-org__name">{{ row.orgName }}</span>
                <span class="cell-org__meta">{{ row.patientName }} · {{ row.doctorName || row.district }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="suspectedAmount" label="可疑金额(元)" width="116" align="right">
            <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度" width="80" align="center">
            <template #default="{ row }"><span class="num" style="font-weight: 700">{{ row.confidence }}%</span></template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }"><StatusTag :status="row.status" /></template>
          </el-table-column>
          <el-table-column prop="pendingHours" label="已等待" width="88" align="center">
            <template #default="{ row }">
              <span class="num" :style="{ color: row.pendingHours > 24 ? 'var(--zh-danger)' : 'var(--zh-text-secondary)' }">
                {{ row.pendingHours }}h
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="goDetail(row)">研判</el-button>
              <el-button link type="success" size="small"
                @click="router.push({ name: 'M07', params: { clueId: row.clueId } })">图谱</el-button>
            </template>
          </el-table-column>
          <template #empty><EmptyState text="当前分类下暂无待办线索" desc="干得不错，队列已清空" icon="SuccessFilled" /></template>
        </el-table>

        <div class="pager">
          <el-pagination v-model:current-page="q.page" :page-size="q.pageSize" :total="total"
            layout="total, prev, pager, next" background small @current-change="loadQueue" />
        </div>
      </div>

      <!-- 右侧统计 -->
      <div class="right-col">
        <SectionCard title="待办风险构成" desc="我的队列分布">
          <EChart :option="levelOption" height="176px" />
        </SectionCard>
        <SectionCard title="线索来源场景" desc="按比对场景">
          <EChart :option="sourceOption" height="196px" />
        </SectionCard>
        <SectionCard title="研判效率" desc="近 7 日新增 / 办结">
          <EChart :option="weekOption" height="196px" />
        </SectionCard>
      </div>
    </div>

    <!-- 批量研判 -->
    <el-dialog v-model="batchVisible" title="批量研判" width="520px">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 14px">
        已选择 <b>{{ selection.length }}</b> 条线索。批量研判适用于同类型、同结论的线索；
        涉及金额较大或高风险线索建议逐条研判以保证准确性。
      </el-alert>
      <el-form :model="batchForm" label-width="86px">
        <el-form-item label="研判结论" required>
          <el-radio-group v-model="batchForm.conclusion">
            <el-radio-button v-for="c in CONCLUSIONS" :key="c" :value="c">{{ c }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="研判意见">
          <el-input v-model="batchForm.opinion" type="textarea" :rows="4"
            placeholder="请填写研判依据与处理意见，将同步写入所选线索的办理档案" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batching" @click="submitBatch">提交研判</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml6 { margin-left: 6px; }
.mr6 { margin-right: 6px; }

.perf-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-radius: var(--zh-radius-lg);
  background: linear-gradient(96deg, #0a2f6b 0%, #1668dc 62%, #1495b3 100%);
  box-shadow: var(--zh-shadow-base);
  color: #fff;

  &__user { display: flex; align-items: center; gap: 11px; }
  &__avatar {
    width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 19px; font-weight: 700;
    background: rgba(255, 255, 255, .18);
    border: 1px solid rgba(255, 255, 255, .3);
  }
  &__name { font-size: var(--zh-font-lg); font-weight: 700; display: flex; align-items: center; }
  &__meta { font-size: var(--zh-font-xs); opacity: .78; margin-top: 2px; }
  &__metrics { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
}
.pm {
  display: flex; flex-direction: column; align-items: center; padding: 0 12px;
  &__label { font-size: 11px; opacity: .76; }
  &__value {
    font-size: 21px; font-weight: 700; line-height: 1.25;
    i { font-size: 11px; font-style: normal; opacity: .72; margin-left: 1px; }
  }
}
.pm-div { height: 30px; border-color: rgba(255, 255, 255, .26); }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.main-row {
  display: grid; grid-template-columns: 1fr 302px; gap: 12px; align-items: start;
  @media (max-width: 1360px) { grid-template-columns: 1fr; }
}
.queue-card { min-width: 0; }
.right-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.queue-tabs { margin-bottom: -6px;
  :deep(.el-tabs__header) { margin-bottom: 8px; }
  :deep(.el-tabs__nav-wrap::after) { height: 1px; background: var(--zh-border-light); }
}
.tab-danger { color: var(--zh-danger); font-weight: 700; }
.tab-badge { :deep(.el-badge__content) { transform: scale(.82) translate(6px, -4px); } }

.urg {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  --tone: var(--zh-success);
  &.is-over { --tone: var(--zh-overdue); }
  &.is-high { --tone: var(--zh-danger); }
  &.is-warn { --tone: var(--zh-warning); }
  &.is-ok { --tone: var(--zh-success); }
  &__icon { color: var(--tone); font-size: 14px; display: flex; }
  &__txt { font-size: 10px; font-weight: 700; color: var(--tone); }
}

.cell-org {
  display: flex; flex-direction: column; line-height: 1.35;
  &__name { color: var(--zh-text-primary); }
  &__meta { font-size: 10px; color: var(--zh-text-placeholder); }
}
</style>
