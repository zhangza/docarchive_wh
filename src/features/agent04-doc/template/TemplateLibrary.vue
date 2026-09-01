<script setup lang="ts">
import {
  getTemplateStats, getTemplateList, getTemplateDetail,
  getTemplateEditable, saveTemplate, rollbackTemplate
} from '@/api/agent04-doc/docgen'
import { CHART_COLORS } from '@/utils/format'

const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const q = reactive({ keyword: '', categoryId: '', status: '', docType: '', page: 1, pageSize: 18 })

const CAT_TONE: Record<string, string> = {
  CAT01: 'primary', CAT02: 'accent', CAT03: 'warning', CAT04: 'danger', CAT05: 'purple', CAT06: 'info'
}
/** 分类 → 实际色值（供纸样卡 CSS 变量） */
const CAT_COLOR: Record<string, string> = {
  CAT01: 'var(--zh-primary)', CAT02: 'var(--zh-accent)', CAT03: 'var(--zh-warning)',
  CAT04: 'var(--doc-vermilion)', CAT05: 'var(--zh-purple)', CAT06: 'var(--zh-info)'
}
/** 视图模式：纸样墙 / 明细表 */
const viewMode = ref<'wall' | 'table'>('wall')

async function loadStats() { st.value = await getTemplateStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getTemplateList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', categoryId: '', status: '', docType: '', page: 1 })
  load()
}
function pickCategory(id: string) {
  q.categoryId = q.categoryId === id ? '' : id
  q.page = 1
  load()
}

/* ---------- 模板详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)
const activeTab = ref('preview')

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  activeTab.value = 'preview'
  try {
    cur.value = await getTemplateDetail(row.templateId)
    editable.value = await getTemplateEditable(row.templateId)
  } finally { detailLoading.value = false }
}

/* ---------- 模板维护（3.1.2） ---------- */
const editable = ref<any>(null)
const editVisible = ref(false)
const saving = ref(false)
const editForm = reactive<any>({
  header: {}, docNoFormat: {}, footer: {}, pageSetup: {}, changeNote: ''
})

function openEdit() {
  if (!editable.value) return
  const e = editable.value.editableElements
  Object.assign(editForm, {
    header: { ...e.header },
    docNoFormat: { ...e.docNoFormat },
    footer: { ...e.footer },
    pageSetup: { ...e.pageSetup },
    changeNote: ''
  })
  editVisible.value = true
}

async function doSave() {
  if (!editForm.changeNote.trim()) { msg.warning('请填写修改说明'); return }
  saving.value = true
  try {
    const nextVer = 'v' + (Number(String(cur.value.version).replace('v', '').split('.')[0]) + 0) + '.' +
      (Number(String(cur.value.version).split('.')[1] || 0) + 1)
    const res: any = await saveTemplate({ templateId: cur.value.templateId, newVersion: nextVer, ...editForm })
    msg.success(`${res?.message || '已提交审批'}（新版本 ${res?.newVersion}）`)
    editVisible.value = false
    editable.value = await getTemplateEditable(cur.value.templateId)
  } finally { saving.value = false }
}

async function doRollback(v: any) {
  await ElMessageBox.confirm(`确认将模板回滚至版本 ${v.version}？回滚后当前版本将作废。`, '版本回滚', {
    type: 'warning', confirmButtonText: '确认回滚', cancelButtonText: '取消'
  }).then(async () => {
    const res: any = await rollbackTemplate({ templateId: cur.value.templateId, version: v.version })
    msg.success(res?.message || '已回滚')
    cur.value = await getTemplateDetail(cur.value.templateId)
    await load()
  }).catch(() => undefined)
}

/* ---------- 图表 ---------- */
/** 单条堆叠"色带"：六大类占比一目了然（替代饼图） */
const catBandOption = computed(() => {
  const d = st.value?.categoryDist || []
  const cats = st.value?.categories || []
  const colorOf = (name: string) => {
    const c = cats.find((x: any) => x.categoryName === name)
    const map: Record<string, string> = {
      CAT01: '#1668dc', CAT02: '#13c2c2', CAT03: '#e8a30c',
      CAT04: '#c8161d', CAT05: '#722ed1', CAT06: '#5a7189'
    }
    return map[c?.categoryId] || '#1668dc'
  }
  return {
    tooltip: { trigger: 'item', formatter: '{a}<br/>{b}: {c} 个' },
    grid: { left: 2, right: 2, top: 8, bottom: 42, containLabel: false },
    xAxis: { type: 'value', show: false, max: d.reduce((s: number, i: any) => s + i.value, 0) },
    yAxis: { type: 'category', show: false, data: ['模板'] },
    legend: {
      bottom: 0, itemWidth: 9, itemHeight: 9, itemGap: 12,
      textStyle: { fontSize: 10, color: '#43516b' }, type: 'scroll'
    },
    series: d.map((i: any, idx: number) => ({
      name: i.name, type: 'bar', stack: 'all', barWidth: 34,
      itemStyle: {
        color: colorOf(i.name),
        borderRadius: idx === 0 ? [5, 0, 0, 5] : idx === d.length - 1 ? [0, 5, 5, 0] : 0,
        borderColor: '#fff', borderWidth: 1.5
      },
      label: { show: true, position: 'inside', formatter: '{c}', fontSize: 11, fontWeight: 700, color: '#fff' },
      data: [i.value]
    }))
  }
})

/** 引用热度：极坐标玫瑰（比横条更有张力） */
const useOption = computed(() => {
  const d = (st.value?.templateUseTop || []).slice(0, 8)
  const max = Math.max(1, ...d.map((i: any) => i.value))
  return {
    tooltip: { trigger: 'item', formatter: '{b}<br/>引用 {c} 次' },
    angleAxis: {
      max: max * 1.16, startAngle: 90,
      splitLine: { lineStyle: { color: '#eef1f7' } },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }
    },
    radiusAxis: {
      type: 'category', data: d.map((i: any) => i.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { fontSize: 9, color: '#6b7a90', margin: 4 },
      z: 10
    },
    polar: { center: ['50%', '50%'], radius: ['16%', '86%'] },
    series: [{
      type: 'bar', coordinateSystem: 'polar', roundCap: true, barWidth: 9,
      itemStyle: {
        color: (p: any) => {
          const cs = ['#1668dc', '#3c88ff', '#13c2c2', '#12a150', '#e8a30c', '#c8161d', '#722ed1', '#5a7189']
          return cs[p.dataIndex % cs.length]
        }
      },
      label: { show: true, position: 'end', formatter: '{c}', fontSize: 9, fontWeight: 700, color: '#43516b' },
      data: d.map((i: any) => i.value)
    }]
  }
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="文书模板库" tag="M25"
      subtitle="全套制式模板 · 六大类业务环节覆盖 · 模板维护与版本回滚">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Upload'" @click="msg.info('请选择 Word 模板文件导入')">导入 Word 模板</el-button>
      </template>
    </PageHeader>

    <!-- ============ 顶部：档案柜式指标条 + 分类色带 + 引用玫瑰 ============ -->
    <div class="top-grid">
      <div class="cabinet">
        <div class="cabinet__label">模板档案柜</div>
        <div class="drawer">
          <span class="drawer__pull" />
          <div class="drawer__v num">{{ st?.templateTotal || 0 }}</div>
          <div class="drawer__l">制式模板总数</div>
        </div>
        <div class="drawer is-ok">
          <span class="drawer__pull" />
          <div class="drawer__v num">{{ st?.templateEffective || 0 }}</div>
          <div class="drawer__l">现行有效</div>
        </div>
        <div class="drawer is-cat">
          <span class="drawer__pull" />
          <div class="drawer__v num">{{ (st?.categoryDist || []).length }}</div>
          <div class="drawer__l">业务分类</div>
        </div>
        <div class="cabinet__foot">
          <el-icon><Clock /></el-icon>最近维护 <b class="num">{{ st?.lastUpdate || '—' }}</b>
        </div>
      </div>

      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">六大业务环节模板构成</span>
          <span class="section-title__desc">单条色带按环节顺序铺开，宽度即模板数量</span>
        </div>
        <EChart :option="catBandOption" height="112px" />

        <!-- 分类导航（3.1.1）——档案标签页样式 -->
        <div class="tabs-row">
          <div v-for="c in (st?.categories || [])" :key="c.categoryId" class="ftab"
            :class="[`is-${CAT_TONE[c.categoryId] || 'primary'}`, { 'is-active': q.categoryId === c.categoryId }]"
            @click="pickCategory(c.categoryId)">
            <span class="ftab__id num">{{ c.categoryId.replace('CAT', '') }}</span>
            <span class="ftab__n">{{ c.categoryName }}</span>
            <span class="ftab__c num">{{ c.tpls.length }}</span>
          </div>
        </div>
      </div>

      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">模板引用热度</span>
        </div>
        <EChart :option="useOption" height="238px" />
      </div>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">模板查询</span>
        <span class="section-title__desc">支持模板编号 / 名称 / 文书类型检索</span>
        <span class="section-title__extra">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="wall">
              <el-icon><Grid /></el-icon> 纸样墙
            </el-radio-button>
            <el-radio-button value="table">
              <el-icon><List /></el-icon> 明细表
            </el-radio-button>
          </el-radio-group>
        </span>
      </div>
      <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="模板编号/名称/文书类型" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="模板分类">
          <el-select v-model="q.categoryId" placeholder="全部分类" clearable>
            <el-option v-for="c in (st?.categories || [])" :key="c.categoryId" :label="c.categoryName" :value="c.categoryId" />
          </el-select>
        </el-form-item>
        <el-form-item label="模板状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option label="现行有效" value="现行有效" />
            <el-option label="已废止" value="已废止" />
          </el-select>
        </el-form-item>
        <div class="query-form__actions">
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </div>
      </el-form>
    </div>

    <!-- ============ 纸样墙 ============ -->
    <div v-if="viewMode === 'wall'" class="section-card wall-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">制式文书纸样墙</span>
        <span class="section-title__desc">共 {{ total }} 份纸样，悬停掀页、点击查看要素与版本</span>
        <span class="section-title__extra">
          <el-button size="small" :icon="'Download'" @click="msg.success('模板清单已导出，正在下载')">导出清单</el-button>
        </span>
      </div>

      <div class="wall" v-loading="loading">
        <PaperCard v-for="t in list" :key="t.templateId"
          :name="t.templateName" :code="t.docTypeCode" :category="t.categoryName"
          :version="t.version" :pages="t.pageCount" :use-count="t.useCount"
          :effective="t.status === '现行有效'"
          :active="cur?.templateId === t.templateId"
          :tone="CAT_COLOR[t.categoryId] || 'var(--zh-primary)'"
          :lines="Math.min(9, 5 + (t.variableElements?.length || 4) % 5)"
          @click="openDetail(t)" />
        <EmptyState v-if="!list.length && !loading" text="暂无符合条件的模板" height="180px" />
      </div>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 份纸样</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[12, 18, 24, 36]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 明细表 ============ -->
    <div v-else class="section-card">
      <div class="table-toolbar">
        <span class="text-mini">共 {{ total }} 个模板</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Download'" @click="msg.success('模板清单已导出，正在下载')">导出清单</el-button>
        </div>
      </div>

      <el-table :data="list" size="small" border stripe v-loading="loading">
        <el-table-column prop="templateId" label="模板编号" width="98">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.templateId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="templateName" label="模板名称" min-width="176" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="业务分类" width="118" align="center">
          <template #default="{ row }">
            <el-tag :type="(CAT_TONE[row.categoryId] === 'purple' || CAT_TONE[row.categoryId] === 'accent' ? 'primary' : CAT_TONE[row.categoryId]) as any" size="small" effect="plain">
              {{ row.categoryName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="docTypeCode" label="代字" width="76" align="center">
          <template #default="{ row }"><el-tag size="small" effect="dark">{{ row.docTypeCode }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="76" align="center">
          <template #default="{ row }"><span class="num">{{ row.version }}</span></template>
        </el-table-column>
        <el-table-column prop="approvalLevel" label="审批层级" width="124" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.approvalLevel.includes('局长') ? 'danger' : row.approvalLevel.includes('处长') ? 'warning' : 'info'" effect="plain">
              {{ row.approvalLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="要素数" width="96" align="center">
          <template #default="{ row }">
            <span class="num text-mini">固定 {{ row.fixedElements.length }} / 可变 {{ row.variableElements.length }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pageCount" label="页数" width="66" align="right">
          <template #default="{ row }"><span class="num">{{ row.pageCount }}</span></template>
        </el-table-column>
        <el-table-column prop="useCount" label="引用次数" width="88" align="right">
          <template #default="{ row }"><span class="num">{{ row.useCount }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '现行有效' ? 'success' : 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveDate" label="生效日期" width="106">
          <template #default="{ row }"><span class="num text-mini">{{ row.effectiveDate }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无符合条件的模板" height="140px" /></template>
      </el-table>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 条</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 模板详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="700px" title="模板详情与维护">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <div class="tp-hero">
            <div class="tp-hero__t">
              {{ cur.templateName }}
              <el-tag size="small" effect="dark">{{ cur.docTypeCode }}</el-tag>
              <el-tag :type="cur.status === '现行有效' ? 'success' : 'info'" size="small" effect="light">{{ cur.status }}</el-tag>
            </div>
            <div class="tp-hero__m">
              <span><el-icon><Files /></el-icon>{{ cur.templateId }}</span>
              <span><el-icon><Grid /></el-icon>{{ cur.categoryName }}</span>
              <span><el-icon><Ticket /></el-icon>{{ cur.version }}</span>
              <span><el-icon><Stamp /></el-icon>{{ cur.approvalLevel }}</span>
              <span><el-icon><Document /></el-icon>{{ cur.pageCount }} 页</span>
            </div>
            <div class="tp-hero__s">适用范围：{{ cur.applicableScope }}</div>
          </div>

          <el-tabs v-model="activeTab" class="tp-tabs">
            <!-- 模板预览 -->
            <el-tab-pane label="模板预览" name="preview">
              <div class="tp-paper">
                <div class="tp-paper__org">芜湖市医疗保障局</div>
                <div class="tp-paper__name">{{ cur.templateName }}</div>
                <div class="tp-paper__no">芜医保{{ cur.docTypeCode }}〔2026〕〇〇〇号</div>
                <div class="tp-paper__line" />
                <div class="tp-paper__body">
                  <p class="tp-ph">【当事人名称】：</p>
                  <p v-for="(v, i) in cur.variableElements" :key="i" class="tp-ph tp-ph--indent">
                    【{{ v }}】
                  </p>
                </div>
                <div class="tp-paper__sign">
                  <div class="tp-paper__signbox">
                    <div class="tp-paper__org2">芜湖市医疗保障局</div>
                    <div class="tp-paper__date">二〇二六年〇月〇日</div>
                    <SealStamp class="tp-paper__seal" :size="88" :stamped="cur.status === '现行有效'" />
                  </div>
                </div>
                <div class="tp-paper__pf">第 1 页 共 {{ cur.pageCount }} 页</div>
              </div>
              <div class="tab-actions">
                <el-button :icon="'View'" @click="msg.info('正在打开模板样式预览')">在线预览</el-button>
                <el-button :icon="'Download'" @click="msg.success('模板已导出 Word，正在下载')">导出 Word</el-button>
              </div>
            </el-tab-pane>

            <!-- 模板要素 -->
            <el-tab-pane label="模板要素" name="elements">
              <div class="sub-title">固定要素（文头 / 文号 / 落款 / 日期 / 印章位置）</div>
              <div class="el-list">
                <div v-for="(f, i) in cur.fixedElements" :key="i" class="el-item is-fixed">
                  <el-icon><Lock /></el-icon>{{ f }}
                </div>
              </div>

              <div class="sub-title">可变要素（占位符，生成时自动填充）</div>
              <div class="el-list">
                <div v-for="(v, i) in cur.variableElements" :key="i" class="el-item is-var">
                  <el-icon><EditPen /></el-icon>【{{ v }}】
                </div>
              </div>

              <el-alert type="info" :closable="false" show-icon class="mt12">
                <template #title>
                  <span class="text-mini">
                    固定要素由模板锁定，不可在生成时修改；可变要素以占位符标记，由「文书智能生成」环节自动填充
                  </span>
                </template>
              </el-alert>
            </el-tab-pane>

            <!-- 模板维护 -->
            <el-tab-pane label="模板维护" name="maintain">
              <el-alert type="warning" :closable="false" show-icon class="mb12">
                <template #title>
                  <span class="text-mini">仅模板管理员可修改，修改需经审批方可生效，生效前不影响在用文书</span>
                </template>
              </el-alert>

              <template v-if="editable">
                <div class="sub-title">文头设置</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="单位名称">{{ editable.editableElements.header.orgName }}</el-descriptions-item>
                  <el-descriptions-item label="文书名称">{{ editable.editableElements.header.docName }}</el-descriptions-item>
                  <el-descriptions-item label="字体 / 字号">
                    {{ editable.editableElements.header.font }} · {{ editable.editableElements.header.fontSize }}
                  </el-descriptions-item>
                  <el-descriptions-item label="对齐 / 加粗">
                    {{ editable.editableElements.header.alignment }} · {{ editable.editableElements.header.bold ? '加粗' : '常规' }}
                  </el-descriptions-item>
                </el-descriptions>

                <div class="sub-title">文号格式</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="文号前缀">{{ editable.editableElements.docNoFormat.prefix }}</el-descriptions-item>
                  <el-descriptions-item label="年份格式">{{ editable.editableElements.docNoFormat.yearFormat }}</el-descriptions-item>
                  <el-descriptions-item label="流水号规则">{{ editable.editableElements.docNoFormat.serialNo }}</el-descriptions-item>
                  <el-descriptions-item label="示例">
                    <span class="num">{{ editable.editableElements.docNoFormat.example }}</span>
                  </el-descriptions-item>
                </el-descriptions>

                <div class="sub-title">落款与印章</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="落款单位">{{ editable.editableElements.footer.orgName }}</el-descriptions-item>
                  <el-descriptions-item label="日期格式">{{ editable.editableElements.footer.dateFormat }}</el-descriptions-item>
                  <el-descriptions-item label="签名位置">{{ editable.editableElements.footer.signaturePosition }}</el-descriptions-item>
                  <el-descriptions-item label="印章位置">{{ editable.editableElements.footer.sealPosition }}</el-descriptions-item>
                </el-descriptions>

                <div class="sub-title">页面设置</div>
                <el-descriptions :column="3" border size="small">
                  <el-descriptions-item label="纸张">{{ editable.editableElements.pageSetup.paperSize }}</el-descriptions-item>
                  <el-descriptions-item label="上边距">{{ editable.editableElements.pageSetup.marginTop }}</el-descriptions-item>
                  <el-descriptions-item label="下边距">{{ editable.editableElements.pageSetup.marginBottom }}</el-descriptions-item>
                  <el-descriptions-item label="左边距">{{ editable.editableElements.pageSetup.marginLeft }}</el-descriptions-item>
                  <el-descriptions-item label="右边距">{{ editable.editableElements.pageSetup.marginRight }}</el-descriptions-item>
                  <el-descriptions-item label="页脚">{{ editable.editableElements.pageSetup.footer }}</el-descriptions-item>
                </el-descriptions>

                <div class="tab-actions">
                  <el-button type="primary" :icon="'EditPen'" @click="openEdit">编辑模板并提交审批</el-button>
                </div>
              </template>
            </el-tab-pane>

            <!-- 版本历史 -->
            <el-tab-pane label="版本历史" name="version">
              <el-timeline class="ver-tl">
                <el-timeline-item v-for="(v, i) in cur.versionHistory" :key="i"
                  :type="v.status === '现行有效' ? 'success' : 'info'" :hollow="v.status !== '现行有效'"
                  :timestamp="v.date" size="normal">
                  <div class="ver__h">
                    <b class="num">{{ v.version }}</b>
                    <el-tag :type="v.status === '现行有效' ? 'success' : 'info'" size="small" effect="dark">{{ v.status }}</el-tag>
                    <el-button v-if="v.status === '已废止'" link type="warning" size="small"
                      :icon="'RefreshLeft'" @click="doRollback(v)">回滚至此版本</el-button>
                  </div>
                  <div class="ver__c">{{ v.change }}</div>
                  <div class="ver__f">审批人：{{ v.approver }}</div>
                </el-timeline-item>
              </el-timeline>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 模板编辑弹窗 ============ -->
    <el-dialog v-model="editVisible" title="模板维护" width="680px" top="6vh">
      <el-alert type="warning" :closable="false" show-icon class="mb12">
        <template #title><span class="text-mini">修改后生成新版本并提交审批，审批通过后生效；历史版本保留可回滚</span></template>
      </el-alert>

      <el-form label-width="94px">
        <div class="sub-title">文头</div>
        <div class="form-row">
          <el-form-item label="单位名称"><el-input v-model="editForm.header.orgName" /></el-form-item>
          <el-form-item label="文书名称"><el-input v-model="editForm.header.docName" /></el-form-item>
        </div>
        <div class="form-row">
          <el-form-item label="字体">
            <el-select v-model="editForm.header.font" style="width: 100%">
              <el-option v-for="f in ['宋体', '仿宋', '黑体', '楷体']" :key="f" :label="f" :value="f" />
            </el-select>
          </el-form-item>
          <el-form-item label="字号">
            <el-select v-model="editForm.header.fontSize" style="width: 100%">
              <el-option v-for="f in ['小标宋二号', '二号', '三号', '小三号']" :key="f" :label="f" :value="f" />
            </el-select>
          </el-form-item>
        </div>

        <div class="sub-title">文号格式</div>
        <div class="form-row">
          <el-form-item label="文号前缀"><el-input v-model="editForm.docNoFormat.prefix" /></el-form-item>
          <el-form-item label="年份格式">
            <el-select v-model="editForm.docNoFormat.yearFormat" style="width: 100%">
              <el-option label="〔YYYY〕" value="〔YYYY〕" />
              <el-option label="（YYYY）" value="（YYYY）" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="文号示例">
          <div class="no-preview num">
            {{ editForm.docNoFormat.prefix }}{{ String(editForm.docNoFormat.yearFormat || '').replace('YYYY', '2026') }}012号
          </div>
        </el-form-item>

        <div class="sub-title">落款与页面</div>
        <div class="form-row">
          <el-form-item label="日期格式">
            <el-select v-model="editForm.footer.dateFormat" style="width: 100%">
              <el-option label="YYYY年MM月DD日" value="YYYY年MM月DD日" />
              <el-option label="YYYY-MM-DD" value="YYYY-MM-DD" />
            </el-select>
          </el-form-item>
          <el-form-item label="纸张">
            <el-select v-model="editForm.pageSetup.paperSize" style="width: 100%">
              <el-option label="A4" value="A4" />
              <el-option label="A3" value="A3" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="印章位置"><el-input v-model="editForm.footer.sealPosition" /></el-form-item>

        <el-form-item label="修改说明" required>
          <el-input v-model="editForm.changeNote" type="textarea" :rows="3" placeholder="请说明本次修改内容与原因，作为版本变更记录" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doSave">保存并提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }

.top-grid {
  display: grid; grid-template-columns: 216px 1fr 300px; gap: 12px; align-items: start;
  @media (max-width: 1400px) { grid-template-columns: 216px 1fr; }
  @media (max-width: 1000px) { grid-template-columns: 1fr; }
}

/* ---------- 档案柜式指标 ---------- */
.cabinet {
  padding: 10px;
  border-radius: var(--zh-radius);
  background: linear-gradient(165deg, #2a3a52, #16233a);
  box-shadow: var(--zh-shadow), inset 0 1px 0 rgba(255, 255, 255, .1);

  &__label {
    font-family: var(--doc-font-song);
    font-size: 11px; font-weight: 700; letter-spacing: 3px;
    color: var(--doc-gold); text-align: center;
    padding-bottom: 8px; margin-bottom: 9px;
    border-bottom: 1px solid rgba(184, 137, 43, .3);
  }

  &__foot {
    display: flex; align-items: center; justify-content: center; gap: 4px;
    margin-top: 9px; padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, .08);
    font-size: 10px; color: rgba(232, 242, 255, .58);
    b { color: var(--doc-gold); font-weight: 700; }
    :deep(.el-icon) { color: var(--doc-gold); }
  }
}

/* 抽屉 */
.drawer {
  position: relative;
  padding: 9px 12px 9px 34px;
  border-radius: 5px;
  background: linear-gradient(150deg, #3a4d69, #253550);
  border: 1px solid rgba(255, 255, 255, .09);
  border-left: 3px solid var(--dw-c, var(--zh-primary-hover));
  transition: transform .22s, box-shadow .22s;
  + .drawer { margin-top: 8px; }

  &:hover { transform: translateX(4px); box-shadow: -3px 0 12px rgba(0, 0, 0, .25); }

  &.is-ok { --dw-c: #35d07f; }
  &.is-cat { --dw-c: var(--zh-accent); }

  /* 抽屉拉手 */
  &__pull {
    position: absolute; left: 11px; top: 50%;
    width: 13px; height: 4px; margin-top: -2px;
    border-radius: 2px;
    background: var(--doc-gold); opacity: .8;
    box-shadow: 0 1px 2px rgba(0, 0, 0, .4);
  }

  &__v {
    font-size: 22px; font-weight: 800; line-height: 1.1;
    color: #fff; text-shadow: 0 0 12px color-mix(in srgb, var(--dw-c) 55%, transparent);
  }
  &__l { margin-top: 1px; font-size: 10px; color: rgba(232, 242, 255, .62); }
}

/* ---------- 档案标签页（分类导航） ---------- */
.tabs-row {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 10px; padding-top: 10px;
  border-top: 1px dashed var(--zh-border-light);
}

.ftab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px 4px 5px;
  cursor: pointer;
  /* 档案吊牌形状：左圆右切角 */
  border-radius: 12px 4px 4px 12px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--ft-c, var(--zh-primary));
  transition: all .2s;

  &:hover { background: #fff; box-shadow: var(--zh-shadow-xs); transform: translateY(-2px); }
  &.is-active {
    background: color-mix(in srgb, var(--ft-c) 12%, #fff);
    border-color: var(--ft-c);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ft-c) 18%, transparent);
  }

  &.is-primary { --ft-c: var(--zh-primary); }
  &.is-accent { --ft-c: var(--zh-accent); }
  &.is-warning { --ft-c: var(--zh-warning); }
  &.is-danger { --ft-c: var(--doc-vermilion); }
  &.is-purple { --ft-c: var(--zh-purple); }
  &.is-info { --ft-c: var(--zh-info); }

  &__id {
    width: 16px; height: 16px; flex-shrink: 0;
    border-radius: 50%; display: grid; place-items: center;
    background: var(--ft-c); color: #fff;
    font-size: 9px; font-weight: 800;
  }
  &__n { font-size: 11px; font-weight: 600; color: var(--zh-text-primary); }
  &__c {
    font-size: 10px; font-weight: 700; color: var(--ft-c);
    padding: 0 5px; border-radius: 8px;
    background: color-mix(in srgb, var(--ft-c) 13%, transparent);
  }
}

/* ---------- 纸样墙 ---------- */
.wall-card {
  /* 墙面质感：细网格 + 顶部投影 */
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .022), transparent 90px),
    repeating-linear-gradient(0deg, transparent 0 23px, rgba(226, 232, 242, .5) 23px 24px),
    repeating-linear-gradient(90deg, transparent 0 23px, rgba(226, 232, 242, .5) 23px 24px),
    var(--zh-bg-card);
}

.wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: 20px 16px;
  padding: 6px 2px 4px;
  @media (max-width: 600px) { grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
}

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

/* ---------- 详情 ---------- */
.tp-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-purple-light), #fff);
  border: 1px solid var(--zh-purple);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-purple); }
  }
  &__s {
    margin-top: 8px; padding-top: 7px;
    border-top: 1px dashed rgba(114, 46, 209, .25);
    font-size: 11px; color: var(--zh-text-regular);
  }
}

.tp-tabs { margin-top: 12px; }

/* ---------- 模板预览纸 ---------- */
.tp-paper {
  position: relative;
  padding: 32px 36px 22px;
  background: var(--doc-paper);
  border: 1px solid var(--doc-paper-line);
  box-shadow: var(--doc-shadow-paper);
  font-family: var(--doc-font-fang);
  background-image: linear-gradient(90deg, transparent 0 22px, rgba(200, 22, 29, .05) 22px 23px, transparent 23px);

  &__org {
    text-align: center; font-size: 21px; font-weight: 700;
    color: var(--doc-vermilion); letter-spacing: 5px;
    font-family: var(--doc-font-song);
  }
  &__name {
    text-align: center; font-size: 19px; font-weight: 700; margin-top: 10px;
    font-family: var(--doc-font-song); color: var(--doc-ink);
  }
  &__no { text-align: center; font-size: 12px; color: var(--doc-ink-soft); margin-top: 5px; }
  &__line { height: 2px; background: var(--doc-vermilion); margin: 11px 0 18px; }
  &__body { min-height: 120px; }

  &__sign {
    display: flex; justify-content: flex-end;
    margin-top: 24px;
  }
  &__signbox {
    position: relative;
    text-align: right; font-size: 13px; line-height: 2.1; color: var(--doc-ink);
    padding-right: 8px;
  }
  &__org2 { font-family: var(--doc-font-song); font-weight: 600; }
  &__date { color: var(--doc-ink-soft); }
  /* 圆章下压落款日期 */
  &__seal {
    position: absolute; right: -14px; bottom: -18px;
    pointer-events: none;
  }

  &__pf {
    margin-top: 26px; padding-top: 8px;
    border-top: 1px dashed var(--doc-paper-edge);
    text-align: center; font-size: 10px; color: var(--doc-ink-faint);
  }
}

.tp-ph {
  margin: 6px 0; font-size: 13px; line-height: 2;
  color: var(--zh-primary); font-weight: 600;
  &--indent { text-indent: 2em; }
}

/* ---------- 要素 ---------- */
.el-list { display: flex; flex-wrap: wrap; gap: 7px; }

.el-item {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 5px; font-size: 11px;

  &.is-fixed {
    background: var(--zh-info-light); border: 1px solid var(--zh-border-strong);
    color: var(--zh-text-regular);
    :deep(.el-icon) { color: var(--zh-info); }
  }
  &.is-var {
    background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
    color: var(--zh-primary); font-weight: 600;
    :deep(.el-icon) { color: var(--zh-primary); }
  }
}

.tab-actions {
  display: flex; gap: 8px; margin-top: 15px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 版本 ---------- */
.ver-tl {
  padding-left: 4px;
  :deep(.el-timeline-item) { padding-bottom: 15px; }
  :deep(.el-timeline-item__timestamp) { font-size: 10px; }
}

.ver__h {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  font-size: var(--zh-font-xs); color: var(--zh-text-primary);
  b { font-size: 13px; }
}
.ver__c { margin-top: 4px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
.ver__f { margin-top: 3px; font-size: 10px; color: var(--zh-text-secondary); }

.no-preview {
  padding: 7px 11px; border-radius: 5px;
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
  font-size: 13px; font-weight: 700; color: var(--zh-primary);
}
</style>
