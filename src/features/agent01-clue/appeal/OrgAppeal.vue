<script setup lang="ts">
import { getMyAppeals, getAppealableClues, submitAppeal, getAppealDetail } from '@/api/agent01-clue/appeal'
import { fmtMoney } from '@/utils/format'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const orgCode = computed(() => user.currentOrgCode || 'H340200001')

const AP_TYPES = [
  { v: '事实认定异议', d: '对核查认定的违规事实本身存在异议' },
  { v: '金额认定异议', d: '认可违规事实，但对涉及基金金额计算有异议' },
  { v: '政策适用异议', d: '对所引用的医保政策条款适用性存在异议' },
  { v: '程序异议', d: '对核查程序、告知程序合法性存在异议' },
  { v: '其他', d: '其他需要说明的异议情形' }
]
const MATERIAL_TPL = [
  { name: 'LIS 检验报告单', type: 'PDF', icon: 'DataLine' },
  { name: '电子病历（病程记录）', type: 'PDF', icon: 'Notebook' },
  { name: '处方原件复印件', type: 'JPG', icon: 'Document' },
  { name: '情况说明（加盖公章）', type: 'PDF', icon: 'Stamp' },
  { name: '政策依据文件', type: 'PDF', icon: 'Collection' },
  { name: '系统操作日志导出', type: 'XLSX', icon: 'Monitor' }
]

/* ===== 我的申诉 ===== */
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const q = reactive({ status: '', page: 1, pageSize: 10 })
const AP_STATUS = ['待受理', '已受理', 'AI初核中', '复核中', '已复核', '已撤回', '已逾期']

async function load() {
  loading.value = true
  try {
    const res: any = await getMyAppeals({ orgCode: orgCode.value, ...q })
    list.value = res.list
    total.value = res.total
  } finally { loading.value = false }
}

/* ===== 可申诉线索 ===== */
const cLoading = ref(false)
const canList = ref<any[]>([])
async function loadCan() {
  cLoading.value = true
  try {
    const res: any = await getAppealableClues({ orgCode: orgCode.value, page: 1, pageSize: 20 })
    canList.value = res.list
  } finally { cLoading.value = false }
}

const kpi = computed(() => {
  const l = list.value
  return {
    total: total.value,
    pending: l.filter((x) => ['待受理', '已受理', 'AI初核中', '复核中'].includes(x.status)).length,
    done: l.filter((x) => x.status === '已复核').length,
    win: l.filter((x) => x.result && x.result !== '申诉不成立·维持原结论').length,
    appealAmount: l.reduce((s, x) => s + (x.appealAmount || 0), 0),
    savedAmount: l.filter((x) => x.finalAmount).reduce((s, x) => s + Math.max(0, x.originalAmount - x.finalAmount), 0)
  }
})

/* ===== 提交申诉 ===== */
const drawer = ref(false)
const step = ref(0)
const submitting = ref(false)
const picked = ref<any>(null)
const form = reactive({
  appealType: '事实认定异议',
  appealAmount: 0,
  reason: '',
  applicant: '医保办·张桂芳主任',
  contact: '13955880231',
  materials: [] as any[],
  pledge: false
})

function openSubmit(clue?: any) {
  drawer.value = true
  step.value = clue ? 1 : 0
  picked.value = clue || null
  if (clue) form.appealAmount = clue.confirmAmount
  if (!canList.value.length) loadCan()
}
function pickClue(row: any) {
  picked.value = row
  form.appealAmount = row.confirmAmount
  step.value = 1
}
function addMaterial(tpl: any) {
  form.materials.push({
    name: `${tpl.name}_${form.materials.length + 1}`,
    type: tpl.type,
    size: `${Math.floor(Math.random() * 2200 + 180)} KB`,
    uploadTime: '2026-09-01 09:12:00',
    verify: '通过'
  })
  ElMessage.success(`已上传：${tpl.name}`)
}
function nextStep() {
  if (step.value === 1) {
    if (form.reason.trim().length < 30) return ElMessage.warning('申诉理由不少于 30 字，请详细说明异议依据')
    if (form.appealAmount <= 0) return ElMessage.warning('请填写申诉涉及金额')
  }
  if (step.value === 2 && form.materials.length < 1) {
    return ElMessage.warning('请至少上传 1 份举证材料')
  }
  step.value++
}
async function doSubmit() {
  if (!form.pledge) return ElMessage.warning('请勾选真实性承诺')
  submitting.value = true
  try {
    const r: any = await submitAppeal({ clueId: picked.value.clueId, orgCode: orgCode.value, ...form })
    ElMessage.success(r.message)
    drawer.value = false
    resetForm()
    load(); loadCan()
  } finally { submitting.value = false }
}
function resetForm() {
  step.value = 0
  picked.value = null
  Object.assign(form, {
    appealType: '事实认定异议', appealAmount: 0, reason: '',
    applicant: '医保办·张桂芳主任', contact: '13955880231', materials: [], pledge: false
  })
}

/* ===== 申诉进度 ===== */
const trackVisible = ref(false)
const trackLoading = ref(false)
const cur = ref<any>(null)
async function openTrack(row: any) {
  trackVisible.value = true
  trackLoading.value = true
  cur.value = null
  try { cur.value = await getAppealDetail({ appealId: row.appealId }) }
  finally { trackLoading.value = false }
}

const STATUS_TONE: Record<string, any> = {
  待受理: 'info', 已受理: 'primary', AI初核中: 'primary', 复核中: 'warning',
  已复核: 'success', 已撤回: 'info', 已逾期: 'danger'
}
const RESULT_TONE: Record<string, any> = {
  '申诉成立·撤销原结论': 'success', '部分撤销原结论': 'warning', '申诉不成立·维持原结论': 'danger'
}
const TL_TONE: Record<string, any> = { done: 'success', process: 'primary', wait: 'info' }

onMounted(() => { load(); loadCan() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="机构申诉申请（机构端）" tag="M12" tag-tone="accent"
      subtitle="对核查认定结论提出异议 · 在线举证 · 申诉进度实时查询">
      <template #actions>
        <el-button :icon="'Refresh'" @click="load(); loadCan()">刷新</el-button>
        <el-button type="primary" :icon="'ChatDotSquare'" @click="openSubmit()">提交新申诉</el-button>
      </template>
    </PageHeader>

    <div class="org-hero">
      <div class="org-hero__l">
        <div class="org-hero__ic"><el-icon :size="22"><OfficeBuilding /></el-icon></div>
        <div>
          <div class="org-hero__name">芜湖市第一人民医院</div>
          <div class="org-hero__meta">
            <span>机构编码 <b class="num">{{ orgCode }}</b></span>
            <span>三级医院 · 镜湖区</span>
            <el-tag type="warning" size="small" effect="dark">机构端视图</el-tag>
          </div>
        </div>
      </div>
      <div class="org-hero__r">
        <div class="oh-n"><span>申诉总数</span><b class="num">{{ kpi.total }}</b></div>
        <div class="oh-n"><span>处理中</span><b class="num is-warn">{{ kpi.pending }}</b></div>
        <div class="oh-n"><span>已复核</span><b class="num is-ok">{{ kpi.done }}</b></div>
        <div class="oh-n"><span>获采信</span><b class="num is-ok">{{ kpi.win }}</b></div>
      </div>
    </div>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>
        申诉须知：机构对核查认定结论有异议的，应自收到告知之日起 <b>15 个工作日内</b> 提出申诉，并同步提交举证材料；
        医保经办机构受理后将启动 <b>AI 智能初核 + 人工复核</b> 双轨审查，一般在 <b>15 个工作日</b> 内出具复核决定。
      </template>
    </el-alert>

    <div class="kpi-grid">
      <StatCard label="可申诉线索" :value="canList.length" unit="条" icon="Files" tone="accent" desc="已确认违规且在申诉期内" />
      <StatCard label="申诉涉及金额" :value="kpi.appealAmount" unit="元" icon="Money" tone="warning" :precision="2" />
      <StatCard label="累计调减金额" :value="kpi.savedAmount" unit="元" icon="Discount" tone="success" :precision="2"
        desc="复核后调减的认定金额" />
      <StatCard label="申诉采信率" :value="kpi.done ? Math.round((kpi.win / kpi.done) * 1000) / 10 : 0" unit="%"
        icon="TrendCharts" tone="primary" :precision="1" />
    </div>

    <!-- 可申诉线索 -->
    <SectionCard title="可申诉线索" desc="以下线索已完成违规认定，仍在申诉期内，可发起申诉" tight>
      <template #extra>
        <span class="text-mini">申诉截止：2026-09-15 18:00</span>
      </template>
      <el-table :data="canList.slice(0, 5)" v-loading="cLoading" size="small" border stripe>
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="clueId" label="线索编号" width="150">
          <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="violationType" label="认定违规类型" min-width="140" show-overflow-tooltip />
        <el-table-column label="风险" width="76" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="confirmAmount" label="认定金额(元)" width="122" align="right">
          <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.confirmAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="confirmTime" label="认定时间" width="158">
          <template #default="{ row }"><span class="num text-mini">{{ row.confirmTime }}</span></template>
        </el-table-column>
        <el-table-column prop="appealDeadline" label="申诉截止" width="158">
          <template #default="{ row }"><span class="num text-mini">{{ row.appealDeadline }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="106" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'ChatDotSquare'" @click="openSubmit(row)">提出申诉</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无可申诉线索" desc="所有认定结论均已超出申诉期或已提交申诉" /></template>
      </el-table>
    </SectionCard>

    <!-- 我的申诉 -->
    <div class="section-card">
      <div class="section-title">
        <i class="section-title__dot" />
        <span class="section-title__text">我的申诉记录</span>
        <span class="section-title__desc">共 {{ total }} 条申诉，点击可查看复核进度与结论</span>
        <div class="section-title__extra">
          <el-select v-model="q.status" placeholder="全部状态" clearable size="small" style="width: 130px"
            @change="q.page = 1; load()">
            <el-option v-for="s in AP_STATUS" :key="s" :label="s" :value="s" />
          </el-select>
        </div>
      </div>
      <el-table :data="list" v-loading="loading" size="small" border stripe @row-dblclick="openTrack">
        <el-table-column type="index" label="#" width="44" align="center" />
        <el-table-column prop="appealId" label="申诉编号" width="146">
          <template #default="{ row }">
            <span class="text-link num" @click="openTrack(row)">{{ row.appealId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="clueId" label="关联线索" width="146">
          <template #default="{ row }"><span class="num text-mini">{{ row.clueId }}</span></template>
        </el-table-column>
        <el-table-column prop="appealType" label="申诉类型" width="118" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.appealType }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="violationType" label="争议事项" width="126" show-overflow-tooltip />
        <el-table-column prop="originalAmount" label="原认定(元)" width="110" align="right">
          <template #default="{ row }"><span class="num">{{ fmtMoney(row.originalAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="appealAmount" label="申诉金额(元)" width="116" align="right">
          <template #default="{ row }"><span class="num num--money-mild">{{ fmtMoney(row.appealAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="submitTime" label="提交时间" width="158">
          <template #default="{ row }"><span class="num text-mini">{{ row.submitTime }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TONE[row.status] || 'info'" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="剩余时限" width="92" align="center">
          <template #default="{ row }">
            <span v-if="row.remainDays" class="num" :class="{ 'is-urgent': row.remainDays <= 3 }">{{ row.remainDays }} 天</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="复核结论" min-width="160" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.result" :type="RESULT_TONE[row.result] || 'info'" size="small" effect="dark">{{ row.result }}</el-tag>
            <span v-else class="text-muted">复核中</span>
          </template>
        </el-table-column>
        <el-table-column prop="finalAmount" label="最终认定(元)" width="118" align="right">
          <template #default="{ row }">
            <span v-if="row.finalAmount" class="num num--money">{{ fmtMoney(row.finalAmount) }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="'Guide'" @click="openTrack(row)">进度</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无申诉记录" desc="可从上方「可申诉线索」中发起申诉" /></template>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" background
          @current-change="load" @size-change="q.page = 1; load()" />
      </div>
    </div>

    <!-- 提交申诉抽屉 -->
    <el-drawer v-model="drawer" title="提交申诉申请" size="900px" :close-on-click-modal="false">
      <el-steps :active="step" align-center finish-status="success" class="stp">
        <el-step title="选择线索" description="选择争议线索" />
        <el-step title="填写异议" description="类型/金额/理由" />
        <el-step title="上传举证" description="证明材料" />
        <el-step title="确认提交" description="真实性承诺" />
      </el-steps>

      <!-- Step0 -->
      <div v-show="step === 0" class="sp">
        <div class="section-title">
          <i class="section-title__dot" /><span class="section-title__text">选择争议线索</span>
          <span class="section-title__desc">仅可对已确认违规且在申诉期内的线索提出申诉</span>
        </div>
        <el-table :data="canList" v-loading="cLoading" size="small" border height="360"
          highlight-current-row @row-click="pickClue">
          <el-table-column prop="clueId" label="线索编号" width="150">
            <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
          </el-table-column>
          <el-table-column prop="violationType" label="认定违规类型" min-width="150" show-overflow-tooltip />
          <el-table-column label="风险" width="76" align="center">
            <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
          </el-table-column>
          <el-table-column prop="confirmAmount" label="认定金额(元)" width="122" align="right">
            <template #default="{ row }"><span class="num num--money">{{ fmtMoney(row.confirmAmount) }}</span></template>
          </el-table-column>
          <el-table-column prop="appealDeadline" label="申诉截止" width="158">
            <template #default="{ row }"><span class="num text-mini">{{ row.appealDeadline }}</span></template>
          </el-table-column>
          <el-table-column label="" width="70" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="pickClue(row)">选择</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Step1 -->
      <div v-show="step === 1" class="sp">
        <el-descriptions v-if="picked" :column="3" border size="small" title="争议线索信息">
          <el-descriptions-item label="线索编号"><span class="num">{{ picked.clueId }}</span></el-descriptions-item>
          <el-descriptions-item label="认定违规类型">{{ picked.violationType }}</el-descriptions-item>
          <el-descriptions-item label="风险等级"><RiskTag :level="picked.riskLevel" /></el-descriptions-item>
          <el-descriptions-item label="原认定金额">
            <span class="num num--money">{{ fmtMoney(picked.confirmAmount) }} 元</span>
          </el-descriptions-item>
          <el-descriptions-item label="认定时间"><span class="num">{{ picked.confirmTime }}</span></el-descriptions-item>
          <el-descriptions-item label="申诉截止"><span class="num">{{ picked.appealDeadline }}</span></el-descriptions-item>
        </el-descriptions>

        <div class="section-title mt14">
          <i class="section-title__dot" /><span class="section-title__text">异议类型</span>
        </div>
        <div class="ty-grid">
          <div v-for="t in AP_TYPES" :key="t.v" class="ty" :class="{ 'is-on': form.appealType === t.v }"
            @click="form.appealType = t.v">
            <div class="ty__t">{{ t.v }}</div>
            <div class="ty__d">{{ t.d }}</div>
          </div>
        </div>

        <el-form label-width="112px" class="mt14">
          <div class="f-row">
            <el-form-item label="申诉涉及金额" required>
              <el-input-number v-model="form.appealAmount" :min="0" :precision="2" :step="10" style="width: 100%" />
            </el-form-item>
            <el-form-item label="申诉联系人" required>
              <el-input v-model="form.applicant" placeholder="如：医保办·张桂芳主任" />
            </el-form-item>
            <el-form-item label="联系电话" required>
              <el-input v-model="form.contact" placeholder="11 位手机号" />
            </el-form-item>
          </div>
          <el-form-item label="申诉理由" required>
            <el-input v-model="form.reason" type="textarea" :rows="6" maxlength="1000" show-word-limit
              placeholder="请详细说明异议事实、依据及诉求。例如：我院对该线索认定结论提出异议——该患者属 2 型糖尿病特殊病种，符合《芜湖市门诊慢特病长处方管理办法》长处方政策适用条件，一次开具 6 盒格列美脲片系依据患者实际病情及诊疗规范，相关病程记录与检验报告可查，请予复核并撤销相应认定金额。" />
            <div class="len-hint" :class="{ 'is-bad': form.reason.trim().length < 30 }">
              已填写 {{ form.reason.trim().length }} 字（不少于 30 字）
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step2 -->
      <div v-show="step === 2" class="sp">
        <div class="section-title">
          <i class="section-title__dot" /><span class="section-title__text">上传举证材料</span>
          <span class="section-title__desc">点击下方材料模板即可模拟上传，系统将自动进行合规性校验</span>
        </div>
        <div class="tpl-grid">
          <div v-for="t in MATERIAL_TPL" :key="t.name" class="tpl" @click="addMaterial(t)">
            <el-icon :size="20"><component :is="t.icon" /></el-icon>
            <div class="tpl__n">{{ t.name }}</div>
            <div class="tpl__t">{{ t.type }}</div>
          </div>
        </div>
        <div class="section-title mt14">
          <i class="section-title__dot" /><span class="section-title__text">已上传材料（{{ form.materials.length }}）</span>
        </div>
        <el-table :data="form.materials" size="small" border>
          <el-table-column type="index" label="#" width="44" align="center" />
          <el-table-column prop="name" label="材料名称" min-width="220" />
          <el-table-column prop="type" label="格式" width="80" align="center">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.type }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="size" label="大小" width="96" align="right">
            <template #default="{ row }"><span class="num text-mini">{{ row.size }}</span></template>
          </el-table-column>
          <el-table-column prop="uploadTime" label="上传时间" width="150">
            <template #default="{ row }"><span class="num text-mini">{{ row.uploadTime }}</span></template>
          </el-table-column>
          <el-table-column prop="verify" label="校验" width="86" align="center">
            <template #default="{ row }">
              <el-tag :type="row.verify === '通过' ? 'success' : 'warning'" size="small" effect="light">{{ row.verify }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link size="small" :icon="'Delete'"
                @click="form.materials.splice($index, 1)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><EmptyState text="尚未上传举证材料" desc="请至少上传 1 份能支撑异议主张的材料" height="140px" /></template>
        </el-table>
      </div>

      <!-- Step3 -->
      <div v-show="step === 3" class="sp">
        <el-descriptions :column="2" border size="small" title="申诉信息确认">
          <el-descriptions-item label="争议线索"><span class="num">{{ picked?.clueId }}</span></el-descriptions-item>
          <el-descriptions-item label="异议类型">
            <el-tag size="small" effect="plain">{{ form.appealType }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="原认定金额">
            <span class="num">{{ fmtMoney(picked?.confirmAmount || 0) }} 元</span>
          </el-descriptions-item>
          <el-descriptions-item label="申诉涉及金额">
            <span class="num num--money">{{ fmtMoney(form.appealAmount) }} 元</span>
          </el-descriptions-item>
          <el-descriptions-item label="申诉联系人">{{ form.applicant }}</el-descriptions-item>
          <el-descriptions-item label="联系电话"><span class="num">{{ form.contact }}</span></el-descriptions-item>
          <el-descriptions-item label="举证材料">
            <b class="num">{{ form.materials.length }}</b> 份
          </el-descriptions-item>
          <el-descriptions-item label="受理时限">3 个工作日内完成受理审查</el-descriptions-item>
          <el-descriptions-item label="申诉理由" :span="2">
            <div class="rsn">{{ form.reason }}</div>
          </el-descriptions-item>
        </el-descriptions>

        <div class="pledge">
          <el-checkbox v-model="form.pledge">
            本机构承诺：以上申诉事实陈述及所提交举证材料均真实、完整、有效，不存在伪造、变造情形；
            如有虚假，愿承担相应法律责任及医保协议约定的违约责任。
          </el-checkbox>
        </div>
        <el-alert type="warning" :closable="false" show-icon style="margin-top: 10px">
          提交后申诉进入「待受理」状态，经办机构受理后将自动触发 AI 智能初核，并由复核人员出具最终复核决定。
        </el-alert>
      </div>

      <template #footer>
        <span class="text-mini fl">
          {{ picked ? `争议线索 ${picked.clueId}` : '请先选择争议线索' }}
        </span>
        <el-button v-if="step > 0" @click="step--">上一步</el-button>
        <el-button @click="drawer = false">取消</el-button>
        <el-button v-if="step < 3" type="primary" :disabled="!picked" @click="nextStep">下一步</el-button>
        <el-button v-else type="primary" :loading="submitting" :icon="'Promotion'" @click="doSubmit">提交申诉</el-button>
      </template>
    </el-drawer>

    <!-- 申诉进度 -->
    <el-dialog v-model="trackVisible" :title="`申诉进度 · ${cur?.appealId || ''}`" width="820px" top="6vh">
      <div v-loading="trackLoading" class="tk">
        <template v-if="cur">
          <div class="tk-hero">
            <div>
              <div class="tk-hero__t">
                {{ cur.appealType }}
                <el-tag :type="STATUS_TONE[cur.status] || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              </div>
              <div class="tk-hero__m">
                <span>线索 <b class="num">{{ cur.clueId }}</b></span>
                <span>核查任务 <b class="num">{{ cur.inspectTaskId }}</b></span>
                <span>提交 <b class="num">{{ cur.submitTime }}</b></span>
              </div>
            </div>
            <div class="tk-hero__n">
              <div class="tn"><span>原认定</span><b class="num">{{ fmtMoney(cur.originalAmount) }}</b></div>
              <el-icon class="tn-arrow"><Right /></el-icon>
              <div class="tn"><span>最终认定</span>
                <b class="num" :class="cur.finalAmount ? 'is-ok' : 'is-mute'">
                  {{ cur.finalAmount ? fmtMoney(cur.finalAmount) : '待复核' }}
                </b>
              </div>
            </div>
          </div>

          <div class="section-title mt14">
            <i class="section-title__dot" /><span class="section-title__text">办理进度</span>
          </div>
          <el-steps :active="cur.timeline.filter((t: any) => t.status === 'done').length" align-center>
            <el-step v-for="(t, i) in cur.timeline" :key="i" :title="t.title"
              :status="t.status === 'done' ? 'success' : t.status === 'process' ? 'process' : 'wait'">
              <template #description>
                <div class="tl-d">
                  <div class="num">{{ t.time || '—' }}</div>
                  <div>{{ t.operator }}</div>
                </div>
              </template>
            </el-step>
          </el-steps>

          <div class="section-title mt14">
            <i class="section-title__dot" /><span class="section-title__text">申诉理由</span>
          </div>
          <div class="rsn">{{ cur.reason }}</div>

          <div class="section-title mt14">
            <i class="section-title__dot" /><span class="section-title__text">举证材料（{{ cur.materials?.length || 0 }}）</span>
          </div>
          <el-table :data="cur.materials || []" size="small" border>
            <el-table-column prop="name" label="材料名称" min-width="220" show-overflow-tooltip />
            <el-table-column prop="type" label="格式" width="76" align="center" />
            <el-table-column prop="size" label="大小" width="92" align="right">
              <template #default="{ row }"><span class="num text-mini">{{ row.size }}</span></template>
            </el-table-column>
            <el-table-column prop="verify" label="校验" width="86" align="center">
              <template #default="{ row }">
                <el-tag :type="row.verify === '通过' ? 'success' : 'warning'" size="small" effect="light">{{ row.verify }}</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <template v-if="cur.review">
            <div class="section-title mt14">
              <i class="section-title__dot" /><span class="section-title__text">复核决定</span>
            </div>
            <div class="rv" :class="`is-${RESULT_TONE[cur.review.result] || 'info'}`">
              <div class="rv__t">
                <el-icon><Stamp /></el-icon>{{ cur.review.result }}
                <span class="rv__amt num">最终认定 {{ fmtMoney(cur.review.finalAmount) }} 元</span>
              </div>
              <div class="rv__o">{{ cur.review.opinion }}</div>
              <div class="rv__f">
                <span>复核人：{{ cur.review.reviewer }}</span>
                <span>审批人：{{ cur.review.approver }}</span>
                <span class="num">{{ cur.review.time }}</span>
              </div>
            </div>
          </template>
          <el-alert v-else type="info" :closable="false" show-icon style="margin-top: 12px"
            title="复核尚未完成，经办机构将在受理后 15 个工作日内出具复核决定并推送本机构工作台。" />
        </template>
      </div>
      <template #footer>
        <el-button @click="trackVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.ml4 { margin-left: 4px; }
.mt14 { margin-top: 14px; }
.fl { float: left; }

.org-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; border-radius: var(--zh-radius-lg); color: #fff;
  background: linear-gradient(102deg, #0a2f6b, #1668dc 58%, #1495b3);
  box-shadow: var(--zh-shadow-base);
  &__l { display: flex; align-items: center; gap: 12px; }
  &__ic {
    width: 46px; height: 46px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .26);
  }
  &__name { font-size: var(--zh-font-title); font-weight: 700; }
  &__meta {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 4px;
    font-size: var(--zh-font-xs); opacity: .88;
    b { font-family: var(--zh-font-num); }
  }
  &__r { display: flex; gap: 22px; flex-shrink: 0; }
}
.oh-n {
  display: flex; flex-direction: column; align-items: center;
  span { font-size: 11px; opacity: .82; }
  b {
    font-size: 22px; font-family: var(--zh-font-num); line-height: 1.2;
    &.is-warn { color: #ffd666; }
    &.is-ok { color: #95f2c8; }
  }
}
.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
}
.is-urgent { color: var(--zh-danger); font-weight: 700; }

.stp { margin-bottom: 16px; }
.sp { display: block; }
.f-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px;
  @media (max-width: 780px) { grid-template-columns: 1fr; }
}
.ty-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}
.ty {
  padding: 10px 11px; border-radius: var(--zh-radius); cursor: pointer;
  background: #fff; border: 1px solid var(--zh-border); transition: all .18s;
  &__t { font-size: var(--zh-font-sm); font-weight: 700; color: var(--zh-text-primary); }
  &__d { font-size: 11px; line-height: 1.55; color: var(--zh-text-secondary); margin-top: 3px; }
  &:hover { border-color: var(--zh-primary); }
  &.is-on {
    border-color: var(--zh-primary); background: var(--zh-primary-lighter);
    box-shadow: 0 0 0 2px rgba(22, 104, 220, .12);
    .ty__t { color: var(--zh-primary); }
  }
}
.len-hint {
  margin-top: 4px; font-size: 11px; color: var(--zh-text-secondary);
  &.is-bad { color: var(--zh-warning); }
}
.tpl-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  @media (max-width: 780px) { grid-template-columns: repeat(2, 1fr); }
}
.tpl {
  display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;
  padding: 14px 10px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px dashed var(--zh-border-strong);
  transition: all .18s; text-align: center;
  :deep(.el-icon) { color: var(--zh-primary); }
  &__n { font-size: var(--zh-font-sm); font-weight: 600; color: var(--zh-text-primary); }
  &__t { font-size: 11px; color: var(--zh-text-secondary); }
  &:hover {
    border-color: var(--zh-primary); border-style: solid;
    background: var(--zh-primary-lighter); transform: translateY(-2px);
  }
}
.rsn {
  padding: 11px 13px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: var(--zh-font-sm); line-height: 1.85; color: var(--zh-text-regular);
  white-space: pre-wrap;
}
.pledge {
  margin-top: 14px; padding: 12px 14px; border-radius: var(--zh-radius);
  background: var(--zh-risk-mid-bg); border: 1px solid var(--zh-risk-mid-border);
  :deep(.el-checkbox) { width: 100%; align-items: flex-start; }
  :deep(.el-checkbox__label) {
    white-space: normal; line-height: 1.75;
    font-size: var(--zh-font-xs); color: var(--zh-text-regular);
  }
}

.tk { display: block; }
.tk-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 15px; border-radius: var(--zh-radius-lg);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border);
  border-left: 4px solid var(--zh-primary);
  &__t {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-lg); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; gap: 14px; flex-wrap: wrap; margin-top: 5px;
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
    b { color: var(--zh-text-regular); }
  }
  &__n { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
}
.tn {
  display: flex; flex-direction: column; align-items: center;
  span { font-size: 11px; color: var(--zh-text-secondary); }
  b {
    font-size: 18px; font-family: var(--zh-font-num); color: var(--zh-text-primary);
    &.is-ok { color: var(--zh-success); }
    &.is-mute { color: var(--zh-text-placeholder); font-size: 14px; }
  }
}
.tn-arrow { color: var(--zh-text-placeholder); }
.tl-d {
  font-size: 11px; line-height: 1.6; color: var(--zh-text-secondary);
}
.rv {
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
  &__o {
    margin-top: 7px; font-size: var(--zh-font-sm); line-height: 1.8; color: var(--zh-text-regular);
  }
  &__f {
    display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px;
    padding-top: 8px; border-top: 1px dashed var(--zh-border);
    font-size: var(--zh-font-xs); color: var(--zh-text-secondary);
  }
}
</style>
