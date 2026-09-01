<script setup lang="ts">
import { getAgentMonitor, getOpsMonitor, toggleAlertRule } from '@/api/agent06-system/system'
import { CHART_GRID } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('agents')

/* ================= 智能体运行监控 ================= */
const am = ref<any>(null)
const amLoading = ref(false)

async function loadAgents() {
  amLoading.value = true
  try { am.value = await getAgentMonitor() } finally { amLoading.value = false }
}

const agentTrendOption = computed(() => {
  const t = am.value?.trend
  if (!t) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['总处理量', '成功率'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 52, right: 44, bottom: 24 },
    xAxis: { type: 'category', data: t.xAxis, axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: [
      { type: 'value', name: '件', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
      { type: 'value', name: '成功率', min: 0.99, max: 1, splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v * 100).toFixed(1) + '%' } }
    ],
    series: [
      { name: '总处理量', type: 'bar', barWidth: 18, itemStyle: { borderRadius: [3, 3, 0, 0], color: '#1668dc' }, data: t.totalProcessed },
      { name: '成功率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5, itemStyle: { color: '#12a150' }, data: t.successRate }
    ]
  }
})

/* ================= 系统运维监控 ================= */
const om = ref<any>(null)
const omLoading = ref(false)

async function loadOps() {
  omLoading.value = true
  try { om.value = await getOpsMonitor() } finally { omLoading.value = false }
}

const opsTrendOption = computed(() => {
  const t = om.value?.trend
  if (!t) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均CPU', '平均内存', 'QPS'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 42, right: 46, bottom: 24 },
    xAxis: { type: 'category', data: t.xAxis, axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: [
      { type: 'value', name: '%', max: 100, splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
      { type: 'value', name: 'QPS', splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9aa7b8' } }
    ],
    series: [
      { name: '平均CPU', type: 'line', smooth: true, symbolSize: 5, areaStyle: { opacity: .1 }, itemStyle: { color: '#1668dc' }, data: t.avgCpu },
      { name: '平均内存', type: 'line', smooth: true, symbolSize: 5, areaStyle: { opacity: .1 }, itemStyle: { color: '#722ed1' }, data: t.avgMemory },
      { name: 'QPS', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 5, itemStyle: { color: '#e8a30c' }, data: t.qps }
    ]
  }
})

function usageColor(v: number) {
  return v >= 85 ? '#e5484d' : v >= 60 ? '#e8a30c' : '#12a150'
}

async function doToggleAlertRule(rule: any) {
  const res: any = await toggleAlertRule({ ruleId: rule.ruleId, name: rule.name, enabled: !rule.enabled })
  msg.success(res.message)
  rule.enabled = !rule.enabled
}

function doAgentOp(action: string, row: any) {
  msg.success(`已执行「${action}」：${row.agentName}（Mock 操作）`)
}

watch(activeTab, (v) => { if (v === 'ops' && !om.value) loadOps() })

onMounted(() => { loadAgents() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="运行监控" tag="M48"
      subtitle="六大智能体运行状态与性能 · 系统级运维健康度 · 告警与巡检">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadAgents(); if (activeTab === 'ops') loadOps()">刷新</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <!-- ================= 智能体运行监控 ================= -->
      <el-tab-pane label="智能体运行监控" name="agents">
        <div v-loading="amLoading">
          <template v-if="am">
            <div class="kpi-grid">
              <StatCard label="智能体" :value="am.agentCount" unit="个" icon="Cpu" tone="primary"
                :desc="`正常 ${am.normalCount} · 异常 ${am.abnormalCount}`" />
              <StatCard label="今日AI调用" :value="am.aiServiceOverview.todayTotalCalls" unit="次" icon="MagicStick" tone="accent" />
              <StatCard label="今日Token消耗" :value="(am.aiServiceOverview.todayTotalTokens / 10000)" unit="万" icon="Coin" tone="purple" :precision="1" />
              <StatCard label="AI平均成功率" :value="am.aiServiceOverview.avgSuccessRate * 100" unit="%" icon="CircleCheck" tone="success" :precision="1" />
              <StatCard label="AI平均响应" :value="am.aiServiceOverview.avgResponseTime" icon="Timer" tone="warning" />
            </div>

            <!-- 智能体卡片 -->
            <div class="agent-grid">
              <div v-for="a in am.agents" :key="a.agentId" class="section-card section-card--tight ag">
                <div class="ag__h">
                  <span class="ag__dot" :class="a.status === '运行中' ? 'is-ok' : 'is-err'" />
                  <b class="ag__n">{{ a.agentName }}</b>
                  <el-tag size="small" type="success" effect="dark">{{ a.status }}</el-tag>
                </div>
                <div class="ag__m text-mini">
                  <span class="num">{{ a.agentId }}</span> · <span class="num">{{ a.version }}</span> · 已稳定运行 {{ a.uptime }}
                </div>
                <div class="ag__kpi">
                  <div><b class="num">{{ a.todayProcessed.toLocaleString() }}</b><span>今日处理</span></div>
                  <div><b class="num">{{ (a.successRate * 100).toFixed(1) }}%</b><span>成功率</span></div>
                  <div><b class="num">{{ a.avgResponseTime }}</b><span>均响应</span></div>
                  <div>
                    <b class="num" :style="{ color: a.queueBacklog > 0 ? 'var(--zh-warning)' : 'var(--zh-text-primary)' }">{{ a.queueBacklog }}</b>
                    <span>队列积压</span>
                  </div>
                </div>
                <div class="ag__res">
                  <span class="ag__rl">CPU</span>
                  <el-progress :percentage="a.cpu" :stroke-width="6" :show-text="false" :color="usageColor(a.cpu)" />
                  <span class="ag__rv num">{{ a.cpu }}%</span>
                  <span class="ag__rl">内存</span>
                  <el-progress :percentage="a.memory" :stroke-width="6" :show-text="false" :color="usageColor(a.memory)" />
                  <span class="ag__rv num">{{ a.memory }}%</span>
                </div>
                <div class="ag__ai text-mini">
                  <el-icon :size="10"><MagicStick /></el-icon>{{ a.aiModel }} · 今日Token <span class="num">{{ (a.todayTokens / 10000).toFixed(1) }}万</span>
                </div>
                <el-alert v-for="al in a.alerts" :key="al.alertId" type="warning" :closable="false" show-icon style="margin-top: 7px">
                  <template #title><span class="text-mini">{{ al.type }}：{{ al.message }}</span></template>
                </el-alert>
                <div class="ag__ops">
                  <el-button link type="primary" size="small" @click="doAgentOp('查看日志', a)">日志</el-button>
                  <el-button link type="warning" size="small" @click="doAgentOp('重启智能体', a)">重启</el-button>
                  <el-button link type="primary" size="small" @click="doAgentOp('性能详情', a)">性能</el-button>
                </div>
              </div>
            </div>

            <div class="sup-grid">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">今日处理量与成功率</span>
                </div>
                <EChart :option="agentTrendOption" height="236px" />
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">AI 服务模型（{{ am.aiServiceOverview.totalModels }} 个）</span>
                </div>
                <el-table :data="am.aiServiceOverview.models" size="small" border stripe max-height="236">
                  <el-table-column prop="name" label="模型" min-width="150">
                    <template #default="{ row }"><span class="num text-mini">{{ row.name }}</span></template>
                  </el-table-column>
                  <el-table-column prop="calls" label="今日调用" width="86" align="right">
                    <template #default="{ row }"><span class="num">{{ row.calls.toLocaleString() }}</span></template>
                  </el-table-column>
                  <el-table-column label="Token消耗" width="100" align="right">
                    <template #default="{ row }"><span class="num text-mini">{{ (row.tokens / 10000).toFixed(1) }}万</span></template>
                  </el-table-column>
                  <el-table-column label="状态" width="70" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small" effect="plain">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <div class="section-card section-card--tight">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">资源概览</span>
              </div>
              <div class="res-grid">
                <div class="res"><b class="num">{{ am.resourceOverview.totalNodes }}</b><span>节点总数</span></div>
                <div class="res"><b class="num" style="color: var(--zh-success)">{{ am.resourceOverview.healthyNodes }}</b><span>健康节点</span></div>
                <div class="res"><b class="num">{{ am.resourceOverview.avgCpu }}%</b><span>平均CPU</span></div>
                <div class="res"><b class="num">{{ am.resourceOverview.avgMemory }}%</b><span>平均内存</span></div>
                <div class="res"><b class="num">{{ am.resourceOverview.avgGpu }}%</b><span>平均GPU</span></div>
                <div class="res"><b class="num">{{ am.resourceOverview.storageUsage }}%</b><span>存储使用</span></div>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>

      <!-- ================= 系统运维监控 ================= -->
      <el-tab-pane label="系统运维监控" name="ops">
        <div v-loading="omLoading">
          <template v-if="om">
            <!-- 健康度 -->
            <div class="section-card health">
              <div class="health__score">
                <el-progress type="dashboard" :percentage="om.healthScore" :width="96" :stroke-width="9" color="#12a150" />
                <div class="health__t">
                  <b>系统健康度</b>
                  <el-tag type="success" size="small" effect="dark">{{ om.overallHealth }}</el-tag>
                  <span class="text-mini">上次巡检 {{ om.inspection.lastInspection }} · {{ om.inspection.inspectionResult }}</span>
                </div>
              </div>
              <div class="health__comps">
                <div v-for="c in om.components" :key="c.name" class="hc" :class="{ 'is-warn': c.warning > 0 }">
                  <span class="hc__n">{{ c.name }}</span>
                  <b class="num">{{ c.healthy }}/{{ c.total }}</b>
                  <el-tag v-if="c.warning" type="warning" size="small" effect="dark">{{ c.warning }} 警告</el-tag>
                  <el-tag v-else type="success" size="small" effect="plain">正常</el-tag>
                </div>
              </div>
            </div>

            <div class="sup-grid">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">资源与负载趋势</span>
                </div>
                <EChart :option="opsTrendOption" height="232px" />
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">告警规则</span>
                </div>
                <div class="arules">
                  <div v-for="r in om.alertRules" :key="r.ruleId" class="arule">
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
                <span class="section-title__text">服务器状态</span>
                <span class="section-title__desc">银河麒麟V10 · 使用率超过85%自动告警</span>
              </div>
              <el-table :data="om.servers" size="small" border stripe>
                <el-table-column prop="serverName" label="服务器" width="140">
                  <template #default="{ row }"><span class="num text-mini" style="font-weight: 700">{{ row.serverName }}</span></template>
                </el-table-column>
                <el-table-column prop="ip" label="IP" width="110">
                  <template #default="{ row }"><span class="num text-mini">{{ row.ip }}</span></template>
                </el-table-column>
                <el-table-column prop="role" label="角色" width="110" />
                <el-table-column label="CPU" width="130">
                  <template #default="{ row }">
                    <el-progress :percentage="row.cpu" :stroke-width="8" :text-inside="true" :color="usageColor(row.cpu)" />
                  </template>
                </el-table-column>
                <el-table-column label="内存" width="130">
                  <template #default="{ row }">
                    <el-progress :percentage="Math.round(row.memory)" :stroke-width="8" :text-inside="true" :color="usageColor(row.memory)" />
                  </template>
                </el-table-column>
                <el-table-column label="磁盘" width="130">
                  <template #default="{ row }">
                    <el-progress :percentage="Math.round(row.disk)" :stroke-width="8" :text-inside="true" :color="usageColor(row.disk)" />
                  </template>
                </el-table-column>
                <el-table-column prop="uptime" label="运行时长" width="110">
                  <template #default="{ row }"><span class="num text-mini">{{ row.uptime }}</span></template>
                </el-table-column>
                <el-table-column label="状态" width="72" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small" effect="dark">{{ row.status }}</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="sup-grid">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">数据库状态</span>
                </div>
                <el-table :data="om.databases" size="small" border stripe>
                  <el-table-column prop="dbName" label="实例" min-width="130">
                    <template #default="{ row }"><span class="num text-mini" style="font-weight: 700">{{ row.dbName }}</span></template>
                  </el-table-column>
                  <el-table-column prop="role" label="角色" width="70" align="center" />
                  <el-table-column label="连接数" width="130">
                    <template #default="{ row }">
                      <el-progress :percentage="Math.round(row.connectionUsage)" :stroke-width="8" :text-inside="true" :color="usageColor(row.connectionUsage)" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="qps" label="QPS" width="80" align="right">
                    <template #default="{ row }"><span class="num">{{ row.qps.toLocaleString() }}</span></template>
                  </el-table-column>
                  <el-table-column label="慢查询" width="80" align="right">
                    <template #default="{ row }">
                      <span class="num" :style="{ color: row.slowQueries > 10 ? 'var(--zh-danger)' : 'var(--zh-text-regular)' }">{{ row.slowQueries }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="缓存命中" width="90" align="right">
                    <template #default="{ row }"><span class="num">{{ (row.cacheHitRate * 100).toFixed(1) }}%</span></template>
                  </el-table-column>
                  <el-table-column prop="replicationLag" label="同步延迟" width="90" align="right">
                    <template #default="{ row }"><span class="num text-mini">{{ row.replicationLag }}</span></template>
                  </el-table-column>
                </el-table>
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">应用健康度</span>
                </div>
                <el-table :data="om.applications" size="small" border stripe>
                  <el-table-column prop="appName" label="应用" min-width="140" show-overflow-tooltip />
                  <el-table-column prop="version" label="版本" width="76" align="center">
                    <template #default="{ row }"><span class="num">{{ row.version }}</span></template>
                  </el-table-column>
                  <el-table-column label="实例" width="90" align="center">
                    <template #default="{ row }">
                      <span class="num" :style="{ color: row.healthyInstances < row.instances ? 'var(--zh-warning)' : 'var(--zh-success)', fontWeight: 700 }">
                        {{ row.healthyInstances }}/{{ row.instances }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="avgResponseTime" label="均响应" width="86" align="right">
                    <template #default="{ row }"><span class="num text-mini">{{ row.avgResponseTime }}</span></template>
                  </el-table-column>
                  <el-table-column label="错误率" width="86" align="right">
                    <template #default="{ row }">
                      <span class="num" :style="{ color: row.errorRate > 0.005 ? 'var(--zh-warning)' : 'var(--zh-success)' }">{{ (row.errorRate * 100).toFixed(1) }}%</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="状态" width="72" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.status === '正常' ? 'success' : 'warning'" size="small" effect="dark">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
                <el-alert v-for="a in om.applications.flatMap((x: any) => x.alerts)" :key="a.alertId" type="warning"
                  :closable="false" show-icon style="margin-top: 8px">
                  <template #title><span class="text-mini">{{ a.type }}：{{ a.message }}</span></template>
                  <div class="text-mini">处理人：{{ a.assignee }} · {{ a.status }}</div>
                </el-alert>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1300px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.sup-grid {
  display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.agent-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1400px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.ag {
  &__h {
    display: flex; align-items: center; gap: 7px;
    b { font-size: 13px; color: var(--zh-text-primary); }
    :deep(.el-tag) { margin-left: auto; }
  }
  &__dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    &.is-ok { background: var(--zh-success); box-shadow: 0 0 6px rgba(18, 161, 80, .5); }
    &.is-err { background: var(--zh-danger); }
  }
  &__m { margin-top: 3px; }

  &__kpi {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 9px;

    > div {
      padding: 6px 4px; text-align: center; border-radius: 5px;
      background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
      b { display: block; font-size: 12.5px; font-weight: 800; color: var(--zh-text-primary); }
      span { font-size: 9px; color: var(--zh-text-secondary); }
    }
  }

  &__res {
    display: flex; align-items: center; gap: 6px; margin-top: 9px;

    :deep(.el-progress) { flex: 1; }
  }
  &__rl { font-size: 9.5px; color: var(--zh-text-secondary); flex-shrink: 0; }
  &__rv { font-size: 9.5px; font-weight: 700; color: var(--zh-text-primary); width: 28px; text-align: right; flex-shrink: 0; }

  &__ai {
    display: flex; align-items: center; gap: 4px; margin-top: 8px;
    :deep(.el-icon) { color: var(--zh-purple); }
  }

  &__ops {
    display: flex; gap: 4px; margin-top: 8px;
    padding-top: 7px; border-top: 1px dashed var(--zh-border-light);
    :deep(.el-button) { margin-left: 0 !important; }
  }
}

.res-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
  @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
}

.res {
  padding: 10px 6px; text-align: center; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  b { display: block; font-size: 18px; font-weight: 800; color: var(--zh-text-primary); }
  span { font-size: 10px; color: var(--zh-text-secondary); }
}

.health {
  display: flex; gap: 20px; align-items: center; flex-wrap: wrap;

  &__score { display: flex; align-items: center; gap: 14px; }
  &__t {
    display: flex; flex-direction: column; gap: 5px;
    b { font-size: 14px; color: var(--zh-text-primary); }
  }

  &__comps {
    flex: 1; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
    @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
  }
}

.hc {
  padding: 8px 10px; border-radius: 6px; text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &.is-warn { background: var(--zh-warning-light); border-color: var(--zh-risk-mid-border); }

  &__n { display: block; font-size: 10.5px; color: var(--zh-text-secondary); }
  b { display: block; margin: 3px 0; font-size: 13px; color: var(--zh-text-primary); }
}

.arules { display: flex; flex-direction: column; gap: 6px; }

.arule {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__n { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); min-width: 118px; }
  &__c { flex: 1; font-size: 10.5px; color: var(--zh-text-secondary); }
}
</style>
