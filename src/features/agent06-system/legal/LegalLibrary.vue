<script setup lang="ts">
import { getLegalStats, getLegalList, getLegalDetail, requestLegalReference, saveLegalDoc, setLegalDocStatus } from '@/api/agent06-system/system'
import { CHART_COLORS } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('library')
const st = ref<any>(null)

const LIB_TONE: Record<string, any> = { 政策法规库: 'primary', 典型案例库: 'warning', 指导文书库: 'success' }

async function loadStats() { st.value = await getLegalStats() }

/* ================= 三库维护 ================= */
const dList = ref<any[]>([])
const dTotal = ref(0)
const dLoading = ref(false)
const dQ = reactive({ keyword: '', library: '', level: '', status: '', page: 1, pageSize: 10 })

async function loadDocs() {
  dLoading.value = true
  try {
    const res: any = await getLegalList(dQ)
    dList.value = res?.list || []
    dTotal.value = res?.total || 0
  } finally { dLoading.value = false }
}

const dDrawer = ref(false)
const curDoc = ref<any>(null)
const dDetailLoading = ref(false)
async function openDoc(row: any) {
  dDrawer.value = true
  dDetailLoading.value = true
  try { curDoc.value = await getLegalDetail(row.docId) } finally { dDetailLoading.value = false }
}

/* ---------- 内容新增 / 编辑 / 失效 ---------- */
const dfVisible = ref(false)
const dfSaving = ref(false)
const dfEditing = ref<any>(null)
const df = reactive({ title: '', library: '政策法规库', level: '行政法规', docNo: '', issuingAuthority: '', effectiveDate: '', category: '基金监管', tags: '', summary: '' })

function openDocForm(row?: any) {
  dfEditing.value = row || null
  if (row) {
    Object.assign(df, {
      title: row.title, library: row.library, level: row.level, docNo: row.docNo,
      issuingAuthority: row.issuingAuthority, effectiveDate: row.effectiveDate,
      category: row.category || '基金监管', tags: (row.tags || []).join('、'), summary: row.summary || ''
    })
  } else {
    Object.assign(df, { title: '', library: '政策法规库', level: '行政法规', docNo: '', issuingAuthority: '', effectiveDate: '', category: '基金监管', tags: '', summary: '' })
  }
  dfVisible.value = true
}

async function doSaveDoc() {
  if (!df.title || !df.docNo) { msg.warning('请填写标题与文号'); return }
  dfSaving.value = true
  try {
    const res: any = await saveLegalDoc({ docId: dfEditing.value?.docId, ...df, tags: df.tags.split(/[、,，]/).filter(Boolean) })
    msg.success(res.message)
    if (dfEditing.value) {
      Object.assign(dfEditing.value, { title: df.title, library: df.library, level: df.level, docNo: df.docNo, issuingAuthority: df.issuingAuthority, effectiveDate: df.effectiveDate, summary: df.summary, tags: df.tags.split(/[、,，]/).filter(Boolean) })
    } else {
      dList.value.unshift({
        docId: res.docId, title: df.title, library: df.library, level: df.level, docNo: df.docNo,
        issuingAuthority: df.issuingAuthority, effectiveDate: df.effectiveDate || '2026-09-01', status: '有效',
        summary: df.summary, tags: df.tags.split(/[、,，]/).filter(Boolean), keyArticles: [], referenceCount: 0, version: 'v1.0',
        creator: '法制科 刘科长', createTime: '2026-09-01 09:00:00', lastReferencedTime: '—'
      })
      dTotal.value += 1
    }
    dfVisible.value = false
    dDrawer.value = false
  } finally { dfSaving.value = false }
}

async function doToggleDocStatus(row: any) {
  const target = row.status === '有效' ? '已失效' : '有效'
  if (target === '已失效') {
    await ElMessageBox.confirm(`失效后「${row.title}」将不再被智能引用推荐，确认标记失效？`, '失效确认', { type: 'warning', confirmButtonText: '标记失效', cancelButtonText: '取消' })
  }
  const res: any = await setLegalDocStatus({ docId: row.docId, status: target })
  msg.success(res.message)
  row.status = target
}

const libraryOption = computed(() => {
  const d = st.value?.byLibrary || []
  return {
    color: ['#1668dc', '#e8a30c', '#12a150'],
    tooltip: { trigger: 'item', formatter: '{b}: {c} 条（{d}%）' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['44%', '68%'], center: ['50%', '44%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.count }))
    }]
  }
})

const levelOption = computed(() => {
  const d = st.value?.byLevel || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: { type: 'category', data: d.map((i: any) => i.level).reverse(), axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 12,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: '#722ed1' },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, color: '#43516b' },
      data: d.map((i: any) => i.count).reverse()
    }]
  }
})

/* ================= 智能引用 ================= */
const refForm = reactive({
  violationType: '串换药品', orgType: '零售药店',
  caseSummary: '芜湖XX药店将生活用品、保健品串换为医保目录药品结算，涉及金额5.6万元'
})
const refResult = ref<any>(null)
const refLoading = ref(false)

async function doReference() {
  if (!refForm.caseSummary) { msg.warning('请填写案件事实摘要'); return }
  refLoading.value = true
  refResult.value = null
  try {
    refResult.value = await requestLegalReference(refForm)
    msg.success(`AI 引用完成（${refResult.value.aiModel} · 耗时 ${refResult.value.responseTime}）`)
  } finally { refLoading.value = false }
}

function doInsert(item: any, kind: string) {
  item.inserted = true
  msg.success(`已一键插入文书：${item.docTitle || item.caseName || item.templateName}（${kind}）`)
}

watch(activeTab, (v) => { if (v === 'reference') { /* 保持输入态 */ } })

onMounted(() => { loadStats(); loadDocs() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="政策法规案例库" tag="M43"
      subtitle="法规 / 案例 / 文书三库维护 · 法制科审核发布 · 文书处置时智能引用">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadDocs()">刷新</el-button>
        <el-button :icon="'MagicStick'" @click="activeTab = 'reference'">智能引用</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openDocForm()">新增内容</el-button>
      </template>
    </PageHeader>

    <!-- 指标卡 -->
    <div class="kpi-grid">
      <StatCard label="政策法规" :value="st?.lawTotal || 0" unit="部" icon="Notebook" tone="primary"
        desc="国家 / 省 / 市各级" />
      <StatCard label="典型案例" :value="st?.caseTotal || 0" unit="件" icon="Files" tone="warning"
        desc="已脱敏案例" />
      <StatCard label="指导文书" :value="st?.templateTotal || 0" unit="套" icon="Document" tone="success" />
      <StatCard label="本月引用次数" :value="st?.monthReference || 0" unit="次" icon="Link" tone="accent" />
      <StatCard label="引用插入率" :value="(st?.insertionRate || 0) * 100" unit="%" icon="CircleCheck" tone="success" :precision="0" />
    </div>

    <el-tabs v-model="activeTab">
      <!-- ================= 三库维护 ================= -->
      <el-tab-pane label="三库内容维护" name="library">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">三库构成</span>
            </div>
            <EChart :option="libraryOption" height="206px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">法规层级分布</span>
            </div>
            <EChart :option="levelOption" height="206px" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">库内容清单</span>
            <span class="section-title__desc">内容提交 → 法制科审核 → 发布，支持版本管理与失效标记</span>
          </div>
          <el-form class="query-form" :model="dQ" @submit.prevent>
            <el-input v-model="dQ.keyword" placeholder="标题 / 文号 / 摘要" clearable :prefix-icon="'Search'"
              style="width: 220px" @keyup.enter="dQ.page = 1; loadDocs()" />
            <el-select v-model="dQ.library" placeholder="所属库" clearable style="width: 130px">
              <el-option v-for="l in ['政策法规库', '典型案例库', '指导文书库']" :key="l" :label="l" :value="l" />
            </el-select>
            <el-select v-model="dQ.level" placeholder="层级" clearable style="width: 130px">
              <el-option v-for="l in ['法律', '行政法规', '部门规章', '规范性文件', '政策解读', '典型案例', '文书模板']" :key="l" :label="l" :value="l" />
            </el-select>
            <el-select v-model="dQ.status" placeholder="状态" clearable style="width: 96px">
              <el-option label="有效" value="有效" />
              <el-option label="已失效" value="已失效" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="dQ.page = 1; loadDocs()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(dQ, { keyword: '', library: '', level: '', status: '', page: 1 }); loadDocs()">重　置</el-button>
          </el-form>

          <el-table :data="dList" size="small" border stripe v-loading="dLoading">
            <el-table-column prop="docId" label="编号" width="140">
              <template #default="{ row }">
                <span class="num text-link" @click="openDoc(row)">{{ row.docId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
            <el-table-column label="所属库" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="LIB_TONE[row.library]" size="small" effect="plain">{{ row.library }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="层级" width="100" align="center" />
            <el-table-column prop="issuingAuthority" label="发文机关" width="140" show-overflow-tooltip />
            <el-table-column prop="effectiveDate" label="施行日期" width="104" align="center">
              <template #default="{ row }"><span class="num text-mini">{{ row.effectiveDate }}</span></template>
            </el-table-column>
            <el-table-column label="被引用" width="80" align="right">
              <template #default="{ row }"><span class="num">{{ row.referenceCount }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="76" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '有效' ? 'success' : 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDoc(row)">详情</el-button>
                <el-button link type="warning" :icon="'EditPen'" @click="openDocForm(row)">编辑</el-button>
                <el-button link :type="row.status === '有效' ? 'danger' : 'success'" :icon="row.status === '有效' ? 'Remove' : 'CircleCheck'" @click="doToggleDocStatus(row)">
                  {{ row.status === '有效' ? '失效' : '恢复' }}
                </el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无内容" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ dTotal }} 条</span>
            <el-pagination v-model:current-page="dQ.page" v-model:page-size="dQ.pageSize" :total="dTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadDocs" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 智能引用 ================= -->
      <el-tab-pane label="智能引用" name="reference">
        <div class="ref-grid">
          <div class="section-card">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">案件信息输入</span>
              <span class="section-title__desc">AI 分析案件事实，推荐适用法条 + 类似案例 + 文书模板</span>
            </div>
            <el-form label-width="92px">
              <el-form-item label="违规类型" required>
                <el-select v-model="refForm.violationType" style="width: 100%">
                  <el-option v-for="t in ['串换药品', '重复收费', '超量开药', '过度诊疗', '虚假诊疗', '分解住院', '无指征收费']" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="机构类型" required>
                <el-select v-model="refForm.orgType" style="width: 100%">
                  <el-option v-for="t in ['零售药店', '三级医院', '二级医院', '一级医院', '社区卫生服务中心', '诊所']" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="案件事实" required>
                <el-input v-model="refForm.caseSummary" type="textarea" :rows="4"
                  placeholder="输入案件事实摘要，AI 将进行语义匹配" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :icon="'MagicStick'" :loading="refLoading" @click="doReference">
                  {{ refLoading ? 'AI 正在分析匹配…' : 'AI 智能引用' }}
                </el-button>
                <span class="text-mini" style="margin-left: 8px">legal-reference-v2.1 · 约 1-3 秒</span>
              </el-form-item>
            </el-form>
            <el-alert type="info" :closable="false" show-icon>
              <template #title>
                <span class="text-mini">引用结果支持一键插入文书，插入行为全程留痕；引用效果可反馈以优化推荐模型。</span>
              </template>
            </el-alert>
          </div>

          <div v-if="refLoading" class="section-card ref-loading" v-loading="true"
            element-loading-text="AI 正在检索法规库 / 案例库 / 文书库…" />
        </div>

        <template v-if="refResult">
          <!-- 法条推荐 -->
          <div class="section-card">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">推荐法条</span>
              <span class="section-title__desc">按相关度排序 · 含适用说明与处罚建议</span>
            </div>
            <div v-for="law in refResult.recommendedLaws" :key="law.docId + law.articleNo" class="ref-item">
              <div class="ref-item__h">
                <span class="ref-item__rk num">{{ law.rank }}</span>
                <b class="ref-item__t">{{ law.docTitle }} · {{ law.articleNo }}</b>
                <span class="ref-item__score num">相关度 {{ law.relevanceScore }}</span>
                <el-button size="small" :type="law.inserted ? 'success' : 'primary'" :plain="law.inserted"
                  :icon="law.inserted ? 'CircleCheck' : 'DocumentAdd'" @click="doInsert(law, '法条')">
                  {{ law.inserted ? '已插入' : '插入文书' }}
                </el-button>
              </div>
              <div class="ref-item__sub">{{ law.articleTitle }}</div>
              <div class="ref-item__c">{{ law.articleContent }}</div>
              <div class="ref-item__row">
                <span><b>适用说明：</b>{{ law.applicability }}</span>
              </div>
              <div v-if="law.penaltyRange" class="ref-item__row">
                <span><b>处罚幅度：</b>{{ law.penaltyRange }}</span>
                <span v-if="law.recommendedPenalty"><b>建议：</b>{{ law.recommendedPenalty }}</span>
              </div>
            </div>
          </div>

          <!-- 案例与模板 -->
          <div class="ref-cols">
            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">类似案例</span>
                <span class="section-title__desc">已脱敏 · 含参考价值评估</span>
              </div>
              <div v-for="c in refResult.recommendedCases" :key="c.caseId" class="ref-item">
                <div class="ref-item__h">
                  <span class="ref-item__rk num">{{ c.rank }}</span>
                  <b class="ref-item__t">{{ c.caseName }}</b>
                  <span class="ref-item__score num">相似度 {{ c.similarity }}</span>
                  <el-button size="small" :type="c.inserted ? 'success' : 'primary'" :plain="c.inserted"
                    :icon="c.inserted ? 'CircleCheck' : 'DocumentAdd'" @click="doInsert(c, '案例')">
                    {{ c.inserted ? '已插入' : '插入' }}
                  </el-button>
                </div>
                <div class="ref-item__c">{{ c.summary }}</div>
                <div class="ref-item__row">
                  <span><b>处理结果：</b>{{ c.handlingResult }}</span>
                  <span><b>参考价值：</b>{{ c.referenceValue }}</span>
                </div>
                <div class="ref-item__row">
                  <span><b>与本案差异：</b>{{ c.differences }}</span>
                </div>
              </div>
            </div>

            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">文书模板</span>
                <span class="section-title__desc">含填写指引</span>
              </div>
              <div v-for="t in refResult.recommendedTemplates" :key="t.templateId" class="ref-item">
                <div class="ref-item__h">
                  <span class="ref-item__rk num">{{ t.rank }}</span>
                  <b class="ref-item__t">{{ t.templateName }}</b>
                  <span class="ref-item__score num">{{ t.relevanceScore }}</span>
                  <el-button size="small" :type="t.inserted ? 'success' : 'primary'" :plain="t.inserted"
                    :icon="t.inserted ? 'CircleCheck' : 'DocumentAdd'" @click="doInsert(t, '模板')">
                    {{ t.inserted ? '已插入' : '使用' }}
                  </el-button>
                </div>
                <div class="ref-item__c">{{ t.applicability }}</div>
              </div>
            </div>
          </div>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 内容详情抽屉 ============ -->
    <el-drawer v-model="dDrawer" size="640px" title="库内容详情">
      <template v-if="curDoc">
        <div v-loading="dDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curDoc.title }}
              <el-tag :type="LIB_TONE[curDoc.library]" size="small" effect="plain">{{ curDoc.library }}</el-tag>
              <el-tag :type="curDoc.status === '有效' ? 'success' : 'info'" size="small" effect="dark">{{ curDoc.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curDoc.docNo }}</span>
              <span><el-icon><OfficeBuilding /></el-icon>{{ curDoc.issuingAuthority }}</span>
              <span><el-icon><Calendar /></el-icon>施行 {{ curDoc.effectiveDate }}</span>
            </div>
            <div class="dt-hero__d">{{ curDoc.summary }}</div>
          </div>

          <template v-if="curDoc.keyArticles?.length">
            <div class="sub-title">关键条款</div>
            <div v-for="a in curDoc.keyArticles" :key="a.articleNo" class="art">
              <div class="art__h">
                <b>{{ a.articleNo }} · {{ a.title }}</b>
                <el-tag size="small" type="danger" effect="plain">{{ a.penaltyRange }}</el-tag>
              </div>
              <div class="art__s">
                适用场景：
                <el-tag v-for="s in a.scenarios" :key="s" size="small" effect="plain" class="mr4">{{ s }}</el-tag>
              </div>
            </div>
          </template>

          <div class="sub-title">标签</div>
          <el-tag v-for="t in curDoc.tags" :key="t" size="small" effect="plain" class="mr4">{{ t }}</el-tag>

          <div class="sub-title">维护信息</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="当前版本">{{ curDoc.version }}</el-descriptions-item>
            <el-descriptions-item label="被引用次数"><span class="num">{{ curDoc.referenceCount }}</span></el-descriptions-item>
            <el-descriptions-item label="最近引用" :span="2"><span class="num">{{ curDoc.lastReferencedTime }}</span></el-descriptions-item>
            <el-descriptions-item label="维护人">{{ curDoc.creator }}</el-descriptions-item>
            <el-descriptions-item label="入库时间"><span class="num">{{ curDoc.createTime }}</span></el-descriptions-item>
          </el-descriptions>

          <div class="dt-actions">
            <el-button type="primary" :icon="'EditPen'" @click="openDocForm(curDoc)">编辑内容</el-button>
            <el-button :type="curDoc.status === '有效' ? 'danger' : 'success'" plain :icon="curDoc.status === '有效' ? 'Remove' : 'CircleCheck'" @click="doToggleDocStatus(curDoc); dDrawer = false">
              {{ curDoc.status === '有效' ? '标记失效' : '恢复有效' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 内容新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="dfVisible" :title="dfEditing ? '编辑内容' : '新增库内容'" width="660px" top="6vh" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
        <template #title>
          <span class="text-mini">内容保存后进入「法制科审核 → 发布」流程，审核通过后进入正式库并被智能引用检索。</span>
        </template>
      </el-alert>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="16">
            <el-form-item label="标题" required>
              <el-input v-model="df.title" placeholder="如：医疗保障基金使用监督管理条例" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="所属库" required>
              <el-select v-model="df.library" style="width: 100%">
                <el-option v-for="l in ['政策法规库', '典型案例库', '指导文书库']" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="文号" required>
              <el-input v-model="df.docNo" placeholder="如：国务院令第735号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="层级" required>
              <el-select v-model="df.level" style="width: 100%">
                <el-option v-for="l in ['法律', '行政法规', '部门规章', '规范性文件', '政策解读', '典型案例', '文书模板']" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发文机关">
              <el-input v-model="df.issuingAuthority" placeholder="如：国务院" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="施行日期">
              <el-date-picker v-model="df.effectiveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务分类">
              <el-select v-model="df.category" style="width: 100%">
                <el-option v-for="c in ['基金监管', '行政处罚', '协议管理', '串换药品', '过度诊疗']" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标签">
              <el-input v-model="df.tags" placeholder="多个标签用顿号分隔" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="内容摘要">
          <el-input v-model="df.summary" type="textarea" :rows="3" placeholder="主要内容与适用说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dfVisible = false">取消</el-button>
        <el-button type="primary" :loading="dfSaving" @click="doSaveDoc">{{ dfEditing ? '保存并提交审核' : '提交法制科审核' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mr4 { margin-right: 4px; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
  @media (max-width: 1300px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.chart-grid {
  display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.ref-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.ref-loading { min-height: 300px; }

.ref-cols {
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.ref-item {
  padding: 11px 13px; border-radius: 8px; margin-bottom: 10px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__h {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    :deep(.el-button) { margin-left: auto; }
  }
  &__rk {
    width: 19px; height: 19px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 10px; font-weight: 800;
  }
  &__t { font-size: 12.5px; font-weight: 700; color: var(--zh-text-primary); }
  &__score { font-size: 10.5px; font-weight: 700; color: var(--zh-primary); }
  &__sub { margin-top: 4px; font-size: 10.5px; color: var(--zh-text-secondary); }
  &__c {
    margin-top: 7px; padding: 8px 10px; border-radius: 5px;
    background: #fff; border: 1px solid var(--zh-border-light);
    font-size: 11px; line-height: 1.9; color: var(--zh-text-regular); text-align: justify;
  }
  &__row {
    display: flex; gap: 18px; flex-wrap: wrap; margin-top: 7px;
    font-size: 10.5px; color: var(--zh-text-regular); line-height: 1.7;
    b { color: var(--zh-text-primary); }
  }
}

.art {
  padding: 9px 11px; border-radius: 6px; margin-bottom: 8px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__h {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    b { font-size: 12px; color: var(--zh-text-primary); }
  }
  &__s { margin-top: 6px; font-size: 10.5px; color: var(--zh-text-secondary); }
}

.sub-title {
  margin: 16px 0 10px;
  font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.dt-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-fs-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 14px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__d { margin-top: 8px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary); }
}

.dt-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
