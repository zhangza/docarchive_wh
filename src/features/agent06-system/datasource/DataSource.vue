<script setup lang="ts">
import { getDsList, getDsDetail, testDatasource, getIfList, testInterface, getDsMonitor, saveDatasource, saveInterface, toggleAlertRule } from '@/api/agent06-system/system'
import { CHART_GRID } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('datasource')

const DS_TONE: Record<string, any> = { 运行中: 'success', 异常: 'danger', 已停用: 'info' }
const DIR_TONE: Record<string, any> = { '出站（数据推送）': 'primary', '出站（数据上报）': 'primary', '入站（数据接入）': 'success' }

/* ================= 数据接入 ================= */
const dsList = ref<any[]>([])
const dsLoading = ref(false)

async function loadDs() {
  dsLoading.value = true
  try {
    const res: any = await getDsList({ page: 1, pageSize: 20 })
    dsList.value = res?.list || []
  } finally { dsLoading.value = false }
}

const dsDrawer = ref(false)
const curDs = ref<any>(null)
const dsDetailLoading = ref(false)
async function openDs(row: any) {
  dsDrawer.value = true
  dsDetailLoading.value = true
  try { curDs.value = await getDsDetail(row.datasourceId) } finally { dsDetailLoading.value = false }
}

const dsTesting = ref(false)
async function doTestDs(row: any) {
  dsTesting.value = true
  try {
    const res: any = await testDatasource({ datasourceId: row.datasourceId })
    msg.success(res.message)
  } finally { dsTesting.value = false }
}

/* ---------- 数据源新增 / 编辑 ---------- */
const dsfVisible = ref(false)
const dsfSaving = ref(false)
const dsfEditing = ref<any>(null)
const dsf = reactive({ datasourceName: '', datasourceType: '医保结算系统', connectionType: 'API接口', syncFrequency: '实时（Kafka消息）', description: '' })

function openDsForm(row?: any) {
  dsfEditing.value = row || null
  if (row) {
    Object.assign(dsf, { datasourceName: row.datasourceName, datasourceType: row.datasourceType, connectionType: row.connectionType, syncFrequency: row.syncFrequency, description: row.description })
  } else {
    Object.assign(dsf, { datasourceName: '', datasourceType: '医保结算系统', connectionType: 'API接口', syncFrequency: '实时（Kafka消息）', description: '' })
  }
  dsfVisible.value = true
}

async function doSaveDs() {
  if (!dsf.datasourceName) { msg.warning('请填写数据源名称'); return }
  dsfSaving.value = true
  try {
    const res: any = await saveDatasource({ datasourceId: dsfEditing.value?.datasourceId, ...dsf })
    msg.success(res.message)
    if (dsfEditing.value) {
      Object.assign(dsfEditing.value, dsf)
    } else {
      dsList.value.unshift({
        datasourceId: res.datasourceId, ...dsf, status: '已停用',
        tableCount: 0, dailyVolume: '0条', todaySyncCount: 0, successRate: 1, dataQuality: 0, lastSyncTime: '—', delay: '—'
      })
    }
    dsfVisible.value = false
  } finally { dsfSaving.value = false }
}

/* ================= 平台对接 ================= */
const ifList = ref<any[]>([])
const ifLoading = ref(false)

async function loadIf() {
  ifLoading.value = true
  try {
    const res: any = await getIfList({ page: 1, pageSize: 20 })
    ifList.value = res?.list || []
  } finally { ifLoading.value = false }
}

const ifTesting = ref('')
async function doTestIf(row: any) {
  ifTesting.value = row.interfaceId
  try {
    const res: any = await testInterface({ interfaceId: row.interfaceId })
    msg.success(`${row.interfaceName}：${res.message}`)
  } finally { ifTesting.value = '' }
}

/* ---------- 接口新增 / 编辑 ---------- */
const iffVisible = ref(false)
const iffSaving = ref(false)
const iffEditing = ref<any>(null)
const iff = reactive({ interfaceName: '', systemName: '行政执法公示平台', direction: '出站（数据推送）', protocol: 'RESTful API', dataFormat: 'JSON', endpoint: '', method: 'POST' })

function openIfForm(row?: any) {
  iffEditing.value = row || null
  if (row) {
    Object.assign(iff, { interfaceName: row.interfaceName, systemName: row.systemName, direction: row.direction, protocol: row.protocol, dataFormat: row.dataFormat, endpoint: row.endpoint, method: row.method })
  } else {
    Object.assign(iff, { interfaceName: '', systemName: '行政执法公示平台', direction: '出站（数据推送）', protocol: 'RESTful API', dataFormat: 'JSON', endpoint: '', method: 'POST' })
  }
  iffVisible.value = true
}

async function doSaveIf() {
  if (!iff.interfaceName || !iff.endpoint) { msg.warning('请填写接口名称与地址'); return }
  iffSaving.value = true
  try {
    const res: any = await saveInterface({ interfaceId: iffEditing.value?.interfaceId, ...iff })
    msg.success(res.message)
    if (iffEditing.value) {
      Object.assign(iffEditing.value, iff)
    } else {
      ifList.value.unshift({
        interfaceId: res.interfaceId, ...iff, status: '运行中',
        todayCallCount: 0, successRate: 1, avgResponseTime: '—', totalCallCount: 0, lastCallTime: '—', version: 'v1.0'
      })
    }
    iffVisible.value = false
  } finally { iffSaving.value = false }
}

/* ---------- 告警规则开关 ---------- */
async function doToggleAlertRule(rule: any) {
  const res: any = await toggleAlertRule({ ruleId: rule.ruleId, name: rule.name, enabled: !rule.enabled })
  msg.success(res.message)
  rule.enabled = !rule.enabled
}

/* ================= 通道监控 ================= */
const mon = ref<any>(null)
const monLoading = ref(false)

async function loadMonitor() {
  monLoading.value = true
  try { mon.value = await getDsMonitor() } finally { monLoading.value = false }
}

const trendOption = computed(() => {
  const t = mon.value?.trend
  if (!t) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['接入数据量', '成功率'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 60, right: 46, bottom: 24 },
    xAxis: { type: 'category', data: t.xAxis, axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: [
      { type: 'value', name: '条', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v / 10000) + '万' } },
      { type: 'value', name: '成功率', min: 0.985, max: 1, splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v * 100).toFixed(1) + '%' } }
    ],
    series: [
      { name: '接入数据量', type: 'bar', barWidth: 16, itemStyle: { borderRadius: [3, 3, 0, 0], color: '#1668dc' }, data: t.totalVolume },
      { name: '成功率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5, itemStyle: { color: '#12a150' }, data: t.successRate }
    ]
  }
})

watch(activeTab, (v) => {
  if (v === 'interface' && !ifList.value.length) loadIf()
  else if (v === 'monitor' && !mon.value) loadMonitor()
})

onMounted(() => { loadDs() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="数据源与接口" tag="M44"
      subtitle="多源数据接入配置 · 平台系统对接 · 通道健康度与延迟监控">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadDs(); if (activeTab === 'monitor') loadMonitor()">刷新</el-button>
        <el-button v-if="activeTab === 'datasource'" type="primary" :icon="'Plus'" @click="openDsForm()">新增数据源</el-button>
        <el-button v-if="activeTab === 'interface'" type="primary" :icon="'Plus'" @click="openIfForm()">新增接口</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <!-- ================= 多源数据接入 ================= -->
      <el-tab-pane label="多源数据接入" name="datasource">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">数据源清单</span>
            <span class="section-title__desc">医保结算 / HIS / 进销存 / 电子病历，支持连通性测试与数据预览</span>
          </div>

          <el-table :data="dsList" size="small" border stripe v-loading="dsLoading">
            <el-table-column prop="datasourceId" label="数据源ID" width="140">
              <template #default="{ row }">
                <span class="num text-link" @click="openDs(row)">{{ row.datasourceId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="datasourceName" label="数据源名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="datasourceType" label="类型" width="130" />
            <el-table-column prop="connectionType" label="连接方式" width="110" align="center" />
            <el-table-column prop="syncFrequency" label="同步频率" width="130" align="center" />
            <el-table-column prop="dailyVolume" label="日数据量" width="110" align="right">
              <template #default="{ row }"><span class="num text-mini">{{ row.dailyVolume }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" width="92" align="right">
              <template #default="{ row }">
                <span class="num" :style="{ color: row.successRate >= 0.995 ? 'var(--zh-success)' : 'var(--zh-danger)', fontWeight: 700 }">
                  {{ (row.successRate * 100).toFixed(2) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column label="质量分" width="80" align="center">
              <template #default="{ row }">
                <span class="num" :style="{ color: row.dataQuality >= 95 ? 'var(--zh-success)' : 'var(--zh-warning)', fontWeight: 700 }">{{ row.dataQuality }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="DS_TONE[row.status] || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="196" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openDs(row)">详情</el-button>
                <el-button link type="warning" :icon="'EditPen'" @click="openDsForm(row)">配置</el-button>
                <el-button link type="success" :icon="'Link'" :loading="dsTesting" @click="doTestDs(row)">测试</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无数据源" height="140px" /></template>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ================= 平台系统对接 ================= -->
      <el-tab-pane label="平台系统对接" name="interface">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">对接接口清单</span>
            <span class="section-title__desc">国家平台上报 / 执法公示 / 信用平台 / 案件移送，支持接口测试与版本管理</span>
          </div>

          <el-table :data="ifList" size="small" border stripe v-loading="ifLoading">
            <el-table-column prop="interfaceId" label="接口ID" width="160">
              <template #default="{ row }"><span class="num">{{ row.interfaceId }}</span></template>
            </el-table-column>
            <el-table-column prop="interfaceName" label="接口名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="systemName" label="对接系统" width="140" />
            <el-table-column label="方向" width="130" align="center">
              <template #default="{ row }">
                <el-tag :type="DIR_TONE[row.direction] || 'info'" size="small" effect="plain">{{ row.direction }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="协议 / 格式" width="140" align="center">
              <template #default="{ row }">
                <span class="text-mini">{{ row.protocol }} / {{ row.dataFormat }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="version" label="版本" width="70" align="center">
              <template #default="{ row }"><span class="num">{{ row.version }}</span></template>
            </el-table-column>
            <el-table-column label="今日调用" width="90" align="right">
              <template #default="{ row }"><span class="num">{{ row.todayCallCount }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" width="86" align="right">
              <template #default="{ row }">
                <span class="num" style="color: var(--zh-success); font-weight: 700">{{ (row.successRate * 100).toFixed(1) }}%</span>
              </template>
            </el-table-column>
            <el-table-column prop="avgResponseTime" label="均响应" width="84" align="right">
              <template #default="{ row }"><span class="num text-mini">{{ row.avgResponseTime }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '运行中' ? 'success' : 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="warning" :icon="'EditPen'" @click="openIfForm(row)">配置</el-button>
                <el-button link type="success" :icon="'Link'" :loading="ifTesting === row.interfaceId" @click="doTestIf(row)">测试</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无接口" height="140px" /></template>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ================= 数据通道监控 ================= -->
      <el-tab-pane label="数据通道监控" name="monitor">
        <div v-loading="monLoading">
          <template v-if="mon">
            <div class="kpi-grid">
              <StatCard label="监控通道" :value="mon.channelCount" unit="条" icon="Connection" tone="primary"
                :desc="`正常 ${mon.normalCount} · 异常 ${mon.abnormalCount}`" />
              <StatCard label="今日接入量" :value="mon.todaySummary.totalDataVolume" unit="条" icon="Download" tone="accent" />
              <StatCard label="平均成功率" :value="mon.todaySummary.avgSuccessRate * 100" unit="%" icon="CircleCheck" tone="success" :precision="1" />
              <StatCard label="平均质量分" :value="mon.todaySummary.avgDataQuality" unit="分" icon="Medal" tone="success" />
              <StatCard label="活跃告警" :value="mon.todaySummary.activeAlerts" unit="条" icon="BellFilled" tone="warning" />
            </div>

            <div class="mon-grid">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">近 7 日接入趋势</span>
                </div>
                <EChart :option="trendOption" height="240px" />
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">告警规则</span>
                </div>
                <div class="arules">
                  <div v-for="r in mon.alertRules" :key="r.ruleId" class="arule">
                    <span class="arule__n">{{ r.name }}</span>
                    <span class="arule__c num">{{ r.condition }}</span>
                    <el-tag :type="r.level === '高' ? 'danger' : r.level === '中' ? 'warning' : 'info'" size="small" effect="plain">{{ r.level }}</el-tag>
                    <el-switch :model-value="r.enabled" size="small" @change="doToggleAlertRule(r)" />
                  </div>
                </div>
              </div>
            </div>

            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">通道状态</span>
                <span class="section-title__desc">异常通道标红，点击告警查看处理人</span>
              </div>
              <div class="chs">
                <div v-for="c in mon.channels" :key="c.channelId" class="ch" :class="{ 'is-err': c.status === '异常' }">
                  <div class="ch__h">
                    <span class="ch__dot" :class="c.status === '正常' ? 'is-ok' : 'is-err'" />
                    <b>{{ c.channelName }}</b>
                    <el-tag :type="c.status === '正常' ? 'success' : 'danger'" size="small" effect="dark">{{ c.status }}</el-tag>
                  </div>
                  <div class="ch__m text-mini">{{ c.channelId }} · {{ c.dataType }}</div>
                  <div class="ch__kpi">
                    <div><b class="num">{{ c.todayVolume.toLocaleString() }}</b><span>今日量</span></div>
                    <div>
                      <b class="num" :style="{ color: c.changeRate < -0.2 ? 'var(--zh-danger)' : 'var(--zh-text-primary)' }">
                        {{ c.changeRate > 0 ? '+' : '' }}{{ (c.changeRate * 100).toFixed(1) }}%
                      </b>
                      <span>环比</span>
                    </div>
                    <div><b class="num">{{ c.delay }}</b><span>延迟</span></div>
                    <div><b class="num">{{ c.dataQuality }}</b><span>质量分</span></div>
                  </div>
                  <template v-if="c.alerts.length">
                    <el-alert v-for="a in c.alerts" :key="a.alertId" type="warning" :closable="false" show-icon style="margin-top: 7px">
                      <template #title><span class="text-mini">{{ a.type }}：{{ a.message }}</span></template>
                      <div class="text-mini">处理人：{{ a.assignee }} · {{ a.status }}</div>
                    </el-alert>
                  </template>
                </div>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 数据源详情抽屉 ============ -->
    <el-drawer v-model="dsDrawer" size="680px" title="数据源详情">
      <template v-if="curDs">
        <div v-loading="dsDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curDs.datasourceName }}
              <el-tag :type="DS_TONE[curDs.status] || 'info'" size="small" effect="dark">{{ curDs.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curDs.datasourceId }}</span>
              <span><el-icon><Connection /></el-icon>{{ curDs.connectionType }}</span>
              <span><el-icon><Timer /></el-icon>{{ curDs.syncFrequency }}</span>
            </div>
            <div class="dt-hero__d">{{ curDs.description }}</div>
          </div>

          <div class="sub-title">接入数据表</div>
          <el-table :data="curDs.dataTables || []" size="small" border stripe>
            <el-table-column prop="tableName" label="表名" min-width="130" />
            <el-table-column prop="tableCode" label="表编码" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.tableCode }}</span></template>
            </el-table-column>
            <el-table-column prop="fieldCount" label="字段数" width="76" align="right">
              <template #default="{ row }"><span class="num">{{ row.fieldCount }}</span></template>
            </el-table-column>
            <el-table-column prop="dailyVolume" label="日数据量" width="96" align="right" />
            <el-table-column prop="syncStatus" label="状态" width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.syncStatus === '正常' ? 'success' : 'danger'" size="small" effect="plain">{{ row.syncStatus }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="delay" label="延迟" width="76" align="center" />
          </el-table>

          <div class="sub-title">清洗规则</div>
          <div v-for="r in curDs.cleaningRules || []" :key="r.ruleId" class="clean">
            <span class="clean__id num">{{ r.ruleId }}</span>
            <span class="clean__t">{{ r.targetTable }}</span>
            <span class="clean__r">{{ r.rule }}</span>
            <el-tag type="success" size="small" effect="plain" style="margin-left: auto">{{ r.status }}</el-tag>
          </div>

          <div class="sub-title">数据质量</div>
          <div class="dt-kpi">
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ (curDs.dataQuality.completeness * 100).toFixed(1) }}%</div><div class="dt-kpi__l">完整性</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ (curDs.dataQuality.accuracy * 100).toFixed(1) }}%</div><div class="dt-kpi__l">准确性</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ (curDs.dataQuality.consistency * 100).toFixed(1) }}%</div><div class="dt-kpi__l">一致性</div></div>
            <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-success)">{{ curDs.dataQuality.qualityScore }}</div><div class="dt-kpi__l">质量分</div></div>
          </div>

          <div class="sub-title">同步统计</div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="今日同步"><span class="num">{{ curDs.syncStats.todaySyncCount.toLocaleString() }} 条</span></el-descriptions-item>
            <el-descriptions-item label="今日失败"><span class="num" style="color: var(--zh-warning)">{{ curDs.syncStats.todayFailCount }} 条</span></el-descriptions-item>
            <el-descriptions-item label="历史总量">{{ curDs.syncStats.totalRecords }}</el-descriptions-item>
            <el-descriptions-item label="连通测试">{{ curDs.testResult }}（{{ curDs.lastTestTime }}）</el-descriptions-item>
          </el-descriptions>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 数据源新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="dsfVisible" :title="dsfEditing ? '数据源配置' : '新增数据源'" width="620px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="数据源名称" required>
          <el-input v-model="dsf.datasourceName" placeholder="如：医保结算系统" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="数据源类型" required>
              <el-select v-model="dsf.datasourceType" style="width: 100%">
                <el-option v-for="t in ['医保结算系统', '医院HIS系统', '药店进销存系统', '电子病历系统', '医保智能监控系统', '外部数据']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="连接方式" required>
              <el-select v-model="dsf.connectionType" style="width: 100%">
                <el-option v-for="t in ['API接口', '数据库同步', '文件同步', 'Kafka消息']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="同步频率" required>
          <el-radio-group v-model="dsf.syncFrequency">
            <el-radio-button label="实时（Kafka消息）" />
            <el-radio-button label="每15分钟" />
            <el-radio-button label="每小时" />
            <el-radio-button label="每日02:00" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="接入说明">
          <el-input v-model="dsf.description" type="textarea" :rows="2" placeholder="数据范围、字段映射与清洗要求" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dsfVisible = false">取消</el-button>
        <el-button type="primary" :loading="dsfSaving" @click="doSaveDs">{{ dsfEditing ? '保存配置' : '创建数据源' }}</el-button>
      </template>
    </el-dialog>

    <!-- ============ 接口新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="iffVisible" :title="iffEditing ? '接口配置' : '新增对接接口'" width="620px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="接口名称" required>
          <el-input v-model="iff.interfaceName" placeholder="如：行政处罚信息公示接口" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="对接系统" required>
              <el-select v-model="iff.systemName" style="width: 100%">
                <el-option v-for="s in ['国家医保信息平台', '省医保信息平台', '政务服务平台', '行政执法公示平台', '信用信息平台', '公安/纪检监察']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="接口方向" required>
              <el-select v-model="iff.direction" style="width: 100%">
                <el-option label="出站（数据推送）" value="出站（数据推送）" />
                <el-option label="出站（数据上报）" value="出站（数据上报）" />
                <el-option label="入站（数据接入）" value="入站（数据接入）" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="协议" required>
              <el-select v-model="iff.protocol" style="width: 100%">
                <el-option v-for="p in ['RESTful API', 'SOAP', 'WebService']" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据格式" required>
              <el-radio-group v-model="iff.dataFormat">
                <el-radio-button label="JSON" /><el-radio-button label="XML" />
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="接口地址" required>
          <el-input v-model="iff.endpoint" placeholder="https://…">
            <template #prepend>
              <el-select v-model="iff.method" style="width: 86px">
                <el-option v-for="m in ['POST', 'GET', 'PUT', 'SOAP']" :key="m" :label="m" :value="m" />
              </el-select>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="iffVisible = false">取消</el-button>
        <el-button type="primary" :loading="iffSaving" @click="doSaveIf">{{ iffEditing ? '保存并生成新版本' : '创建接口' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1300px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.mon-grid {
  display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.arules { display: flex; flex-direction: column; gap: 6px; }

.arule {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__n { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); min-width: 128px; }
  &__c { flex: 1; font-size: 10.5px; color: var(--zh-text-secondary); }
}

.chs {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.ch {
  padding: 12px 14px; border-radius: 8px;
  background: #fff; border: 1px solid var(--zh-border-light);

  &.is-err { border-color: var(--zh-risk-high-border); background: var(--zh-risk-high-bg); }

  &__h {
    display: flex; align-items: center; gap: 7px;
    b { font-size: 13px; color: var(--zh-text-primary); }
    :deep(.el-tag) { margin-left: auto; }
  }

  &__dot {
    width: 8px; height: 8px; border-radius: 50%;
    &.is-ok { background: var(--zh-success); }
    &.is-err { background: var(--zh-danger); animation: chBlink 1.2s ease-in-out infinite; }
  }

  &__m { margin-top: 3px; }

  &__kpi {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 9px;

    > div {
      padding: 6px 4px; text-align: center; border-radius: 5px;
      background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
      b { display: block; font-size: 13px; font-weight: 800; color: var(--zh-text-primary); }
      span { font-size: 9px; color: var(--zh-text-secondary); }
    }
  }
}

@keyframes chBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: .35; }
}

.clean {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 7px 10px; border-radius: 6px; margin-bottom: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__id { font-size: 10px; font-weight: 700; color: var(--zh-primary); }
  &__t { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); }
  &__r { flex: 1; font-size: 10.5px; color: var(--zh-text-secondary); }
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

.dt-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px;

  &__c {
    padding: 9px 6px; text-align: center;
    border-radius: 6px; background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__v { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}
</style>
