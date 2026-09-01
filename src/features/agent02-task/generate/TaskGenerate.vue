<script setup lang="ts">
import {
  getClusterGroups, getTaskDraft, confirmTask, getTaskTypes,
  dispatchTask, getDispatchRecords, getTaskList
} from '@/api/agent02-task/task'
import { fmtMoney, CHART_COLORS, riskColor } from '@/utils/format'

const msg = ElMessage

/* ---------- 聚类分组 ---------- */
const groups = ref<any[]>([])
const groupLoading = ref(false)
const activeDraftId = ref('')
const draft = ref<any>(null)
const draftLoading = ref(false)

/* ---------- 任务类型 ---------- */
const taskTypes = ref<any[]>([])
const curTypeCfg = computed(() =>
  taskTypes.value.find((t) => t.typeName === form.taskType) || null
)

/* ---------- 立项表单 ---------- */
const form = reactive({
  taskName: '',
  taskType: '',
  inspectMethod: '',
  priority: '',
  deadline: '',
  assigneeGroup: '',
  members: [] as string[],
  noticeOrg: true,
  remark: ''
})

/* ---------- 派发 ---------- */
const pendingTasks = ref<any[]>([])
const pendingLoading = ref(false)
const selection = ref<any[]>([])
const dispatchVisible = ref(false)
const dispatching = ref(false)
const dispatchForm = reactive({
  dispatchType: '批量派发',
  assigneeGroup: '稽核一组',
  members: [] as string[],
  leader: '',
  noticeOrg: true,
  signHours: 24,
  remark: ''
})

const records = ref<any[]>([])

const GROUPS = ['稽核一组', '稽核二组', '稽核三组', '基金监管处', '飞行检查组']
const MEMBERS = ['稽核员·王振华', '稽核员·李明华', '稽核员·陈晓东', '稽核员·刘丽娟', '稽核员·周文斌', '稽核员·徐海燕']

/* ---------- 加载 ---------- */
async function loadGroups() {
  groupLoading.value = true
  try {
    groups.value = (await getClusterGroups()) || []
    if (groups.value.length && !activeDraftId.value) {
      pickGroup(groups.value[0])
    }
  } finally {
    groupLoading.value = false
  }
}

async function loadPending() {
  pendingLoading.value = true
  try {
    const res: any = await getTaskList({ status: '待派发', page: 1, pageSize: 50 })
    pendingTasks.value = res?.list || []
  } finally {
    pendingLoading.value = false
  }
}

async function pickGroup(g: any) {
  activeDraftId.value = g.draftId
  draftLoading.value = true
  try {
    draft.value = await getTaskDraft(g.draftId)
    const el = draft.value?.taskElements
    if (el) {
      form.taskName = el.taskName
      form.taskType = el.taskType
      form.inspectMethod = el.inspectMethod
      form.priority = el.priority
      form.deadline = el.timeLimit?.deadline || ''
      form.assigneeGroup = el.recommendedGroup?.groupName || '稽核一组'
      form.members = MEMBERS.slice(0, 3)
      form.noticeOrg = el.taskType !== '飞行检查'
    }
  } finally {
    draftLoading.value = false
  }
}

/* 任务类型切换时联动时限 */
watch(() => form.taskType, (v) => {
  const cfg = taskTypes.value.find((t) => t.typeName === v)
  if (cfg && draft.value) {
    // 飞行检查不预先通知机构
    if (v === '飞行检查') form.noticeOrg = false
  }
})

const submitting = ref(false)
async function doConfirm() {
  if (!draft.value) return
  if (!form.taskName.trim()) { msg.warning('请填写任务名称'); return }
  if (!form.members.length) { msg.warning('请选择承办人员'); return }
  submitting.value = true
  try {
    const res: any = await confirmTask({
      draftId: draft.value.draftId,
      groupId: draft.value.groupId,
      ...form
    })
    msg.success(`立项成功，任务编号 ${res?.taskId || ''}`)
    await loadPending()
  } finally {
    submitting.value = false
  }
}

function openDispatch() {
  if (!selection.value.length) { msg.warning('请先勾选待派发任务'); return }
  // 分级派发时按风险自动匹配
  const hasHigh = selection.value.some((t) => t.riskLevel === '高')
  dispatchForm.assigneeGroup = hasHigh ? '飞行检查组' : '稽核一组'
  dispatchForm.members = MEMBERS.slice(0, 2)
  dispatchForm.leader = MEMBERS[0]
  dispatchVisible.value = true
}

async function doDispatch() {
  if (!dispatchForm.members.length) { msg.warning('请选择承办人员'); return }
  dispatching.value = true
  try {
    await dispatchTask({
      taskIds: selection.value.map((t) => t.taskId),
      ...dispatchForm
    })
    msg.success(`已${dispatchForm.dispatchType} ${selection.value.length} 个任务，承办人将在 ${dispatchForm.signHours} 小时内签收`)
    dispatchVisible.value = false
    selection.value = []
    await Promise.all([loadPending(), loadRecords()])
  } finally {
    dispatching.value = false
  }
}

async function loadRecords() {
  records.value = (await getDispatchRecords()) || []
}

/* ---------- 图表：风险分布 ---------- */
const riskOption = computed(() => {
  const dist = draft.value?.riskDistribution || {}
  const data = [
    { name: '高风险', value: dist['高'] || 0, itemStyle: { color: '#e5484d' } },
    { name: '中风险', value: dist['中'] || 0, itemStyle: { color: '#e8a30c' } },
    { name: '低风险', value: dist['低'] || 0, itemStyle: { color: '#12a150' } }
  ]
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 条 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['46%', '68%'],
      center: ['50%', '44%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data
    }]
  }
})

const clusterDimText = computed(() => {
  const dim = draft.value?.clusterDim || {}
  const map: Record<string, string> = { org: '机构', region: '区域', orgType: '机构类型', violationType: '违规类型', riskLevel: '风险等级', dept: '科室' }
  return Object.keys(dim).map((k) => `${map[k] || k}：${dim[k]}`).join(' · ')
})

const TYPE_TONE: Record<string, string> = { 日常稽核: 'primary', 专项检查: 'success', 飞行检查: 'danger', 联合督查: 'warning' }

onMounted(async () => {
  taskTypes.value = (await getTaskTypes()) || []
  await Promise.all([loadGroups(), loadPending(), loadRecords()])
})
</script>

<template>
  <div class="zh-page">
    <PageHeader title="任务智能生成与派发" tag="M16"
      subtitle="线索智能聚类 · 合并去重 · 要素自动预填 · 多方式精准派达">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadGroups(); loadPending()">刷新</el-button>
        <el-button type="primary" :icon="'Promotion'" :disabled="!selection.length" @click="openDispatch">
          派发任务<template v-if="selection.length">（{{ selection.length }}）</template>
        </el-button>
      </template>
    </PageHeader>

    <!-- ============ 第一步：线索聚类分组 ============ -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">线索智能聚类</span>
        <span class="section-title__desc">
          按机构 &gt; 违规类型 &gt; 风险等级 &gt; 科室 &gt; 区域优先级归并，高风险线索优先单独成任务
        </span>
        <span class="section-title__extra">
          <el-tag size="small" effect="plain">共 {{ groups.length }} 个分组</el-tag>
        </span>
      </div>

      <div v-loading="groupLoading" class="cluster-grid">
        <div v-for="g in groups" :key="g.draftId" class="cl-card"
          :class="{ 'is-active': activeDraftId === g.draftId }" @click="pickGroup(g)">
          <div class="cl-card__top">
            <span class="cl-card__id num">{{ g.groupId }}</span>
            <el-tag :type="(TYPE_TONE[g.suggestedTaskType] as any) || 'info'" size="small" effect="dark">
              {{ g.suggestedTaskType }}
            </el-tag>
          </div>
          <div class="cl-card__name">{{ g.groupName }}</div>
          <div class="cl-card__stat">
            <div class="cl-card__cell">
              <span class="cl-card__v num">{{ g.clueCount }}</span>
              <span class="cl-card__l">线索</span>
            </div>
            <div class="cl-card__cell">
              <span class="cl-card__v num">{{ g.orgCount }}</span>
              <span class="cl-card__l">机构</span>
            </div>
            <div class="cl-card__cell">
              <span class="cl-card__v num num--money-mild">{{ fmtMoney(g.totalSuspectedAmount) }}</span>
              <span class="cl-card__l">疑似金额</span>
            </div>
          </div>
          <div class="cl-card__risk">
            <span v-if="g.riskDistribution['高']" class="rk rk--h">高 {{ g.riskDistribution['高'] }}</span>
            <span v-if="g.riskDistribution['中']" class="rk rk--m">中 {{ g.riskDistribution['中'] }}</span>
            <span v-if="g.riskDistribution['低']" class="rk rk--l">低 {{ g.riskDistribution['低'] }}</span>
          </div>
        </div>
        <EmptyState v-if="!groups.length && !groupLoading" text="暂无待立项聚类分组" height="130px" />
      </div>
    </div>

    <!-- ============ 第二步：去重 + 要素确认 ============ -->
    <div v-if="draft" v-loading="draftLoading" class="gen-layout">
      <!-- 左：合并去重 -->
      <div class="section-card">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">合并去重</span>
          <span class="section-title__desc">剔除重复与交叉线索，避免重复立项</span>
        </div>

        <div class="dedupe-bar">
          <div class="dedupe-bar__cell">
            <div class="dedupe-bar__v num">{{ draft.dedupeInfo.beforeCount }}</div>
            <div class="dedupe-bar__l">去重前</div>
          </div>
          <el-icon class="dedupe-bar__arrow"><Right /></el-icon>
          <div class="dedupe-bar__cell is-merged">
            <div class="dedupe-bar__v num">{{ draft.dedupeInfo.mergedCount }}</div>
            <div class="dedupe-bar__l">已合并</div>
          </div>
          <el-icon class="dedupe-bar__arrow"><Right /></el-icon>
          <div class="dedupe-bar__cell is-final">
            <div class="dedupe-bar__v num">{{ draft.dedupeInfo.afterCount }}</div>
            <div class="dedupe-bar__l">最终纳入</div>
          </div>
        </div>

        <div class="sub-title">合并记录</div>
        <div class="merge-list">
          <div v-for="m in draft.dedupeInfo.mergeRecords" :key="m.mergeId" class="mg">
            <div class="mg__head">
              <el-tag size="small" :type="m.mergeType === '完全重复' ? 'danger' : 'warning'" effect="plain">
                {{ m.mergeType }}
              </el-tag>
              <span class="mg__kept num">保留 {{ m.keptClueId }}</span>
              <span class="mg__amt num num--money">{{ fmtMoney(m.keptAmount) }}</span>
            </div>
            <div class="mg__merged">
              合并 <b class="num">{{ m.mergedClueIds.length }}</b> 条：
              <span v-for="c in m.mergedClueIds" :key="c" class="mg__cid num">{{ c }}</span>
            </div>
            <div class="mg__reason">{{ m.mergeReason }}</div>
          </div>
          <EmptyState v-if="!draft.dedupeInfo.mergeRecords.length" text="本分组无重复线索" height="90px" />
        </div>

        <div class="sub-title">风险等级分布</div>
        <EChart :option="riskOption" height="168px" />
      </div>

      <!-- 右：任务要素 -->
      <div class="section-card">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">任务要素生成</span>
          <span class="section-title__desc">系统已自动预填，可人工调整后确认立项</span>
          <span class="section-title__extra">
            <span class="text-mini">草稿号 <b class="num">{{ draft.draftId }}</b></span>
          </span>
        </div>

        <el-alert type="info" :closable="false" show-icon class="mb10">
          <template #title>
            <span class="text-mini">聚类维度：{{ clusterDimText }}</span>
          </template>
        </el-alert>

        <el-form label-width="88px" class="el-form-tight">
          <el-form-item label="任务名称" required>
            <el-input v-model="form.taskName" placeholder="按规则自动生成，可调整" />
          </el-form-item>

          <div class="form-row">
            <el-form-item label="任务类型" required>
              <el-select v-model="form.taskType" style="width: 100%">
                <el-option v-for="t in taskTypes" :key="t.typeCode" :label="t.typeName" :value="t.typeName">
                  <span>{{ t.typeName }}</span>
                  <span class="text-mini" style="float: right">{{ t.defaultDays }} 工作日</span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%">
                <el-option label="高" value="高" />
                <el-option label="中" value="中" />
                <el-option label="低" value="低" />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item v-if="curTypeCfg" label="类型说明">
            <div class="type-cfg">
              <div class="type-cfg__desc">{{ curTypeCfg.description }}</div>
              <div class="type-cfg__meta">
                <span><el-icon><Clock /></el-icon>{{ curTypeCfg.defaultDays }} 工作日</span>
                <span><el-icon><Stamp /></el-icon>{{ curTypeCfg.approvalLevel }}</span>
                <span v-if="curTypeCfg.needPlan"><el-icon><Document /></el-icon>需制定检查方案</span>
              </div>
              <div class="type-cfg__docs">
                <span class="text-mini">派发同步生成空白文书：</span>
                <el-tag v-for="d in curTypeCfg.documentTemplates" :key="d" size="small" effect="plain" class="mr4">
                  {{ d }}
                </el-tag>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="检查范围">
            <div class="scope">
              <div class="scope__row">
                <span class="scope__k">机构</span>
                <span class="scope__v">{{ draft.taskElements.inspectScope.orgs.join('、') }}</span>
              </div>
              <div class="scope__row">
                <span class="scope__k">科室</span>
                <span class="scope__v">{{ draft.taskElements.inspectScope.depts.join('、') }}</span>
              </div>
              <div class="scope__row">
                <span class="scope__k">时间段</span>
                <span class="scope__v num">{{ draft.taskElements.inspectScope.timeRange }}</span>
              </div>
              <div class="scope__row">
                <span class="scope__k">违规类型</span>
                <span class="scope__v">
                  <el-tag v-for="v in draft.taskElements.inspectScope.violationTypes" :key="v"
                    size="small" type="warning" effect="plain" class="mr4">{{ v }}</el-tag>
                </span>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="疑点清单">
            <el-table :data="draft.taskElements.clueList" size="small" border stripe max-height="180">
              <el-table-column prop="clueId" label="线索编号" width="150">
                <template #default="{ row }"><span class="num">{{ row.clueId }}</span></template>
              </el-table-column>
              <el-table-column prop="violationType" label="违规类型" width="110" />
              <el-table-column prop="dept" label="科室" width="100" />
              <el-table-column prop="riskLevel" label="风险" width="70" align="center">
                <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
              </el-table-column>
              <el-table-column prop="amount" label="疑似金额" align="right">
                <template #default="{ row }">
                  <span class="num num--money">{{ fmtMoney(row.amount) }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div class="clue-sum">
              纳入线索 <b class="num">{{ draft.taskElements.totalClueCount }}</b> 条 ·
              疑似违规金额 <b class="num num--money">{{ fmtMoney(draft.taskElements.totalSuspectedAmount) }}</b>
            </div>
          </el-form-item>

          <div class="form-row">
            <el-form-item label="办理时限">
              <el-date-picker v-model="form.deadline" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="按类型自动计算" style="width: 100%" />
            </el-form-item>
            <el-form-item label="检查方式">
              <el-select v-model="form.inspectMethod" style="width: 100%">
                <el-option label="线上自查为主" value="线上自查为主" />
                <el-option label="线上+现场结合" value="线上+现场结合" />
                <el-option label="现场检查为主" value="现场检查为主" />
              </el-select>
            </el-form-item>
          </div>

          <div class="node-hint">
            <span>自查截止 <b class="num">{{ draft.taskElements.timeLimit.selfCheckDeadline }}</b></span>
            <span>核查截止 <b class="num">{{ draft.taskElements.timeLimit.inspectionDeadline }}</b></span>
            <span>共 <b class="num">{{ draft.taskElements.timeLimit.workdays }}</b> 工作日</span>
          </div>

          <div class="form-row">
            <el-form-item label="承办组" required>
              <el-select v-model="form.assigneeGroup" style="width: 100%">
                <el-option v-for="g in GROUPS" :key="g" :label="g" :value="g" />
              </el-select>
            </el-form-item>
            <el-form-item label="通知机构">
              <el-switch v-model="form.noticeOrg" :disabled="form.taskType === '飞行检查'" />
              <span class="text-mini ml8">
                {{ form.taskType === '飞行检查' ? '飞行检查不预先告知' : '派发时同步通知被检机构' }}
              </span>
            </el-form-item>
          </div>

          <el-form-item label="承办人员" required>
            <el-select v-model="form.members" multiple collapse-tags collapse-tags-tooltip style="width: 100%">
              <el-option v-for="m in MEMBERS" :key="m" :label="m" :value="m" />
            </el-select>
          </el-form-item>

          <el-form-item label="推荐依据">
            <div class="rec">
              <el-icon><MagicStick /></el-icon>
              系统按辖区（{{ draft.taskElements.recommendedGroup.jurisdiction }}）与专长（{{
                draft.taskElements.recommendedGroup.specialty.join('、') }}）推荐
              <b>{{ draft.taskElements.recommendedGroup.groupName }}</b>
            </div>
          </el-form-item>

          <el-form-item label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="补充说明（选填）" />
          </el-form-item>

          <div class="form-actions">
            <el-button :icon="'RefreshLeft'" @click="pickGroup({ draftId: activeDraftId })">重置要素</el-button>
            <el-button type="primary" :icon="'CircleCheck'" :loading="submitting" @click="doConfirm">
              确认立项
            </el-button>
          </div>
        </el-form>
      </div>
    </div>

    <!-- ============ 第三步：待派发任务 ============ -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">待派发任务</span>
        <span class="section-title__desc">
          支持批量派发、定向派发、按风险分级派发；派发后限时签收，未签收自动提醒升级
        </span>
        <span class="section-title__extra">
          <el-tag size="small" type="warning" effect="plain">{{ pendingTasks.length }} 个待派发</el-tag>
        </span>
      </div>

      <div class="table-toolbar">
        <el-button type="primary" :icon="'Promotion'" :disabled="!selection.length" @click="openDispatch">
          派发选中<template v-if="selection.length">（{{ selection.length }}）</template>
        </el-button>
        <span class="text-mini">已选 {{ selection.length }} 项</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Refresh'" @click="loadPending">刷新</el-button>
        </div>
      </div>

      <el-table :data="pendingTasks" size="small" border stripe v-loading="pendingLoading"
        max-height="330" @selection-change="(v: any[]) => (selection = v)">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="taskId" label="任务编号" width="150">
          <template #default="{ row }"><span class="num">{{ row.taskId }}</span></template>
        </el-table-column>
        <el-table-column prop="taskName" label="任务名称" min-width="240" show-overflow-tooltip />
        <el-table-column prop="taskType" label="任务类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="(TYPE_TONE[row.taskType] as any) || 'info'" size="small" effect="plain">
              {{ row.taskType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="riskLevel" label="风险" width="70" align="center">
          <template #default="{ row }"><RiskTag :level="row.riskLevel" /></template>
        </el-table-column>
        <el-table-column prop="inspectOrg" label="被检机构" min-width="170" show-overflow-tooltip />
        <el-table-column prop="clueCount" label="线索" width="70" align="right">
          <template #default="{ row }"><span class="num">{{ row.clueCount }}</span></template>
        </el-table-column>
        <el-table-column prop="totalSuspectedAmount" label="疑似金额" width="120" align="right">
          <template #default="{ row }">
            <span class="num num--money">{{ fmtMoney(row.totalSuspectedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="deadline" label="办理时限" width="150">
          <template #default="{ row }"><span class="num text-mini">{{ row.deadline }}</span></template>
        </el-table-column>
        <template #empty><EmptyState text="暂无待派发任务" height="120px" /></template>
      </el-table>
    </div>

    <!-- ============ 派发记录 ============ -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">近期派发记录</span>
        <span class="section-title__desc">派发方式、承办对象与机构通知情况留痕</span>
      </div>

      <div class="rec-list">
        <div v-for="r in records" :key="r.dispatchId" class="dr">
          <div class="dr__head">
            <span class="dr__id num">{{ r.dispatchId }}</span>
            <el-tag size="small" effect="dark"
              :type="r.dispatchType === '批量派发' ? 'primary' : r.dispatchType === '定向派发' ? 'success' : 'warning'">
              {{ r.dispatchType }}
            </el-tag>
            <span class="dr__op"><el-icon><User /></el-icon>{{ r.operator }}</span>
            <span class="dr__time num">{{ r.dispatchTime }}</span>
            <span class="dr__cnt">{{ r.tasks.length }} 个任务</span>
          </div>
          <div class="dr__tasks">
            <div v-for="t in r.tasks" :key="t.taskId" class="dt">
              <span class="dt__id num">{{ t.taskId }}</span>
              <el-tag :type="(TYPE_TONE[t.taskType] as any) || 'info'" size="small" effect="plain">
                {{ t.taskType }}
              </el-tag>
              <RiskTag :level="t.riskLevel" />
              <span class="dt__name">{{ t.taskName }}</span>
              <span class="dt__grp">
                <el-icon><UserFilled /></el-icon>{{ t.assigneeGroup }} · {{ t.leader }}
              </span>
              <el-tag v-if="t.noticeOrg" size="small" type="success" effect="plain">已通知机构</el-tag>
              <el-tag v-else size="small" type="danger" effect="plain">不预先通知</el-tag>
            </div>
          </div>
        </div>
        <EmptyState v-if="!records.length" text="暂无派发记录" height="100px" />
      </div>
    </div>

    <!-- ============ 派发弹窗 ============ -->
    <el-dialog v-model="dispatchVisible" title="任务派发" width="620px">
      <el-alert type="warning" :closable="false" show-icon class="mb12">
        <template #title>
          <span class="text-mini">
            共选中 <b class="num">{{ selection.length }}</b> 个任务，其中高风险
            <b class="num">{{ selection.filter((t) => t.riskLevel === '高').length }}</b> 个；
            分级派发时高风险任务将自动匹配市级检查组
          </span>
        </template>
      </el-alert>

      <el-form label-width="92px">
        <el-form-item label="派发方式" required>
          <el-radio-group v-model="dispatchForm.dispatchType">
            <el-radio-button label="批量派发" />
            <el-radio-button label="定向派发" />
            <el-radio-button label="分级派发" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="派发说明">
          <div class="dp-hint">
            <template v-if="dispatchForm.dispatchType === '批量派发'">
              多个任务一次派发至同一检查组，适合同类任务集中处理
            </template>
            <template v-else-if="dispatchForm.dispatchType === '定向派发'">
              指定具体承办人，不受辖区与专长限制，适合特殊任务安排
            </template>
            <template v-else>
              高风险 → 市级检查组／资深稽核员；中风险 → 区县级检查组；低风险 → 机构自查为主、监管抽查
            </template>
          </div>
        </el-form-item>
        <el-form-item label="承办组" required>
          <el-select v-model="dispatchForm.assigneeGroup" style="width: 100%">
            <el-option v-for="g in GROUPS" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="承办人员" required>
          <el-select v-model="dispatchForm.members" multiple collapse-tags style="width: 100%">
            <el-option v-for="m in MEMBERS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="组长">
          <el-select v-model="dispatchForm.leader" clearable style="width: 100%">
            <el-option v-for="m in dispatchForm.members" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="签收时限">
          <el-input-number v-model="dispatchForm.signHours" :min="1" :max="72" :controls="false" style="width: 110px" />
          <span class="text-mini ml8">小时内签收，逾期自动提醒并升级至上级</span>
        </el-form-item>
        <el-form-item label="通知机构">
          <el-switch v-model="dispatchForm.noticeOrg" />
          <span class="text-mini ml8">同步推送检查通知书至被检机构（飞行检查除外）</span>
        </el-form-item>
        <el-form-item label="派发说明">
          <el-input v-model="dispatchForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dispatchVisible = false">取消</el-button>
        <el-button type="primary" :loading="dispatching" @click="doDispatch">确认派发</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mb10 { margin-bottom: 10px; }
.mb12 { margin-bottom: 12px; }
.mr4 { margin-right: 4px; }
.ml8 { margin-left: 8px; }

/* ---------- 聚类卡片 ---------- */
.cluster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 10px;
}

.cl-card {
  padding: 11px 12px;
  border-radius: var(--zh-radius);
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  cursor: pointer;
  transition: all .2s;

  &:hover { background: var(--zh-bg-hover); transform: translateY(-2px); box-shadow: var(--zh-shadow-sm); }
  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--zh-primary);
    box-shadow: 0 0 0 2px rgba(22, 104, 220, .12);
  }

  &__top { display: flex; align-items: center; justify-content: space-between; }
  &__id { font-size: 11px; color: var(--zh-text-secondary); font-weight: 700; }
  &__name {
    margin-top: 6px;
    font-size: var(--zh-font-sm);
    font-weight: 700;
    color: var(--zh-text-primary);
    line-height: 1.5;
    min-height: 38px;
  }
  &__stat {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
    margin-top: 8px; padding-top: 8px;
    border-top: 1px dashed var(--zh-border-light);
  }
  &__cell { text-align: center; }
  &__v { display: block; font-size: 15px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); }
  &__risk { display: flex; gap: 5px; margin-top: 8px; }
}

.rk {
  padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700;
  &--h { background: var(--zh-risk-high-bg); color: var(--zh-risk-high); border: 1px solid var(--zh-risk-high-border); }
  &--m { background: var(--zh-risk-mid-bg); color: var(--zh-risk-mid); border: 1px solid var(--zh-risk-mid-border); }
  &--l { background: var(--zh-risk-low-bg); color: var(--zh-risk-low); border: 1px solid var(--zh-risk-low-border); }
}

/* ---------- 生成布局 ---------- */
.gen-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 12px;
  align-items: start;
  @media (max-width: 1400px) { grid-template-columns: 1fr; }
}

.sub-title {
  margin: 14px 0 8px;
  font-size: var(--zh-font-xs);
  font-weight: 700;
  color: var(--zh-text-regular);
  padding-left: 7px;
  border-left: 2px solid var(--zh-accent);
}

/* ---------- 去重 ---------- */
.dedupe-bar {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__cell {
    flex: 1; text-align: center; padding: 6px 4px; border-radius: 6px;
    background: #fff; border: 1px solid var(--zh-border-light);
    &.is-merged { border-color: var(--zh-warning); background: var(--zh-warning-light); }
    &.is-final { border-color: var(--zh-success); background: var(--zh-success-light); }
  }
  &__v { font-size: 20px; font-weight: 800; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 1px; }
  &__arrow { color: var(--zh-text-placeholder); font-size: 13px; flex-shrink: 0; }
}

.merge-list { display: flex; flex-direction: column; gap: 7px; }

.mg {
  padding: 8px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--zh-warning);

  &__head { display: flex; align-items: center; gap: 7px; }
  &__kept { font-size: 11px; color: var(--zh-text-regular); font-weight: 700; }
  &__amt { margin-left: auto; font-size: 11px; }
  &__merged { margin-top: 5px; font-size: 11px; color: var(--zh-text-secondary); }
  &__cid { margin-right: 5px; color: var(--zh-text-placeholder); }
  &__reason {
    margin-top: 4px; font-size: 10px; line-height: 1.6;
    color: var(--zh-text-secondary);
    padding-top: 4px; border-top: 1px dashed var(--zh-border-light);
  }
}

/* ---------- 表单 ---------- */
.el-form-tight :deep(.el-form-item) { margin-bottom: 12px; }

.form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.type-cfg {
  width: 100%; padding: 8px 10px; border-radius: 6px;
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);

  &__desc { font-size: 11px; color: var(--zh-text-regular); line-height: 1.6; }
  &__meta {
    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__docs {
    margin-top: 6px; padding-top: 6px;
    border-top: 1px dashed var(--zh-primary-light);
    line-height: 2;
  }
}

.scope {
  width: 100%; padding: 8px 10px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__row { display: flex; gap: 8px; font-size: 11px; line-height: 2; }
  &__k { flex-shrink: 0; width: 52px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-primary); }
}

.clue-sum {
  margin-top: 6px; font-size: 11px; color: var(--zh-text-secondary); text-align: right;
  b { color: var(--zh-text-primary); }
}

.node-hint {
  display: flex; flex-wrap: wrap; gap: 16px;
  margin: -4px 0 12px 88px; font-size: 11px; color: var(--zh-text-secondary);
  b { color: var(--zh-primary); }
  @media (max-width: 900px) { margin-left: 0; }
}

.rec {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--zh-text-secondary); line-height: 1.7;
  :deep(.el-icon) { color: var(--zh-purple); }
  b { color: var(--zh-primary); }
}

.form-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
}

/* ---------- 派发记录 ---------- */
.rec-list { display: flex; flex-direction: column; gap: 9px; }

.dr {
  border-radius: var(--zh-radius);
  border: 1px solid var(--zh-border-light);
  overflow: hidden;

  &__head {
    display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
    padding: 8px 11px; background: var(--zh-bg-soft);
    border-bottom: 1px solid var(--zh-border-light);
  }
  &__id { font-size: 11px; font-weight: 700; color: var(--zh-text-primary); }
  &__op, &__time, &__cnt { font-size: 11px; color: var(--zh-text-secondary); display: inline-flex; align-items: center; gap: 3px; }
  &__cnt { margin-left: auto; }
  &__tasks { padding: 4px 11px 8px; }
}

.dt {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 0; font-size: 11px;
  & + & { border-top: 1px dashed var(--zh-border-light); }

  &__id { font-weight: 700; color: var(--zh-primary); }
  &__name { flex: 1; min-width: 130px; color: var(--zh-text-regular); }
  &__grp { display: inline-flex; align-items: center; gap: 3px; color: var(--zh-text-secondary); }
}

.dp-hint {
  font-size: 11px; line-height: 1.7; color: var(--zh-text-secondary);
  padding: 7px 10px; border-radius: 6px;
  background: var(--zh-info-light);
}
</style>
