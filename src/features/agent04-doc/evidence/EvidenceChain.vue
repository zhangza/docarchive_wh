<script setup lang="ts">
import {
  getEvidenceStats, getEvidenceList, getEvidenceDetail, collectEvidence,
  getEvidenceChain, getTamperExports, doTamperExport, verifyEvidencePackage
} from '@/api/agent04-doc/docgen'

const msg = ElMessage

const st = ref<any>(null)
const activeTab = ref('manage')

async function loadStats() { st.value = await getEvidenceStats() }

/* ================= 证据管理 ================= */
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', evidenceKind: '', status: '', caseId: '', sealed: '', page: 1, pageSize: 15 })

const KIND_TONE: Record<string, string> = {
  书证: 'primary', 物证: 'accent', 视听资料: 'warning', 电子数据: 'purple',
  证人证言: 'success', 当事人陈述: 'info', 鉴定意见: 'danger', 勘验笔录: 'primary'
}

async function load() {
  loading.value = true
  try {
    const res: any = await getEvidenceList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', evidenceKind: '', status: '', caseId: '', sealed: '', page: 1 })
  load()
}

const drawer = ref(false)
const cur = ref<any>(null)
async function openDetail(row: any) {
  drawer.value = true
  cur.value = await getEvidenceDetail(row.evidenceId)
}

const collecting = ref(false)
const cVisible = ref(false)
const cForm = reactive({ caseId: '' })
const cRes = ref<any>(null)

function openCollect() {
  cForm.caseId = list.value[0]?.caseId || ''
  cRes.value = null
  cVisible.value = true
}

async function doCollect() {
  if (!cForm.caseId.trim()) { msg.warning('请填写案件编号'); return }
  collecting.value = true
  try {
    cRes.value = await collectEvidence(cForm)
    msg.success(`${cRes.value.message}（共归集 ${cRes.value.collected} 项）`)
    await Promise.all([loadStats(), load()])
  } finally { collecting.value = false }
}

/* ================= 证据链可视化 ================= */
const chainCaseId = ref('')
const chain = ref<any>(null)
const chainLoading = ref(false)

async function loadChain(caseId?: string) {
  const id = caseId || chainCaseId.value || list.value[0]?.caseId
  if (!id) return
  chainCaseId.value = id
  chainLoading.value = true
  try { chain.value = await getEvidenceChain(id) } finally { chainLoading.value = false }
}

function viewChain(row: any) {
  activeTab.value = 'chain'
  drawer.value = false
  loadChain(row.caseId)
}

/* ================= 防篡改导出 ================= */
const tpList = ref<any[]>([])
const tpTotal = ref(0)
const tpLoading = ref(false)
const tpQ = reactive({ page: 1, pageSize: 10 })

async function loadTp() {
  tpLoading.value = true
  try {
    const res: any = await getTamperExports(tpQ)
    tpList.value = res?.list || []
    tpTotal.value = res?.total || 0
  } finally { tpLoading.value = false }
}

const tpVisible = ref(false)
const tpRunning = ref(false)
const tpForm = reactive({ caseId: '', format: 'PDF（带证据专用章）', evidenceIds: [] as string[] })
const tpRes = ref<any>(null)

function openTp() {
  tpForm.caseId = chainCaseId.value || list.value[0]?.caseId || ''
  tpRes.value = null
  tpVisible.value = true
}

async function doTp() {
  if (!tpForm.caseId.trim()) { msg.warning('请填写案件编号'); return }
  tpRunning.value = true
  try {
    tpRes.value = await doTamperExport(tpForm)
    msg.success(tpRes.value.message)
    await Promise.all([loadStats(), loadTp()])
  } finally { tpRunning.value = false }
}

const verifying = ref(false)
async function doVerify(row: any) {
  verifying.value = true
  try {
    const res: any = await verifyEvidencePackage({ exportId: row.exportId })
    ElMessageBox.alert(
      `校验结论：${res.verifyStatus}\n哈希比对：${res.hashMatched ? '一致' : '不一致'}\n区块链存证：${res.blockchainMatched ? '一致' : '不一致'}\n\n${res.message}`,
      '证据包完整性校验', { type: res.verifyStatus === '校验通过' ? 'success' : 'error', confirmButtonText: '知道了' }
    )
  } finally { verifying.value = false }
}

/* ---------- 图表 ---------- */
/** 证据种类：旭日图（法定分类 → 固化方式两层） */
const kindOption = computed(() => {
  const d = st.value?.evidenceByKind || []
  const kinds = st.value?.evidenceKinds || []
  const cs = ['#1668dc', '#13c2c2', '#e8a30c', '#722ed1', '#12a150', '#5a7189', '#c8161d', '#3c88ff']
  return {
    tooltip: { formatter: (p: any) => `${p.name}<br/>${p.value} 项` },
    series: [{
      type: 'sunburst',
      center: ['50%', '48%'], radius: [16, '90%'],
      nodeClick: false,
      itemStyle: { borderColor: '#fff', borderWidth: 1.5 },
      label: { show: true, fontSize: 9, color: '#fff', minAngle: 14, rotate: 'tangential' },
      levels: [
        {},
        {
          r0: 16, r: '58%',
          label: { rotate: 'tangential', fontSize: 9, fontWeight: 700 },
          itemStyle: { borderWidth: 2 }
        },
        {
          r0: '58%', r: '88%',
          label: { position: 'outside', fontSize: 8, color: '#43516b', padding: 2, silent: false },
          itemStyle: { borderWidth: 1, opacity: .78 }
        }
      ],
      data: d.map((i: any, idx: number) => {
        const k = kinds.find((x: any) => x.kind === i.name)
        const fix = String(k?.fixMethod || '哈希固化').split(/[+、,，]/).filter(Boolean).slice(0, 2)
        return {
          name: i.name, value: i.value,
          itemStyle: { color: cs[idx % cs.length] },
          children: fix.map((f: string, fi: number) => ({
            name: f.trim(), value: Math.max(1, Math.round(i.value / fix.length)),
            itemStyle: { color: cs[idx % cs.length], opacity: fi ? .5 : .74 }
          }))
        }
      })
    }]
  }
})

/** 证据链关系图（案件 → 违规事实 → 证据） */
const chainOption = computed(() => {
  const c = chain.value
  if (!c || !c.nodes?.length) return {}
  return {
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === 'edge') return `${p.data.label?.formatter || '关联'}`
        const d = p.data
        return `<b>${d.name}</b><br/>类别：${d.category !== undefined ? c.categories[d.category].name : '—'}${d.desc ? '<br/>' + d.desc : ''}`
      }
    },
    legend: [{
      data: c.categories.map((x: any) => x.name),
      bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 }
    }],
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      categories: c.categories,
      force: { repulsion: 300, edgeLength: [64, 152], gravity: 0.055, friction: 0.14 },
      label: { show: true, position: 'right', fontSize: 10, formatter: '{b}', color: '#43516b' },
      edgeLabel: { show: false },
      lineStyle: { color: 'source', width: 1.2, curveness: 0.16, opacity: 0.6 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 2.6 }, label: { fontWeight: 700 } },
      /** 案件节点用光圈涟漪强调 */
      data: c.nodes.map((n: any) => ({
        id: n.id, name: n.name, category: n.category,
        symbolSize: n.symbolSize || 16, desc: n.desc,
        symbol: n.category === 0 ? 'circle' : undefined,
        itemStyle: n.category === 0
          ? { color: '#c8161d', shadowBlur: 18, shadowColor: 'rgba(200,22,29,.55)' }
          : n.category === 1
            ? { shadowBlur: 8, shadowColor: 'rgba(232,163,12,.4)' }
            : undefined
      })),
      links: c.links.map((l: any) => ({
        source: l.source, target: l.target,
        lineStyle: l.type === '相互印证'
          ? { type: 'dashed', color: '#12a150', width: 1.7, opacity: 0.85, curveness: 0.32 }
          : undefined,
        label: { formatter: l.type || '关联' }
      }))
    }]
  }
})

/** 事实 × 证据种类 支撑强度热力矩阵 */
const matrixOption = computed(() => {
  const c = chain.value
  if (!c?.facts?.length) return {}
  const kinds: string[] = Array.from(new Set(c.facts.flatMap((f: any) => f.kinds || []))) as string[]
  if (!kinds.length) return {}
  const data: any[] = []
  c.facts.forEach((f: any, fi: number) => {
    kinds.forEach((k, ki) => {
      const has = (f.kinds || []).includes(k)
      // 支撑强度：命中则按该事实证据数均摊，未命中为 0（空缺=证据链薄弱点）
      const v = has ? Math.max(1, Math.round((f.evidenceCount || 1) / (f.kinds?.length || 1))) : 0
      data.push([ki, fi, v])
    })
  })
  return {
    tooltip: {
      formatter: (p: any) =>
        `${c.facts[p.value[1]].fact}<br/>${kinds[p.value[0]]}：${p.value[2] ? p.value[2] + ' 项' : '无证据支撑'}`
    },
    grid: { left: 4, right: 12, top: 6, bottom: 52, containLabel: true },
    xAxis: {
      type: 'category', data: kinds, splitArea: { show: true },
      axisLabel: { fontSize: 9, color: '#43516b', interval: 0, rotate: 26 },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'category',
      data: c.facts.map((f: any, i: number) => `事实${i + 1}`),
      splitArea: { show: true },
      axisLabel: { fontSize: 9, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    visualMap: {
      min: 0, max: Math.max(2, ...data.map((d) => d[2])),
      calculable: false, orient: 'horizontal', left: 'center', bottom: 2,
      itemWidth: 10, itemHeight: 62,
      textStyle: { fontSize: 9, color: '#6b7a90' },
      inRange: { color: ['#f5f8fd', '#bcd8ff', '#5aa0f5', '#1668dc', '#0f3f8f'] }
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, fontSize: 9, fontWeight: 700, formatter: (p: any) => (p.value[2] ? p.value[2] : '—') },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.2)' } }
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'chain' && !chain.value) loadChain()
  else if (v === 'tamper' && !tpList.value.length) loadTp()
})

onMounted(async () => { await Promise.all([loadStats(), load()]) })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="证据全链管理" tag="M29"
      subtitle="八类法定证据归集固化 · 证据链关系可视化 · 防篡改固化导出与在线校验">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'FolderAdd'" @click="openCollect">证据归集</el-button>
        <el-button type="primary" :icon="'Lock'" @click="activeTab = 'tamper'; loadTp(); openTp()">防篡改导出</el-button>
      </template>
    </PageHeader>

    <!-- 指标 -->
    <div class="kpi-grid">
      <StatCard label="证据总数" :value="st?.evidenceTotal || 0" unit="项" icon="Folder" tone="primary" />
      <StatCard label="已固化" :value="st?.sealedCount || 0" unit="项" icon="Lock" tone="success" />
      <StatCard label="法定种类" :value="(st?.evidenceKinds || []).length" unit="类" icon="Collection" tone="accent" />
      <StatCard label="证据链" :value="st?.chainCount || 0" unit="条" icon="Share" tone="purple" />
      <StatCard label="防篡改导出" :value="st?.tamperExportTotal || 0" unit="次" icon="Download" tone="warning" />
    </div>

    <el-tabs v-model="activeTab" class="ev-tabs">
      <!-- ============ 证据管理 ============ -->
      <el-tab-pane label="证据管理" name="manage">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">证据种类分布</span>
            </div>
            <EChart :option="kindOption" height="248px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">八类法定证据与固化方式</span>
              <span class="section-title__desc">按《行政处罚法》法定证据种类分类归集，各类采用相应固化方式确保法律效力</span>
            </div>
            <el-table :data="st?.evidenceKinds || []" size="small" border stripe max-height="248">
              <el-table-column prop="no" label="序" width="48" align="center">
                <template #default="{ row }"><span class="num">{{ row.no }}</span></template>
              </el-table-column>
              <el-table-column prop="kind" label="法定种类" width="106">
                <template #default="{ row }">
                  <el-tag :type="(KIND_TONE[row.kind] === 'purple' || KIND_TONE[row.kind] === 'accent' ? 'primary' : KIND_TONE[row.kind]) as any"
                    size="small" effect="dark">{{ row.kind }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="sample" label="典型示例" min-width="200" show-overflow-tooltip />
              <el-table-column prop="fixMethod" label="固化方式" min-width="164" show-overflow-tooltip>
                <template #default="{ row }">
                  <span class="text-mini" style="color: var(--zh-primary)">{{ row.fixMethod }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">证据查询</span>
            <span class="section-title__desc">支持证据编号 / 名称 / 机构 / 案件号检索</span>
          </div>
          <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
            <el-form-item label="关键词">
              <el-input v-model="q.keyword" placeholder="证据编号/名称/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
            </el-form-item>
            <el-form-item label="法定种类">
              <el-select v-model="q.evidenceKind" placeholder="全部种类" clearable>
                <el-option v-for="k in (st?.evidenceKinds || [])" :key="k.kind" :label="k.kind" :value="k.kind" />
              </el-select>
            </el-form-item>
            <el-form-item label="证据状态">
              <el-select v-model="q.status" placeholder="全部状态" clearable>
                <el-option v-for="s in ['已固化', '已归档', '待固化', '已引用']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="案件编号">
              <el-input v-model="q.caseId" placeholder="如 CASE202608150003" clearable @keyup.enter="doQuery" />
            </el-form-item>
            <div class="query-form__actions">
              <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
            </div>
          </el-form>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'FolderAdd'" @click="openCollect">证据自动归集</el-button>
            <span class="text-mini">共 {{ total }} 项证据</span>
            <div class="table-toolbar__right">
              <el-button :icon="'Download'" @click="msg.success('证据清单已导出，正在下载')">导出清单</el-button>
            </div>
          </div>

          <el-table :data="list" size="small" border stripe v-loading="loading">
            <el-table-column prop="evidenceNo" label="证据编号" width="128">
              <template #default="{ row }">
                <span class="num text-link" @click="openDetail(row)">{{ row.evidenceNo }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="evidenceName" label="证据名称" min-width="196" show-overflow-tooltip />
            <el-table-column prop="evidenceKind" label="法定种类" width="106" align="center">
              <template #default="{ row }">
                <el-tag :type="(KIND_TONE[row.evidenceKind] === 'purple' || KIND_TONE[row.evidenceKind] === 'accent' ? 'primary' : KIND_TONE[row.evidenceKind]) as any"
                  size="small" effect="plain">{{ row.evidenceKind }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="orgName" label="涉及机构" min-width="160" show-overflow-tooltip />
            <el-table-column prop="proveMatter" label="证明事项" min-width="164" show-overflow-tooltip />
            <el-table-column prop="fixMethod" label="固化方式" width="140" show-overflow-tooltip>
              <template #default="{ row }"><span class="text-mini">{{ row.fixMethod }}</span></template>
            </el-table-column>
            <el-table-column label="固化" width="88" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.sealed" size="small" type="success" effect="dark">
                  <el-icon :size="10"><Lock /></el-icon> 已固化
                </el-tag>
                <el-tag v-else size="small" type="warning" effect="plain">待固化</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="pageCount" label="页数" width="66" align="right">
              <template #default="{ row }"><span class="num">{{ row.pageCount }}</span></template>
            </el-table-column>
            <el-table-column prop="collector" label="收集人" width="126" />
            <el-table-column prop="collectTime" label="收集时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.collectTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="124" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
                <el-button link type="success" :icon="'Share'" @click="viewChain(row)">证据链</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无符合条件的证据" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ total }} 条</span>
            <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
              :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 证据链可视化 ============ -->
      <el-tab-pane label="证据链可视化" name="chain">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">证据链关系图</span>
            <span class="section-title__desc">案件 → 违规事实 → 证据三级关联；虚线表示证据之间相互印证</span>
            <span class="section-title__extra">
              <el-input v-model="chainCaseId" placeholder="案件编号" size="small" style="width: 190px"
                @keyup.enter="loadChain()" />
              <el-button size="small" type="primary" :icon="'Search'" @click="loadChain()">加载</el-button>
            </span>
          </div>

          <template v-if="chain">
            <div class="ch-hero">
              <div class="ch-hero__t">
                {{ chain.caseName }}
                <el-tag size="small" effect="plain">{{ chain.caseId }}</el-tag>
              </div>
              <div class="ch-score" :class="chain.chainIntegrity.score >= 90 ? 'is-high' : chain.chainIntegrity.score >= 75 ? 'is-mid' : 'is-low'">
                <div class="ch-score__v num">{{ chain.chainIntegrity.score }}</div>
                <div class="ch-score__l">证据链完整性</div>
              </div>
              <div class="ch-flags">
                <div class="ch-flag" :class="chain.chainIntegrity.complete ? 'is-ok' : 'is-no'">
                  <el-icon><component :is="chain.chainIntegrity.complete ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                  {{ chain.chainIntegrity.complete ? '证据链完整' : '证据链存在缺口' }}
                </div>
                <div class="ch-flag" :class="chain.chainIntegrity.crossVerified ? 'is-ok' : 'is-no'">
                  <el-icon><component :is="chain.chainIntegrity.crossVerified ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                  {{ chain.chainIntegrity.crossVerified ? '证据相互印证' : '缺少相互印证' }}
                </div>
              </div>
            </div>

            <div class="chain-wrap">
              <EChart :option="chainOption" height="440px" v-loading="chainLoading" />
              <div class="chain-legend">
                <span><i class="cl-dot is-case" />案件</span>
                <span><i class="cl-dot is-fact" />违规事实</span>
                <span><i class="cl-dot is-ev" />证据</span>
                <span><i class="cl-line" />相互印证</span>
              </div>
            </div>

            <!-- 事实 × 证据种类 支撑强度矩阵 -->
            <div class="sub-title">事实 × 证据种类 支撑强度矩阵</div>
            <div class="mx-tip">
              <el-icon><InfoFilled /></el-icon>
              颜色越深表示该违规事实在该证据种类上的支撑越充分；<b>空白格（—）即为证据链缺口</b>，需补充取证
            </div>
            <EChart :option="matrixOption" height="212px" />

            <!-- 薄弱点 -->
            <template v-if="chain.chainIntegrity.weakPoints?.length">
              <div class="sub-title">证据链薄弱点提示</div>
              <div class="wp-list">
                <div v-for="(w, i) in chain.chainIntegrity.weakPoints" :key="i" class="wp">
                  <el-icon><WarningFilled /></el-icon>
                  <span>{{ w }}</span>
                </div>
              </div>
            </template>

            <div class="ci-conc">
              <el-icon><Opportunity /></el-icon>
              <div>
                <b>完整性结论</b>
                <div>{{ chain.chainIntegrity.conclusion }}</div>
              </div>
            </div>

            <!-- 违规事实与证据支撑 -->
            <div class="sub-title">违规事实与证据支撑情况</div>
            <el-table :data="chain.facts" size="small" border stripe>
              <el-table-column type="index" label="序" width="48" align="center" />
              <el-table-column prop="fact" label="违规事实" min-width="240" show-overflow-tooltip />
              <el-table-column prop="evidenceCount" label="支撑证据" width="98" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.evidenceCount >= 3 ? 'success' : row.evidenceCount >= 2 ? 'warning' : 'danger'" size="small" effect="dark">
                    {{ row.evidenceCount }} 项
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="kinds" label="证据种类" min-width="180">
                <template #default="{ row }">
                  <el-tag v-for="k in row.kinds" :key="k" size="small" effect="plain" class="mr4">{{ k }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="sufficient" label="是否充分" width="98" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.sufficient ? 'success' : 'danger'" size="small" effect="plain">
                    {{ row.sufficient ? '充分' : '不充分' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>

            <!-- 种类统计 -->
            <div class="sub-title">本案证据种类统计</div>
            <div class="ks-grid">
              <div v-for="k in chain.kindStat" :key="k.kind" class="ks"
                :class="`is-${KIND_TONE[k.kind] || 'primary'}`">
                <div class="ks__n">{{ k.kind }}</div>
                <div class="ks__v num">{{ k.count }}</div>
              </div>
            </div>
          </template>
          <EmptyState v-else text="请输入案件编号加载证据链" height="260px" />
        </div>
      </el-tab-pane>

      <!-- ============ 防篡改导出 ============ -->
      <el-tab-pane label="防篡改导出" name="tamper">
        <div class="section-card section-card--tight">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">防篡改保护机制</span>
            <span class="section-title__desc">证据专用章 + SHA-256 哈希 + 时间戳 + 区块链存证，四重保障证据法律效力</span>
          </div>
          <div class="tp-grid">
            <div class="tp is-danger">
              <el-icon class="tp__i"><Stamp /></el-icon>
              <div class="tp__n">证据专用章</div>
              <div class="tp__d">导出证据包自动加盖「芜湖市医疗保障局证据专用章」</div>
            </div>
            <div class="tp is-primary">
              <el-icon class="tp__i"><Key /></el-icon>
              <div class="tp__n">SHA-256 哈希</div>
              <div class="tp__d">对证据包整体计算哈希值，任何修改都会导致哈希变化</div>
            </div>
            <div class="tp is-warning">
              <el-icon class="tp__i"><Clock /></el-icon>
              <div class="tp__n">可信时间戳</div>
              <div class="tp__d">记录固化时点，证明证据在该时点已存在且未被修改</div>
            </div>
            <div class="tp is-success">
              <el-icon class="tp__i"><Link /></el-icon>
              <div class="tp__n">区块链存证</div>
              <div class="tp__d">哈希上链存证，可凭存证编号在线校验证据包完整性</div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="table-toolbar">
            <el-button type="primary" :icon="'Lock'" @click="openTp">新建防篡改导出</el-button>
            <span class="text-mini">共 {{ tpTotal }} 次导出</span>
          </div>

          <el-table :data="tpList" size="small" border stripe v-loading="tpLoading">
            <el-table-column prop="exportId" label="导出编号" width="140">
              <template #default="{ row }"><span class="num">{{ row.exportId }}</span></template>
            </el-table-column>
            <el-table-column prop="caseId" label="案件编号" width="164">
              <template #default="{ row }"><span class="num text-mini">{{ row.caseId }}</span></template>
            </el-table-column>
            <el-table-column prop="caseName" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="evidenceCount" label="证据项" width="82" align="right">
              <template #default="{ row }"><span class="num">{{ row.evidenceCount }}</span></template>
            </el-table-column>
            <el-table-column prop="format" label="导出格式" width="164" show-overflow-tooltip>
              <template #default="{ row }"><el-tag size="small" type="danger" effect="plain">{{ row.format }}</el-tag></template>
            </el-table-column>
            <el-table-column label="哈希值" min-width="180">
              <template #default="{ row }">
                <span class="hash" :title="row.packageHash">{{ row.packageHash.slice(0, 24) }}…</span>
              </template>
            </el-table-column>
            <el-table-column prop="blockchainId" label="区块链存证" width="164">
              <template #default="{ row }">
                <span class="num text-mini" style="color: var(--zh-success)">{{ row.blockchainId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="verifyStatus" label="校验状态" width="98" align="center">
              <template #default="{ row }">
                <el-tag :type="row.verifyStatus === '校验通过' ? 'success' : 'warning'" size="small" effect="dark">
                  {{ row.verifyStatus }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="exportTime" label="导出时间" width="148">
              <template #default="{ row }"><span class="num text-mini">{{ row.exportTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="96" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'Key'" :loading="verifying" @click="doVerify(row)">在线校验</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无防篡改导出记录" height="130px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ tpTotal }} 条</span>
            <el-pagination v-model:current-page="tpQ.page" v-model:page-size="tpQ.pageSize" :total="tpTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadTp" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 证据详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="660px" title="证据详情">
      <template v-if="cur">
        <div class="ev-hero">
          <div class="ev-hero__t">
            {{ cur.evidenceName }}
            <el-tag :type="(KIND_TONE[cur.evidenceKind] === 'purple' || KIND_TONE[cur.evidenceKind] === 'accent' ? 'primary' : KIND_TONE[cur.evidenceKind]) as any"
              size="small" effect="dark">{{ cur.evidenceKind }}</el-tag>
            <el-tag v-if="cur.sealed" size="small" type="success" effect="light">已固化</el-tag>
          </div>
          <div class="ev-hero__m">
            <span><el-icon><Folder /></el-icon>{{ cur.evidenceNo }}</span>
            <span><el-icon><Tickets /></el-icon>{{ cur.caseId }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ cur.orgName }}</span>
            <span><el-icon><Document /></el-icon>{{ cur.pageCount }} 页 · {{ cur.fileSize }}</span>
          </div>
        </div>

        <div class="sub-title">基本信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="证据编号">
            <span class="num">{{ cur.evidenceId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="证据状态">
            <el-tag :type="cur.status === '已固化' || cur.status === '已归档' ? 'success' : 'warning'" size="small" effect="dark">
              {{ cur.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="证据来源">{{ cur.source }}</el-descriptions-item>
          <el-descriptions-item label="收集人">{{ cur.collector }}</el-descriptions-item>
          <el-descriptions-item label="收集时间">
            <span class="num text-mini">{{ cur.collectTime }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="固化方式">{{ cur.fixMethod }}</el-descriptions-item>
          <el-descriptions-item label="证明事项" :span="2">{{ cur.proveMatter }}</el-descriptions-item>
        </el-descriptions>

        <div class="sub-title">固化与存证</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="文件哈希（SHA-256）">
            <span class="hash">{{ cur.fileHash }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="区块链存证编号">
            <span class="num" style="color: var(--zh-success); font-weight: 700">{{ cur.blockchainId }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="sub-title">关联违规事实</div>
        <div class="rel-list">
          <div v-for="(f, i) in cur.relatedFacts" :key="i" class="rel is-fact">
            <span class="rel__no num">{{ i + 1 }}</span>
            <span>{{ f }}</span>
          </div>
          <EmptyState v-if="!cur.relatedFacts?.length" text="暂无关联违规事实" height="80px" />
        </div>

        <div class="sub-title">被引用文书</div>
        <div class="rel-list">
          <div v-for="(d, i) in cur.relatedDocs" :key="i" class="rel is-doc">
            <el-icon><Document /></el-icon>
            <span class="num">{{ d }}</span>
          </div>
          <EmptyState v-if="!cur.relatedDocs?.length" text="尚未被文书引用" height="80px" />
        </div>

        <div class="dr-actions">
          <el-button :icon="'View'" @click="msg.info('正在打开证据原件预览')">预览原件</el-button>
          <el-button :icon="'Share'" @click="viewChain(cur)">查看证据链</el-button>
          <el-button type="primary" :icon="'Lock'" @click="tpForm.caseId = cur.caseId; tpVisible = true">防篡改导出</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 证据归集 ============ -->
    <el-dialog v-model="cVisible" title="证据自动归集" width="560px">
      <el-alert type="info" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">
            系统自动归集案件全流程产生的证据材料（检查记录、询问笔录、票据凭证、影像资料、系统数据等），
            按八类法定证据种类分类并计算哈希固化
          </span>
        </template>
      </el-alert>
      <el-form label-width="94px">
        <el-form-item label="案件编号" required>
          <el-input v-model="cForm.caseId" placeholder="如 CASE202608150003" />
        </el-form-item>
        <el-form-item v-if="cRes" label="归集结果">
          <div class="cr-box">
            <div class="cr-box__t">共归集 <b class="num">{{ cRes.collected }}</b> 项证据</div>
            <div class="cr-box__l">
              <el-tag v-for="k in cRes.byKind" :key="k.kind" size="small" effect="plain" class="mr4 mb4">
                {{ k.kind }} {{ k.count }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cVisible = false">关闭</el-button>
        <el-button type="primary" :loading="collecting" @click="doCollect">开始归集</el-button>
      </template>
    </el-dialog>

    <!-- ============ 防篡改导出 ============ -->
    <el-dialog v-model="tpVisible" title="证据包防篡改导出" width="620px">
      <el-form label-width="106px">
        <el-form-item label="案件编号" required>
          <el-input v-model="tpForm.caseId" placeholder="如 CASE202608150003" />
        </el-form-item>
        <el-form-item label="导出格式">
          <el-select v-model="tpForm.format" style="width: 100%">
            <el-option label="PDF（带证据专用章）" value="PDF（带证据专用章）" />
            <el-option label="ZIP（PDF + 原件 + 校验报告）" value="ZIP（PDF + 原件 + 校验报告）" />
            <el-option label="OFD（带证据专用章）" value="OFD（带证据专用章）" />
          </el-select>
        </el-form-item>
        <el-form-item label="保护措施">
          <div class="gen-tip">
            <el-icon><Lock /></el-icon>
            导出时自动加盖证据专用章、计算 SHA-256 哈希、附加可信时间戳并上链存证，
            同时生成校验报告；可凭存证编号在线校验证据包是否被篡改。
          </div>
        </el-form-item>

        <template v-if="tpRes">
          <el-form-item label="导出结果">
            <div class="tr-box">
              <div class="tr-box__h">
                <el-icon><CircleCheckFilled /></el-icon>
                <b>导出成功</b>
                <el-tag size="small" type="success" effect="dark">已上链存证</el-tag>
              </div>
              <el-descriptions :column="1" border size="small" class="mt8">
                <el-descriptions-item label="导出编号">
                  <span class="num">{{ tpRes.exportId }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="证据项数">
                  <span class="num">{{ tpRes.evidenceCount }} 项</span>
                </el-descriptions-item>
                <el-descriptions-item label="加盖印章">{{ tpRes.sealName }}</el-descriptions-item>
                <el-descriptions-item label="包哈希（SHA-256）">
                  <span class="hash">{{ tpRes.packageHash }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="区块链存证号">
                  <span class="num" style="color: var(--zh-success); font-weight: 700">{{ tpRes.blockchainId }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="在线校验地址">
                  <span class="num text-mini">{{ tpRes.queryUrl }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="校验报告编号">
                  <span class="num">{{ tpRes.verifyReportId }}</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="tpVisible = false">关闭</el-button>
        <el-button type="primary" :loading="tpRunning" :icon="'Lock'" @click="doTp">固化并导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb4 { margin-bottom: 4px; }
.mb12 { margin-bottom: 12px; }
.mt8 { margin-top: 8px; }
.mr4 { margin-right: 4px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
  @media (max-width: 1300px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.ev-tabs { margin-top: 12px; }

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.7fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

/* ---------- 证据链画布 ---------- */
.chain-wrap {
  position: relative;
  border-radius: var(--zh-radius);
  background:
    radial-gradient(520px 260px at 50% 45%, rgba(114, 46, 209, .05), transparent 72%),
    repeating-linear-gradient(0deg, transparent 0 27px, rgba(226, 232, 242, .38) 27px 28px),
    repeating-linear-gradient(90deg, transparent 0 27px, rgba(226, 232, 242, .38) 27px 28px);
  border: 1px solid var(--zh-border-light);
}

.chain-legend {
  position: absolute; top: 9px; right: 12px;
  display: flex; flex-direction: column; gap: 5px;
  padding: 7px 10px; border-radius: 6px;
  background: rgba(255, 255, 255, .88);
  border: 1px solid var(--zh-border-light);
  backdrop-filter: blur(4px);
  font-size: 10px; color: var(--zh-text-regular);
  span { display: inline-flex; align-items: center; gap: 5px; }
}

.cl-dot {
  width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
  &.is-case { background: var(--doc-vermilion); box-shadow: 0 0 6px rgba(200, 22, 29, .55); }
  &.is-fact { background: var(--zh-warning); }
  &.is-ev { background: var(--zh-primary); }
}
.cl-line {
  width: 16px; height: 0; flex-shrink: 0;
  border-top: 1.6px dashed var(--zh-success);
}

.mx-tip {
  display: flex; align-items: flex-start; gap: 5px;
  padding: 7px 10px; margin-bottom: 8px; border-radius: 5px;
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
  font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary);
  b { color: var(--doc-vermilion); }
  :deep(.el-icon) { color: var(--zh-primary); flex-shrink: 0; margin-top: 2px; }
}

/* ---------- 证据链头部 ---------- */
.ch-hero {
  display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center;
  padding: 11px 14px; margin-bottom: 12px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-purple-light), #fff);
  border: 1px solid var(--zh-purple);
  @media (max-width: 900px) { grid-template-columns: 1fr; }

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
}

.ch-score {
  text-align: center; padding: 4px 16px; border-radius: 6px;
  background: #fff; border: 1px solid var(--sc, var(--zh-primary));
  &.is-high { --sc: var(--zh-success); }
  &.is-mid { --sc: var(--zh-warning); }
  &.is-low { --sc: var(--zh-danger); }

  &__v { font-size: 26px; font-weight: 800; color: var(--sc); line-height: 1.2; }
  &__l { font-size: 10px; color: var(--zh-text-secondary); }
}

.ch-flags { display: flex; flex-direction: column; gap: 5px; }

.ch-flag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 4px; font-size: 10px; font-weight: 600;

  &.is-ok { background: var(--zh-success-light); color: var(--zh-success); :deep(.el-icon) { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); color: var(--zh-danger); :deep(.el-icon) { color: var(--zh-danger); } }
}

.wp-list { display: flex; flex-direction: column; gap: 6px; }

.wp {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 7px 10px; border-radius: 5px;
  background: var(--zh-warning-light); border: 1px solid var(--zh-warning);
  font-size: 11px; line-height: 1.7; color: var(--zh-text-regular);
  :deep(.el-icon) { color: var(--zh-warning); flex-shrink: 0; margin-top: 2px; }
}

.ci-conc {
  display: flex; align-items: flex-start; gap: 8px; margin-top: 11px;
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
  > :deep(.el-icon) { font-size: 17px; color: var(--zh-primary); flex-shrink: 0; margin-top: 1px; }

  b { font-size: var(--zh-font-xs); color: var(--zh-text-primary); }
  div > div { margin-top: 4px; font-size: 11px; line-height: 1.85; color: var(--zh-text-regular); }
}

.ks-grid {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px;
  @media (max-width: 1100px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
}

.ks {
  padding: 9px 6px; text-align: center; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--kc, var(--zh-primary));

  &.is-primary { --kc: var(--zh-primary); }
  &.is-accent { --kc: var(--zh-accent); }
  &.is-warning { --kc: var(--zh-warning); }
  &.is-purple { --kc: var(--zh-purple); }
  &.is-success { --kc: var(--zh-success); }
  &.is-info { --kc: var(--zh-info); }
  &.is-danger { --kc: var(--zh-danger); }

  &__n { font-size: 10px; color: var(--zh-text-secondary); font-weight: 600; }
  &__v { margin-top: 3px; font-size: 17px; font-weight: 800; color: var(--kc); }
}

/* ---------- 防篡改机制 ---------- */
.tp-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
}

.tp {
  padding: 11px 12px; border-radius: var(--zh-radius); text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--tc, var(--zh-primary));

  &.is-danger { --tc: var(--zh-danger); }
  &.is-primary { --tc: var(--zh-primary); }
  &.is-warning { --tc: var(--zh-warning); }
  &.is-success { --tc: var(--zh-success); }

  &__i { font-size: 20px; color: var(--tc); }
  &__n { margin-top: 5px; font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__d { margin-top: 4px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
}

/* ---------- 抽屉 ---------- */
.ev-hero {
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

.rel-list { display: flex; flex-direction: column; gap: 6px; }

.rel {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 10px; border-radius: 5px;
  font-size: 11px; line-height: 1.7; color: var(--zh-text-regular);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-fact { border-left: 2px solid var(--zh-danger); }
  &.is-doc { border-left: 2px solid var(--zh-primary); :deep(.el-icon) { color: var(--zh-primary); } }

  &__no {
    width: 16px; height: 16px; flex-shrink: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-danger); color: #fff; font-size: 9px; font-weight: 700;
  }
}

.hash {
  font-family: var(--zh-font-mono, monospace); font-size: 10px;
  word-break: break-all; color: var(--zh-text-secondary);
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

.cr-box {
  width: 100%; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__t { font-size: var(--zh-font-xs); color: var(--zh-text-regular); b { font-size: 15px; color: var(--zh-success); } }
  &__l { margin-top: 7px; }
}

.tr-box {
  width: 100%; padding: 9px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);

  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
    :deep(.el-icon) { color: var(--zh-success); }
  }
}
</style>
