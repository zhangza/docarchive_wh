<script setup lang="ts">
import {
  getInspectionTasks, getInspectionDetail, runOcr,
  uploadEvidence, saveInterview, submitConclusion
} from '@/api/agent01-clue/inspection'
import { fmtMoney } from '@/utils/format'

const router = useRouter()
/** 今日重点核查任务，列表中高亮提示 */
const FOCUS_TASK = 'INS202608300001'

/* ===== 任务列表 ===== */
const listLoading = ref(false)
const tasks = ref<any[]>([])
const view = ref<'list' | 'detail'>('list')
const cur = ref<any>(null)
const detailLoading = ref(false)
const tab = ref('check')

async function loadTasks() {
  listLoading.value = true
  try {
    const res: any = await getInspectionTasks({ mine: 'true', page: 1, pageSize: 12 })
    tasks.value = res.list
  } finally { listLoading.value = false }
}

async function openTask(row: any) {
  view.value = 'detail'
  tab.value = 'check'
  detailLoading.value = true
  cur.value = null
  ocrResult.value = null
  evidences.value = []
  interviewList.value = []
  try {
    const d: any = await getInspectionDetail({ taskId: row.taskId })
    cur.value = d
    checkList.value = (d.checklist || []).map((c: any) => ({
      ...c, checked: c.status === '已完成', finding: c.finding || ''
    }))
    evidences.value = [...(d.evidences || [])]
    interviewList.value = [...(d.interviews || [])]
    concForm.confirmAmount = d.conclusion?.confirmAmount || d.suspectedAmount || 0
    concForm.result = d.conclusion?.result || ''
    concForm.detail = d.conclusion?.detail || ''
  } finally { detailLoading.value = false }
}
function back() { view.value = 'list'; cur.value = null }

/* ===== 核查清单 ===== */
const checkList = ref<any[]>([])
const doneCount = computed(() => checkList.value.filter((c) => c.checked).length)
const progress = computed(() =>
  checkList.value.length ? Math.round((doneCount.value / checkList.value.length) * 100) : 0)

/* ===== OCR ===== */
const DOC_TYPES = [
  { v: '门诊处方', icon: 'Document' },
  { v: '发药单', icon: 'FirstAidKit' },
  { v: '库存台账', icon: 'Notebook' },
  { v: '检查报告单', icon: 'DataLine' }
]
const ocrDoc = ref('门诊处方')
const ocrLoading = ref(false)
const ocrResult = ref<any>(null)
const ocrHistory = ref<any[]>([])

async function doOcr() {
  ocrLoading.value = true
  ocrResult.value = null
  try {
    const r: any = await runOcr({ docType: ocrDoc.value, taskId: cur.value.taskId })
    ocrResult.value = r
    ocrHistory.value.unshift({ ocrId: r.ocrId, docType: r.docType, confidence: r.confidence, time: '刚刚' })
    ElMessage.success(`识别完成，${r.fields.length} 个字段（${r.costMs}ms）`)
  } finally { ocrLoading.value = false }
}
async function ocrToEvidence() {
  const r: any = await uploadEvidence({
    taskId: cur.value.taskId, name: `${ocrResult.value.docType}影像件`, type: '书证'
  })
  evidences.value.unshift({
    evidenceId: r.evidenceId, name: r.name, type: '书证',
    collectTime: r.collectTime, collector: '稽核员·王振华',
    hash: r.hash, chainStatus: r.chainStatus, size: `${Math.floor(Math.random() * 2000 + 300)} KB`
  })
  ElMessage.success(r.message)
  tab.value = 'evidence'
}

/* ===== 证据 ===== */
const evidences = ref<any[]>([])
const evUploading = ref(false)
const EV_TPL = [
  { name: '现场照片', type: '视听资料', icon: 'Camera' },
  { name: '处方复印件', type: '书证', icon: 'Document' },
  { name: '库存台账照片', type: '书证', icon: 'Notebook' },
  { name: 'HIS 操作日志', type: '电子数据', icon: 'Monitor' },
  { name: '药品实物照片', type: '物证', icon: 'Box' },
  { name: '现场录像', type: '视听资料', icon: 'VideoCamera' }
]
async function addEvidence(tpl: any) {
  evUploading.value = true
  try {
    const r: any = await uploadEvidence({ taskId: cur.value.taskId, name: tpl.name, type: tpl.type })
    evidences.value.unshift({
      evidenceId: r.evidenceId, name: r.name, type: tpl.type,
      collectTime: r.collectTime, collector: '稽核员·王振华',
      hash: r.hash, chainStatus: r.chainStatus, size: `${Math.floor(Math.random() * 2000 + 300)} KB`
    })
    ElMessage.success(r.message)
  } finally { evUploading.value = false }
}

/* ===== 问询 ===== */
const interviewList = ref<any[]>([])
const ivVisible = ref(false)
const ivSaving = ref(false)
const recording = ref(false)
const recordSec = ref(0)
let timer: any = null
const ivForm = reactive({ interviewee: '', role: '主治医师', summary: '' })
const ROLES = ['主治医师', '主任医师', '药房负责人', '医保办工作人员', '参保人', '护士']

function toggleRecord() {
  recording.value = !recording.value
  if (recording.value) {
    timer = setInterval(() => recordSec.value++, 1000)
    ElMessage.info('开始录音，请全程记录问询过程')
  } else {
    clearInterval(timer)
    ElMessage.success(`录音已保存（${fmtSec(recordSec.value)}）`)
  }
}
const fmtSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

async function saveIv() {
  if (!ivForm.interviewee.trim()) return ElMessage.warning('请填写被询问人姓名')
  if (ivForm.summary.trim().length < 10) return ElMessage.warning('笔录摘要不少于 10 字')
  ivSaving.value = true
  try {
    const r: any = await saveInterview({ taskId: cur.value.taskId, ...ivForm })
    interviewList.value.unshift({
      recordId: r.recordId, interviewee: ivForm.interviewee, role: ivForm.role,
      duration: recordSec.value ? fmtSec(recordSec.value) : '—',
      signed: true, summary: ivForm.summary, time: '2026-08-30 11:20:00'
    })
    ElMessage.success(r.message)
    ivVisible.value = false
    Object.assign(ivForm, { interviewee: '', role: '主治医师', summary: '' })
    recordSec.value = 0
  } finally { ivSaving.value = false }
}

/* ===== 结论 ===== */
const RESULTS = [
  { v: '确认违规', tone: 'danger' },
  { v: '部分违规', tone: 'warning' },
  { v: '未发现违规', tone: 'success' },
  { v: '证据不足', tone: 'info' }
]
const concForm = reactive({ result: '', confirmAmount: 0, detail: '' })
const concSubmitting = ref(false)

async function doSubmitConc() {
  if (!concForm.result) return ElMessage.warning('请选择核查结论')
  if (!evidences.value.length) return ElMessage.warning('至少固化 1 件证据后方可提交结论')
  if (doneCount.value < checkList.value.length) {
    return ElMessageBox.confirm('核查清单尚未全部勾选完成，是否仍要提交结论？', '提示', { type: 'warning' })
      .then(() => realSubmit()).catch(() => {})
  }
  realSubmit()
}
async function realSubmit() {
  concSubmitting.value = true
  try {
    const r: any = await submitConclusion({ taskId: cur.value.taskId, ...concForm })
    ElMessage.success(r.message)
    ElMessageBox.alert(
      `核查结论已提交：${r.result}\n确认金额：${fmtMoney(r.confirmAmount)} 元\n线索状态已更新为「${r.nextStatus}」`,
      '提交成功', { confirmButtonText: '返回任务列表' }
    ).then(() => back())
  } finally { concSubmitting.value = false }
}

const STATUS_TONE: Record<string, any> = {
  待安排: 'info', 待出发: 'warning', 核查中: 'primary', 待提交结论: 'warning', 已完成: 'success', 已挂起: 'danger'
}
const now = ref('09:41')
onMounted(() => {
  loadTasks()
  now.value = new Date().toTimeString().slice(0, 5)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="zh-page">
    <PageHeader title="移动核查端（现场取证）" subtitle="稽核人员现场作业界面 · OCR 拍照识别 · 证据实时哈希固化" tag="M10" tag-tone="accent">
      <template #actions>
        <el-button :icon="'Suitcase'" @click="router.push('/inspection/manage')">核查管理端</el-button>
        <el-button :icon="'Refresh'" @click="loadTasks">刷新任务</el-button>
      </template>
    </PageHeader>

    <div class="mob-wrap">
      <!-- 手机 -->
      <div class="phone">
        <div class="phone__frame">
          <div class="phone__notch" />
          <div class="phone__status">
            <span class="num">{{ now }}</span>
            <span class="phone__ic">
              <el-icon :size="11"><Cellphone /></el-icon>
              <el-icon :size="11"><Wallet /></el-icon>
            </span>
          </div>

          <div class="phone__nav">
            <el-icon v-if="view === 'detail'" class="phone__back" @click="back"><ArrowLeft /></el-icon>
            <span>{{ view === 'list' ? '我的核查任务' : cur?.taskId || '核查作业' }}</span>
            <el-icon><MoreFilled /></el-icon>
          </div>

          <div class="phone__screen">
            <!-- 任务列表 -->
            <template v-if="view === 'list'">
              <div class="m-banner">
                <div>
                  <div class="m-banner__hi">稽核员·王振华</div>
                  <div class="m-banner__sub">稽核一组 · 执法证号 WH-JH-0231</div>
                </div>
                <div class="m-banner__num">
                  <b class="num">{{ tasks.length }}</b><span>待办</span>
                </div>
              </div>

              <div class="m-quick">
                <div class="mq"><el-icon><Location /></el-icon><span>签到打卡</span></div>
                <div class="mq"><el-icon><Camera /></el-icon><span>拍照取证</span></div>
                <div class="mq"><el-icon><Microphone /></el-icon><span>问询录音</span></div>
                <div class="mq"><el-icon><Map /></el-icon><span>路线导航</span></div>
              </div>

              <div class="m-sec">今日核查任务</div>
              <div v-loading="listLoading" class="m-list">
                <div v-for="t in tasks" :key="t.taskId" class="mt-card"
                  :class="{ 'is-focus': t.taskId === FOCUS_TASK }" @click="openTask(t)">
                  <div class="mt-card__top">
                    <span class="mt-card__id num">{{ t.taskId }}</span>
                    <el-tag :type="STATUS_TONE[t.status] || 'info'" size="small" effect="dark">{{ t.status }}</el-tag>
                  </div>
                  <div class="mt-card__org">{{ t.orgName }}</div>
                  <div class="mt-card__addr">
                    <el-icon :size="11"><Location /></el-icon>{{ t.address }}
                  </div>
                  <div class="mt-card__row">
                    <RiskTag :level="t.riskLevel" size="small" />
                    <span class="mt-card__vt">{{ t.violationType }}</span>
                    <span class="num num--money">{{ fmtMoney(t.suspectedAmount) }}</span>
                  </div>
                  <div class="mt-card__foot">
                    <span><el-icon :size="11"><Clock /></el-icon>{{ t.planTime }}</span>
                    <span><el-icon :size="11"><UserFilled /></el-icon>{{ t.inspectors.length }} 人</span>
                    <el-progress :percentage="t.progress" :stroke-width="5" :show-text="false" style="flex: 1" />
                    <span class="num">{{ t.progress }}%</span>
                  </div>
                  <div v-if="t.taskId === FOCUS_TASK" class="mt-card__focus">今日重点核查</div>
                </div>
                <EmptyState v-if="!tasks.length && !listLoading" text="暂无核查任务" height="140px" />
              </div>
            </template>

            <!-- 任务作业 -->
            <template v-else>
              <div v-loading="detailLoading" class="m-detail">
                <template v-if="cur">
                  <div class="m-head">
                    <div class="m-head__org">{{ cur.orgName }}</div>
                    <div class="m-head__addr"><el-icon :size="11"><Location /></el-icon>{{ cur.address }}</div>
                    <div class="m-head__tags">
                      <RiskTag :level="cur.riskLevel" size="small" />
                      <el-tag size="small" effect="plain">{{ cur.inspectType }}</el-tag>
                      <el-tag size="small" effect="plain">{{ cur.violationType }}</el-tag>
                    </div>
                    <div class="m-head__pg">
                      <span class="text-mini">核查进度 {{ doneCount }}/{{ checkList.length }}</span>
                      <el-progress :percentage="progress" :stroke-width="7" :text-inside="false" />
                    </div>
                  </div>

                  <div class="m-tabs">
                    <div v-for="t in [
                      { k: 'check', l: '清单', i: 'List' },
                      { k: 'ocr', l: 'OCR', i: 'Camera' },
                      { k: 'evidence', l: '证据', i: 'Folder' },
                      { k: 'interview', l: '问询', i: 'Microphone' },
                      { k: 'conc', l: '结论', i: 'EditPen' }
                    ]" :key="t.k" class="m-tab" :class="{ 'is-on': tab === t.k }" @click="tab = t.k">
                      <el-icon :size="14"><component :is="t.i" /></el-icon>
                      <span>{{ t.l }}</span>
                    </div>
                  </div>

                  <!-- 清单 -->
                  <div v-show="tab === 'check'" class="m-pane">
                    <div v-for="(c, i) in checkList" :key="i" class="ck" :class="{ 'is-on': c.checked }">
                      <el-checkbox v-model="c.checked" />
                      <div class="ck__b">
                        <div class="ck__t">{{ c.item }}</div>
                        <div class="ck__d">{{ c.desc }}</div>
                        <el-input v-if="c.checked" v-model="c.finding" size="small" type="textarea" :rows="2"
                          placeholder="填写核查发现（如：抽查 8 份处方，3 份数量不一致）" class="ck__in" />
                      </div>
                    </div>
                  </div>

                  <!-- OCR -->
                  <div v-show="tab === 'ocr'" class="m-pane">
                    <div class="m-lab">选择单据类型</div>
                    <div class="doc-grid">
                      <div v-for="d in DOC_TYPES" :key="d.v" class="doc" :class="{ 'is-on': ocrDoc === d.v }"
                        @click="ocrDoc = d.v">
                        <el-icon :size="18"><component :is="d.icon" /></el-icon>
                        <span>{{ d.v }}</span>
                      </div>
                    </div>

                    <div class="cam" :class="{ 'is-busy': ocrLoading }" @click="!ocrLoading && doOcr()">
                      <template v-if="ocrLoading">
                        <div class="cam__scan" />
                        <el-icon class="is-loading" :size="26"><Loading /></el-icon>
                        <span>AI 正在识别 {{ ocrDoc }}…</span>
                      </template>
                      <template v-else>
                        <el-icon :size="30"><Camera /></el-icon>
                        <span>点击拍照识别</span>
                        <small>请将{{ ocrDoc }}原件置于取景框内</small>
                      </template>
                    </div>

                    <template v-if="ocrResult">
                      <div class="ocr-head">
                        <span>识别结果</span>
                        <el-tag :type="ocrResult.confidence >= 92 ? 'success' : 'warning'" size="small" effect="dark">
                          置信度 {{ ocrResult.confidence }}%
                        </el-tag>
                        <span class="text-mini">{{ ocrResult.costMs }}ms</span>
                      </div>
                      <div class="ocr-fields">
                        <div v-for="(f, i) in ocrResult.fields" :key="i" class="of">
                          <span class="of__l">{{ f.label }}</span>
                          <span class="of__v">{{ f.value }}</span>
                          <span class="of__c num" :class="{ 'is-low': f.confidence < 90 }">{{ f.confidence }}%</span>
                        </div>
                      </div>
                      <div v-for="(w, i) in ocrResult.warnings" :key="i" class="ocr-warn">
                        <el-icon :size="12"><WarningFilled /></el-icon>{{ w }}
                      </div>
                      <el-button type="primary" size="small" :icon="'Upload'" style="width: 100%; margin-top: 10px"
                        @click="ocrToEvidence">存为证据并哈希固化</el-button>
                    </template>

                    <template v-if="ocrHistory.length">
                      <div class="m-lab mt10">本次识别记录</div>
                      <div v-for="h in ocrHistory" :key="h.ocrId" class="oh">
                        <span class="num text-mini">{{ h.ocrId }}</span>
                        <span>{{ h.docType }}</span>
                        <span class="num">{{ h.confidence }}%</span>
                      </div>
                    </template>
                  </div>

                  <!-- 证据 -->
                  <div v-show="tab === 'evidence'" class="m-pane">
                    <div class="m-lab">快速取证</div>
                    <div class="ev-tpl">
                      <div v-for="t in EV_TPL" :key="t.name" class="et" @click="addEvidence(t)">
                        <el-icon :size="16"><component :is="t.icon" /></el-icon>
                        <span>{{ t.name }}</span>
                      </div>
                    </div>
                    <div class="m-lab mt10">
                      已固化证据
                      <b class="num">{{ evidences.length }}</b> 件
                      <el-tag type="success" size="small" effect="plain" class="ml4">SHA256 上链</el-tag>
                    </div>
                    <div v-loading="evUploading" class="ev-list">
                      <div v-for="e in evidences" :key="e.evidenceId" class="ev">
                        <div class="ev__t">
                          <el-icon :size="13"><Lock /></el-icon>
                          {{ e.name }}
                          <el-tag size="small" effect="plain">{{ e.type }}</el-tag>
                        </div>
                        <div class="ev__m">
                          <span class="num">{{ e.evidenceId }}</span>
                          <span>{{ e.size }}</span>
                        </div>
                        <div class="ev__h num">{{ e.hash }}</div>
                        <div class="ev__f">
                          <span class="num text-mini">{{ e.collectTime }}</span>
                          <el-tag type="success" size="small" effect="dark">{{ e.chainStatus }}</el-tag>
                        </div>
                      </div>
                      <EmptyState v-if="!evidences.length" text="暂无证据" height="110px" />
                    </div>
                  </div>

                  <!-- 问询 -->
                  <div v-show="tab === 'interview'" class="m-pane">
                    <div class="rec" :class="{ 'is-on': recording }">
                      <div class="rec__dot" />
                      <div class="rec__t num">{{ fmtSec(recordSec) }}</div>
                      <div class="rec__l">{{ recording ? '录音中…' : '问询录音' }}</div>
                      <el-button :type="recording ? 'danger' : 'primary'" size="small" round
                        :icon="recording ? 'VideoPause' : 'Microphone'" @click="toggleRecord">
                        {{ recording ? '停止录音' : '开始录音' }}
                      </el-button>
                    </div>
                    <el-button type="primary" plain size="small" :icon="'EditPen'" style="width: 100%; margin-top: 10px"
                      @click="ivVisible = true">填写问询笔录</el-button>

                    <div class="m-lab mt10">已完成笔录 <b class="num">{{ interviewList.length }}</b> 份</div>
                    <div class="iv-list">
                      <div v-for="iv in interviewList" :key="iv.recordId" class="ivc">
                        <div class="ivc__t">
                          {{ iv.interviewee }}
                          <el-tag size="small" effect="plain">{{ iv.role }}</el-tag>
                          <el-tag v-if="iv.signed" type="success" size="small" effect="dark">已签认</el-tag>
                        </div>
                        <div class="ivc__b">{{ iv.summary }}</div>
                        <div class="ivc__f">
                          <span class="num text-mini">{{ iv.recordId }}</span>
                          <span class="text-mini">{{ iv.duration }}</span>
                        </div>
                      </div>
                      <EmptyState v-if="!interviewList.length" text="暂无问询笔录" height="110px" />
                    </div>
                  </div>

                  <!-- 结论 -->
                  <div v-show="tab === 'conc'" class="m-pane">
                    <div class="sum">
                      <div class="sm"><span>核查清单</span><b class="num">{{ doneCount }}/{{ checkList.length }}</b></div>
                      <div class="sm"><span>OCR 识别</span><b class="num">{{ ocrHistory.length || cur.ocrRecords?.length || 0 }}</b></div>
                      <div class="sm"><span>固化证据</span><b class="num">{{ evidences.length }}</b></div>
                      <div class="sm"><span>问询笔录</span><b class="num">{{ interviewList.length }}</b></div>
                    </div>

                    <div class="m-lab mt10">核查结论认定</div>
                    <div class="res-grid">
                      <div v-for="r in RESULTS" :key="r.v" class="rs" :class="[`rs-${r.tone}`, { 'is-on': concForm.result === r.v }]"
                        @click="concForm.result = r.v">{{ r.v }}</div>
                    </div>

                    <div class="m-lab mt10">确认违规金额（元）</div>
                    <el-input-number v-model="concForm.confirmAmount" :min="0" :precision="2" :step="10"
                      size="small" style="width: 100%" />

                    <div class="m-lab mt10">核查情况说明</div>
                    <el-input v-model="concForm.detail" type="textarea" :rows="4" size="small"
                      placeholder="经现场核查，核对处方原件、发药记录及库存台账，发现…" />

                    <el-button type="primary" :loading="concSubmitting" :icon="'CircleCheck'"
                      style="width: 100%; margin-top: 12px" @click="doSubmitConc">提交核查结论</el-button>
                    <div class="conc-tip">
                      <el-icon :size="12"><InfoFilled /></el-icon>
                      提交后结论将同步至线索全周期档案，确认违规将自动推送违规处置流程。
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <div class="phone__bar" />
        </div>
      </div>

      <!-- 右侧说明 -->
      <div class="side">
        <SectionCard title="移动现场取证能力" desc="稽核人员到达现场后的全流程数字化作业" tight>
          <div class="cap">
            <div v-for="c in [
              { i: 'List', t: '结构化核查清单', d: '按违规类型自动生成核查要点，逐项勾选并记录发现，避免遗漏' },
              { i: 'Camera', t: 'OCR 单据识别', d: '处方/发药单/台账拍照即时结构化，字段级置信度输出，自动与医保结算数据比对预警' },
              { i: 'Lock', t: '证据哈希固化', d: '证据上传即生成 SHA256 摘要并上链存证，全流程可追溯、不可篡改' },
              { i: 'Microphone', t: '问询录音与笔录', d: '录音+笔录同步，被询问人电子签认，形成合规言词证据' },
              { i: 'EditPen', t: '结论现场认定', d: '四类结论一键认定，确认金额自动带入违规处置追回流程' }
            ]" :key="c.t" class="cp">
              <div class="cp__ic"><el-icon :size="16"><component :is="c.i" /></el-icon></div>
              <div>
                <div class="cp__t">{{ c.t }}</div>
                <div class="cp__d">{{ c.d }}</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="现场核查作业指引" desc="标准作业流程 · 六步完成现场取证" tight>
          <ol class="steps">
            <li>在任务列表中选择待核查任务，核对机构名称与核查事项</li>
            <li><b>清单</b>页逐项勾选核查事项并填写核查发现</li>
            <li><b>OCR</b>页选择资料类型 → 点击拍照 → 查看字段级识别结果与不一致预警 → 存为证据</li>
            <li><b>证据</b>页快速取证，核对 SHA256 哈希与上链状态</li>
            <li><b>问询</b>页开始录音并填写笔录，完成电子签认</li>
            <li><b>结论</b>页认定核查结论、填写确认违规金额并提交</li>
          </ol>
          <el-alert type="warning" :closable="false" show-icon style="margin-top: 10px">
            现场取证须两人同行，证据须当场拍摄并即时上传固化；离线取证将在恢复网络后自动同步。
          </el-alert>
        </SectionCard>
      </div>
    </div>

    <!-- 问询笔录弹窗 -->
    <el-dialog v-model="ivVisible" title="问询笔录" width="560px">
      <el-form label-width="92px">
        <el-form-item label="被询问人">
          <el-input v-model="ivForm.interviewee" placeholder="如：李建国" />
        </el-form-item>
        <el-form-item label="身份/岗位">
          <el-select v-model="ivForm.role" style="width: 100%">
            <el-option v-for="r in ROLES" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="录音时长">
          <span class="num">{{ fmtSec(recordSec) }}</span>
          <span class="text-mini ml8">{{ recordSec ? '已录制' : '未录音（建议先录音）' }}</span>
        </el-form-item>
        <el-form-item label="笔录摘要">
          <el-input v-model="ivForm.summary" type="textarea" :rows="6"
            placeholder="问：请说明该参保人一次开具 6 盒格列美脲片的依据？&#10;答：…" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ivVisible = false">取消</el-button>
        <el-button type="primary" :loading="ivSaving" :icon="'EditPen'" @click="saveIv">保存并电子签认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.ml8 { margin-left: 8px; }
.mt10 { margin-top: 10px; }

.mob-wrap {
  display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: start;
  @media (max-width: 1080px) { grid-template-columns: 1fr; justify-items: center; }
}

/* 手机外框 */
.phone { display: flex; justify-content: center; }
.phone__frame {
  position: relative; width: 392px; height: 806px;
  border-radius: 42px; padding: 12px 10px 10px;
  background: linear-gradient(160deg, #1c2b42, #0b1626);
  box-shadow: 0 18px 46px rgba(10, 30, 60, .34), 0 0 0 2px #2c3d55 inset;
  display: flex; flex-direction: column;
}
.phone__notch {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  width: 116px; height: 20px; border-radius: 12px; background: #060d18; z-index: 3;
}
.phone__status {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 18px 6px; color: #fff; font-size: 11px; font-weight: 600;
}
.phone__ic { display: inline-flex; gap: 4px; opacity: .85; }
.phone__nav {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 14px;
  background: linear-gradient(96deg, #0a2f6b, #1668dc);
  color: #fff; font-size: 14px; font-weight: 700;
  border-radius: 16px 16px 0 0;
  :deep(.el-icon) { cursor: pointer; }
}
.phone__back:hover { opacity: .75; }
.phone__screen {
  flex: 1; overflow-y: auto; background: #f2f5fa;
  padding: 10px; border-radius: 0 0 16px 16px;
  &::-webkit-scrollbar { width: 0; }
}
.phone__bar {
  width: 118px; height: 4px; border-radius: 3px; margin: 8px auto 0;
  background: rgba(255, 255, 255, .55);
}

/* 列表 */
.m-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-radius: 14px; color: #fff;
  background: linear-gradient(120deg, #0a2f6b, #1668dc 62%, #1495b3);
  box-shadow: 0 6px 16px rgba(22, 104, 220, .28);
  &__hi { font-size: 15px; font-weight: 700; }
  &__sub { font-size: 11px; opacity: .82; margin-top: 3px; }
  &__num {
    text-align: center;
    b { font-size: 24px; font-family: var(--zh-font-num); display: block; line-height: 1; }
    span { font-size: 10px; opacity: .85; }
  }
}
.m-quick {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 10px;
}
.mq {
  display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
  padding: 9px 0; border-radius: 11px; background: #fff;
  border: 1px solid var(--zh-border-light);
  font-size: 10px; color: var(--zh-text-regular);
  :deep(.el-icon) { color: var(--zh-primary); font-size: 17px; }
  &:active { transform: scale(.96); }
}
.m-sec {
  margin: 12px 0 7px; font-size: 12px; font-weight: 700; color: var(--zh-text-primary);
  padding-left: 8px; border-left: 3px solid var(--zh-primary);
}
.m-list { display: flex; flex-direction: column; gap: 9px; }
.mt-card {
  position: relative; padding: 11px 12px; border-radius: 12px; cursor: pointer;
  background: #fff; border: 1px solid var(--zh-border-light);
  box-shadow: 0 2px 8px rgba(20, 50, 90, .05); transition: all .18s;
  &:active { transform: scale(.985); }
  &.is-focus { border-color: var(--zh-warning); box-shadow: 0 0 0 2px rgba(232, 163, 12, .16); }
  &__top { display: flex; align-items: center; justify-content: space-between; }
  &__id { font-size: 11px; color: var(--zh-text-secondary); }
  &__org { margin-top: 5px; font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__addr {
    display: flex; align-items: center; gap: 3px; margin-top: 3px;
    font-size: 10px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__row {
    display: flex; align-items: center; gap: 6px; margin-top: 7px;
    padding-top: 7px; border-top: 1px dashed var(--zh-border-light);
  }
  &__vt { font-size: 11px; color: var(--zh-text-regular); flex: 1; }
  &__foot {
    display: flex; align-items: center; gap: 8px; margin-top: 7px;
    font-size: 10px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 2px; }
  }
  &__focus {
    position: absolute; top: -1px; right: -1px;
    padding: 1px 7px; border-radius: 0 11px 0 8px;
    background: var(--zh-warning); color: #fff; font-size: 9px; font-weight: 700;
  }
}

/* 作业 */
.m-head {
  padding: 11px 12px; border-radius: 12px; background: #fff;
  border: 1px solid var(--zh-border-light);
  &__org { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__addr {
    display: flex; align-items: center; gap: 3px; margin-top: 3px;
    font-size: 10px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-accent); }
  }
  &__tags { display: flex; align-items: center; gap: 5px; margin-top: 7px; flex-wrap: wrap; }
  &__pg { margin-top: 8px; }
}
.m-tabs {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 9px 0;
  padding: 4px; border-radius: 11px; background: #fff; border: 1px solid var(--zh-border-light);
}
.m-tab {
  display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer;
  padding: 6px 0; border-radius: 8px; font-size: 10px; color: var(--zh-text-secondary);
  transition: all .16s;
  &.is-on { background: var(--zh-primary-light); color: var(--zh-primary); font-weight: 700; }
  :deep(.el-icon) { font-size: 14px; }
}
.m-pane { display: flex; flex-direction: column; }
.m-lab {
  font-size: 11px; font-weight: 700; color: var(--zh-text-primary); margin-bottom: 6px;
  display: flex; align-items: center; gap: 4px;
}

.ck {
  display: flex; gap: 8px; padding: 9px 10px; margin-bottom: 7px;
  border-radius: 10px; background: #fff; border: 1px solid var(--zh-border-light);
  &.is-on { border-color: var(--zh-success); background: var(--zh-risk-low-bg); }
  &__t { font-size: 12px; font-weight: 700; color: var(--zh-text-primary); }
  &__d { font-size: 10px; line-height: 1.55; color: var(--zh-text-secondary); margin-top: 2px; }
  &__in { margin-top: 6px; }
  &__b { flex: 1; min-width: 0; }
}

.doc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.doc {
  display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer;
  padding: 8px 0; border-radius: 10px; background: #fff;
  border: 1px solid var(--zh-border-light); font-size: 10px; color: var(--zh-text-regular);
  :deep(.el-icon) { color: var(--zh-text-placeholder); }
  &.is-on {
    border-color: var(--zh-primary); background: var(--zh-primary-light);
    color: var(--zh-primary); font-weight: 700;
    :deep(.el-icon) { color: var(--zh-primary); }
  }
}
.cam {
  position: relative; overflow: hidden; margin-top: 10px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  height: 150px; border-radius: 12px;
  background: linear-gradient(150deg, #0d2647, #16375f);
  border: 2px dashed rgba(255, 255, 255, .3);
  color: #fff; font-size: 12px; font-weight: 600;
  small { font-size: 10px; opacity: .7; font-weight: 400; }
  :deep(.el-icon) { color: var(--zh-accent); }
  &:active { transform: scale(.99); }
  &.is-busy { border-style: solid; border-color: var(--zh-accent); }
}
.cam__scan {
  position: absolute; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, transparent, #13c2c2, transparent);
  animation: scan 1.5s linear infinite;
}
@keyframes scan { 0% { top: 6%; } 100% { top: 94%; } }

.ocr-head {
  display: flex; align-items: center; gap: 7px; margin: 10px 0 6px;
  font-size: 12px; font-weight: 700; color: var(--zh-text-primary);
}
.ocr-fields {
  border-radius: 10px; overflow: hidden;
  border: 1px solid var(--zh-border-light); background: #fff;
}
.of {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  font-size: 11px; border-bottom: 1px solid var(--zh-border-light);
  &:last-child { border-bottom: none; }
  &__l { width: 72px; flex-shrink: 0; color: var(--zh-text-secondary); }
  &__v { flex: 1; font-weight: 600; color: var(--zh-text-primary); }
  &__c {
    font-size: 10px; color: var(--zh-success); font-weight: 700;
    &.is-low { color: var(--zh-warning); }
  }
}
.ocr-warn {
  display: flex; align-items: center; gap: 4px; margin-top: 7px;
  padding: 6px 9px; border-radius: 8px;
  background: var(--zh-risk-high-bg); border: 1px solid var(--zh-risk-high-border);
  font-size: 10px; line-height: 1.5; color: var(--zh-danger);
}
.oh {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px; margin-bottom: 5px;
  border-radius: 8px; background: #fff; border: 1px solid var(--zh-border-light);
  font-size: 10px; color: var(--zh-text-secondary);
  span:nth-child(2) { flex: 1; color: var(--zh-text-primary); font-weight: 600; }
  span:last-child { color: var(--zh-success); font-weight: 700; }
}

.ev-tpl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.et {
  display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer;
  padding: 9px 4px; border-radius: 10px; background: #fff;
  border: 1px solid var(--zh-border-light); font-size: 10px; text-align: center;
  color: var(--zh-text-regular); transition: all .16s;
  :deep(.el-icon) { color: var(--zh-primary); }
  &:active { transform: scale(.96); }
  &:hover { border-color: var(--zh-primary); background: var(--zh-primary-lighter); }
}
.ev-list { display: flex; flex-direction: column; gap: 7px; }
.ev {
  padding: 9px 10px; border-radius: 10px; background: #fff;
  border: 1px solid var(--zh-border-light); border-left: 3px solid var(--zh-success);
  &__t {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 700; color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-success); }
  }
  &__m {
    display: flex; align-items: center; justify-content: space-between; margin-top: 4px;
    font-size: 10px; color: var(--zh-text-secondary);
  }
  &__h {
    margin-top: 4px; padding: 3px 6px; border-radius: 5px;
    background: var(--zh-bg-soft); font-size: 9px; color: var(--zh-text-placeholder);
    word-break: break-all;
  }
  &__f { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; }
}

.rec {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 16px; border-radius: 12px;
  background: linear-gradient(150deg, #0d2647, #16375f); color: #fff;
  &__dot {
    width: 11px; height: 11px; border-radius: 50%; background: rgba(255, 255, 255, .3);
  }
  &.is-on &__dot { background: var(--zh-danger); animation: zh-pulse 1.1s infinite; }
  &__t { font-size: 26px; font-weight: 700; font-family: var(--zh-font-num); }
  &__l { font-size: 11px; opacity: .8; }
}
.iv-list { display: flex; flex-direction: column; gap: 7px; }
.ivc {
  padding: 9px 10px; border-radius: 10px; background: #fff;
  border: 1px solid var(--zh-border-light);
  &__t {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    font-size: 12px; font-weight: 700; color: var(--zh-text-primary);
  }
  &__b {
    margin-top: 5px; font-size: 10px; line-height: 1.6; color: var(--zh-text-secondary);
  }
  &__f { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; }
}

.sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.sm {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 9px 0; border-radius: 10px; background: #fff;
  border: 1px solid var(--zh-border-light);
  span { font-size: 9px; color: var(--zh-text-secondary); }
  b { font-size: 16px; color: var(--zh-primary); font-family: var(--zh-font-num); }
}
.res-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.rs {
  padding: 9px 0; border-radius: 10px; cursor: pointer; text-align: center;
  background: #fff; border: 1px solid var(--zh-border-light);
  font-size: 12px; color: var(--zh-text-regular); transition: all .16s;
  &.rs-danger.is-on { background: var(--zh-risk-high-bg); border-color: var(--zh-danger); color: var(--zh-danger); font-weight: 700; }
  &.rs-warning.is-on { background: var(--zh-risk-mid-bg); border-color: var(--zh-warning); color: var(--zh-warning); font-weight: 700; }
  &.rs-success.is-on { background: var(--zh-risk-low-bg); border-color: var(--zh-success); color: var(--zh-success); font-weight: 700; }
  &.rs-info.is-on { background: var(--zh-info-light); border-color: var(--zh-info); color: var(--zh-info); font-weight: 700; }
  &:active { transform: scale(.97); }
}
.conc-tip {
  display: flex; gap: 4px; margin-top: 8px; padding: 7px 9px;
  border-radius: 8px; border: 1px dashed var(--zh-border-strong);
  font-size: 10px; line-height: 1.55; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 1px; }
}

/* 右侧 */
.side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.cap { display: flex; flex-direction: column; gap: 9px; }
.cp {
  display: flex; gap: 10px; padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  &__ic {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary-light); color: var(--zh-primary);
  }
  &__t { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); }
  &__d { font-size: var(--zh-font-xs); line-height: 1.65; color: var(--zh-text-secondary); margin-top: 2px; }
}
.steps {
  margin: 0; padding-left: 20px;
  font-size: var(--zh-font-xs); line-height: 2; color: var(--zh-text-regular);
  b { color: var(--zh-primary); }
  li::marker { color: var(--zh-primary); font-weight: 700; }
}
</style>
