<script setup lang="ts">
import { getMySelfCheck, getSelfCheckSummary, getScreeningDetail, submitScreening } from '@/api/agent01-clue/screening'
import { fmtMoney } from '@/utils/format'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const orgCode = computed(() => user.currentOrgCode || 'H340200001')

const loading = ref(false)
const summary = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const q = reactive({ status: '', page: 1, pageSize: 10 })

/* 自查填报抽屉 */
const drawer = ref(false)
const detailLoading = ref(false)
const cur = ref<any>(null)
const step = ref(0)
const submitting = ref(false)
const form = reactive({
  orgReply: '',
  reason: '',
  agree: false,
  selfReport: [] as any[],
  materials: [] as any[]
})

const REASONS = [
  '信息系统模板自动带出，医师未及时修正',
  '结算时点与医嘱执行时点存在差异',
  '患者家属代取药合并结算',
  '病历文书录入延迟，尚未回传',
  '医嘱执行记录未及时上传至医保接口',
  '确系患者病情需要，已补充临床依据',
  '经复核确属我院操作失误，愿主动退回'
]

const MATERIAL_TPL = [
  { name: '门诊/住院处方（复印件）', type: 'PDF' },
  { name: '医嘱执行记录截图', type: 'PNG' },
  { name: '病历首页及病程记录', type: 'PDF' },
  { name: '情况说明（加盖公章）', type: 'PDF' },
  { name: '药品出入库台账', type: 'XLSX' },
  { name: '检查检验报告单', type: 'PDF' }
]

async function loadSummary() {
  summary.value = await getSelfCheckSummary({ orgCode: orgCode.value })
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await getMySelfCheck({ orgCode: orgCode.value, ...q })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

function reload() { loadSummary(); loadList() }
watch(orgCode, reload)

async function openTask(row: any) {
  drawer.value = true
  step.value = 0
  detailLoading.value = true
  cur.value = null
  try {
    const d: any = await getScreeningDetail({ taskId: row.taskId })
    cur.value = d
    form.orgReply = ''
    form.reason = ''
    form.agree = false
    form.selfReport = (d.selfReport || []).map((i: any) => ({ ...i, selfQty: i.insuranceQty }))
    form.materials = []
  } finally { detailLoading.value = false }
}

function addMaterial(tpl: any) {
  if (form.materials.some((m) => m.name === tpl.name)) return ElMessage.info('该材料已上传')
  form.materials.push({
    ...tpl,
    size: `${Math.round(120 + Math.random() * 600)} KB`,
    uploadTime: '2026-09-01 15:38:22',
    ocrConfidence: Math.round(86 + Math.random() * 12),
    verify: '待核验'
  })
  ElMessage.success(`「${tpl.name}」上传成功，系统已自动 OCR 识别`)
}

function removeMaterial(i: number) { form.materials.splice(i, 1) }

const diffRows = computed(() =>
  form.selfReport.map((i: any) => {
    const diff = i.selfQty - i.insuranceQty
    return { ...i, diff, diffAmount: Math.abs(diff) * i.unitPrice, match: diff === 0 }
  })
)
const unmatchedCount = computed(() => diffRows.value.filter((i: any) => !i.match).length)

function nextStep() {
  if (step.value === 1 && !form.orgReply.trim()) return ElMessage.warning('请填写自查说明')
  if (step.value === 2 && !form.materials.length) return ElMessage.warning('请至少上传一项举证材料')
  step.value++
}

async function doSubmit() {
  if (!form.agree) return ElMessage.warning('请确认自查承诺声明')
  submitting.value = true
  try {
    const res: any = await submitScreening({
      taskId: cur.value.taskId,
      orgReply: form.orgReply,
      reason: form.reason,
      selfReport: diffRows.value,
      materials: form.materials
    })
    ElMessage.success(res.message || '提交成功')
    drawer.value = false
    reload()
  } finally { submitting.value = false }
}

const STATUS_TONE: Record<string, any> = {
  待下发: 'info', 待提交: 'warning', 已提交: 'primary', 待审核: 'primary',
  已初筛: 'primary', 已完成: 'success', 已逾期: 'danger'
}
const canFill = (s: string) => ['待提交', '待下发', '已逾期'].includes(s)

const urgency = (row: any) => {
  if (row.overdue) return { cls: 'is-over', text: '已逾期' }
  if (row.remainHours && row.remainHours <= 24) return { cls: 'is-high', text: `剩 ${row.remainHours} 小时` }
  if (row.remainHours && row.remainHours <= 72) return { cls: 'is-warn', text: `剩 ${Math.round(row.remainHours / 24)} 天` }
  if (row.remainHours) return { cls: 'is-ok', text: `剩 ${Math.round(row.remainHours / 24)} 天` }
  return { cls: 'is-ok', text: '已提交' }
}

onMounted(reload)
</script>

<template>
  <div class="zh-page">
    <PageHeader title="机构自查填报" subtitle="医疗机构端 · 在线自查举证、材料上传与数据自比对" tag="M08" tag-tone="accent">
      <template #actions>
        <el-select v-model="user.currentOrgCode" size="default" style="width: 260px" @change="reload">
          <el-option v-for="o in user.info?.orgSwitch || []" :key="o.code" :label="o.name" :value="o.code" />
        </el-select>
        <el-button :icon="'Refresh'" @click="reload">刷新</el-button>
      </template>
    </PageHeader>

    <!-- 机构信息横幅 -->
    <div class="org-hero">
      <div class="org-hero__left">
        <div class="org-hero__logo"><el-icon :size="24"><OfficeBuilding /></el-icon></div>
        <div>
          <div class="org-hero__name">{{ summary?.orgName || '—' }}</div>
          <div class="org-hero__meta">
            <span>机构编码 <b class="num">{{ orgCode }}</b></span>
            <el-divider direction="vertical" />
            <span>信用等级 <b :style="{ color: (summary?.creditScore || 0) >= 85 ? 'var(--zh-success)' : 'var(--zh-warning)' }">{{ summary?.creditLevel }}</b></span>
            <el-divider direction="vertical" />
            <span>按期提交率 <b class="num">{{ summary?.onTimeRate }}%</b></span>
          </div>
        </div>
      </div>
      <div class="org-hero__credit">
        <span class="cl">医保信用评分</span>
        <el-progress type="dashboard" :percentage="summary?.creditScore || 0" :width="76" :stroke-width="8"
          :color="(summary?.creditScore || 0) >= 85 ? '#12a150' : (summary?.creditScore || 0) >= 70 ? '#e8a30c' : '#e5484d'" />
      </div>
    </div>

    <el-alert v-if="summary?.notice" type="warning" show-icon :closable="false" class="notice">
      <template #title><b>医保部门提示：</b>{{ summary.notice }}</template>
    </el-alert>

    <div class="kpi-grid">
      <StatCard label="自查任务总数" :value="summary?.total || 0" unit="项" icon="Files" tone="primary" />
      <StatCard label="待提交" :value="summary?.waitingSubmit || 0" unit="项" icon="EditPen" tone="warning"
        desc="请于期限内完成填报" clickable @click="q.status = '待提交'; q.page = 1; loadList()" />
      <StatCard label="已提交待审" :value="summary?.submitted || 0" unit="项" icon="Promotion" tone="accent" />
      <StatCard label="已办结" :value="summary?.closed || 0" unit="项" icon="CircleCheck" tone="success" />
      <StatCard label="逾期未办" :value="summary?.overdue || 0" unit="项" icon="WarningFilled" tone="danger"
        desc="将计入信用评价" clickable @click="q.status = '已逾期'; q.page = 1; loadList()" />
      <StatCard label="涉及疑似金额" :value="summary?.totalAmount || 0" unit="元" icon="Money" tone="purple" :precision="2" />
    </div>

    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">我的自查任务</span>
        <span class="section-title__desc">共 {{ total }} 项，请点击「填报自查」在线提交说明与举证材料</span>
        <div class="section-title__extra">
          <el-select v-model="q.status" placeholder="全部状态" clearable size="small" style="width: 130px"
            @change="q.page = 1; loadList()">
            <el-option v-for="s in ['待提交', '已提交', '待审核', '已初筛', '已完成', '已逾期']" :key="s" :label="s" :value="s" />
          </el-select>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" size="small" border stripe
        :row-class-name="({ row }: any) => (row.overdue ? 'row-over' : '')">
        <el-table-column type="index" label="#" width="46" align="center" />
        <el-table-column prop="taskId" label="自查任务号" width="152">
          <template #default="{ row }">
            <span class="text-link num" @click="openTask(row)">{{ row.taskId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索号" width="148">
          <template #default="{ row }"><span class="num text-mini">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="violationType" label="疑点类型" min-width="120">
          <template #default="{ row }">
            {{ row.violationType }}
            <div class="text-mini">{{ row.itemName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="82" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="suspectedAmount" label="疑似金额(元)" width="118" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.suspectedAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="issueTime" label="下发时间" width="150">
          <template #default="{ row }"><span class="num text-mini">{{ row.issueTime }}</span></template>
        </el-table-column>
        <el-table-column prop="deadline" label="提交期限" width="150">
          <template #default="{ row }">
            <div class="num text-mini">{{ row.deadline }}</div>
            <span class="urg" :class="urgency(row).cls">{{ urgency(row).text }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="94" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="材料" width="80" align="center">
          <template #default="{ row }">
            <span class="num">{{ row.materialCount }}</span> 份
            <el-tag v-if="row.needFix" type="danger" size="small" effect="plain" class="mt2">需补正</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="screenResult" label="初筛结论" width="150">
          <template #default="{ row }">
            <span v-if="row.screenResult" class="res" :class="row.screenResult.includes('合理') ? 'is-ok' : row.screenResult.includes('存疑') ? 'is-warn' : 'is-bad'">
              {{ row.screenResult }}
            </span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="106" align="center" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canFill(row.status)" type="primary" link size="small" :icon="'EditPen'" @click="openTask(row)">填报自查</el-button>
            <el-button v-else type="primary" link size="small" :icon="'View'" @click="openTask(row)">查看</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无自查任务" desc="当前机构没有待处理的自查任务" /></template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @current-change="loadList" @size-change="q.page = 1; loadList()" />
      </div>
    </div>

    <!-- 自查填报抽屉 -->
    <el-drawer v-model="drawer" :title="`自查填报 · ${cur?.taskId || ''}`" size="920px" :close-on-click-modal="false">
      <div v-loading="detailLoading" class="fill">
        <template v-if="cur">
          <el-steps :active="step" align-center finish-status="success" class="fill-steps">
            <el-step title="核对疑点" description="查看医保部门推送疑点" />
            <el-step title="填写说明" description="说明原因并选择归因" />
            <el-step title="上传材料" description="处方/病历/台账举证" />
            <el-step title="确认提交" description="承诺声明并提交" />
          </el-steps>

          <!-- Step 0 -->
          <div v-show="step === 0" class="fill-body">
            <SectionCard title="医保部门推送疑点" desc="请逐项核对以下疑点信息" tight>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="关联线索号"><span class="num">{{ cur.clueId }}</span></el-descriptions-item>
                <el-descriptions-item label="风险等级"><RiskTag :level="cur.riskLevel" /></el-descriptions-item>
                <el-descriptions-item label="疑点类型">{{ cur.violationCategory }} / {{ cur.violationType }}</el-descriptions-item>
                <el-descriptions-item label="涉及项目">{{ cur.itemName }}</el-descriptions-item>
                <el-descriptions-item label="涉及参保人">{{ cur.patientName }}</el-descriptions-item>
                <el-descriptions-item label="疑似违规金额">
                  <span class="num num--money">{{ fmtMoney(cur.suspectedAmount) }}</span> 元
                </el-descriptions-item>
                <el-descriptions-item label="下发时间"><span class="num">{{ cur.issueTime }}</span></el-descriptions-item>
                <el-descriptions-item label="提交期限"><span class="num" style="color: var(--zh-danger)">{{ cur.deadline }}</span></el-descriptions-item>
              </el-descriptions>
            </SectionCard>

            <SectionCard title="自查数据填报" desc="请填写贵院实际发生数量，系统将自动与医保结算数据比对" tight>
              <el-table :data="diffRows" size="small" border>
                <el-table-column prop="itemName" label="项目名称" min-width="180" />
                <el-table-column prop="insuranceQty" label="医保结算数量" width="118" align="center">
                  <template #default="{ row }"><span class="num">{{ row.insuranceQty }}</span></template>
                </el-table-column>
                <el-table-column label="实际发生数量" width="150" align="center">
                  <template #default="{ row }">
                    <el-input-number v-model="row.selfQty" :min="0" :max="999" size="small" controls-position="right" style="width: 108px" />
                  </template>
                </el-table-column>
                <el-table-column prop="unitPrice" label="单价(元)" width="96" align="right">
                  <template #default="{ row }"><span class="num">{{ fmtMoney(row.unitPrice) }}</span></template>
                </el-table-column>
                <el-table-column label="差异" width="90" align="center">
                  <template #default="{ row }">
                    <span class="num" :style="{ color: row.diff === 0 ? 'var(--zh-success)' : 'var(--zh-danger)', fontWeight: 700 }">
                      {{ row.diff > 0 ? '+' : '' }}{{ row.diff }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="差异金额(元)" width="118" align="right">
                  <template #default="{ row }">
                    <span class="num" :style="{ color: row.diffAmount ? 'var(--zh-danger)' : 'var(--zh-text-placeholder)' }">
                      {{ fmtMoney(row.diffAmount) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="比对结果" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.match ? 'success' : 'danger'" size="small" effect="light">
                      {{ row.match ? '一致' : '不一致' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
              <el-alert :type="unmatchedCount ? 'error' : 'success'" :closable="false" show-icon style="margin-top: 10px">
                {{ unmatchedCount ? `当前存在 ${unmatchedCount} 项数据不一致，请在下一步详细说明差异原因` : '自查数据与医保结算数据完全一致，请继续说明诊疗合理性' }}
              </el-alert>
            </SectionCard>
          </div>

          <!-- Step 1 -->
          <div v-show="step === 1" class="fill-body">
            <SectionCard title="差异归因" desc="请选择最贴合实际情况的归因类型" tight>
              <el-radio-group v-model="form.reason" class="reason-group">
                <el-radio v-for="r in REASONS" :key="r" :value="r" border size="large" class="reason-item">{{ r }}</el-radio>
              </el-radio-group>
            </SectionCard>
            <SectionCard title="自查情况说明" desc="须说明诊疗合理性依据、政策适用及整改措施，不少于 30 字" tight>
              <el-input v-model="form.orgReply" type="textarea" :rows="8"
                placeholder="示例：经我院自查，格列美脲片系依据患者2型糖尿病病情长期用药需要开具，因家属代取药合并结算导致单次数量偏高，现补充处方、医嘱执行记录及情况说明，并已对信息系统开方模板进行整改…" />
              <div class="len-hint" :class="{ 'is-bad': form.orgReply.length < 30 }">
                已输入 {{ form.orgReply.length }} 字{{ form.orgReply.length < 30 ? '（不足 30 字）' : '' }}
              </div>
            </SectionCard>
          </div>

          <!-- Step 2 -->
          <div v-show="step === 2" class="fill-body">
            <SectionCard title="举证材料上传" desc="点击材料类型模拟上传，系统将自动进行 OCR 识别与真实性核验" tight>
              <div class="tpl-grid">
                <div v-for="t in MATERIAL_TPL" :key="t.name" class="tpl" @click="addMaterial(t)">
                  <el-icon :size="18"><UploadFilled /></el-icon>
                  <span class="tpl__name">{{ t.name }}</span>
                  <span class="tpl__type">{{ t.type }}</span>
                </div>
              </div>
            </SectionCard>
            <SectionCard :title="`已上传材料（${form.materials.length}）`" desc="OCR 置信度低于 85% 的材料可能被要求补正" tight>
              <el-table v-if="form.materials.length" :data="form.materials" size="small" border>
                <el-table-column type="index" label="#" width="46" align="center" />
                <el-table-column prop="name" label="材料名称" min-width="200" />
                <el-table-column prop="type" label="格式" width="76" align="center" />
                <el-table-column prop="size" label="大小" width="90" align="right" />
                <el-table-column label="OCR 置信度" width="150" align="center">
                  <template #default="{ row }">
                    <el-progress :percentage="row.ocrConfidence" :stroke-width="8"
                      :color="row.ocrConfidence >= 90 ? '#12a150' : row.ocrConfidence >= 85 ? '#e8a30c' : '#e5484d'" />
                  </template>
                </el-table-column>
                <el-table-column prop="verify" label="核验" width="88" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.verify === '通过' ? 'success' : row.verify === '需补正' ? 'danger' : 'info'" size="small" effect="light">
                      {{ row.verify }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="70" align="center">
                  <template #default="{ $index }">
                    <el-button type="danger" link size="small" :icon="'Delete'" @click="removeMaterial($index)">移除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <EmptyState v-else text="尚未上传材料" desc="请从上方材料类型中选择并上传" height="140px" icon="FolderOpened" />
            </SectionCard>
          </div>

          <!-- Step 3 -->
          <div v-show="step === 3" class="fill-body">
            <SectionCard title="提交内容确认" tight>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="自查任务号"><span class="num">{{ cur.taskId }}</span></el-descriptions-item>
                <el-descriptions-item label="关联线索号"><span class="num">{{ cur.clueId }}</span></el-descriptions-item>
                <el-descriptions-item label="数据不一致项">
                  <span class="num" :style="{ color: unmatchedCount ? 'var(--zh-danger)' : 'var(--zh-success)', fontWeight: 700 }">{{ unmatchedCount }}</span> 项
                </el-descriptions-item>
                <el-descriptions-item label="上传材料数"><span class="num">{{ form.materials.length }}</span> 份</el-descriptions-item>
                <el-descriptions-item label="差异归因" :span="2">{{ form.reason || '未选择' }}</el-descriptions-item>
                <el-descriptions-item label="情况说明" :span="2">
                  <div class="reply-box">{{ form.orgReply }}</div>
                </el-descriptions-item>
              </el-descriptions>
            </SectionCard>
            <div class="pledge">
              <el-checkbox v-model="form.agree" size="large">
                <span class="pledge__text">
                  本机构承诺：以上自查数据及举证材料<b>真实、完整、准确</b>，不存在伪造、变造情形。若经核查发现虚假举证，
                  自愿承担<b>加重处理</b>后果并接受医保信用扣分。
                </span>
              </el-checkbox>
            </div>
            <el-alert type="info" :closable="false" show-icon style="margin-top: 10px">
              提交后系统将自动执行「自查数据 vs 医保结算数据」二次比对并生成 AI 初筛结论，监管部门将在 3 个工作日内完成审核。
            </el-alert>
          </div>
        </template>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <span class="text-mini">步骤 {{ step + 1 }} / 4</span>
          <div>
            <el-button v-if="step > 0" :icon="'ArrowLeft'" @click="step--">上一步</el-button>
            <el-button v-if="step < 3" type="primary" @click="nextStep">
              下一步<el-icon class="ml4"><ArrowRight /></el-icon>
            </el-button>
            <el-button v-else type="primary" :icon="'Promotion'" :loading="submitting" @click="doSubmit">确认提交自查</el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.mt2 { margin-top: 2px; }

.org-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 20px; border-radius: var(--zh-radius-lg);
  background: linear-gradient(96deg, #0a2f6b 0%, #1668dc 58%, #1495b3 100%);
  color: #fff; box-shadow: var(--zh-shadow-base);
  &__left { display: flex; align-items: center; gap: 14px; }
  &__logo {
    width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, .18); border: 1px solid rgba(255, 255, 255, .3);
  }
  &__name { font-size: 19px; font-weight: 700; }
  &__meta {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap; margin-top: 4px;
    font-size: var(--zh-font-xs); color: rgba(255, 255, 255, .82);
    b { color: #fff; }
    :deep(.el-divider--vertical) { background: rgba(255, 255, 255, .3); }
  }
  &__credit { display: flex; align-items: center; gap: 10px; }
  .cl { font-size: var(--zh-font-xs); color: rgba(255, 255, 255, .82); }
  :deep(.el-progress__text) { color: #fff !important; font-weight: 700; }
}
.notice :deep(.el-alert__title) { font-size: var(--zh-font-sm); line-height: 1.6; font-weight: 400; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.urg {
  display: inline-block; font-size: 10px; font-weight: 700; padding: 0 4px; border-radius: 3px;
  &.is-over { color: #fff; background: var(--zh-overdue); }
  &.is-high { color: var(--zh-danger); background: var(--zh-risk-high-bg); }
  &.is-warn { color: var(--zh-warning); background: var(--zh-risk-mid-bg); }
  &.is-ok { color: var(--zh-success); background: var(--zh-risk-low-bg); }
}
.res {
  font-size: 11px; font-weight: 700;
  &.is-ok { color: var(--zh-success); }
  &.is-warn { color: var(--zh-warning); }
  &.is-bad { color: var(--zh-danger); }
}
:deep(.row-over) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }

.fill { display: flex; flex-direction: column; gap: 14px; }
.fill-steps { margin-bottom: 4px; :deep(.el-step__description) { font-size: 11px; } }
.fill-body { display: flex; flex-direction: column; gap: 12px; }

.reason-group { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
.reason-item {
  margin-right: 0 !important; height: auto; padding: 10px 12px; white-space: normal;
  :deep(.el-radio__label) { font-size: var(--zh-font-xs); line-height: 1.5; }
}
.len-hint {
  margin-top: 6px; font-size: 11px; color: var(--zh-text-placeholder); text-align: right;
  &.is-bad { color: var(--zh-danger); }
}

.tpl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tpl {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 11px 12px; border-radius: var(--zh-radius);
  border: 1px dashed var(--zh-border-strong); background: var(--zh-bg-soft);
  transition: all .18s;
  &:hover {
    border-color: var(--zh-primary); background: var(--zh-primary-lighter);
    transform: translateY(-2px); box-shadow: var(--zh-shadow-sm);
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  :deep(.el-icon) { color: var(--zh-text-placeholder); flex-shrink: 0; }
  &__name { flex: 1; font-size: var(--zh-font-xs); font-weight: 600; color: var(--zh-text-primary); }
  &__type { font-size: 10px; color: var(--zh-text-placeholder); }
}

.reply-box { font-size: var(--zh-font-xs); line-height: 1.7; color: var(--zh-text-regular); white-space: pre-wrap; }
.pledge {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: var(--zh-risk-mid-bg); border: 1px solid var(--zh-risk-mid-border);
  :deep(.el-checkbox) { height: auto; align-items: flex-start; }
  :deep(.el-checkbox__label) { white-space: normal; line-height: 1.7; }
  &__text {
    font-size: var(--zh-font-xs); color: var(--zh-text-regular);
    b { color: var(--zh-danger); }
  }
}
.drawer-footer { display: flex; align-items: center; justify-content: space-between; width: 100%; }
</style>
