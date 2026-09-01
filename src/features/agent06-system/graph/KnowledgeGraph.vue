<script setup lang="ts">
import { getGraphStats, getEntityList, getEntityDetail, getGraphView, saveEntity, addRelation } from '@/api/agent06-system/system'
import { CHART_COLORS, CHART_GRID } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('entity')
const st = ref<any>(null)

const ENTITY_TONE: Record<string, string> = {
  医疗机构: '#1668dc', 医生: '#12a150', 参保人: '#e8a30c', 药品: '#722ed1',
  诊疗项目: '#13c2c2', 零售药店: '#d43878', 疑点线索: '#e5484d', 违规案件: '#d4380d', 政策法规: '#5a7189'
}

async function loadStats() { st.value = await getGraphStats() }

/* ================= 实体关系 ================= */
const eList = ref<any[]>([])
const eTotal = ref(0)
const eLoading = ref(false)
const eQ = reactive({ keyword: '', entityType: '', status: '', area: '', page: 1, pageSize: 10 })

async function loadEntities() {
  eLoading.value = true
  try {
    const res: any = await getEntityList(eQ)
    eList.value = res?.list || []
    eTotal.value = res?.total || 0
  } finally { eLoading.value = false }
}

const eDrawer = ref(false)
const curEntity = ref<any>(null)
const eDetailLoading = ref(false)
async function openEntity(row: any) {
  eDrawer.value = true
  eDetailLoading.value = true
  try { curEntity.value = await getEntityDetail(row.entityId) } finally { eDetailLoading.value = false }
}

/* ---------- 实体新增 / 编辑 ---------- */
const efVisible = ref(false)
const efSaving = ref(false)
const efEditing = ref<any>(null)
const ef = reactive({ entityName: '', entityType: '医疗机构', entityCode: '', area: '镜湖区', props: [{ key: '', value: '' }] as { key: string; value: string }[] })

function openEntityForm(row?: any) {
  efEditing.value = row || null
  if (row) {
    Object.assign(ef, {
      entityName: row.entityName, entityType: row.entityType, entityCode: row.entityCode, area: row.area,
      props: Object.entries(row.properties || {}).map(([key, value]) => ({ key, value: String(value) }))
    })
    if (!ef.props.length) ef.props = [{ key: '', value: '' }]
  } else {
    Object.assign(ef, { entityName: '', entityType: '医疗机构', entityCode: '', area: '镜湖区', props: [{ key: '', value: '' }] })
  }
  efVisible.value = true
}

function addProp() { ef.props.push({ key: '', value: '' }) }
function removeProp(i: number) { ef.props.splice(i, 1) }

async function doSaveEntity() {
  if (!ef.entityName || !ef.entityCode) { msg.warning('请填写实体名称与编码'); return }
  efSaving.value = true
  try {
    const res: any = await saveEntity({
      entityId: efEditing.value?.entityId, ...ef,
      properties: Object.fromEntries(ef.props.filter((p) => p.key).map((p) => [p.key, p.value]))
    })
    msg.success(res.message)
    if (efEditing.value) {
      Object.assign(efEditing.value, { entityName: ef.entityName, entityType: ef.entityType, entityCode: ef.entityCode, area: ef.area })
    } else {
      eList.value.unshift({
        entityId: res.entityId, entityName: ef.entityName, entityType: ef.entityType, entityCode: ef.entityCode,
        status: '有效', area: ef.area, relationCount: 0, violationCount: 0,
        properties: {}, updateTime: '2026-09-01 00:00:00'
      })
      eTotal.value += 1
    }
    efVisible.value = false
  } finally { efSaving.value = false }
}

/* ---------- 新增关系 ---------- */
const relVisible = ref(false)
const relSaving = ref(false)
const relForm = reactive({ relationType: '就诊', targetEntityName: '', properties: '' })
function openRelForm() {
  Object.assign(relForm, { relationType: '就诊', targetEntityName: '', properties: '' })
  relVisible.value = true
}
async function doAddRelation() {
  if (!relForm.targetEntityName) { msg.warning('请填写目标实体'); return }
  relSaving.value = true
  try {
    const res: any = await addRelation({ sourceId: curEntity.value.entityId, ...relForm })
    msg.success(res.message)
    curEntity.value.relations = curEntity.value.relations || []
    curEntity.value.relations.unshift({ relationId: res.relationId, relationType: relForm.relationType, targetEntityName: relForm.targetEntityName, properties: relForm.properties || '—', status: '有效' })
    curEntity.value.relationCount = (curEntity.value.relationCount || 0) + 1
    relVisible.value = false
  } finally { relSaving.value = false }
}

/* ================= 图谱浏览 ================= */
const view = ref<any>(null)
const viewLoading = ref(false)
const hops = ref(2)
const activePath = ref(false)

async function loadView() {
  viewLoading.value = true
  try { view.value = await getGraphView() } finally { viewLoading.value = false }
}

const graphOption = computed(() => {
  const v = view.value
  if (!v) return {}
  return {
    tooltip: {
      formatter: (p: any) => p.dataType === 'edge'
        ? `${p.data.source} —${p.data.name}→ ${p.data.target}<br/>权重 ${p.data.value}`
        : `${p.data.name}<br/>${p.data.type} · 度数 ${p.data.value}`
    },
    legend: { data: Object.keys(ENTITY_TONE).slice(0, 8), bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      categories: Object.entries(ENTITY_TONE).map(([name, color]) => ({ name, itemStyle: { color } })),
      force: { repulsion: 260, edgeLength: [50, 110], gravity: 0.08 },
      label: { show: true, position: 'bottom', fontSize: 9.5, color: '#43516b' },
      edgeLabel: { show: true, fontSize: 8.5, color: '#9aa7b8', formatter: (p: any) => p.data.name },
      lineStyle: { color: '#b8c6da', width: 1.2, curveness: 0.12 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 2.5 } },
      data: v.nodes.map((n: any) => ({ ...n, category: n.type })),
      links: v.edges
    }]
  }
})

const entityTypeOption = computed(() => {
  const d = st.value?.entityTypes || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value.toLocaleString()} 个（${p.percent}%）` },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 }, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['42%', '66%'], center: ['50%', '44%'],
      label: { show: false },
      data: d.map((i: any) => ({ name: i.type, value: i.count }))
    }]
  }
})

const relationTypeOption = computed(() => {
  const d = st.value?.relationTypes || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 60, bottom: 24 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000) + '万' } },
    yAxis: { type: 'category', data: d.map((i: any) => i.type).reverse(), axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: '#13c2c2' },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700, color: '#43516b', formatter: (p: any) => (p.value / 10000).toFixed(1) + '万' },
      data: d.map((i: any) => i.count).reverse()
    }]
  }
})

watch(activeTab, (v) => {
  if (v === 'view' && !view.value) loadView()
})

onMounted(() => { loadStats(); loadEntities() })

function fmtWan(v: number) {
  return v >= 10000 ? (v / 10000).toFixed(1) + ' 万' : String(v)
}
function exportGraph() { msg.success('子图已导出（PNG图片 / JSON数据 / GraphML格式）') }
</script>

<template>
  <div class="zh-page">
    <PageHeader title="知识图谱管理" tag="M42"
      subtitle="实体关系维护 · 可视化图谱浏览 · 路径分析与异常社区识别">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); loadEntities()">刷新</el-button>
        <el-button :icon="'Download'" @click="exportGraph">导出子图</el-button>
        <el-button type="primary" :icon="'Plus'" @click="openEntityForm()">新增实体</el-button>
      </template>
    </PageHeader>

    <!-- 指标卡 -->
    <div class="kpi-grid">
      <StatCard label="实体总数" :value="st?.entityTotal || 0" unit="个" icon="Coin" tone="primary"
        :desc="`今日新增 ${st?.todayNewEntities || 0}`" />
      <StatCard label="关系总数" :value="st?.relationTotal || 0" unit="条" icon="Share" tone="accent"
        :desc="`今日新增 ${st?.todayNewRelations || 0}`" />
      <StatCard label="实体类型" :value="st?.entityTypes?.length || 0" unit="类" icon="Files" tone="purple" />
      <StatCard label="关系类型" :value="st?.relationTypes?.length || 0" unit="类" icon="Connection" tone="success" />
      <StatCard label="图谱质量分" :value="st?.qualityScore || 0" unit="分" icon="CircleCheck" tone="success"
        desc="孤立/重复/异常关系每日检查" />
    </div>

    <el-tabs v-model="activeTab">
      <!-- ================= 实体关系管理 ================= -->
      <el-tab-pane label="实体关系管理" name="entity">
        <div class="chart-grid">
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">实体类型分布</span>
            </div>
            <EChart :option="entityTypeOption" height="216px" />
          </div>
          <div class="section-card section-card--tight">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">关系类型分布</span>
            </div>
            <EChart :option="relationTypeOption" height="216px" />
          </div>
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">实体清单</span>
            <span class="section-title__desc">参保人 / 医生 / 机构 / 药品 / 线索 / 案件 / 法规，支持合并、注销与批量导入</span>
          </div>
          <el-form class="query-form" :model="eQ" @submit.prevent>
            <el-input v-model="eQ.keyword" placeholder="实体名称 / 编码 / ID" clearable :prefix-icon="'Search'"
              style="width: 220px" @keyup.enter="eQ.page = 1; loadEntities()" />
            <el-select v-model="eQ.entityType" placeholder="实体类型" clearable style="width: 130px">
              <el-option v-for="t in Object.keys(ENTITY_TONE)" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="eQ.area" placeholder="所属区域" clearable style="width: 116px">
              <el-option v-for="a in ['市本级', '镜湖区', '弋江区', '鸠江区', '湾沚区', '全市']" :key="a" :label="a" :value="a" />
            </el-select>
            <el-select v-model="eQ.status" placeholder="状态" clearable style="width: 96px">
              <el-option label="有效" value="有效" />
              <el-option label="已注销" value="已注销" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="eQ.page = 1; loadEntities()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(eQ, { keyword: '', entityType: '', status: '', area: '', page: 1 }); loadEntities()">重　置</el-button>
          </el-form>

          <el-table :data="eList" size="small" border stripe v-loading="eLoading">
            <el-table-column prop="entityId" label="实体ID" width="150">
              <template #default="{ row }">
                <span class="num text-link" @click="openEntity(row)">{{ row.entityId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="entityName" label="实体名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="类型" width="100" align="center">
              <template #default="{ row }">
                <span class="et" :style="{ '--etc': ENTITY_TONE[row.entityType] || '#5a7189' }">{{ row.entityType }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="entityCode" label="实体编码" width="170">
              <template #default="{ row }"><span class="num text-mini">{{ row.entityCode }}</span></template>
            </el-table-column>
            <el-table-column prop="area" label="区域" width="88" align="center" />
            <el-table-column prop="relationCount" label="关系数" width="90" align="right">
              <template #default="{ row }"><span class="num">{{ row.relationCount.toLocaleString() }}</span></template>
            </el-table-column>
            <el-table-column label="违规关联" width="86" align="right">
              <template #default="{ row }">
                <span class="num" :style="{ color: row.violationCount > 0 ? 'var(--zh-danger)' : 'var(--zh-text-placeholder)' }">
                  {{ row.violationCount }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="76" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '有效' ? 'success' : 'info'" size="small" effect="plain">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="128" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openEntity(row)">详情</el-button>
                <el-button link type="warning" :icon="'EditPen'" @click="openEntityForm(row)">编辑</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无实体" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ eTotal }} 条</span>
            <el-pagination v-model:current-page="eQ.page" v-model:page-size="eQ.pageSize" :total="eTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadEntities" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 图谱浏览维护 ================= -->
      <el-tab-pane label="图谱浏览维护" name="view">
        <div v-loading="viewLoading">
          <template v-if="view">
            <div class="view-grid">
              <!-- 图谱画布 -->
              <div class="section-card view-main">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">{{ view.viewName }}</span>
                  <span class="section-title__desc">拖拽缩放 · 点击节点联动 · 边标注为关系类型</span>
                  <span class="section-title__extra">
                    <el-radio-group v-model="hops" size="small" @change="loadView">
                      <el-radio-button :label="1">一跳</el-radio-button>
                      <el-radio-button :label="2">二跳</el-radio-button>
                      <el-radio-button :label="3">多跳</el-radio-button>
                    </el-radio-group>
                  </span>
                </div>
                <EChart :option="graphOption" height="430px" />
              </div>

              <!-- 右侧分析面板 -->
              <div class="view-side">
                <div class="section-card section-card--tight">
                  <div class="section-title">
                    <span class="section-title__dot" />
                    <span class="section-title__text">图谱统计</span>
                  </div>
                  <div class="gv-kpi">
                    <div class="gv-kpi__c"><b class="num">{{ view.statistics.entityCount }}</b><span>实体</span></div>
                    <div class="gv-kpi__c"><b class="num">{{ view.statistics.relationCount }}</b><span>关系</span></div>
                    <div class="gv-kpi__c"><b class="num">{{ view.statistics.avgDegree }}</b><span>平均度数</span></div>
                    <div class="gv-kpi__c"><b class="num">{{ view.statistics.maxDegree }}</b><span>最大度数</span></div>
                  </div>
                </div>

                <div class="section-card section-card--tight">
                  <div class="section-title">
                    <span class="section-title__dot" />
                    <span class="section-title__text">路径分析</span>
                    <span class="section-title__extra">
                      <el-switch v-model="activePath" size="small" active-text="显示" />
                    </span>
                  </div>
                  <template v-if="activePath">
                    <div class="path">
                      <template v-for="(p, i) in view.pathAnalysis.shortestPath" :key="i">
                        <span class="path__n" :class="{ 'is-rel': p.startsWith('—') }">{{ p }}</span>
                      </template>
                    </div>
                    <div class="text-mini" style="margin-top: 6px">
                      最短路径 {{ view.pathAnalysis.pathLength }} 步 · 全部路径 {{ view.pathAnalysis.allPathsCount }} 条
                    </div>
                    <el-alert v-for="(a, i) in view.pathAnalysis.abnormalPaths" :key="i" type="warning" :closable="false" show-icon style="margin-top: 8px">
                      <template #title><span class="text-mini">{{ a.abnormality }}</span></template>
                      <div class="text-mini">路径：{{ a.path }} · 风险等级：{{ a.riskLevel }}</div>
                    </el-alert>
                  </template>
                  <div v-else class="text-mini" style="padding: 8px 0">
                    选择两个实体后可分析最短路径 / 全部路径与异常路径
                  </div>
                </div>

                <div class="section-card section-card--tight">
                  <div class="section-title">
                    <span class="section-title__dot" />
                    <span class="section-title__text">异常社区发现</span>
                  </div>
                  <div v-for="c in view.communities" :key="c.communityId" class="comm"
                    :class="c.riskLevel === '高' ? 'is-high' : 'is-low'">
                    <div class="comm__h">
                      <b>{{ c.name }}</b>
                      <el-tag :type="c.riskLevel === '高' ? 'danger' : 'warning'" size="small" effect="dark">{{ c.riskLevel }}风险</el-tag>
                    </div>
                    <div class="comm__m text-mini">
                      实体 {{ c.entityCount }} · 密度 {{ c.density }} · {{ c.abnormality }}
                    </div>
                  </div>
                </div>

                <div class="section-card section-card--tight">
                  <div class="section-title">
                    <span class="section-title__dot" />
                    <span class="section-title__text">图谱质量检查</span>
                    <span class="section-title__desc">{{ view.graphQuality.lastCheckTime }}</span>
                  </div>
                  <div class="gv-kpi">
                    <div class="gv-kpi__c"><b class="num">{{ view.graphQuality.isolatedEntities }}</b><span>孤立实体</span></div>
                    <div class="gv-kpi__c"><b class="num">{{ view.graphQuality.duplicateEntities }}</b><span>重复实体</span></div>
                    <div class="gv-kpi__c"><b class="num">{{ view.graphQuality.abnormalRelations }}</b><span>异常关系</span></div>
                    <div class="gv-kpi__c"><b class="num" style="color: var(--zh-success)">{{ view.graphQuality.qualityScore }}</b><span>质量分</span></div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 实体详情抽屉 ============ -->
    <el-drawer v-model="eDrawer" size="600px" title="实体详情与关系">
      <template v-if="curEntity">
        <div v-loading="eDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curEntity.entityName }}
              <span class="et" :style="{ '--etc': ENTITY_TONE[curEntity.entityType] || '#5a7189' }">{{ curEntity.entityType }}</span>
              <el-tag :type="curEntity.status === '有效' ? 'success' : 'info'" size="small" effect="plain">{{ curEntity.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curEntity.entityId }}</span>
              <span><el-icon><PriceTag /></el-icon>{{ curEntity.entityCode }}</span>
              <span><el-icon><Location /></el-icon>{{ curEntity.area }}</span>
            </div>
          </div>

          <div class="sub-title">实体属性</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item v-for="(v, k) in curEntity.properties" :key="k" :label="String(k)">
              {{ Array.isArray(v) ? v.join('、') : v }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="sub-title">
            关联关系（{{ curEntity.relationCount?.toLocaleString() }} 条）
            <el-button link type="primary" size="small" :icon="'Plus'" style="margin-left: 8px" @click="openRelForm">新增关系</el-button>
          </div>
          <el-table :data="curEntity.relations || []" size="small" border stripe>
            <el-table-column prop="relationId" label="关系ID" width="100">
              <template #default="{ row }"><span class="num text-mini">{{ row.relationId }}</span></template>
            </el-table-column>
            <el-table-column prop="relationType" label="关系" width="70" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.relationType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="targetEntityName" label="目标实体" min-width="140" show-overflow-tooltip />
            <el-table-column prop="properties" label="关系属性" min-width="190" show-overflow-tooltip />
          </el-table>

          <div class="sub-title">数据来源</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="来源系统">{{ curEntity.dataSource }}</el-descriptions-item>
            <el-descriptions-item label="最近同步"><span class="num">{{ curEntity.lastSyncTime }}</span></el-descriptions-item>
          </el-descriptions>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 实体新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="efVisible" :title="efEditing ? '编辑实体' : '新增实体'" width="620px" destroy-on-close>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="实体名称" required>
              <el-input v-model="ef.entityName" placeholder="如：芜湖市第一医院" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实体类型" required>
              <el-select v-model="ef.entityType" style="width: 100%">
                <el-option v-for="t in Object.keys(ENTITY_TONE)" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实体编码" required>
              <el-input v-model="ef.entityCode" placeholder="如：HOSP340200001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属区域" required>
              <el-select v-model="ef.area" style="width: 100%">
                <el-option v-for="a in ['市本级', '镜湖区', '弋江区', '鸠江区', '湾沚区', '全市']" :key="a" :label="a" :value="a" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="实体属性">
          <div class="props">
            <div v-for="(p, i) in ef.props" :key="i" class="props__row">
              <el-input v-model="p.key" placeholder="属性名，如 orgLevel" style="width: 180px" size="small" />
              <el-input v-model="p.value" placeholder="属性值，如 三级甲等" style="flex: 1" size="small" />
              <el-button link type="danger" size="small" :icon="'Delete'" @click="removeProp(i)" />
            </div>
            <el-button link type="primary" size="small" :icon="'Plus'" @click="addProp">添加属性</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="efVisible = false">取消</el-button>
        <el-button type="primary" :loading="efSaving" @click="doSaveEntity">{{ efEditing ? '保存' : '创建实体' }}</el-button>
      </template>
    </el-dialog>

    <!-- ============ 新增关系弹窗 ============ -->
    <el-dialog v-model="relVisible" title="新增关系" width="480px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="源实体">
          <el-input :model-value="curEntity?.entityName" disabled />
        </el-form-item>
        <el-form-item label="关系类型" required>
          <el-select v-model="relForm.relationType" style="width: 100%">
            <el-option v-for="t in ['就诊', '处方', '结算', '执业', '关联', '违规', '引用']" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标实体" required>
          <el-input v-model="relForm.targetEntityName" placeholder="实体名称或编码" />
        </el-form-item>
        <el-form-item label="关系属性">
          <el-input v-model="relForm.properties" placeholder="如：就诊15次 · 总额2.85万元" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="relVisible = false">取消</el-button>
        <el-button type="primary" :loading="relSaving" @click="doAddRelation">建立关系</el-button>
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
  display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.et {
  display: inline-flex; align-items: center;
  padding: 1px 7px; border-radius: 3px;
  font-size: 10px; font-weight: 700; line-height: 1.7;
  color: var(--etc);
  background: color-mix(in srgb, var(--etc) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--etc) 30%, transparent);
}

.view-grid {
  display: grid; grid-template-columns: 1.7fr 1fr; gap: 12px;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.view-side { display: flex; flex-direction: column; gap: 12px; }

.gv-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px;

  &__c {
    padding: 7px 4px; text-align: center; border-radius: 6px;
    background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
    b { display: block; font-size: 15px; font-weight: 800; color: var(--zh-text-primary); }
    span { font-size: 9.5px; color: var(--zh-text-secondary); }
  }
}

.path {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;

  &__n {
    padding: 3px 8px; border-radius: 4px;
    background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
    font-size: 10.5px; font-weight: 700; color: var(--zh-text-primary);

    &.is-rel {
      background: transparent; border: none; padding: 0;
      color: var(--zh-accent); font-weight: 400;
    }
  }
}

.comm {
  padding: 8px 10px; border-radius: 6px; margin-bottom: 7px;
  border: 1px solid var(--zh-border-light);

  &.is-high { background: var(--zh-risk-high-bg); border-color: var(--zh-risk-high-border); }
  &.is-low { background: var(--zh-risk-mid-bg); border-color: var(--zh-risk-mid-border); }

  &__h {
    display: flex; align-items: center; justify-content: space-between;
    b { font-size: 11.5px; color: var(--zh-text-primary); }
  }
  &__m { margin-top: 4px; line-height: 1.7; }
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
}

/* ---------- 属性编辑 ---------- */
.props {
  width: 100%; padding: 10px; border-radius: 8px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__row {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    padding: 6px 8px; border-radius: 6px;
    background: #fff; border: 1px solid var(--zh-border-light);

    &:hover { border-color: var(--zh-primary-light); }
  }
}
</style>
