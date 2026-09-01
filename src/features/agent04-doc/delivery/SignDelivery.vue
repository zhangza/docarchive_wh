<script setup lang="ts">
import {
  getSignStats, getSignList, getSignDetail, applySign, doSign,
  getDeliveryList, getDeliveryDetail, sendDelivery, retryDelivery, genReceipt,
  getExportList, doExportDoc
} from '@/api/agent04-doc/docgen'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('sign')

async function loadStats() { st.value = await getSignStats() }

/* ================= 在线签章 ================= */
const signList = ref<any[]>([])
const signTotal = ref(0)
const signLoading = ref(false)
const signQ = reactive({ keyword: '', status: '', page: 1, pageSize: 12 })

async function loadSign() {
  signLoading.value = true
  try {
    const res: any = await getSignList(signQ)
    signList.value = res?.list || []
    signTotal.value = res?.total || 0
  } finally { signLoading.value = false }
}

const signDrawer = ref(false)
const curSign = ref<any>(null)
async function openSign(row: any) {
  signDrawer.value = true
  curSign.value = await getSignDetail({ signId: row.signId })
}

const signing = ref(false)
async function doStepSign(step: any) {
  await ElMessageBox.confirm(
    `确认以「${step.signerRole}」身份对该文书进行${step.signType}？签章后文书内容将固化，任何修改都会使签章失效。`,
    '签章确认', { type: 'warning', confirmButtonText: '身份核验并签章', cancelButtonText: '取消' }
  ).then(async () => {
    signing.value = true
    try {
      const res: any = await doSign({ signId: curSign.value.signId, step: step.step, signType: step.signType })
      msg.success(`${res.message}（核验方式：${res.authMethod}）`)
      curSign.value = await getSignDetail({ signId: curSign.value.signId })
      await loadSign()
    } finally { signing.value = false }
  }).catch(() => undefined)
}

async function doApplySign() {
  const res: any = await applySign({ documentId: curSign.value?.documentId })
  msg.success(res?.message || '已发起签章申请')
  await loadSign()
}

/* ================= 电子送达 ================= */
const delList = ref<any[]>([])
const delTotal = ref(0)
const delLoading = ref(false)
const delQ = reactive({ keyword: '', status: '', method: '', page: 1, pageSize: 12 })

const DEL_TONE: Record<string, any> = {
  待送达: 'info', 已发送: 'primary', 已送达: 'success', 已读: 'success',
  已签收: 'success', 送达失败: 'danger', 视为送达: 'warning'
}

async function loadDel() {
  delLoading.value = true
  try {
    const res: any = await getDeliveryList(delQ)
    delList.value = res?.list || []
    delTotal.value = res?.total || 0
  } finally { delLoading.value = false }
}

const delDrawer = ref(false)
const curDel = ref<any>(null)
async function openDel(row: any) {
  delDrawer.value = true
  curDel.value = await getDeliveryDetail(row.deliveryId)
}

const sendVisible = ref(false)
const sending = ref(false)
const sendForm = reactive({ documentId: '', methods: ['电子送达', '短信通知', '邮件送达'] as string[] })

function openSendDlg() {
  sendForm.documentId = curDel.value?.documentId || ''
  sendForm.methods = ['电子送达', '短信通知', '邮件送达']
  sendVisible.value = true
}

async function doSend() {
  if (!sendForm.methods.length) { msg.warning('请至少选择一种送达方式'); return }
  sending.value = true
  try {
    const res: any = await sendDelivery(sendForm)
    msg.success(res?.message || '已送达')
    sendVisible.value = false
    await loadDel()
  } finally { sending.value = false }
}

async function doRetry(row: any) {
  const res: any = await retryDelivery({ deliveryId: row.deliveryId })
  msg.success(res?.message || '已重新送达')
  await loadDel()
}

async function doReceipt(row: any) {
  const res: any = await genReceipt({ deliveryId: row.deliveryId })
  msg.success(`${res.message}（回证编号 ${res.receiptId}）`)
}

/* ================= 文书导出 ================= */
const expList = ref<any[]>([])
const expTotal = ref(0)
const expLoading = ref(false)
const expQ = reactive({ keyword: '', format: '', page: 1, pageSize: 10 })

const FMT_TONE: Record<string, any> = { PDF: 'danger', Word: 'primary', OFD: 'warning', 'ZIP打包(PDF)': 'success' }

async function loadExp() {
  expLoading.value = true
  try {
    const res: any = await getExportList(expQ)
    expList.value = res?.list || []
    expTotal.value = res?.total || 0
  } finally { expLoading.value = false }
}

const expVisible = ref(false)
const exporting = ref(false)
const expForm = reactive({ documentId: '', format: 'PDF', withSeal: true, watermark: '无' })

function openExpDlg(row?: any) {
  Object.assign(expForm, { documentId: row?.documentId || '', format: 'PDF', withSeal: true, watermark: '无' })
  expVisible.value = true
}

async function doExport() {
  exporting.value = true
  try {
    const res: any = await doExportDoc(expForm)
    msg.success(res?.message || '已导出')
    expVisible.value = false
    await loadExp()
  } finally { exporting.value = false }
}

/* ---------- 图表 ---------- */
/** 送达状态：南丁格尔玫瑰 + 中心汇总 */
const delStatusOption = computed(() => {
  const d = st.value?.deliveryByStatus || []
  const colors: Record<string, string> = {
    待送达: '#5a7189', 已发送: '#3c88ff', 已送达: '#13c2c2', 已读: '#4cc38a',
    已签收: '#12a150', 送达失败: '#e5484d', 视为送达: '#e8a30c'
  }
  const tot = d.reduce((s: number, i: any) => s + i.value, 0)
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
    legend: { type: 'scroll', bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    graphic: [
      { type: 'text', left: 'center', top: '38%', style: { text: String(tot), fontSize: 24, fontWeight: 800, fill: '#1a2230' } },
      { type: 'text', left: 'center', top: '50%', style: { text: '送达总量', fontSize: 10, fill: '#6b7a90' } }
    ],
    series: [{
      type: 'pie', radius: ['42%', '74%'], center: ['50%', '43%'], roseType: 'area',
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      label: { show: true, formatter: '{c}', fontSize: 10, fontWeight: 700, color: '#43516b' },
      labelLine: { length: 5, length2: 6 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] || '#1668dc' } }))
    }]
  }
})

/** 导出格式：漏斗（PDF→Word→OFD→ZIP 层级递减） */
const fmtOption = computed(() => {
  const d = [...(st.value?.exportFormatDist || [])].sort((a: any, b: any) => b.value - a.value)
  const colors: Record<string, string> = { PDF: '#c8161d', Word: '#1668dc', OFD: '#e8a30c', 'ZIP打包(PDF)': '#12a150' }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 次' },
    series: [{
      type: 'funnel', left: '8%', right: '8%', top: 8, bottom: 8,
      minSize: '32%', maxSize: '96%', sort: 'descending', gap: 3,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: true, position: 'inside', formatter: '{b} {c}', fontSize: 10, fontWeight: 700, color: '#fff' },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] || '#1668dc' } }))
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'delivery' && !delList.value.length) loadDel()
  else if (v === 'export' && !expList.value.length) loadExp()
})

onMounted(() => { loadStats(); loadSign() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="签章与送达" tag="M28"
      subtitle="在线电子签章 · 多渠道电子送达 · 送达回证 · 多格式文书导出">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadSign()">刷新</el-button>
        <el-button :icon="'Download'" @click="activeTab = 'export'; loadExp(); openExpDlg()">导出文书</el-button>
      </template>
    </PageHeader>

    <!-- 指标 -->
    <div class="kpi-grid">
      <StatCard label="签章记录" :value="st?.signTotal || 0" unit="件" icon="Stamp" tone="primary" />
      <StatCard label="签章完成率" :value="st?.signedRate || 0" unit="%" icon="CircleCheck" tone="success" :precision="1" />
      <StatCard label="送达记录" :value="st?.deliveryTotal || 0" unit="件" icon="Promotion" tone="accent" />
      <StatCard label="已签收" :value="(st?.deliveryByStatus || []).find((s: any) => s.name === '已签收')?.value || 0"
        unit="件" icon="DocumentChecked" tone="success" />
      <StatCard label="送达失败" :value="(st?.deliveryByStatus || []).find((s: any) => s.name === '送达失败')?.value || 0"
        unit="件" icon="CircleClose" tone="danger" />
      <StatCard label="导出记录" :value="st?.exportTotal || 0" unit="次" icon="Download" tone="purple" />
    </div>

    <el-tabs v-model="activeTab" class="sd-tabs">
      <!-- ============ 在线签章 ============ -->
      <el-tab-pane label="在线签章" name="sign">
        <div class="section-card section-card--tight seal-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">四级签章流程与用印权限</span>
            <span class="section-title__desc">经办人 → 审核人 → 部门负责人 → 法定代表人（单位电子印章）逐级签章，签章后文书内容固化</span>
          </div>
          <div class="flow-grid">
            <div v-for="(r, i) in (st?.signRoles || [])" :key="r" class="fl"
              :class="[`is-${['info', 'primary', 'warning', 'danger'][i]}`, { 'is-org': i === 3 }]">
              <!-- 前 3 级：个人签名手写体；第 4 级：单位圆章 -->
              <div class="fl__stage">
                <SealStamp v-if="i === 3" :size="72" :rotate="-13" center="医保" />
                <div v-else class="sig">
                  <span class="sig__ink">{{ ['经办', '审核', '负责'][i] }}</span>
                  <span class="sig__line" />
                </div>
              </div>
              <div class="fl__no num">{{ i + 1 }}</div>
              <div class="fl__n">{{ r }}</div>
              <div class="fl__t">{{ i === 3 ? '单位电子印章' : '个人电子签名' }}</div>
              <div class="fl__a">
                <el-icon><Key /></el-icon>{{ i === 3 ? '密码+短信+人脸' : '密码+短信验证码' }}
              </div>
              <span v-if="i < 3" class="fl__arrow"><el-icon><DArrowRight /></el-icon></span>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">签章记录</span>
          </div>
          <el-form class="query-form" :model="signQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="signQ.keyword" placeholder="签章编号/文号/文书名称" clearable :prefix-icon="'Search'"
                @keyup.enter="signQ.page = 1; loadSign()" />
            </el-form-item>
            <el-form-item label="签章状态">
              <el-select v-model="signQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['待签章', '签章中', '签章完成']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="signQ.page = 1; loadSign()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(signQ, { keyword: '', status: '', page: 1 }); loadSign()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="signList" size="small" border stripe v-loading="signLoading">
            <el-table-column prop="docNo" label="文号" width="164">
              <template #default="{ row }">
                <span class="num text-link" @click="openSign(row)">{{ row.docNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="documentName" label="文书名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="签章进度" width="176">
              <template #default="{ row }">
                <div class="sp">
                  <span v-for="s in row.signFlow" :key="s.step" class="sp__d"
                    :class="s.status === '已签章' ? 'is-done' : 'is-wait'" :title="`${s.signerRole}：${s.status}`" />
                  <span class="sp__t num text-mini">
                    {{ row.signFlow.filter((s: any) => s.status === '已签章').length }}/{{ row.signFlow.length }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="92" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '签章完成' ? 'success' : row.status === '签章中' ? 'primary' : 'warning'" size="small" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="防篡改" width="106" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.antiTamper.blockchainNotarization" size="small" type="success" effect="plain">
                  <el-icon :size="10"><Lock /></el-icon> 已上链
                </el-tag>
                <el-tag v-else-if="row.antiTamper.enabled" size="small" type="primary" effect="plain">哈希固化</el-tag>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="applicant" label="申请人" width="132" />
            <el-table-column prop="applyTime" label="申请时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.applyTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'Stamp'" @click="openSign(row)">签章</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无签章记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ signTotal }} 条</span>
            <el-pagination v-model:current-page="signQ.page" v-model:page-size="signQ.pageSize" :total="signTotal"
              :page-sizes="[12, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadSign" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">印章使用日志</span>
            <span class="section-title__desc">电子印章按类型分级授权，每次使用全程留痕，可追溯</span>
          </div>
          <el-table :data="st?.sealLogs || []" size="small" border stripe>
            <el-table-column prop="sealName" label="印章名称" min-width="220" />
            <el-table-column prop="sealType" label="印章类型" width="140" align="center">
              <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.sealType }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="useCount" label="使用次数" width="104" align="right">
              <template #default="{ row }"><span class="num">{{ fmtNum(row.useCount) }}</span></template>
            </el-table-column>
            <el-table-column prop="lastUseTime" label="最近使用" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.lastUseTime }}</span></template>
            </el-table-column>
            <el-table-column prop="authorizedRoles" label="授权角色" min-width="200">
              <template #default="{ row }">
                <el-tag v-for="r in row.authorizedRoles" :key="r" size="small" effect="plain" class="mr4">{{ r }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="90" align="center">
              <template #default="{ row }"><el-tag type="success" size="small" effect="dark">{{ row.status }}</el-tag></template>
            </el-table-column>
            <template #empty><EmptyState text="暂无印章日志" height="120px" /></template>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ============ 电子送达 ============ -->
      <el-tab-pane label="电子送达" name="delivery">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">送达状态分布</span>
            </div>
            <EChart :option="delStatusOption" height="216px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">送达方式（多渠道并行）</span>
              <span class="section-title__desc">电子送达为主，邮寄 / 直接 / 留置 / 公告送达为辅</span>
            </div>
            <div class="mth-grid">
              <div v-for="(m, i) in (st?.deliveryMethods || [])" :key="m" class="mth"
                :class="`is-${['primary', 'accent', 'success', 'warning', 'purple', 'info', 'danger'][i % 7]}`">
                <el-icon class="mth__i">
                  <component :is="['Promotion', 'Message', 'Message', 'Van', 'User', 'House', 'Notification'][i] || 'Promotion'" />
                </el-icon>
                <div class="mth__n">{{ m }}</div>
              </div>
            </div>
            <el-alert type="info" :closable="false" show-icon class="mt10">
              <template #title>
                <span class="text-mini">未签收的自送达之日起 5 个工作日后系统自动标记「视为送达」，法律效力等同签收</span>
              </template>
            </el-alert>
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">送达记录</span>
          </div>
          <el-form class="query-form" :model="delQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="delQ.keyword" placeholder="送达编号/文号/机构" clearable :prefix-icon="'Search'"
                @keyup.enter="delQ.page = 1; loadDel()" />
            </el-form-item>
            <el-form-item label="送达状态">
              <el-select v-model="delQ.status" placeholder="全部状态" clearable>
                <el-option v-for="s in (st?.deliveryByStatus || [])" :key="s.name" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="送达方式">
              <el-select v-model="delQ.method" placeholder="全部方式" clearable>
                <el-option v-for="m in (st?.deliveryMethods || [])" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="delQ.page = 1; loadDel()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(delQ, { keyword: '', status: '', method: '', page: 1 }); loadDel()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="delList" size="small" border stripe v-loading="delLoading">
            <el-table-column prop="docNo" label="文号" width="164">
              <template #default="{ row }">
                <span class="num text-link" @click="openDel(row)">{{ row.docNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="documentName" label="文书名称" min-width="190" show-overflow-tooltip />
            <el-table-column prop="orgName" label="受送达机构" min-width="164" show-overflow-tooltip />
            <el-table-column label="送达渠道" width="150">
              <template #default="{ row }">
                <el-tag v-for="m in row.deliveryMethods.slice(0, 2)" :key="m" size="small" effect="plain" class="mr4">{{ m }}</el-tag>
                <el-tag v-if="row.deliveryMethods.length > 2" size="small" effect="plain">+{{ row.deliveryMethods.length - 2 }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="送达状态" width="96" align="center">
              <template #default="{ row }">
                <el-tag :type="DEL_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="签收" width="140">
              <template #default="{ row }">
                <template v-if="row.signed">
                  <div class="text-mini">{{ row.signer }}</div>
                  <div class="num text-mini text-muted">{{ row.signTime?.slice(5, 16) }}</div>
                </template>
                <el-tag v-else-if="row.deemedDelivered" size="small" type="warning" effect="plain">视为送达</el-tag>
                <span v-else class="text-muted">未签收</span>
              </template>
            </el-table-column>
            <el-table-column prop="sendTime" label="发送时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.sendTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="152" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDel(row)">详情</el-button>
                <el-button v-if="row.status === '送达失败'" link type="warning" :icon="'Refresh'" @click="doRetry(row)">重试</el-button>
                <el-button v-else-if="row.signed" link type="success" :icon="'Tickets'" @click="doReceipt(row)">回证</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无送达记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ delTotal }} 条</span>
            <el-pagination v-model:current-page="delQ.page" v-model:page-size="delQ.pageSize" :total="delTotal"
              :page-sizes="[12, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadDel" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 文书导出 ============ -->
      <el-tab-pane label="文书导出" name="export">
        <div class="chart-grid chart-grid--2">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">导出格式分布</span>
            </div>
            <EChart :option="fmtOption" height="196px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">导出格式说明</span>
            </div>
            <div class="fmt-list">
              <div class="fmt is-danger">
                <div class="fmt__n">PDF</div>
                <div class="fmt__d">版式固定不可编辑，带电子印章，用于正式送达与归档</div>
              </div>
              <div class="fmt is-primary">
                <div class="fmt__n">Word</div>
                <div class="fmt__d">可编辑格式，用于内部修改流转与草稿协作</div>
              </div>
              <div class="fmt is-warning">
                <div class="fmt__n">OFD</div>
                <div class="fmt__d">国产版式文档标准，满足信创与政务归档要求</div>
              </div>
              <div class="fmt is-success">
                <div class="fmt__n">ZIP 打包（PDF）</div>
                <div class="fmt__d">批量文书打包下载，按机构 / 文书类型自动分目录</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'Download'" @click="openExpDlg()">导出文书</el-button>
            <span class="text-mini">共 {{ expTotal }} 次导出</span>
          </div>

          <el-form class="query-form" :model="expQ" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="expQ.keyword" placeholder="导出编号/文号/文书名称" clearable :prefix-icon="'Search'"
                @keyup.enter="expQ.page = 1; loadExp()" />
            </el-form-item>
            <el-form-item label="导出格式">
              <el-select v-model="expQ.format" placeholder="全部格式" clearable>
                <el-option v-for="f in ['PDF', 'Word', 'OFD', 'ZIP打包(PDF)']" :key="f" :label="f" :value="f" />
              </el-select>
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="expQ.page = 1; loadExp()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(expQ, { keyword: '', format: '', page: 1 }); loadExp()">重　置</el-button>
            </div>
          </el-form>

          <el-table :data="expList" size="small" border stripe v-loading="expLoading">
            <el-table-column prop="exportId" label="导出编号" width="146">
              <template #default="{ row }"><span class="num">{{ row.exportId }}</span></template>
            </el-table-column>
            <el-table-column prop="docNo" label="文号" width="164">
              <template #default="{ row }"><span class="num text-mini">{{ row.docNo }}</span></template>
            </el-table-column>
            <el-table-column prop="documentName" label="文书名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="format" label="格式" width="118" align="center">
              <template #default="{ row }">
                <el-tag :type="FMT_TONE[row.format] || 'info'" size="small" effect="dark">{{ row.format }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="电子印章" width="94" align="center">
              <template #default="{ row }">
                <el-tag :type="row.withSeal ? 'success' : 'info'" size="small" effect="plain">
                  {{ row.withSeal ? '带章' : '无章' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="watermark" label="水印" width="108" align="center">
              <template #default="{ row }">
                <span class="text-mini">{{ row.watermark }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="fileSize" label="文件大小" width="98" align="right">
              <template #default="{ row }"><span class="num text-mini">{{ row.fileSize }}</span></template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="132" />
            <el-table-column prop="exportTime" label="导出时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.exportTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'Download'" @click="openExpDlg(row)">重新导出</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无导出记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ expTotal }} 条</span>
            <el-pagination v-model:current-page="expQ.page" v-model:page-size="expQ.pageSize" :total="expTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadExp" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 签章详情抽屉 ============ -->
    <el-drawer v-model="signDrawer" size="680px" title="在线签章">
      <template v-if="curSign">
        <div class="sd-hero">
          <div class="sd-hero__t">
            {{ curSign.documentName }}
            <el-tag :type="curSign.status === '签章完成' ? 'success' : curSign.status === '签章中' ? 'primary' : 'warning'" size="small" effect="dark">
              {{ curSign.status }}
            </el-tag>
          </div>
          <div class="sd-hero__m">
            <span><el-icon><Ticket /></el-icon>{{ curSign.docNo }}</span>
            <span><el-icon><Stamp /></el-icon>{{ curSign.signId }}</span>
            <span><el-icon><User /></el-icon>{{ curSign.applicant }}</span>
            <span><el-icon><Clock /></el-icon>{{ curSign.applyTime }}</span>
          </div>
        </div>

        <div class="sub-title">签章流程（逐级签章 · 身份核验）</div>
        <div class="sf-list">
          <div v-for="s in curSign.signFlow" :key="s.step" class="sf" :class="s.status === '已签章' ? 'is-done' : 'is-wait'">
            <div class="sf__no num">{{ s.step }}</div>
            <div class="sf__b">
              <div class="sf__h">
                <b>{{ s.signerRole }}</b>
                <span class="sf__nm">{{ s.signer }}</span>
                <el-tag :type="s.signType === '单位电子印章' ? 'danger' : 'primary'" size="small" effect="plain">{{ s.signType }}</el-tag>
                <el-tag :type="s.status === '已签章' ? 'success' : 'info'" size="small" effect="dark">{{ s.status }}</el-tag>
              </div>
              <div class="sf__d">
                <span><el-icon><Key /></el-icon>核验：{{ s.authMethod }}</span>
                <span><el-icon><Location /></el-icon>{{ s.signPosition }}</span>
              </div>
              <div v-if="s.sealName" class="sf__seal">
                <el-icon><Stamp /></el-icon>{{ s.sealName }}（{{ s.sealType }}）
              </div>
              <div v-if="s.status === '已签章'" class="sf__f">
                <span class="num">{{ s.signTime }}</span>
                <span class="num">IP {{ s.ipAddress }}</span>
              </div>
            </div>
            <!-- 已签：落章/签名可视化；未签：签章按钮 -->
            <div class="sf__mark">
              <template v-if="s.status === '已签章'">
                <SealStamp v-if="s.signType === '单位电子印章'" :size="66" :rotate="-15" center="医保" />
                <div v-else class="sig sig--sm">
                  <span class="sig__ink">{{ String(s.signer).slice(-2) }}</span>
                  <span class="sig__line" />
                </div>
              </template>
              <el-button v-else type="primary" size="small" :icon="'Stamp'"
                :loading="signing" @click="doStepSign(s)">签章</el-button>
            </div>
          </div>
        </div>

        <template v-if="curSign.signedDocument">
          <div class="sub-title">签章后文书（内容已固化）</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="文件名称" :span="2">{{ curSign.signedDocument.fileName }}</el-descriptions-item>
            <el-descriptions-item label="文件大小">{{ curSign.signedDocument.fileSize }}</el-descriptions-item>
            <el-descriptions-item label="生成时间">
              <span class="num text-mini">{{ curSign.signedDocument.generateTime }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="文件哈希" :span="2">
              <span class="hash">{{ curSign.signedDocument.fileHash }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <div class="sub-title">防篡改保护</div>
        <div class="at-box" :class="{ 'is-on': curSign.antiTamper.enabled }">
          <div class="at-box__h">
            <el-icon><Lock /></el-icon>
            <b>{{ curSign.antiTamper.enabled ? '防篡改保护已启用' : '防篡改保护未启用' }}</b>
            <el-tag v-if="curSign.antiTamper.blockchainNotarization" size="small" type="success" effect="dark">区块链存证</el-tag>
          </div>
          <el-descriptions :column="2" border size="small" class="mt8">
            <el-descriptions-item label="哈希算法">{{ curSign.antiTamper.hashAlgorithm }}</el-descriptions-item>
            <el-descriptions-item label="时间戳">
              <span class="num text-mini">{{ curSign.antiTamper.timestamp }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="curSign.antiTamper.notarizationId" label="存证编号" :span="2">
              <span class="num">{{ curSign.antiTamper.notarizationId }}</span>
            </el-descriptions-item>
          </el-descriptions>
          <div class="at-box__tip">
            <el-icon><InfoFilled /></el-icon>
            签章后文书内容固化，任何修改都会使签章失效；哈希值 + 时间戳 + 区块链存证三重保护，可在线校验完整性
          </div>
        </div>

        <div class="dr-actions">
          <el-button v-if="curSign.status === '待签章'" :icon="'Promotion'" @click="doApplySign">重新发起签章</el-button>
          <el-button :icon="'Download'" @click="openExpDlg(curSign)">导出已签章文书</el-button>
          <el-button type="primary" :icon="'Promotion'" @click="activeTab = 'delivery'; loadDel(); signDrawer = false">
            进入送达环节
          </el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 送达详情抽屉 ============ -->
    <el-drawer v-model="delDrawer" size="680px" title="电子送达详情">
      <template v-if="curDel">
        <div class="sd-hero">
          <div class="sd-hero__t">
            {{ curDel.documentName }}
            <el-tag :type="DEL_TONE[curDel.status] || 'info'" size="small" effect="dark">{{ curDel.status }}</el-tag>
            <el-tag v-if="curDel.deemedDelivered" size="small" type="warning" effect="light">视为送达</el-tag>
          </div>
          <div class="sd-hero__m">
            <span><el-icon><Ticket /></el-icon>{{ curDel.docNo }}</span>
            <span><el-icon><Promotion /></el-icon>{{ curDel.deliveryId }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ curDel.orgName }}</span>
            <span><el-icon><Clock /></el-icon>{{ curDel.sendTime }}</span>
          </div>
        </div>

        <div class="sub-title">受送达人信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="联系人">{{ curDel.recipient.name }}</el-descriptions-item>
          <el-descriptions-item label="职务">{{ curDel.recipient.contact }}</el-descriptions-item>
          <el-descriptions-item label="手机">
            <span class="num">{{ curDel.recipient.phone }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            <span class="num text-mini">{{ curDel.recipient.email }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">{{ curDel.recipient.address }}</el-descriptions-item>
        </el-descriptions>

        <div class="sub-title">多渠道送达明细</div>
        <div class="ch-list">
          <div v-for="(c, i) in curDel.channels" :key="i" class="ch" :class="c.status === '成功' ? 'is-ok' : 'is-no'">
            <div class="ch__h">
              <el-icon><component :is="c.status === '成功' ? 'CircleCheckFilled' : 'CircleCloseFilled'" /></el-icon>
              <b>{{ c.method }}</b>
              <el-tag :type="c.status === '成功' ? 'success' : 'danger'" size="small" effect="dark">{{ c.status }}</el-tag>
              <span class="ch__t num">{{ c.sendTime }}</span>
            </div>
            <div class="ch__d">{{ c.detail }}</div>
            <div class="ch__l num">日志编号：{{ c.logId }}</div>
          </div>
        </div>

        <div class="sub-title">送达状态跟踪</div>
        <el-timeline class="dl-tl">
          <el-timeline-item type="primary" :timestamp="curDel.sendTime" size="normal">
            <b>已发送</b>
            <div class="text-mini">通过 {{ curDel.deliveryMethods.join('、') }} 多渠道并行送达</div>
          </el-timeline-item>
          <el-timeline-item v-if="curDel.readTime" type="success" :timestamp="curDel.readTime" size="normal">
            <b>已阅读</b>
            <div class="text-mini">阅读人：{{ curDel.reader }}</div>
          </el-timeline-item>
          <el-timeline-item v-if="curDel.signed" type="success" :timestamp="curDel.signTime" size="normal">
            <b>已签收</b>
            <div class="text-mini">签收人：{{ curDel.signer }} · 回证编号 <span class="num">{{ curDel.receiptId }}</span></div>
          </el-timeline-item>
          <el-timeline-item v-else-if="curDel.deemedDelivered" type="warning" :timestamp="curDel.deemedTime" size="normal">
            <b>视为送达</b>
            <div class="text-mini">自送达之日起 5 个工作日内未签收，系统自动标记为视为送达，法律效力等同签收</div>
          </el-timeline-item>
          <el-timeline-item v-else-if="curDel.status === '送达失败'" type="danger" :timestamp="curDel.sendTime" size="normal">
            <b>送达失败</b>
            <div class="text-mini">已重试 {{ curDel.retryCount }} 次，建议启动邮寄送达或直接送达</div>
          </el-timeline-item>
          <el-timeline-item v-else type="info" hollow timestamp="待签收" size="normal">
            <b>等待签收</b>
            <div class="text-mini">尚未签收，将于送达之日起 5 个工作日后自动视为送达</div>
          </el-timeline-item>
        </el-timeline>

        <div class="dr-actions">
          <el-button v-if="curDel.status === '送达失败'" type="warning" :icon="'Refresh'" @click="doRetry(curDel)">重新送达</el-button>
          <el-button v-else :icon="'Promotion'" @click="openSendDlg">补充送达渠道</el-button>
          <el-button :icon="'Tickets'" @click="doReceipt(curDel)">生成送达回证</el-button>
          <el-button type="primary" :icon="'Download'" @click="openExpDlg(curDel)">导出送达凭证</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 送达弹窗 ============ -->
    <el-dialog v-model="sendVisible" title="发起电子送达" width="560px">
      <el-alert type="info" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">电子送达为主渠道；建议同时勾选短信与邮件提醒，提高送达成功率</span>
        </template>
      </el-alert>
      <el-form label-width="94px">
        <el-form-item label="送达方式" required>
          <el-checkbox-group v-model="sendForm.methods">
            <el-checkbox v-for="m in (st?.deliveryMethods || [])" :key="m" :value="m" :label="m" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="送达说明">
          <div class="gen-tip">
            <el-icon><InfoFilled /></el-icon>
            系统将记录每个渠道的发送时间、接收状态与日志编号；受送达人在线签收后自动生成送达回证，
            未签收的自送达之日起 5 个工作日后视为送达。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendVisible = false">取消</el-button>
        <el-button type="primary" :loading="sending" @click="doSend">发起送达</el-button>
      </template>
    </el-dialog>

    <!-- ============ 导出弹窗 ============ -->
    <el-dialog v-model="expVisible" title="文书导出" width="520px">
      <el-form label-width="94px">
        <el-form-item label="导出格式" required>
          <el-radio-group v-model="expForm.format">
            <el-radio-button v-for="f in ['PDF', 'Word', 'OFD', 'ZIP打包(PDF)']" :key="f" :value="f" :label="f" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="电子印章">
          <el-switch v-model="expForm.withSeal" :disabled="expForm.format === 'Word'" />
          <span class="text-mini ml8">
            {{ expForm.format === 'Word' ? 'Word 可编辑格式不带电子印章' : '导出带电子印章的正式版文书' }}
          </span>
        </el-form-item>
        <el-form-item label="水印">
          <el-select v-model="expForm.watermark" style="width: 100%">
            <el-option v-for="w in ['无', '仅供内部使用', '副本', '存档', '禁止复制']" :key="w" :label="w" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item label="格式说明">
          <div class="gen-tip">
            <el-icon><InfoFilled /></el-icon>
            PDF 版式固定不可编辑用于正式送达与归档；Word 可编辑用于内部流转；
            OFD 为国产版式标准满足信创归档要求；ZIP 用于批量打包下载。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="expVisible = false">取消</el-button>
        <el-button type="primary" :loading="exporting" @click="doExport">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt8 { margin-top: 8px; }
.mt10 { margin-top: 10px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;
  @media (max-width: 1500px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.sd-tabs { margin-top: 12px; }

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; margin-bottom: 12px;
  &--2 { grid-template-columns: 1fr 1.2fr; }
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

/* ---------- 签章流程 ---------- */
.seal-card {
  background:
    radial-gradient(600px 120px at 50% 0, rgba(200, 22, 29, .05), transparent 70%),
    var(--zh-bg-card);
}

.flow-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
}

.fl {
  position: relative;
  padding: 10px 12px 12px; border-radius: var(--zh-radius); text-align: center;
  background: linear-gradient(180deg, #fff, var(--doc-paper-warm));
  border: 1px solid var(--doc-paper-edge);
  border-top: 2px solid var(--fc, var(--zh-primary));
  box-shadow: var(--zh-shadow-xs);
  transition: transform .24s, box-shadow .24s;

  &:hover { transform: translateY(-4px); box-shadow: var(--doc-shadow-paper); }

  &.is-info { --fc: var(--zh-info); }
  &.is-primary { --fc: var(--zh-primary); }
  &.is-warning { --fc: var(--zh-warning); }
  &.is-danger { --fc: var(--doc-vermilion); }
  &.is-org { background: linear-gradient(180deg, #fff, var(--doc-vermilion-bg)); }

  /* 签名/印章舞台 */
  &__stage {
    height: 74px;
    display: grid; place-items: center;
    margin-bottom: 4px;
  }

  &__no {
    width: 19px; height: 19px; margin: 0 auto 5px;
    border-radius: 50%; display: grid; place-items: center;
    background: var(--fc); color: #fff; font-size: 10px; font-weight: 700;
  }
  &__n { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__t { margin-top: 3px; font-size: 10px; color: var(--fc); font-weight: 700; }
  &__a {
    display: inline-flex; align-items: center; gap: 3px;
    margin-top: 5px; padding: 2px 7px; border-radius: 10px;
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    font-size: 9px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--fc); font-size: 10px; }
  }

  /* 级间箭头 */
  &__arrow {
    position: absolute; right: -11px; top: 46px; z-index: 2;
    width: 20px; height: 20px; border-radius: 50%;
    display: grid; place-items: center;
    background: #fff; border: 1px solid var(--zh-border);
    color: var(--zh-text-placeholder);
    :deep(.el-icon) { font-size: 11px; }
    @media (max-width: 1000px) { display: none; }
  }
}

/* 手写签名效果 */
.sig {
  position: relative;
  display: grid; place-items: center;

  &__ink {
    font-family: 'Kaiti SC', 'STKaiti', 楷体, var(--doc-font-song);
    font-size: 26px; font-weight: 700;
    color: #1c3f7a;
    transform: rotate(-6deg) skewX(-6deg);
    text-shadow: .5px .5px 0 rgba(28, 63, 122, .3);
    letter-spacing: 2px;
  }
  &__line {
    position: absolute; bottom: -3px; left: -6px; right: -6px;
    height: 1.5px;
    background: linear-gradient(90deg, transparent, #1c3f7a 18%, #1c3f7a 82%, transparent);
    opacity: .5;
  }
}

/* ---------- 签章进度点 ---------- */
.sp {
  display: flex; align-items: center; gap: 4px;
  &__d {
    width: 9px; height: 9px; border-radius: 50%;
    &.is-done { background: var(--zh-success); }
    &.is-wait { background: var(--zh-border-strong); }
  }
  &__t { margin-left: 4px; }
}

/* ---------- 送达方式 ---------- */
.mth-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  @media (max-width: 800px) { grid-template-columns: repeat(2, 1fr); }
}

.mth {
  padding: 9px 6px; border-radius: 6px; text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--mc, var(--zh-primary));

  &.is-primary { --mc: var(--zh-primary); }
  &.is-accent { --mc: var(--zh-accent); }
  &.is-success { --mc: var(--zh-success); }
  &.is-warning { --mc: var(--zh-warning); }
  &.is-purple { --mc: var(--zh-purple); }
  &.is-info { --mc: var(--zh-info); }
  &.is-danger { --mc: var(--zh-danger); }

  &__i { font-size: 16px; color: var(--mc); }
  &__n { margin-top: 3px; font-size: 10px; font-weight: 600; color: var(--zh-text-primary); }
}

/* ---------- 导出格式 ---------- */
.fmt-list { display: flex; flex-direction: column; gap: 7px; }

.fmt {
  display: flex; gap: 10px; align-items: center;
  padding: 8px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--mc, var(--zh-primary));

  &.is-danger { --mc: var(--zh-danger); }
  &.is-primary { --mc: var(--zh-primary); }
  &.is-warning { --mc: var(--zh-warning); }
  &.is-success { --mc: var(--zh-success); }

  &__n {
    flex-shrink: 0; width: 116px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--mc);
  }
  &__d { font-size: 11px; line-height: 1.7; color: var(--zh-text-secondary); }
}

/* ---------- 抽屉 ---------- */
.sd-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
}

/* ---------- 签章流程列表 ---------- */
.sf-list { display: flex; flex-direction: column; gap: 8px; }

.sf {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--sc, var(--zh-border-strong));

  &.is-done { --sc: var(--zh-success); background: color-mix(in srgb, var(--zh-success-light) 45%, #fff); }
  &.is-wait { --sc: var(--zh-warning); }

  &__no {
    width: 20px; height: 20px; flex-shrink: 0;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--sc); color: #fff; font-size: 10px; font-weight: 700;
  }
  &__b { flex: 1; min-width: 0; }
  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
    b { font-weight: 700; }
  }
  &__nm { color: var(--zh-text-regular); }
  &__d {
    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px;
    font-size: 10px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__seal {
    display: inline-flex; align-items: center; gap: 4px; margin-top: 5px;
    padding: 2px 7px; border-radius: 3px;
    background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger);
    font-size: 10px; color: var(--zh-danger); font-weight: 600;
  }
  &__f {
    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px;
    padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary);
  }

  /* 落章 / 签名标记区 */
  &__mark {
    flex-shrink: 0; width: 70px;
    display: grid; place-items: center;
  }
}

.sig--sm .sig__ink { font-size: 21px; }

/* ---------- 防篡改 ---------- */
.at-box {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-on { background: var(--zh-success-light); border-color: var(--zh-success); }

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-success); }
  }
  &__tip {
    display: flex; align-items: flex-start; gap: 5px; margin-top: 9px;
    padding-top: 8px; border-top: 1px dashed var(--zh-success);
    font-size: 10px; line-height: 1.75; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
  }
}

.hash {
  font-family: var(--zh-font-mono, monospace); font-size: 10px;
  word-break: break-all; color: var(--zh-text-secondary);
}

/* ---------- 渠道 ---------- */
.ch-list { display: flex; flex-direction: column; gap: 8px; }

.ch {
  padding: 9px 11px; border-radius: 6px;

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); :deep(.el-icon) { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); :deep(.el-icon) { color: var(--zh-danger); } }

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__d { margin-top: 5px; font-size: 11px; line-height: 1.7; color: var(--zh-text-regular); }
  &__l { margin-top: 3px; font-size: 10px; color: var(--zh-text-secondary); }
}

.dl-tl {
  padding-left: 4px;
  :deep(.el-timeline-item) { padding-bottom: 14px; }
  :deep(.el-timeline-item__timestamp) { font-size: 10px; }
  b { font-size: var(--zh-font-xs); color: var(--zh-text-primary); }
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

.gen-tip {
  display: flex; align-items: flex-start; gap: 5px;
  padding: 8px 10px; border-radius: 5px;
  background: var(--zh-info-light);
  font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary);
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}
</style>
