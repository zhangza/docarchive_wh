<script setup lang="ts">
import { getMessageStats, getMessageList, markMessageRead, getSupervision, urgeSupervisionItem, toggleSupervisionRule, saveSupervisionRule, saveMessageSubscribe } from '@/api/agent06-system/system'
import { CHART_GRID } from '@/utils/format'

const msg = ElMessage
const activeTab = ref('message')

const TYPE_TONE: Record<string, any> = { 待办消息: 'primary', 预警消息: 'danger', 通知消息: 'warning', 公告消息: 'info' }
const PRI_TONE: Record<string, any> = { 高: 'danger', 中: 'warning', 低: 'info' }

/* ================= 消息中心 ================= */
const mSt = ref<any>(null)
const mList = ref<any[]>([])
const mTotal = ref(0)
const mLoading = ref(false)
const mQ = reactive({ keyword: '', messageType: '', status: '', priority: '', page: 1, pageSize: 10 })

async function loadMsgStats() { mSt.value = await getMessageStats() }

async function loadMsgs() {
  mLoading.value = true
  try {
    const res: any = await getMessageList(mQ)
    mList.value = res?.list || []
    mTotal.value = res?.total || 0
  } finally { mLoading.value = false }
}

const mDrawer = ref(false)
const curMsg = ref<any>(null)
async function openMsg(row: any) {
  curMsg.value = row
  mDrawer.value = true
  if (row.status === '未读') {
    await markMessageRead({ messageId: row.messageId })
    row.status = '已读'
    loadMsgStats()
  }
}

const readingAll = ref(false)
async function doReadAll() {
  readingAll.value = true
  try {
    await markMessageRead({ all: true })
    mList.value.forEach((m) => (m.status = '已读'))
    msg.success('已将当前页消息全部标记为已读')
    loadMsgStats()
  } finally { readingAll.value = false }
}

/* ================= 时限督办 ================= */
const sup = ref<any>(null)
const supLoading = ref(false)

async function loadSup() {
  supLoading.value = true
  try { sup.value = await getSupervision() } finally { supLoading.value = false }
}

const urging = ref('')
async function doUrge(row: any) {
  urging.value = row.itemId
  try {
    const res: any = await urgeSupervisionItem({ itemId: row.itemId, assignee: row.assignee })
    msg.success(res.message)
  } finally { urging.value = '' }
}

const supTrendOption = computed(() => {
  const t = sup.value?.trend
  if (!t) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['按时完成率', '超期事项'], right: 8, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    grid: { ...CHART_GRID, left: 46, right: 40, bottom: 24 },
    xAxis: { type: 'category', data: t.xAxis, axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    yAxis: [
      { type: 'value', min: 0.85, max: 1, splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8', formatter: (v: number) => (v * 100).toFixed(0) + '%' } },
      { type: 'value', splitLine: { show: false }, axisLabel: { fontSize: 10, color: '#9aa7b8' } }
    ],
    series: [
      { name: '按时完成率', type: 'line', smooth: true, symbolSize: 5, areaStyle: { opacity: .1 }, itemStyle: { color: '#12a150' }, data: t.onTimeRate },
      { name: '超期事项', type: 'bar', yAxisIndex: 1, barWidth: 12, itemStyle: { borderRadius: [3, 3, 0, 0], color: '#e5484d' }, data: t.overdueCount }
    ]
  }
})

const supTypeOption = computed(() => {
  const d = sup.value?.byType || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => `${p[0].name}<br/>事项 ${d[p[0].dataIndex].total} · 超期 ${d[p[0].dataIndex].overdue} · 按时率 ${(d[p[0].dataIndex].onTimeRate * 100).toFixed(1)}%` },
    grid: { left: 8, right: 40, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: { type: 'category', data: d.map((i: any) => i.type).reverse(), axisLabel: { fontSize: 10, color: '#6b7a90' }, axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false } },
    series: [
      { name: '按时', type: 'bar', stack: 'a', barWidth: 13, itemStyle: { color: '#12a150', borderRadius: [0, 0, 0, 0] }, data: d.map((i: any) => i.total - i.overdue).reverse() },
      { name: '超期', type: 'bar', stack: 'a', barWidth: 13, itemStyle: { color: '#e5484d', borderRadius: [0, 3, 3, 0] }, data: d.map((i: any) => i.overdue).reverse() }
    ]
  }
})

/* ---------- 督办规则配置 ---------- */
async function doToggleSupRule(rule: any) {
  const res: any = await toggleSupervisionRule({ ruleId: rule.ruleId, name: rule.name, enabled: !rule.enabled })
  msg.success(res.message)
  rule.enabled = !rule.enabled
}

const srfVisible = ref(false)
const srfSaving = ref(false)
const srEditing = ref<any>(null)
const srf = reactive({ name: '', trigger: '', action: '' })
function openSupRuleForm(rule: any) {
  srEditing.value = rule
  Object.assign(srf, { name: rule.name, trigger: rule.trigger, action: rule.action })
  srfVisible.value = true
}
async function doSaveSupRule() {
  if (!srf.name || !srf.trigger) { msg.warning('请完善规则名称与触发时机'); return }
  srfSaving.value = true
  try {
    const res: any = await saveSupervisionRule({ ruleId: srEditing.value.ruleId, ...srf })
    msg.success(res.message)
    Object.assign(srEditing.value, { ...srf })
    srfVisible.value = false
  } finally { srfSaving.value = false }
}

/* ---------- 消息订阅设置 ---------- */
const subVisible = ref(false)
const subSaving = ref(false)
const sub = reactive({
  types: ['待办消息', '预警消息'],
  channels: ['系统站内消息', '企业微信'],
  dnd: false, dndStart: '22:00', dndEnd: '07:00'
})
async function doSaveSubscribe() {
  subSaving.value = true
  try {
    const res: any = await saveMessageSubscribe(sub)
    msg.success(res.message)
    subVisible.value = false
  } finally { subSaving.value = false }
}

watch(activeTab, (v) => { if (v === 'supervision' && !sup.value) loadSup() })

onMounted(() => { loadMsgStats(); loadMsgs() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="消息与时限督办" tag="M47"
      subtitle="统一消息中心 · 多渠道到达 · 全环节时限监控与超期升级督办">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadMsgStats(); loadMsgs()">刷新</el-button>
        <el-button :icon="'Finished'" :loading="readingAll" @click="doReadAll">全部已读</el-button>
        <el-button type="primary" :icon="'Setting'" @click="subVisible = true">订阅设置</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <!-- ================= 统一消息中心 ================= -->
      <el-tab-pane label="统一消息中心" name="message">
        <div class="kpi-grid">
          <StatCard label="今日消息" :value="mSt?.totalToday || 0" unit="条" icon="Bell" tone="primary" />
          <StatCard label="未读消息" :value="mSt?.unread || 0" unit="条" icon="Message" tone="warning" />
          <StatCard label="待办消息" :value="mSt?.todoCount || 0" unit="条" icon="EditPen" tone="accent" />
          <StatCard label="预警消息" :value="mSt?.warnCount || 0" unit="条" icon="WarnTriangleFilled" tone="danger" />
          <StatCard label="消息到达率" :value="(mSt?.arrivalRate || 0) * 100" unit="%" icon="CircleCheck" tone="success" :precision="1" />
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">消息列表</span>
            <span class="section-title__desc">站内信 / 短信 / 企业微信 / 邮件四通道 · 点击消息自动标记已读并可跳转处理</span>
          </div>
          <el-form class="query-form" :model="mQ" @submit.prevent>
            <el-input v-model="mQ.keyword" placeholder="标题 / 内容关键词" clearable :prefix-icon="'Search'"
              style="width: 220px" @keyup.enter="mQ.page = 1; loadMsgs()" />
            <el-select v-model="mQ.messageType" placeholder="消息类型" clearable style="width: 116px">
              <el-option v-for="t in ['待办消息', '预警消息', '通知消息', '公告消息']" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="mQ.status" placeholder="状态" clearable style="width: 96px">
              <el-option label="未读" value="未读" />
              <el-option label="已读" value="已读" />
            </el-select>
            <el-select v-model="mQ.priority" placeholder="优先级" clearable style="width: 96px">
              <el-option v-for="p in ['高', '中', '低']" :key="p" :label="p" :value="p" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="mQ.page = 1; loadMsgs()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(mQ, { keyword: '', messageType: '', status: '', priority: '', page: 1 }); loadMsgs()">重　置</el-button>
          </el-form>

          <div v-loading="mLoading" class="msg-list">
            <div v-for="m in mList" :key="m.messageId" class="msg" :class="{ 'is-unread': m.status === '未读' }"
              @click="openMsg(m)">
              <span class="msg__dot" :class="`is-${m.priority === '高' ? 'danger' : m.priority === '中' ? 'warning' : 'info'}`" />
              <div class="msg__b">
                <div class="msg__h">
                  <b class="msg__t">{{ m.title }}</b>
                  <el-tag :type="TYPE_TONE[m.messageType]" size="small" effect="plain">{{ m.messageType }}</el-tag>
                  <el-tag v-if="m.overdue" type="danger" size="small" effect="dark">已超期</el-tag>
                </div>
                <div class="msg__c">{{ m.content }}</div>
                <div class="msg__f">
                  <span><el-icon :size="10"><User /></el-icon>{{ m.sender }} → {{ m.receiver }}</span>
                  <span><el-icon :size="10"><Clock /></el-icon><span class="num">{{ m.sendTime }}</span></span>
                  <span v-if="m.deadline" :style="{ color: m.overdue ? 'var(--zh-danger)' : 'var(--zh-text-secondary)' }">
                    <el-icon :size="10"><AlarmClock /></el-icon>截止 <span class="num">{{ m.deadline }}</span>
                  </span>
                  <span class="msg__ch">{{ m.channels.join(' / ') }}</span>
                </div>
              </div>
              <el-tag :type="m.status === '未读' ? 'danger' : 'info'" size="small" :effect="m.status === '未读' ? 'dark' : 'plain'">
                {{ m.status }}
              </el-tag>
            </div>
            <EmptyState v-if="!mList.length" text="暂无消息" height="140px" />
          </div>

          <div class="pager">
            <span class="text-mini">共 {{ mTotal }} 条</span>
            <el-pagination v-model:current-page="mQ.page" v-model:page-size="mQ.pageSize" :total="mTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadMsgs" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 时限督办 ================= -->
      <el-tab-pane label="时限督办" name="supervision">
        <div v-loading="supLoading">
          <template v-if="sup">
            <div class="kpi-grid">
              <StatCard label="督办事项" :value="sup.overallStats.totalItems" unit="项" icon="Files" tone="primary" />
              <StatCard label="进行中" :value="sup.overallStats.inProgress" unit="项" icon="Loading" tone="accent" />
              <StatCard label="24小时内到期" :value="sup.overallStats.upcoming24h" unit="项" icon="AlarmClock" tone="warning" />
              <StatCard label="已超期" :value="sup.overallStats.overdue" unit="项" icon="Warning" tone="danger" />
              <StatCard label="按时完成率" :value="sup.overallStats.onTimeRate * 100" unit="%" icon="CircleCheck" tone="success" :precision="1" />
              <StatCard label="平均办理时长" :value="sup.overallStats.avgDuration" icon="Timer" tone="primary" />
            </div>

            <div class="sup-grid">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">时效趋势（近6个月）</span>
                </div>
                <EChart :option="supTrendOption" height="230px" />
              </div>
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">事项类型时效（绿=按时 红=超期）</span>
                </div>
                <EChart :option="supTypeOption" height="230px" />
              </div>
            </div>

            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">督办事项清单</span>
                <span class="section-title__desc">到期前 24h/2h 自动提醒 · 超期自动升级 · 可人工发起督办单</span>
              </div>
              <el-table :data="sup.items" size="small" border stripe>
                <el-table-column prop="itemName" label="督办事项" min-width="220" show-overflow-tooltip />
                <el-table-column prop="itemType" label="类型" width="96" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" effect="plain">{{ row.itemType }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="module" label="所属智能体" width="150" show-overflow-tooltip />
                <el-table-column prop="assignee" label="承办人" width="150" show-overflow-tooltip />
                <el-table-column prop="deadline" label="截止时间" width="150">
                  <template #default="{ row }"><span class="num text-mini">{{ row.deadline }}</span></template>
                </el-table-column>
                <el-table-column label="剩余/超期" width="96" align="center">
                  <template #default="{ row }">
                    <span v-if="row.overdue" class="num" style="color: var(--zh-danger); font-weight: 700">超期 {{ row.overdueDays }} 天</span>
                    <span v-else class="num" :style="{ color: (row.remainHours ?? 99) <= 4 ? 'var(--zh-danger)' : 'var(--zh-text-regular)' }">
                      余 {{ row.remainHours }} 小时
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="86" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.status === '已超期' ? 'danger' : row.status === '临期' ? 'warning' : 'primary'" size="small" effect="dark">{{ row.status }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="督办级别" width="96" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.supervisionLevel === '重点督办' ? 'danger' : 'info'" size="small" effect="plain">{{ row.supervisionLevel }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="86" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-button link type="warning" :icon="'BellFilled'" :loading="urging === row.itemId" @click="doUrge(row)">督办</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="sup-grid">
              <div class="section-card">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">组织时效排名</span>
                </div>
                <el-table :data="sup.byOrg" size="small" border stripe>
                  <el-table-column type="index" label="#" width="46" align="center" />
                  <el-table-column prop="org" label="组织" min-width="110" />
                  <el-table-column prop="total" label="事项" width="70" align="right" />
                  <el-table-column label="超期" width="70" align="right">
                    <template #default="{ row }">
                      <span class="num" :style="{ color: row.overdue > 0 ? 'var(--zh-danger)' : 'var(--zh-text-placeholder)' }">{{ row.overdue }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="按时率" width="130">
                    <template #default="{ row }">
                      <el-progress :percentage="Math.round(row.onTimeRate * 100)" :stroke-width="8" :text-inside="true"
                        :status="row.onTimeRate >= 0.97 ? 'success' : row.onTimeRate >= 0.94 ? undefined : 'warning'" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="avgDuration" label="平均时长" width="90" align="right">
                    <template #default="{ row }"><span class="num text-mini">{{ row.avgDuration }}</span></template>
                  </el-table-column>
                </el-table>
              </div>

              <div class="section-card">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">督办规则</span>
                  <span class="section-title__desc">超时动作自动执行并全程留痕，可启停与编辑</span>
                </div>
                <div class="srules">
                  <div v-for="r in sup.rules" :key="r.ruleId" class="srule" :class="{ 'is-off': !r.enabled }">
                    <div class="srule__b">
                      <div class="srule__n">
                        {{ r.name }}
                        <el-tag size="small" effect="plain" type="info" style="margin-left: 5px">{{ r.trigger }}</el-tag>
                      </div>
                      <div class="srule__a text-mini">动作：{{ r.action }}</div>
                    </div>
                    <el-button link type="primary" size="small" :icon="'EditPen'" @click="openSupRuleForm(r)" />
                    <el-switch :model-value="r.enabled" size="small" @change="doToggleSupRule(r)" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 超期升级示例 -->
            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">超期升级示例：芜湖XX医院整改验收（超期 15 天 · 重点督办）</span>
              </div>
              <div class="esc">
                <div class="esc__order">
                  <div class="esc__h">
                    <el-icon :size="13" style="color: var(--zh-danger)"><WarnTriangleFilled /></el-icon>
                    <b>督办单 {{ sup.items[1]?.supervisionOrder?.orderId }}</b>
                    <el-tag type="warning" size="small" effect="dark">{{ sup.items[1]?.supervisionOrder?.status }}</el-tag>
                  </div>
                  <div class="esc__c">{{ sup.items[1]?.supervisionOrder?.content }}</div>
                  <div class="text-mini" style="margin-top: 5px">超期原因：{{ sup.items[1]?.overdueReason }}</div>
                </div>
                <el-timeline class="esc__tl">
                  <el-timeline-item v-for="(h, i) in sup.items[1]?.escalationHistory || []" :key="i"
                    type="danger" :timestamp="h.time" size="normal">
                    <div class="tl__n">{{ h.level }} · {{ h.action }}</div>
                    <div class="tl__d">{{ h.result }}</div>
                  </el-timeline-item>
                </el-timeline>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 消息详情抽屉 ============ -->
    <el-drawer v-model="mDrawer" size="520px" title="消息详情">
      <template v-if="curMsg">
        <div class="dt-hero">
          <div class="dt-hero__t">
            {{ curMsg.title }}
            <el-tag :type="PRI_TONE[curMsg.priority]" size="small" effect="dark">{{ curMsg.priority }}优先级</el-tag>
          </div>
          <div class="dt-hero__m">
            <span><el-icon><Ticket /></el-icon>{{ curMsg.messageId }}</span>
            <span><el-icon><Clock /></el-icon>{{ curMsg.sendTime }}</span>
          </div>
        </div>

        <div class="sub-title">消息内容</div>
        <div class="msg-content">{{ curMsg.content }}</div>

        <div class="sub-title">发送信息</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="发送方">{{ curMsg.sender }}</el-descriptions-item>
          <el-descriptions-item label="接收方">{{ curMsg.receiver }}</el-descriptions-item>
          <el-descriptions-item label="推送渠道">{{ curMsg.channels.join('、') }}</el-descriptions-item>
          <el-descriptions-item v-if="curMsg.deadline" label="办理时限">
            <span class="num" :style="{ color: curMsg.overdue ? 'var(--zh-danger)' : 'var(--zh-text-primary)' }">{{ curMsg.deadline }}</span>
            <el-tag v-if="curMsg.overdue" type="danger" size="small" effect="dark" style="margin-left: 6px">已超期</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="dt-actions">
          <el-button type="primary" :icon="'Right'" @click="msg.success(`已跳转至${curMsg.actionType === '跳转处理' ? '业务处理页面' : '详情页'}（Mock）`)">
            {{ curMsg.actionType }}
          </el-button>
        </div>
      </template>
    </el-drawer>
    <!-- ============ 督办规则编辑弹窗 ============ -->
    <el-dialog v-model="srfVisible" title="编辑督办规则" width="520px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="规则名称" required>
          <el-input v-model="srf.name" />
        </el-form-item>
        <el-form-item label="触发时机" required>
          <el-select v-model="srf.trigger" style="width: 100%">
            <el-option v-for="t in ['距截止24小时', '距截止2小时', '超过截止时间', '超期24小时', '超期7天']" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行动作" required>
          <el-input v-model="srf.action" placeholder="如：系统消息+短信+上级通知" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="srfVisible = false">取消</el-button>
        <el-button type="primary" :loading="srfSaving" @click="doSaveSupRule">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 消息订阅设置弹窗 ============ -->
    <el-dialog v-model="subVisible" title="消息订阅设置" width="540px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="订阅类型">
          <el-checkbox-group v-model="sub.types">
            <el-checkbox v-for="t in ['待办消息', '预警消息', '通知消息', '公告消息']" :key="t" :label="t" style="margin-right: 14px" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="接收渠道">
          <el-checkbox-group v-model="sub.channels">
            <el-checkbox v-for="c in ['系统站内消息', '短信', '企业微信', '邮件']" :key="c" :label="c" style="margin-right: 14px" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="免打扰">
          <el-switch v-model="sub.dnd" active-text="开启免打扰" />
        </el-form-item>
        <el-form-item v-if="sub.dnd" label="免打扰时段">
          <el-time-select v-model="sub.dndStart" start="18:00" end="23:30" step="00:30" style="width: 120px" />
          <span style="margin: 0 8px">至</span>
          <el-time-select v-model="sub.dndEnd" start="00:00" end="12:00" step="00:30" style="width: 120px" />
          <div class="text-mini" style="margin-top: 4px">免打扰期间仅推送高优先级预警消息</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subVisible = false">取消</el-button>
        <el-button type="primary" :loading="subSaving" @click="doSaveSubscribe">保存设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1400px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.msg-list { display: flex; flex-direction: column; gap: 8px; }

.msg {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  background: #fff; border: 1px solid var(--zh-border-light);
  transition: all .18s;

  &:hover { box-shadow: var(--zh-shadow-sm); border-color: var(--zh-primary); }
  &.is-unread { background: var(--zh-primary-lighter); border-color: var(--zh-primary-light); }

  &__dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 7px;
    &.is-danger { background: var(--zh-danger); }
    &.is-warning { background: var(--zh-warning); }
    &.is-info { background: var(--zh-info); }
  }

  &__b { flex: 1; min-width: 0; }
  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  }
  &__t { font-size: 12.5px; font-weight: 700; color: var(--zh-text-primary); }
  &__c {
    margin-top: 4px; font-size: 11px; line-height: 1.75; color: var(--zh-text-secondary);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  &__f {
    display: flex; gap: 14px; flex-wrap: wrap; margin-top: 5px;
    font-size: 10px; color: var(--zh-text-placeholder);
    span { display: inline-flex; align-items: center; gap: 3px; }
  }
  &__ch { color: var(--zh-text-placeholder); }
}

.msg-content {
  padding: 12px 14px; border-radius: 8px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: 12px; line-height: 1.9; color: var(--zh-text-regular); text-align: justify;
}

.sup-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.esc {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }

  &__order {
    padding: 12px 14px; border-radius: 8px;
    background: var(--zh-risk-high-bg); border: 1px solid var(--zh-risk-high-border);
  }
  &__h {
    display: flex; align-items: center; gap: 6px;
    b { font-size: 12.5px; color: var(--zh-text-primary); }
  }
  &__c { margin-top: 7px; font-size: 11.5px; line-height: 1.85; color: var(--zh-text-regular); }
}

.sub-title {
  margin: 16px 0 10px;
  font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.tl__n { font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-primary); }
.tl__d { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; line-height: 1.6; }

.srules { display: flex; flex-direction: column; gap: 7px; }

.srule {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  transition: border-color .15s;

  &:hover { border-color: var(--zh-primary-light); }
  &.is-off { opacity: .55; }

  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 11.5px; font-weight: 700; color: var(--zh-text-primary); }
  &__a { margin-top: 3px; }
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

.dt-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
