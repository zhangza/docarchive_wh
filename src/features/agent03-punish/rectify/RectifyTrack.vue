<script setup lang="ts">
import {
  getRectifyStats, getRectifyList, getRectifyDetail,
  issueRectify, reviewRectifyItem, acceptRectify
} from '@/api/agent03-punish/punish'
import { CHART_COLORS, CHART_GRID } from '@/utils/format'
import { buildRectifyDoc, buildAcceptDoc, exportCsv, type LegalDoc } from '@/utils/legalDoc'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const expand = ref(false)

const q = reactive({ keyword: '', status: '', district: '', overdue: '', page: 1, pageSize: 15 })

const STATUS_TONE: Record<string, string> = {
  待整改: 'info', 整改中: 'warning', 待复查: 'primary', 复查不通过: 'danger', 已完成: 'success', 已超期: 'danger'
}
const ITEM_TONE: Record<string, string> = {
  待整改: 'info', 整改中: 'warning', 待复查: 'primary', 复查不通过: 'danger', 已完成: 'success'
}

async function loadStats() { st.value = await getRectifyStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getRectifyList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', status: '', district: '', overdue: '', page: 1 })
  load()
}
function quick(t: string) {
  doReset()
  if (t === 'overdue') q.overdue = 'true'
  else if (t === 'review') q.status = '待复查'
  else if (t === 'fail') q.status = '复查不通过'
  load()
}

/* ---------- 详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const detailLoading = ref(false)

async function openDetail(row: any) {
  drawer.value = true
  detailLoading.value = true
  try { cur.value = await getRectifyDetail(row.rectifyId) } finally { detailLoading.value = false }
}

/* ---------- 逐项复查 ---------- */
const rvVisible = ref(false)
const rvSaving = ref(false)
const rvItem = ref<any>(null)
const rvForm = reactive({ result: '通过', opinion: '' })

function openItemReview(item: any) {
  rvItem.value = item
  rvForm.result = '通过'
  rvForm.opinion = '经复查，整改措施落实到位，制度与系统改造已生效，同意通过'
  rvVisible.value = true
}

async function doItemReview() {
  if (!rvForm.opinion.trim()) { msg.warning('请填写复查意见'); return }
  rvSaving.value = true
  try {
    const res: any = await reviewRectifyItem({
      rectifyId: cur.value.rectifyId, itemId: rvItem.value.itemId, ...rvForm
    })
    msg.success(res?.message || '复查完成')
    rvVisible.value = false
    cur.value = await getRectifyDetail(cur.value.rectifyId)
    await Promise.all([loadStats(), load()])
  } finally { rvSaving.value = false }
}

/* ---------- 整体验收 ---------- */
const accepting = ref(false)
async function doAccept() {
  const undone = (cur.value?.items || []).filter((i: any) => i.status !== '已完成')
  if (undone.length) {
    msg.warning(`仍有 ${undone.length} 项整改事项未复查通过，暂不可验收`)
    return
  }
  await ElMessageBox.confirm('确认整改验收通过？将出具整改验收意见书并推进闭环销号。', '整改验收', {
    type: 'warning', confirmButtonText: '确认验收', cancelButtonText: '取消'
  }).then(async () => {
    accepting.value = true
    try {
      const res: any = await acceptRectify({ rectifyId: cur.value.rectifyId })
      msg.success(res?.message || '验收通过')
      cur.value.status = '已完成'
      await Promise.all([loadStats(), load()])
    } finally { accepting.value = false }
  }).catch(() => undefined)
}

/* ---------- 下达整改清单 ---------- */
const issueVisible = ref(false)
const issuing = ref(false)
const issueForm = reactive({
  orgName: '',
  deadline: '',
  items: [{ violationType: '', problem: '', requirement: '', deadline: '' }] as any[]
})

function openIssue() {
  Object.assign(issueForm, {
    orgName: '',
    deadline: '',
    items: [{ violationType: '重复收费', problem: '', requirement: '', deadline: '' }]
  })
  issueVisible.value = true
}
function addItem() {
  issueForm.items.push({ violationType: '', problem: '', requirement: '', deadline: '' })
}
function delItem(i: number) {
  if (issueForm.items.length <= 1) { msg.warning('至少保留一项整改事项'); return }
  issueForm.items.splice(i, 1)
}

async function doIssue() {
  if (!issueForm.orgName.trim()) { msg.warning('请填写被检机构'); return }
  const invalid = issueForm.items.some((i) => !i.violationType || !i.problem.trim() || !i.requirement.trim())
  if (invalid) { msg.warning('请完整填写每项整改事项'); return }
  issuing.value = true
  try {
    const res: any = await issueRectify(issueForm)
    msg.success(`${res?.message || '已下达'}，文号 ${res?.documentNo || ''}`)
    issueVisible.value = false
    await Promise.all([loadStats(), load()])
  } finally { issuing.value = false }
}

/* ---------- 图表 ---------- */
const statusOption = computed(() => {
  const d = (st.value?.statusDist || []).filter((i: any) => i.value > 0)
  const colors: Record<string, string> = {
    待整改: '#5a7189', 整改中: '#e8a30c', 待复查: '#1668dc',
    复查不通过: '#e5484d', 已完成: '#12a150', 已超期: '#d4380d'
  }
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 项 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i: any) => ({ name: i.name, value: i.value, itemStyle: { color: colors[i.name] } }))
    }]
  }
})

const districtOption = computed(() => {
  const d = st.value?.byDistrict || []
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { ...CHART_GRID, left: 44, bottom: 40 },
    xAxis: {
      type: 'category', data: d.map((i: any) => i.name),
      axisLabel: { fontSize: 10, interval: 0, rotate: 26, color: '#6b7a90' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', name: '案件数', nameTextStyle: { fontSize: 10, color: '#9aa7b8' },
      splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } },
      axisLabel: { fontSize: 10, color: '#9aa7b8' }
    },
    series: [{
      type: 'bar', barWidth: 20,
      itemStyle: { color: '#1668dc', borderRadius: [3, 3, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.count)
    }]
  }
})

const VIOLATION_OPTS = ['重复收费', '过度诊疗', '无指征收费', '超量开药', '串换药品', '虚假诊疗', '管理问题']

/* ---------- 文书预览 ---------- */
const docVisible = ref(false)
const curDoc = ref<LegalDoc | null>(null)

/** 整改意见书 / 整改验收意见书 */
function openDoc(kind: 'rectify' | 'accept') {
  if (!cur.value) return
  const seq = Number(String(cur.value.rectifyId).slice(-4)) || 1
  curDoc.value = kind === 'rectify' ? buildRectifyDoc(cur.value, seq) : buildAcceptDoc(cur.value, seq)
  docVisible.value = true
}

/** 导出整改跟踪台账 */
function doExportLedger() {
  if (!list.value.length) { msg.warning('当前无可导出数据'); return }
  const rows: any[] = []
  list.value.forEach((r: any) => {
    (r.items || []).forEach((it: any, i: number) => {
      rows.push([
        r.rectifyId, r.orgName, r.district, r.status, r.progress + '%',
        r.issueTime, r.deadline, r.overdue ? '是' : '否', r.reviewer,
        i + 1, it.violationType, it.problem, it.requirement, it.deadline, it.status,
        it.feedback ? '已反馈' : '未反馈', it.review?.result || '待复查'
      ])
    })
  })
  exportCsv(
    `整改跟踪台账_${new Date().toISOString().slice(0, 10)}`,
    ['整改编号', '整改机构', '辖区', '整体状态', '整改进度', '下达时间', '整改期限',
      '是否超期', '复查人', '事项序号', '违规类型', '存在问题', '整改要求',
      '事项时限', '事项状态', '机构反馈', '复查结论'],
    rows
  )
  msg.success(`已导出 ${list.value.length} 项整改任务、共 ${rows.length} 条整改事项`)
}

onMounted(() => { dict.load(); loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="整改跟踪" tag="M22"
      subtitle="整改清单逐项下达 · 机构在线反馈 · 监管复查验收 · 超期自动督办">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button :icon="'Warning'" @click="quick('overdue')">超期整改</el-button>
        <el-button type="primary" :icon="'EditPen'" @click="openIssue">下达整改清单</el-button>
      </template>
    </PageHeader>

    <!-- 指标 + 图表 -->
    <div class="top-grid">
      <div class="kpi-col">
        <StatCard label="整改任务" :value="st?.total || 0" unit="项" icon="Tickets" tone="primary" />
        <StatCard label="已完成" :value="st?.done || 0" unit="项" icon="CircleCheck" tone="success" />
        <StatCard label="已超期" :value="st?.overdue || 0" unit="项" icon="AlarmClock" tone="danger" clickable @click="quick('overdue')" />
        <StatCard label="整改完成率" :value="st?.completeRate || 0" unit="%" icon="TrendCharts" tone="accent" :precision="1" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">整改状态分布</span>
        </div>
        <EChart :option="statusOption" height="240px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">辖区整改分布</span>
        </div>
        <EChart :option="districtOption" height="240px" />
      </div>
    </div>

    <!-- 查询 -->
    <div class="section-card">
      <div class="section-title">
        <span class="section-title__dot" />
        <span class="section-title__text">整改任务查询</span>
        <span class="section-title__desc">逐项下达整改要求与时限，机构在线反馈后由监管复查验收</span>
      </div>
      <el-form class="query-form" :model="q" label-width="82px" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="q.keyword" placeholder="整改编号/机构" clearable :prefix-icon="'Search'" @keyup.enter="doQuery" />
        </el-form-item>
        <el-form-item label="整改状态">
          <el-select v-model="q.status" placeholder="全部状态" clearable>
            <el-option v-for="s in ['待整改', '整改中', '待复查', '复查不通过', '已完成', '已超期']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否超期">
          <el-select v-model="q.overdue" placeholder="全部" clearable>
            <el-option label="仅看超期" value="true" />
          </el-select>
        </el-form-item>
        <template v-if="expand">
          <el-form-item label="所属辖区">
            <el-select v-model="q.district" placeholder="全部辖区" clearable>
              <el-option v-for="d in dict.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </el-form-item>
        </template>
        <div class="query-form__actions">
          <el-button link type="primary" @click="expand = !expand">
            {{ expand ? '收起' : '展开' }}
            <el-icon><component :is="expand ? 'ArrowUp' : 'ArrowDown'" /></el-icon>
          </el-button>
          <el-button type="primary" :icon="'Search'" @click="doQuery">查　询</el-button>
          <el-button :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
        </div>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="section-card">
      <div class="table-toolbar">
        <el-button :icon="'DocumentChecked'" @click="quick('review')">待复查</el-button>
        <el-button :icon="'CircleClose'" @click="quick('fail')">复查不通过</el-button>
        <span class="text-mini">共 {{ total }} 项整改任务</span>
        <div class="table-toolbar__right">
          <el-button :icon="'Download'" @click="doExportLedger">导出台账</el-button>
        </div>
      </div>

      <el-table :data="list" size="small" border stripe v-loading="loading"
        :row-class-name="({ row }: any) => (row.overdue ? 'row-over' : '')">
        <el-table-column prop="rectifyId" label="整改编号" width="152">
          <template #default="{ row }">
            <span class="num text-link" @click="openDetail(row)">{{ row.rectifyId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orgName" label="整改机构" min-width="176" show-overflow-tooltip />
        <el-table-column prop="district" label="辖区" width="88" align="center" />
        <el-table-column label="整改事项" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.items.length }} 项</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="整改进度" width="136">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="10" :text-inside="true"
              :status="row.progress >= 100 ? 'success' : row.overdue ? 'exception' : undefined" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="104" align="center">
          <template #default="{ row }">
            <el-tag :type="(STATUS_TONE[row.status] as any) || 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issueTime" label="下达时间" width="148">
          <template #default="{ row }"><span class="num text-mini">{{ row.issueTime }}</span></template>
        </el-table-column>
        <el-table-column prop="deadline" label="整改期限" width="112">
          <template #default="{ row }">
            <span class="num text-mini" :class="{ 'is-over': row.overdue }">{{ row.deadline }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reviewer" label="复查人" width="132" />
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="'View'" @click="openDetail(row)">复查</el-button>
          </template>
        </el-table-column>
        <template #empty><EmptyState text="暂无符合条件的整改任务" height="140px" /></template>
      </el-table>

      <div class="pager">
        <span class="text-mini">共 {{ total }} 条</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[15, 30, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </div>

    <!-- ============ 详情抽屉 ============ -->
    <el-drawer v-model="drawer" size="700px" title="整改复查验收">
      <template v-if="cur">
        <div v-loading="detailLoading">
          <div class="rt-hero" :class="{ 'is-over': cur.overdue }">
            <div class="rt-hero__t">
              {{ cur.orgName }}
              <el-tag :type="(STATUS_TONE[cur.status] as any) || 'info'" size="small" effect="dark">{{ cur.status }}</el-tag>
              <el-tag v-if="cur.overdue" size="small" type="danger" effect="dark">已超期</el-tag>
            </div>
            <div class="rt-hero__m">
              <span><el-icon><Tickets /></el-icon>{{ cur.rectifyId }}</span>
              <span><el-icon><Files /></el-icon>{{ cur.taskId }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.district }}</span>
              <span><el-icon><Clock /></el-icon>期限 {{ cur.deadline }}</span>
              <span><el-icon><User /></el-icon>{{ cur.reviewer }}</span>
            </div>
            <el-progress :percentage="cur.progress" :stroke-width="9" class="rt-hero__pg"
              :status="cur.progress >= 100 ? 'success' : cur.overdue ? 'exception' : undefined" />
          </div>

          <div class="sub-title">整改事项清单（{{ cur.items.length }} 项）</div>
          <div class="ri-list">
            <div v-for="(it, i) in cur.items" :key="it.itemId" class="ri"
              :class="{ 'is-done': it.status === '已完成', 'is-fail': it.status === '复查不通过' }">
              <div class="ri__h">
                <span class="ri__no num">{{ i + 1 }}</span>
                <el-tag size="small" type="warning" effect="plain">{{ it.violationType }}</el-tag>
                <el-tag :type="(ITEM_TONE[it.status] as any) || 'info'" size="small" effect="dark">{{ it.status }}</el-tag>
                <span class="ri__dl"><el-icon :size="11"><Clock /></el-icon>{{ it.deadline }}</span>
              </div>

              <div class="ri-row">
                <span class="ri-row__k">存在问题</span>
                <span class="ri-row__v">{{ it.problem }}</span>
              </div>
              <div class="ri-row">
                <span class="ri-row__k">整改要求</span>
                <span class="ri-row__v">{{ it.requirement }}</span>
              </div>

              <!-- 机构反馈 -->
              <div v-if="it.feedback" class="fb-card">
                <div class="fb-card__h">
                  <el-icon><ChatDotSquare /></el-icon>
                  <b>机构整改反馈</b>
                  <span class="fb-card__t num">{{ it.feedback.feedbackTime }}</span>
                </div>
                <div class="fb-card__c">{{ it.feedback.content }}</div>
                <div class="fb-card__ev">
                  <span class="text-mini">佐证材料：</span>
                  <el-tag v-for="e in it.feedback.evidence" :key="e" size="small" effect="plain" class="mr4"
                    style="cursor: pointer" @click="msg.info('正在调取整改佐证材料，请稍候')">
                    {{ e }}
                  </el-tag>
                </div>
                <div class="fb-card__f">{{ it.feedback.feedbacker }}</div>
              </div>
              <div v-else class="ri-wait">
                <el-icon><Clock /></el-icon>等待机构在线反馈整改情况
              </div>

              <!-- 复查结论 -->
              <div v-if="it.review" class="rr-card" :class="it.review.result === '通过' ? 'is-pass' : 'is-fail'">
                <div class="rr-card__h">
                  <el-icon><component :is="it.review.result === '通过' ? 'CircleCheckFilled' : 'CircleCloseFilled'" /></el-icon>
                  <b>复查{{ it.review.result }}</b>
                  <span class="rr-card__t num">{{ it.review.reviewTime }} · {{ it.review.reviewer }}</span>
                </div>
                <div class="rr-card__c">{{ it.review.opinion }}</div>
              </div>

              <div v-if="it.feedback && it.status !== '已完成'" class="ri__act">
                <el-button size="small" type="primary" :icon="'DocumentChecked'" @click="openItemReview(it)">
                  复查该事项
                </el-button>
              </div>
            </div>
          </div>

          <el-alert v-if="cur.overdue" type="error" :closable="false" show-icon class="mt12">
            <template #title>
              <span class="text-mini">
                整改期满未完成，已自动督办并纳入机构信用记录，屡查屡犯将从重处置
              </span>
            </template>
          </el-alert>

          <div class="dr-actions">
            <el-button type="success" :icon="'Select'" :loading="accepting"
              :disabled="cur.status === '已完成'" @click="doAccept">
              {{ cur.status === '已完成' ? '已验收通过' : '整改验收通过' }}
            </el-button>
            <el-button :icon="'Document'" @click="openDoc('rectify')">整改意见书</el-button>
            <el-button :icon="'DocumentChecked'" @click="openDoc('accept')">验收意见书</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 逐项复查弹窗 ============ -->
    <el-dialog v-model="rvVisible" title="整改事项复查" width="560px">
      <template v-if="rvItem">
        <el-alert type="info" :closable="false" show-icon class="mb12">
          <template #title>
            <span class="text-mini">{{ rvItem.violationType }} · {{ rvItem.problem }}</span>
          </template>
        </el-alert>
        <el-form label-width="88px">
          <el-form-item label="整改要求">
            <div class="rv-req">{{ rvItem.requirement }}</div>
          </el-form-item>
          <el-form-item label="机构反馈">
            <div class="rv-req">{{ rvItem.feedback?.content || '—' }}</div>
          </el-form-item>
          <el-form-item label="复查结论" required>
            <el-radio-group v-model="rvForm.result">
              <el-radio-button label="通过" />
              <el-radio-button label="不通过" />
            </el-radio-group>
          </el-form-item>
          <el-form-item label="复查意见" required>
            <el-input v-model="rvForm.opinion" type="textarea" :rows="4" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="rvVisible = false">取消</el-button>
        <el-button type="primary" :loading="rvSaving" @click="doItemReview">提交复查结论</el-button>
      </template>
    </el-dialog>

    <!-- ============ 下达整改清单 ============ -->
    <el-dialog v-model="issueVisible" title="下达整改清单" width="760px" top="7vh">
      <el-form label-width="88px">
        <div class="form-row">
          <el-form-item label="被检机构" required>
            <el-input v-model="issueForm.orgName" placeholder="如：芜湖市第一人民医院" />
          </el-form-item>
          <el-form-item label="总体期限" required>
            <el-date-picker v-model="issueForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>

      <div class="sub-title">整改事项（逐项下达问题、要求与时限）</div>
      <div class="is-list">
        <div v-for="(it, i) in issueForm.items" :key="i" class="is-item">
          <div class="is-item__h">
            <span class="is-item__no num">{{ i + 1 }}</span>
            <el-select v-model="it.violationType" placeholder="违规类型" size="small" style="width: 130px">
              <el-option v-for="v in VIOLATION_OPTS" :key="v" :label="v" :value="v" />
            </el-select>
            <el-date-picker v-model="it.deadline" type="date" value-format="YYYY-MM-DD"
              placeholder="办理时限" size="small" style="width: 140px" />
            <el-button link type="danger" :icon="'Delete'" @click="delItem(i)">删除</el-button>
          </div>
          <el-input v-model="it.problem" size="small" placeholder="存在问题（必填）" class="mt6" />
          <el-input v-model="it.requirement" size="small" type="textarea" :rows="2"
            placeholder="整改要求（必填）" class="mt6" />
        </div>
      </div>
      <el-button :icon="'Plus'" size="small" class="mt8" @click="addItem">添加整改事项</el-button>

      <template #footer>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" @click="doIssue">下达并送达机构</el-button>
      </template>
    </el-dialog>

    <!-- 文书预览 -->
    <DocPreview v-model:visible="docVisible" :doc="curDoc" />
  </div>
</template>

<style scoped lang="scss">
.mb12 { margin-bottom: 12px; }
.mt6 { margin-top: 6px; }
.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }
.mr4 { margin-right: 4px; }

.top-grid {
  display: grid; grid-template-columns: 262px 1fr 1.35fr; gap: 12px; align-items: start;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.kpi-col { display: flex; flex-direction: column; gap: 12px; }

:deep(.row-over) { --el-table-tr-bg-color: var(--zh-risk-high-bg); }
.is-over { color: var(--zh-danger) !important; font-weight: 700; }

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
.rt-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &.is-over { background: linear-gradient(120deg, var(--zh-risk-high-bg), #fff); border-color: var(--zh-risk-high-border); }

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-md); font-weight: 700; color: var(--zh-text-primary);
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__pg { margin-top: 10px; }
}

.ri-list { display: flex; flex-direction: column; gap: 10px; }

.ri {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--zh-warning);

  &.is-done { border-left-color: var(--zh-success); background: var(--zh-success-light); }
  &.is-fail { border-left-color: var(--zh-danger); background: var(--zh-risk-high-bg); }

  &__h { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  &__no {
    width: 18px; height: 18px; flex-shrink: 0;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 9px; font-weight: 700;
  }
  &__dl {
    margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
    font-size: 10px; color: var(--zh-text-secondary);
    :deep(.el-icon) { color: var(--zh-warning); }
  }
  &__act {
    display: flex; justify-content: flex-end; margin-top: 8px;
    padding-top: 7px; border-top: 1px dashed var(--zh-border-light);
  }
}

.ri-row {
  display: flex; gap: 9px; margin-top: 6px; font-size: 11px; line-height: 1.8;
  &__k { flex-shrink: 0; width: 54px; color: var(--zh-text-secondary); }
  &__v { flex: 1; color: var(--zh-text-regular); }
}

.ri-wait {
  display: flex; align-items: center; gap: 5px; margin-top: 8px;
  padding: 7px 9px; border-radius: 5px;
  background: #fff; border: 1px dashed var(--zh-border-strong);
  font-size: 10px; color: var(--zh-text-placeholder);
  :deep(.el-icon) { color: var(--zh-warning); }
}

.fb-card {
  margin-top: 8px; padding: 8px 10px; border-radius: 6px;
  background: #fff; border: 1px solid var(--zh-accent);

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    :deep(.el-icon) { color: var(--zh-accent); }
    b { color: var(--zh-text-primary); }
  }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__c { margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
  &__ev { margin-top: 6px; line-height: 2; }
  &__f {
    margin-top: 5px; padding-top: 5px; border-top: 1px dashed var(--zh-border-light);
    font-size: 10px; color: var(--zh-text-secondary); text-align: right;
  }
}

.rr-card {
  margin-top: 8px; padding: 8px 10px; border-radius: 6px;

  &.is-pass { background: var(--zh-success-light); border: 1px solid var(--zh-success); }
  &.is-fail { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); }

  &__h {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: var(--zh-font-xs);
    b { color: var(--zh-text-primary); }
  }
  &.is-pass &__h :deep(.el-icon) { color: var(--zh-success); }
  &.is-fail &__h :deep(.el-icon) { color: var(--zh-danger); }
  &__t { margin-left: auto; font-size: 10px; color: var(--zh-text-secondary); }
  &__c { margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
}

.dr-actions {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

.rv-req {
  width: 100%; padding: 7px 9px; border-radius: 5px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: 11px; line-height: 1.8; color: var(--zh-text-regular);
}

/* ---------- 下达清单 ---------- */
.is-list { display: flex; flex-direction: column; gap: 9px; max-height: 42vh; overflow-y: auto; padding-right: 4px; }

.is-item {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__h { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  &__no {
    width: 18px; height: 18px; flex-shrink: 0;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 9px; font-weight: 700;
  }
}
</style>
