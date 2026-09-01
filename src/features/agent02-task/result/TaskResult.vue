<script setup lang="ts">
import { getTaskResults, getTaskResult, reviewTaskResult, pushTaskResult } from '@/api/agent02-task/task'
import { fmtMoney, CHART_COLORS } from '@/utils/format'

const msg = ElMessage

const results = ref<any[]>([])
const loading = ref(false)
const activeId = ref('')
const cur = ref<any>(null)
const detailLoading = ref(false)

const STATUS_TONE: Record<string, string> = { 待复核: 'warning', 已复核: 'primary', 已推送: 'success' }
const VS_TONE: Record<string, string> = { 确认违规: 'danger', 申诉中: 'warning', 不予认定: 'info' }

/** 复核表单 */
const review = reactive({
  opinion: '',
  confirmedAmount: 0,
  recoveredAmount: 0,
  handleType: '协议处理',
  needTransfer: false,
  remark: ''
})

async function load() {
  loading.value = true
  try {
    results.value = (await getTaskResults()) || []
    if (results.value.length && !activeId.value) pick(results.value[0])
  } finally {
    loading.value = false
  }
}

async function pick(r: any) {
  activeId.value = r.resultId
  detailLoading.value = true
  try {
    cur.value = await getTaskResult(r.resultId)
    if (cur.value) {
      review.opinion = cur.value.opinion || ''
      review.confirmedAmount = cur.value.summary?.confirmedAmount || 0
      review.recoveredAmount = cur.value.summary?.recoveredAmount || cur.value.summary?.confirmedAmount || 0
      review.needTransfer = (cur.value.violations || []).some((v: any) => v.violationType === '虚假诊疗')
      review.handleType = review.needTransfer ? '移送处理' : '协议处理'
    }
  } finally {
    detailLoading.value = false
  }
}

/* ---------- 复核 / 推送 ---------- */
const reviewing = ref(false)
async function doReview() {
  if (!cur.value) return
  if (!review.opinion.trim()) { msg.warning('请填写处理意见'); return }
  reviewing.value = true
  try {
    await reviewTaskResult({ resultId: cur.value.resultId, ...review })
    msg.success('结果已复核通过，可推送被检机构')
    cur.value.status = '已复核'
    await load()
  } finally {
    reviewing.value = false
  }
}

const pushing = ref(false)
async function doPush() {
  if (!cur.value) return
  await ElMessageBox.confirm(
    '推送后将正式告知被检机构检查结果与申诉权利，并同步流转至违规处置智能体，确认推送？',
    '推送检查结果',
    { type: 'warning', confirmButtonText: '确认推送', cancelButtonText: '取消' }
  ).catch(() => null).then(async (ok) => {
    if (!ok) return
    pushing.value = true
    try {
      const res: any = await pushTaskResult({ resultId: cur.value.resultId })
      msg.success(res?.message || '检查结果已推送')
      cur.value.status = '已推送'
      await load()
    } finally {
      pushing.value = false
    }
  })
}

/* ---------- 违规金额构成图 ---------- */
const amountOption = computed(() => {
  const vs = cur.value?.violations || []
  const byType: Record<string, number> = {}
  vs.forEach((v: any) => { byType[v.violationType] = (byType[v.violationType] || 0) + v.amount })
  const data = Object.keys(byType).map((k) => ({ name: k, value: byType[k] }))
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value.toLocaleString('zh-CN')} 元 (${p.percent}%)` },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['42%', '66%'], center: ['50%', '42%'],
      label: { show: false },
      data
    }]
  }
})

/** 整合来源（结果自动整合可视化） */
const sources = computed(() => {
  if (!cur.value) return []
  const s = cur.value.summary
  return [
    { name: '线上筛查结果', icon: 'Search', count: s.totalClueCount, unit: '条线索', tone: 'primary' },
    { name: '线下核查结果', icon: 'Location', count: s.confirmedViolations, unit: '项确认', tone: 'accent' },
    { name: '证据材料', icon: 'FolderOpened', count: (cur.value.violations || []).reduce((a: number, b: any) => a + b.evidenceCount, 0), unit: '件证据', tone: 'purple' },
    { name: '机构申诉', icon: 'ChatDotSquare', count: s.appealCount, unit: '份申诉', tone: 'warning' }
  ]
})

onMounted(load)
</script>

<template>
  <div class="zh-page">
    <PageHeader title="任务结果管理" tag="M18"
      subtitle="多源结果自动整合 · AI 生成初步结论 · 人工复核后推送处置">
      <template #actions>
        <el-button :icon="'Refresh'" @click="load">刷新</el-button>
        <el-button v-if="cur && cur.status === '待复核'" type="primary" :icon="'CircleCheck'"
          :loading="reviewing" @click="doReview">复核通过</el-button>
        <el-button v-if="cur && cur.status === '已复核'" type="success" :icon="'Promotion'"
          :loading="pushing" @click="doPush">推送机构</el-button>
      </template>
    </PageHeader>

    <div class="res-layout">
      <!-- ============ 左：结果列表 ============ -->
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">待办结任务</span>
          <span class="section-title__extra">
            <el-tag size="small" effect="plain">{{ results.length }}</el-tag>
          </span>
        </div>
        <div v-loading="loading" class="res-list">
          <div v-for="r in results" :key="r.resultId" class="rs"
            :class="{ 'is-active': activeId === r.resultId }" @click="pick(r)">
            <div class="rs__top">
              <span class="rs__id num">{{ r.resultId }}</span>
              <el-tag :type="(STATUS_TONE[r.status] as any) || 'info'" size="small" effect="dark">
                {{ r.status }}
              </el-tag>
            </div>
            <div class="rs__name">{{ r.taskName }}</div>
            <div class="rs__meta">
              <span><el-icon :size="10"><OfficeBuilding /></el-icon>{{ r.summary.orgName }}</span>
            </div>
            <div class="rs__foot">
              <span class="rs__v">确认 <b class="num">{{ r.summary.confirmedViolations }}</b> 项</span>
              <span class="rs__amt num num--money">{{ fmtMoney(r.summary.confirmedAmount) }}</span>
            </div>
          </div>
          <EmptyState v-if="!results.length && !loading" text="暂无待办结任务" height="120px" />
        </div>
      </div>

      <!-- ============ 右：结果详情 ============ -->
      <div v-if="cur" v-loading="detailLoading" class="res-main">
        <!-- 结果概览 -->
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">检查结果概览</span>
            <span class="section-title__desc">系统已自动汇总线上筛查、线下核查、申诉与佐证材料</span>
            <span class="section-title__extra">
              <el-tag :type="(STATUS_TONE[cur.status] as any)" size="small" effect="dark">{{ cur.status }}</el-tag>
            </span>
          </div>

          <div class="rh">
            <div class="rh__t">{{ cur.taskName }}</div>
            <div class="rh__m">
              <span><el-icon><Document /></el-icon>{{ cur.resultId }}</span>
              <span><el-icon><OfficeBuilding /></el-icon>{{ cur.summary.orgName }}</span>
              <span><el-icon><Ticket /></el-icon>{{ cur.summary.taskType }}</span>
              <span><el-icon><Calendar /></el-icon>{{ cur.summary.inspectPeriod }}</span>
              <span><el-icon><UserFilled /></el-icon>{{ cur.summary.inspectors.join('、') }}</span>
            </div>
          </div>

          <!-- 整合来源 -->
          <div class="src-grid">
            <div v-for="s in sources" :key="s.name" class="sc" :class="`is-${s.tone}`">
              <el-icon class="sc__i"><component :is="s.icon" /></el-icon>
              <div class="sc__b">
                <div class="sc__n">{{ s.name }}</div>
                <div class="sc__v"><b class="num">{{ s.count }}</b> {{ s.unit }}</div>
              </div>
            </div>
          </div>

          <!-- 核心指标 -->
          <div class="rk-grid">
            <div class="rk-c">
              <div class="rk-c__v num">{{ cur.summary.totalClueCount }}</div>
              <div class="rk-c__l">纳入线索</div>
            </div>
            <div class="rk-c is-danger">
              <div class="rk-c__v num">{{ cur.summary.confirmedViolations }}</div>
              <div class="rk-c__l">确认违规项</div>
            </div>
            <div class="rk-c is-danger">
              <div class="rk-c__v num num--money">{{ fmtMoney(cur.summary.confirmedAmount) }}</div>
              <div class="rk-c__l">违规金额</div>
            </div>
            <div class="rk-c is-success">
              <div class="rk-c__v num num--money">{{ fmtMoney(cur.summary.recoveredAmount) }}</div>
              <div class="rk-c__l">建议追回</div>
            </div>
            <div class="rk-c is-warning">
              <div class="rk-c__v num">{{ cur.summary.appealCount }}</div>
              <div class="rk-c__l">申诉件数</div>
            </div>
            <div class="rk-c is-warning">
              <div class="rk-c__v num num--money">{{ fmtMoney(cur.summary.appealAmount) }}</div>
              <div class="rk-c__l">申诉金额</div>
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <!-- 违规明细 -->
          <div class="section-card">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">违规内容明细</span>
              <span class="section-title__desc">AI 依据核查证据自动归集</span>
            </div>
            <el-table :data="cur.violations" size="small" border stripe max-height="330">
              <el-table-column prop="no" label="序" width="46" align="center" />
              <el-table-column prop="violationType" label="违规类型" width="100" />
              <el-table-column prop="description" label="违规事实" min-width="260" show-overflow-tooltip />
              <el-table-column prop="amount" label="金额" width="106" align="right">
                <template #default="{ row }">
                  <span class="num num--money">{{ fmtMoney(row.amount) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="evidenceCount" label="证据" width="66" align="center">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.evidenceCount }} 件</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="认定" width="88" align="center">
                <template #default="{ row }">
                  <el-tag :type="(VS_TONE[row.status] as any) || 'info'" size="small" effect="dark">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>

            <div class="sub-title">违规金额构成</div>
            <EChart :option="amountOption" height="182px" />
          </div>

          <!-- 结论与复核 -->
          <div class="section-card">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">初步结论与复核</span>
              <span class="section-title__desc">AI 生成初稿，人工复核修正后签发</span>
            </div>

            <div class="ai-tip">
              <div class="ai-tip__h">
                <el-icon><MagicStick /></el-icon>
                <span>AI 处理意见建议</span>
                <el-tag size="small" effect="dark" type="primary">自动生成</el-tag>
                <span class="ai-tip__t num">{{ cur.generateTime }}</span>
              </div>
              <div class="ai-tip__b">{{ cur.aiSuggestion }}</div>
            </div>

            <el-form label-width="90px" class="rv-form">
              <el-form-item label="处理意见" required>
                <el-input v-model="review.opinion" type="textarea" :rows="7"
                  placeholder="AI 已生成初稿，请复核修正" />
              </el-form-item>

              <div class="form-row">
                <el-form-item label="确认金额">
                  <el-input-number v-model="review.confirmedAmount" :min="0" :precision="2"
                    :controls="false" style="width: 100%" />
                </el-form-item>
                <el-form-item label="建议追回">
                  <el-input-number v-model="review.recoveredAmount" :min="0" :precision="2"
                    :controls="false" style="width: 100%" />
                </el-form-item>
              </div>

              <el-form-item label="处置路径" required>
                <el-radio-group v-model="review.handleType">
                  <el-radio-button label="协议处理" />
                  <el-radio-button label="行政处罚" />
                  <el-radio-button label="移送处理" />
                </el-radio-group>
              </el-form-item>

              <el-form-item label="移送司法">
                <el-switch v-model="review.needTransfer" />
                <span class="text-mini ml8">涉嫌欺诈骗保，移送公安机关侦查</span>
              </el-form-item>

              <el-form-item label="复核备注">
                <el-input v-model="review.remark" type="textarea" :rows="2" placeholder="选填" />
              </el-form-item>
            </el-form>

            <!-- 复核状态 -->
            <div v-if="cur.reviewer" class="rv-done">
              <el-icon><CircleCheckFilled /></el-icon>
              已由 <b>{{ cur.reviewer }}</b> 于 <span class="num">{{ cur.reviewTime }}</span> 复核
              <template v-if="cur.pushTime">
                ，并于 <span class="num">{{ cur.pushTime }}</span> 推送被检机构
              </template>
            </div>

            <div class="rv-actions">
              <el-button v-if="cur.status === '待复核'" type="primary" :icon="'CircleCheck'"
                :loading="reviewing" @click="doReview">复核通过</el-button>
              <el-button v-if="cur.status === '已复核'" type="success" :icon="'Promotion'"
                :loading="pushing" @click="doPush">推送被检机构</el-button>
              <el-button v-if="cur.status === '已推送'" type="success" :icon="'Select'" disabled>
                已推送并流转处置
              </el-button>
              <el-button :icon="'Printer'"
                @click="msg.success('检查结果报告已生成，正在下载')">生成报告</el-button>
            </div>

            <el-alert v-if="cur.status === '已推送'" type="success" :closable="false" show-icon class="mt10">
              <template #title>
                <span class="text-mini">
                  检查结果已告知被检机构及其申诉权利，并已流转至「违规处置智能体」开展协议处理与基金追回
                </span>
              </template>
            </el-alert>
          </div>
        </div>
      </div>

      <EmptyState v-else text="请从左侧选择待办结任务" height="320px" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.mt10 { margin-top: 10px; }
.ml8 { margin-left: 8px; }

.res-layout {
  display: grid; grid-template-columns: 292px 1fr; gap: 12px; align-items: start;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.res-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.detail-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start;
  @media (max-width: 1500px) { grid-template-columns: 1fr; }
}

/* ---------- 左侧列表 ---------- */
.res-list { display: flex; flex-direction: column; gap: 8px; }

.rs {
  padding: 9px 10px; border-radius: var(--zh-radius); cursor: pointer;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  transition: all .18s;

  &:hover { background: var(--zh-bg-hover); }
  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--zh-primary);
    box-shadow: 0 0 0 2px rgba(22, 104, 220, .1);
  }

  &__top { display: flex; align-items: center; justify-content: space-between; gap: 5px; }
  &__id { font-size: 10px; font-weight: 700; color: var(--zh-text-secondary); }
  &__name {
    margin-top: 5px; font-size: 11px; font-weight: 700; line-height: 1.55;
    color: var(--zh-text-primary);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  &__meta {
    margin-top: 4px; font-size: 10px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__foot {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 6px; padding-top: 5px;
    border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary);
    b { color: var(--zh-danger); }
  }
  &__amt { font-size: 11px; }
}

/* ---------- 结果头部 ---------- */
.rh {
  padding: 11px 13px; border-radius: var(--zh-radius);
  background: linear-gradient(118deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t { font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5; }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
}

/* ---------- 整合来源 ---------- */
.src-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 12px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.sc {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 11px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--sc-c, var(--zh-primary));

  &.is-primary { --sc-c: var(--zh-primary); }
  &.is-accent  { --sc-c: var(--zh-accent); }
  &.is-purple  { --sc-c: var(--zh-purple); }
  &.is-warning { --sc-c: var(--zh-warning); }

  &__i { font-size: 17px; color: var(--sc-c); flex-shrink: 0; }
  &__b { min-width: 0; }
  &__n { font-size: 11px; color: var(--zh-text-secondary); }
  &__v { font-size: 11px; color: var(--zh-text-primary); margin-top: 1px; b { font-size: 15px; font-weight: 700; } }
}

/* ---------- 核心指标 ---------- */
.rk-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 10px;
  @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
}

.rk-c {
  padding: 9px 6px; text-align: center;
  border-radius: 6px; background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--rk-c, var(--zh-primary));

  &.is-danger { --rk-c: var(--zh-danger); }
  &.is-success { --rk-c: var(--zh-success); }
  &.is-warning { --rk-c: var(--zh-warning); }

  &__v { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

/* ---------- 复核表单 ---------- */
.ai-tip {
  border-radius: var(--zh-radius);
  background: var(--zh-purple-light);
  border: 1px solid var(--zh-purple);
  overflow: hidden;

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    padding: 7px 11px;
    background: var(--zh-purple);
    color: #fff;
    font-size: var(--zh-font-xs); font-weight: 700;
    :deep(.el-icon) { font-size: 14px; }
  }
  &__t { margin-left: auto; font-weight: 400; opacity: .85; font-size: 10px; }
  &__b {
    padding: 9px 11px;
    font-size: 11px; line-height: 1.85;
    color: var(--zh-text-regular);
  }
}

.sub-title {
  margin: 14px 0 8px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.rv-form {
  margin-top: 12px;
  :deep(.el-form-item) { margin-bottom: 12px; }
}

.form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.rv-done {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  padding: 8px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);
  font-size: 11px; color: var(--zh-text-regular);
  :deep(.el-icon) { color: var(--zh-success); }
  b { color: var(--zh-text-primary); }
}

.rv-actions {
  display: flex; gap: 8px; margin-top: 12px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
