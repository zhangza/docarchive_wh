<script setup lang="ts">
import { getClueDetail, getAiJudgment, submitJudge, getExperts, submitConsult } from '@/api/agent01-clue/clue'
import { fmtMoney } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const DEFAULT_CLUE_ID = 'CL20260829000001'
const clueId = computed(() => (route.params.clueId as string) || DEFAULT_CLUE_ID)

const loading = ref(false)
const aiLoading = ref(false)
const detail = ref<any>(null)
const ai = ref<any>(null)
const tab = ref('settle')

const judgeVisible = ref(false)
const judging = ref(false)
const judgeForm = reactive({ conclusion: '', opinion: '', confirmAmount: 0, nextStep: '', deadline: '2026-09-05' })

const consultVisible = ref(false)
const consulting = ref(false)
const experts = ref<any[]>([])
const consultForm = reactive({ expertIds: [] as string[], question: '', urgency: '普通' })

const clue = computed(() => detail.value?.clue || {})

async function load() {
  loading.value = true
  try {
    detail.value = await getClueDetail({ clueId: clueId.value })
    judgeForm.confirmAmount = detail.value?.clue?.suspectedAmount || 0
  } finally { loading.value = false }
  loadAi()
}

async function loadAi() {
  aiLoading.value = true
  ai.value = null
  try { ai.value = await getAiJudgment({ clueId: clueId.value }) } finally { aiLoading.value = false }
}

watch(clueId, load)

function openJudge(preset?: string) {
  judgeForm.conclusion = preset || ai.value?.conclusionOptions?.[0] || '确认违规'
  judgeForm.opinion = ''
  judgeVisible.value = true
}

/** 采纳 AI 建议 */
function adoptAi() {
  const s: string = ai.value?.suggestion || ''
  const preset = s.includes('确认') ? '确认违规' : s.includes('线上') ? '转线上筛查' : s.includes('线下') ? '转线下核查' : s.includes('驳回') || s.includes('合理') ? '合理驳回' : '转线上筛查'
  judgeForm.opinion = `采纳 AI 研判建议：${s}\nAI 置信度 ${ai.value?.confidence}%，模型版本 ${ai.value?.modelVersion}。\n主要依据：${(ai.value?.reasons || []).slice(0, 2).map((r: any) => r.title + '—' + r.desc).join('；')}`
  openJudge(preset)
  judgeForm.opinion = `采纳 AI 研判建议：${s}\nAI 置信度 ${ai.value?.confidence}%，模型版本 ${ai.value?.modelVersion}。`
}

async function doJudge() {
  if (!judgeForm.opinion.trim()) return ElMessage.warning('请填写研判意见')
  judging.value = true
  try {
    const res = await submitJudge({ clueId: clueId.value, ...judgeForm })
    ElMessage.success(res.message || '研判结论已提交')
    judgeVisible.value = false
    load()
    // 分流引导
    if (judgeForm.conclusion === '转线上筛查') {
      setTimeout(() => ElMessageBox.confirm('该线索已流转至线上筛查核实环节，是否立即前往下发机构自查任务？', '流转成功', { confirmButtonText: '前往筛查审核', cancelButtonText: '稍后处理' })
        .then(() => router.push('/screening/review')).catch(() => {}), 400)
    } else if (judgeForm.conclusion === '转线下核查') {
      setTimeout(() => ElMessageBox.confirm('该线索已流转至线下核查取证环节，是否立即前往创建核查任务？', '流转成功', { confirmButtonText: '前往核查管理', cancelButtonText: '稍后处理' })
        .then(() => router.push('/inspection/manage')).catch(() => {}), 400)
    }
  } finally { judging.value = false }
}

async function openConsult() {
  if (!experts.value.length) experts.value = await getExperts()
  consultForm.expertIds = []
  consultForm.question = `关于线索 ${clueId.value}（${clue.value.violationType}）的合规性认定，请专家从临床合理性与政策适用性角度出具意见。`
  consultVisible.value = true
}

async function doConsult() {
  if (!consultForm.expertIds.length) return ElMessage.warning('请至少选择一位专家')
  consulting.value = true
  try {
    const res = await submitConsult({ clueId: clueId.value, ...consultForm })
    ElMessage.success(res.message || '会诊邀请已发送')
    consultVisible.value = false
  } finally { consulting.value = false }
}

const settleSum = computed(() => {
  const l = detail.value?.settleDetail || []
  return {
    amount: l.reduce((s: number, i: any) => s + i.amount, 0),
    fund: l.reduce((s: number, i: any) => s + i.fundPay, 0),
    flagged: l.filter((i: any) => i.flag).length
  }
})

const NEXT_STEPS = ['下发机构自查（线上筛查）', '安排现场核查取证', '推送违规处置智能体', '纳入专项检查任务', '暂不处理·归档观察']

onMounted(load)
</script>

<template>
  <div class="zh-page" v-loading="loading">
    <PageHeader :title="`线索详情 · ${clueId}`"
      :subtitle="`${clue.violationCategory || ''} / ${clue.violationType || ''} · ${clue.compareType || ''}`"
      tag="M06" back>
      <template #actions>
        <el-button :icon="'Share'" @click="router.push({ name: 'M07', params: { clueId } })">关联图谱</el-button>
        <el-button :icon="'Guide'" @click="router.push('/lifecycle/track')">全周期轨迹</el-button>
        <el-button :icon="'ChatLineSquare'" @click="openConsult">专家会诊</el-button>
        <el-button type="primary" :icon="'EditPen'" @click="openJudge()">提交研判</el-button>
      </template>
    </PageHeader>

    <!-- 线索概要横幅 -->
    <div class="hero" :class="`is-${clue.riskLevel}`">
      <div class="hero__left">
        <div class="hero__badge">
          <span class="hero__score num">{{ clue.riskScore }}</span>
          <span class="hero__score-label">风险分</span>
        </div>
        <div class="hero__info">
          <div class="hero__l1">
            <RiskTag :level="clue.riskLevel" />
            <StatusTag :status="clue.status" />
            <span class="hero__type">{{ clue.violationType }}</span>
            <el-tag v-if="clue.overdue" type="danger" effect="dark" size="small">已超期</el-tag>
          </div>
          <div class="hero__desc">{{ clue.description }}</div>
          <div class="hero__meta">
            <span><el-icon><OfficeBuilding /></el-icon>{{ clue.orgName }}</span>
            <span><el-icon><User /></el-icon>{{ clue.patientName }}（{{ clue.patientGender }} {{ clue.patientAge }}岁）</span>
            <span><el-icon><Avatar /></el-icon>{{ clue.doctorName }} {{ clue.doctorTitle }}</span>
            <span><el-icon><Clock /></el-icon>{{ clue.detectTime }}</span>
          </div>
        </div>
      </div>
      <div class="hero__right">
        <div class="hm">
          <span class="hm__label">疑似违规金额</span>
          <span class="hm__value num">¥{{ fmtMoney(clue.suspectedAmount) }}</span>
        </div>
        <div class="hm">
          <span class="hm__label">AI 置信度</span>
          <span class="hm__value num">{{ clue.confidence }}<i>%</i></span>
        </div>
        <div class="hm">
          <span class="hm__label">办理时限</span>
          <span class="hm__value num sm">{{ clue.deadline?.slice(0, 10) || '—' }}</span>
        </div>
      </div>
    </div>

    <div class="main-row">
      <div class="left-col">
        <!-- 数据差异比对 -->
        <SectionCard v-if="detail?.diff" title="双源数据差异比对" desc="医保结算数据 vs 医疗机构原始业务数据">
          <template #extra>
            <el-tag type="danger" size="small" effect="light">
              发现 {{ detail.diff.rows.filter((r: any) => r.diff).length }} 项关键差异
            </el-tag>
          </template>
          <DiffTable :left="detail.diff.left" :right="detail.diff.right" :rows="detail.diff.rows" />
        </SectionCard>

        <!-- 多维度信息 -->
        <div class="section-card">
          <el-tabs v-model="tab">
            <el-tab-pane label="结算费用明细" name="settle">
              <el-table :data="detail?.settleDetail || []" size="small" border stripe
                :row-class-name="({ row }: any) => (row.flag ? 'row-flag' : '')">
                <el-table-column type="index" label="#" width="46" align="center" />
                <el-table-column prop="itemName" label="项目名称" min-width="190">
                  <template #default="{ row }">
                    {{ row.itemName }}
                    <el-tag v-if="row.flag" type="danger" size="small" effect="dark" class="ml4">疑点项</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="qty" label="数量" width="80" align="center">
                  <template #default="{ row }"><span class="num">{{ row.qty }}</span></template>
                </el-table-column>
                <el-table-column prop="unitPrice" label="单价(元)" width="100" align="right">
                  <template #default="{ row }"><span class="num">{{ fmtMoney(row.unitPrice) }}</span></template>
                </el-table-column>
                <el-table-column prop="amount" label="金额(元)" width="110" align="right">
                  <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.amount) }}</span></template>
                </el-table-column>
                <el-table-column prop="fundPay" label="基金支付(元)" width="118" align="right">
                  <template #default="{ row }"><span class="num num--money-mild">{{ fmtMoney(row.fundPay) }}</span></template>
                </el-table-column>
                <el-table-column label="疑点判定" width="120" align="center">
                  <template #default="{ row }">
                    <span :style="{ color: row.flag ? 'var(--zh-danger)' : 'var(--zh-success)', fontWeight: 700, fontSize: '12px' }">
                      {{ row.flag ? '超量 / 不符' : '正常' }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="settle-sum">
                <span>合计费用 <b class="num num--money">{{ fmtMoney(settleSum.amount) }}</b> 元</span>
                <el-divider direction="vertical" />
                <span>基金支付 <b class="num num--money-mild">{{ fmtMoney(settleSum.fund) }}</b> 元</span>
                <el-divider direction="vertical" />
                <span>疑点项目 <b style="color: var(--zh-danger)">{{ settleSum.flagged }}</b> 项</span>
                <el-divider direction="vertical" />
                <span class="text-mini">结算单号：<b class="num">{{ clue.settleNo }}</b> · 就诊日期 {{ clue.visitDate }} · {{ clue.visitType }}</span>
              </div>
            </el-tab-pane>

            <el-tab-pane label="参保人画像" name="patient">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="姓名">{{ detail?.patient?.name }}</el-descriptions-item>
                <el-descriptions-item label="医保编号"><span class="num">{{ detail?.patient?.patientId }}</span></el-descriptions-item>
                <el-descriptions-item label="性别 / 年龄">{{ detail?.patient?.gender }} · {{ detail?.patient?.age }}岁</el-descriptions-item>
                <el-descriptions-item label="参保类型">{{ detail?.patient?.insuranceType }}</el-descriptions-item>
                <el-descriptions-item label="所属辖区">{{ detail?.patient?.district }}</el-descriptions-item>
                <el-descriptions-item label="关联线索数">
                  <span class="num" style="color: var(--zh-warning); font-weight: 700">{{ detail?.patient?.clueCount }}</span> 条
                </el-descriptions-item>
                <el-descriptions-item label="慢性病备案" :span="3">
                  <el-tag v-for="c in detail?.patient?.chronicDisease || []" :key="c" size="small" type="primary"
                    effect="light" class="mr4">{{ c }}</el-tag>
                  <span v-if="!detail?.patient?.chronicDisease?.length" class="text-muted">无备案记录</span>
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>

            <el-tab-pane label="医师画像" name="doctor">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="姓名">{{ detail?.doctor?.name }}</el-descriptions-item>
                <el-descriptions-item label="医师编号"><span class="num">{{ detail?.doctor?.doctorId }}</span></el-descriptions-item>
                <el-descriptions-item label="职称">{{ detail?.doctor?.title }}</el-descriptions-item>
                <el-descriptions-item label="所在科室">{{ detail?.doctor?.dept }}</el-descriptions-item>
                <el-descriptions-item label="执业年限"><span class="num">{{ detail?.doctor?.practiceYears }}</span> 年</el-descriptions-item>
                <el-descriptions-item label="涉及线索数">
                  <span class="num" style="color: var(--zh-warning); font-weight: 700">{{ detail?.doctor?.clueCount }}</span> 条
                </el-descriptions-item>
                <el-descriptions-item label="多点执业机构" :span="3">
                  <el-tag v-for="o in detail?.doctor?.multiOrg || []" :key="o" size="small" effect="plain" class="mr4">{{ o }}</el-tag>
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>

            <el-tab-pane label="机构画像" name="org">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="机构名称">{{ detail?.org?.orgName }}</el-descriptions-item>
                <el-descriptions-item label="机构编码"><span class="num">{{ detail?.org?.orgCode }}</span></el-descriptions-item>
                <el-descriptions-item label="机构类型">{{ detail?.org?.orgType }} · {{ detail?.org?.level }}</el-descriptions-item>
                <el-descriptions-item label="所属辖区">{{ detail?.org?.district }}</el-descriptions-item>
                <el-descriptions-item label="信用评分">
                  <el-progress :percentage="detail?.org?.creditScore || 0" :stroke-width="8" style="width: 120px"
                    :color="(detail?.org?.creditScore || 0) >= 85 ? '#12a150' : (detail?.org?.creditScore || 0) >= 70 ? '#e8a30c' : '#e5484d'" />
                </el-descriptions-item>
                <el-descriptions-item label="历史线索数">
                  <span class="num" style="color: var(--zh-danger); font-weight: 700">{{ detail?.org?.clueCount }}</span> 条
                </el-descriptions-item>
                <el-descriptions-item label="医保办联系人">{{ detail?.org?.contact }} · {{ detail?.org?.phone }}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>

            <el-tab-pane label="规则命中详情" name="rule">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="命中规则编号"><span class="num">{{ clue.ruleId }}</span></el-descriptions-item>
                <el-descriptions-item label="规则名称">{{ clue.ruleHit }}</el-descriptions-item>
                <el-descriptions-item label="比对场景">{{ clue.compareType }}</el-descriptions-item>
                <el-descriptions-item label="违规大类 / 类型">{{ clue.violationCategory }} / {{ clue.violationType }}</el-descriptions-item>
                <el-descriptions-item label="涉及项目编码"><span class="num">{{ clue.itemCode }}</span></el-descriptions-item>
                <el-descriptions-item label="涉及项目名称">{{ clue.itemName }}</el-descriptions-item>
                <el-descriptions-item label="识别时间"><span class="num">{{ clue.detectTime }}</span></el-descriptions-item>
                <el-descriptions-item label="承办人 / 稽核组">{{ clue.assignee || '待分派' }} · {{ clue.assignGroup || '—' }}</el-descriptions-item>
                <el-descriptions-item label="线索描述" :span="2">{{ clue.description }}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 右侧 AI 研判面板 -->
      <div class="right-col">
        <AiPanel :loading="aiLoading" :suggestion="ai?.suggestion" :suggest-level="ai?.suggestLevel"
          :confidence="ai?.confidence || 0" :model-version="ai?.modelVersion" :analyze-time="ai?.analyzeTime"
          :cost-ms="ai?.costMs" :reasons="ai?.reasons" :similar-cases="ai?.similarCases"
          :policy-refs="ai?.policyRefs" :risk-factors="ai?.riskFactors">
          <template #footer>
            <div class="ai-actions">
              <el-button type="primary" :icon="'Select'" :disabled="aiLoading" @click="adoptAi">采纳 AI 建议</el-button>
              <el-button :icon="'Refresh'" :loading="aiLoading" @click="loadAi">重新分析</el-button>
            </div>
          </template>
        </AiPanel>

        <SectionCard title="研判操作" desc="人工确认与风险分流" tight>
          <div class="quick-judge">
            <el-button v-for="c in ai?.conclusionOptions || ['确认违规', '合理驳回', '转线上筛查', '转线下核查']" :key="c"
              class="qj-btn" :class="`qj-${c}`" @click="c === '专家会诊' ? openConsult() : openJudge(c)">
              <el-icon><component :is="c === '确认违规' ? 'CircleCloseFilled' : c === '合理驳回' ? 'CircleCheckFilled' : c === '专家会诊' ? 'ChatLineSquare' : 'Promotion'" /></el-icon>
              {{ c }}
            </el-button>
          </div>
          <div class="flow-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>高风险线索建议先<b>转线上筛查</b>让机构在线自查举证，存疑再转线下核查取证，形成完整证据闭环。</span>
          </div>
        </SectionCard>
      </div>
    </div>

    <!-- 研判弹窗 -->
    <el-dialog v-model="judgeVisible" title="提交研判结论" width="620px" top="6vh">
      <el-form :model="judgeForm" label-width="96px">
        <el-form-item label="研判结论" required>
          <el-radio-group v-model="judgeForm.conclusion">
            <el-radio-button v-for="c in ai?.conclusionOptions || ['确认违规', '合理驳回', '转线上筛查', '转线下核查']" :key="c" :value="c">
              {{ c }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="judgeForm.conclusion === '确认违规'" label="确认金额">
          <el-input-number v-model="judgeForm.confirmAmount" :min="0" :precision="2" :step="10" style="width: 200px" />
          <span class="text-mini ml8">元（原疑似金额 {{ fmtMoney(clue.suspectedAmount) }} 元）</span>
        </el-form-item>
        <el-form-item label="后续处理">
          <el-select v-model="judgeForm.nextStep" placeholder="请选择后续处理动作" style="width: 100%" clearable>
            <el-option v-for="s in NEXT_STEPS" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="办理时限">
          <el-date-picker v-model="judgeForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 200px" />
        </el-form-item>
        <el-form-item label="研判意见" required>
          <el-input v-model="judgeForm.opinion" type="textarea" :rows="6"
            placeholder="请填写研判依据、政策条款引用、认定过程等，将作为后续处置与申诉复核的重要档案" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="judgeVisible = false">取消</el-button>
        <el-button type="primary" :loading="judging" @click="doJudge">确认提交</el-button>
      </template>
    </el-dialog>

    <!-- 专家会诊 -->
    <el-dialog v-model="consultVisible" title="发起专家会诊" width="640px" top="6vh">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px">
        对于临床合理性存疑、政策适用边界模糊的线索，可邀请医学 / 药学 / 政策专家出具会诊意见，作为研判辅助依据。
      </el-alert>
      <el-form :model="consultForm" label-width="86px">
        <el-form-item label="选择专家" required>
          <el-checkbox-group v-model="consultForm.expertIds" class="expert-group">
            <el-checkbox v-for="e in experts" :key="e.expertId" :value="e.expertId" class="expert-item">
              <div class="expert">
                <span class="expert__name">{{ e.name }}</span>
                <span class="expert__title">{{ e.title }}</span>
                <span class="expert__meta">{{ e.org }} · {{ e.specialty }}</span>
              </div>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="紧急程度">
          <el-radio-group v-model="consultForm.urgency">
            <el-radio-button value="普通" />
            <el-radio-button value="加急" />
            <el-radio-button value="特急" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="会诊问题">
          <el-input v-model="consultForm.question" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="consultVisible = false">取消</el-button>
        <el-button type="primary" :loading="consulting" @click="doConsult">发送会诊邀请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

.hero {
  display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
  padding: 14px 18px; border-radius: var(--zh-radius-lg);
  background: var(--zh-bg-card); border: 1px solid var(--zh-border);
  border-left: 4px solid var(--tone); box-shadow: var(--zh-shadow-sm);
  --tone: var(--zh-risk-low);
  &.is-高 { --tone: var(--zh-risk-high); background: linear-gradient(96deg, var(--zh-risk-high-bg) 0%, #fff 42%); }
  &.is-中 { --tone: var(--zh-risk-mid); background: linear-gradient(96deg, var(--zh-risk-mid-bg) 0%, #fff 42%); }
  &.is-低 { --tone: var(--zh-risk-low); background: linear-gradient(96deg, var(--zh-risk-low-bg) 0%, #fff 42%); }

  &__left { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
  &__badge {
    width: 68px; height: 68px; flex-shrink: 0; border-radius: 16px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--tone); color: #fff; box-shadow: 0 4px 14px -4px var(--tone);
  }
  &__score { font-size: 27px; font-weight: 700; line-height: 1; }
  &__score-label { font-size: 10px; opacity: .84; margin-top: 2px; }
  &__info { min-width: 0; }
  &__l1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  &__type { font-size: var(--zh-font-title); font-weight: 700; color: var(--zh-text-primary); }
  &__desc { font-size: var(--zh-font-sm); color: var(--zh-text-regular); margin: 5px 0 6px; line-height: 1.6; }
  &__meta {
    display: flex; gap: 16px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 4px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__right { display: flex; gap: 22px; flex-shrink: 0; }
}
.hm {
  display: flex; flex-direction: column; align-items: flex-end;
  &__label { font-size: 11px; color: var(--zh-text-placeholder); }
  &__value {
    font-size: 23px; font-weight: 700; color: var(--zh-text-primary); line-height: 1.3;
    &.sm { font-size: 15px; }
    i { font-size: 12px; font-style: normal; color: var(--zh-text-secondary); }
  }
}

.main-row {
  display: grid; grid-template-columns: 1fr 384px; gap: 12px; align-items: start;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}
.left-col, .right-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.settle-sum {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
  margin-top: 10px; padding: 8px 12px;
  background: var(--zh-bg-soft); border-radius: var(--zh-radius);
  font-size: var(--zh-font-sm); color: var(--zh-text-secondary);
  b { font-weight: 700; }
}
:deep(.row-flag) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

.ai-actions { display: flex; gap: 8px; :deep(.el-button) { flex: 1; margin-left: 0 !important; } }

.quick-judge { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.qj-btn {
  margin-left: 0 !important; height: 38px; font-weight: 700;
  border-radius: var(--zh-radius);
  &.qj-确认违规 { color: var(--zh-danger); border-color: var(--zh-risk-high-border); background: var(--zh-risk-high-bg);
    &:hover { background: var(--zh-danger); color: #fff; border-color: var(--zh-danger); } }
  &.qj-合理驳回 { color: var(--zh-success); border-color: var(--zh-risk-low-border); background: var(--zh-risk-low-bg);
    &:hover { background: var(--zh-success); color: #fff; border-color: var(--zh-success); } }
  &.qj-转线上筛查 { color: var(--zh-primary); border-color: #b9d4ff; background: var(--zh-primary-light);
    &:hover { background: var(--zh-primary); color: #fff; } }
  &.qj-转线下核查 { color: var(--zh-warning); border-color: var(--zh-risk-mid-border); background: var(--zh-risk-mid-bg);
    &:hover { background: var(--zh-warning); color: #fff; } }
  &.qj-专家会诊 { color: var(--zh-purple); border-color: #d9c2f7; background: var(--zh-purple-light); grid-column: span 2;
    &:hover { background: var(--zh-purple); color: #fff; } }
}
.flow-hint {
  display: flex; gap: 6px; margin-top: 10px; padding: 8px 10px;
  background: var(--zh-primary-lighter); border-radius: var(--zh-radius);
  border: 1px dashed #bcd6ff;
  font-size: var(--zh-font-xs); color: var(--zh-text-regular); line-height: 1.6;
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  b { color: var(--zh-primary); }
}

.expert-group { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%; }
.expert-item { height: auto; margin-right: 0; :deep(.el-checkbox__label) { line-height: 1.4; } }
.expert {
  display: flex; flex-direction: column;
  &__name { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); }
  &__title { font-size: 11px; color: var(--zh-primary); }
  &__meta { font-size: 10px; color: var(--zh-text-placeholder); }
}
</style>
