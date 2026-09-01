<script setup lang="ts">
import {
  getProofreadStats, getDocList, getLegalProofread, getTextProofread,
  runProofread, oneClickFix, confirmProofread
} from '@/api/agent04-doc/docgen'
import { CHART_COLORS } from '@/utils/format'
import type { MarkItem, DocParagraph } from '@/components/business/AnnotatedDoc.vue'

const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', docType: '', status: '', page: 1, pageSize: 12 })

const curDocId = ref('')
const curDoc = ref<any>(null)
const legal = ref<any>(null)
const text = ref<any>(null)
const running = ref(false)
const activeTab = ref('annotate')

/** 批注视图状态 */
const activeMarkId = ref('')
const fixedIds = ref<Set<string>>(new Set())
const ignoredIds = ref<Set<string>>(new Set())

const LV_TYPE: Record<string, any> = { 错误: 'danger', 警告: 'warning', 提示: 'primary' }

async function loadStats() { st.value = await getProofreadStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getDocList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
    if (!curDocId.value && list.value.length) pick(list.value[0])
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', docType: '', status: '', page: 1 })
  load()
}

async function pick(row: any) {
  curDocId.value = row.documentId
  curDoc.value = row
  activeMarkId.value = ''
  fixedIds.value = new Set()
  ignoredIds.value = new Set()
  running.value = true
  try {
    const [l, t] = await Promise.all([getLegalProofread(row.documentId), getTextProofread(row.documentId)])
    legal.value = l
    text.value = t
  } finally { running.value = false }
}

async function doRun() {
  if (!curDocId.value) { msg.warning('请先选择待校对文书'); return }
  running.value = true
  try {
    const res: any = await runProofread({ documentId: curDocId.value })
    legal.value = res.legal
    text.value = res.text
    fixedIds.value = new Set()
    ignoredIds.value = new Set()
    msg.success(`${res.message}：错误 ${res.summary.errors} 项、警告 ${res.summary.warnings} 项、提示 ${res.summary.tips} 项`)
  } finally { running.value = false }
}

/* ============ 批注式全文校对（视觉核心） ============ */

/** 公文正文段落：由文书数据 + 校对结果拼装（法律依据段按实际引用法条生成，确保批注可定位） */
const paragraphs = computed<DocParagraph[]>(() => {
  const d = curDoc.value
  const t = text.value
  if (!d) return []
  const fe = t?.elementCheck?.violationFacts?.fiveElements || []
  const money = (n: number) => (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // 法律依据段：逐条串出「《法规名》第X条」，与 citedLaws 完全对应
  const laws = legal.value?.citedLaws || []
  const lawSentence = laws.length
    ? laws.map((l: any) => `${l.lawName}${l.article}`).join('、')
    : '《医疗保障基金使用监督管理条例》第四十条'

  return [
    {
      title: '一、违规事实',
      text: `经查，${d.orgName}于 2026 年 5 月至 8 月期间，在为参保人提供医药服务过程中，存在串换药品、虚构购药纪录等违规行为。这家药店把药换了报销，将非医保目录药品串换为医保目录药品进行结算，涉及金额 ${money(d.amount?.violationAmount * 0.57)} 元；虚构参保人购药记录并申报医保结算，涉及金额 ${money(d.amount?.violationAmount * 0.43)} 元。上述行为共造成医保基金损失 ${money(d.amount?.fundAmount)} 元。`
    },
    {
      title: '二、证据列举',
      text: `上述事实由医保结算明细数据、药品进销存台账、现场检查笔录、询问笔录、票据,处方,病历及影像资料等证据予以证实。经核查，${fe[0] || '时间'}、${fe[1] || '地点'}、${fe[3] || '行为'}等要素清晰，证据之间相互印证，足以认定。`
    },
    {
      title: '三、法律依据',
      text: `依据${lawSentence}之规定，定点医药机构通过虚构医药服务项目等方式骗取医疗保障基金支出的，由医疗保障行政部门责令退回，处骗取金额二倍以上五倍以下的罚款；情节严重的，可中止或解除医保协议。本机关已依法履行事实、理由、依据告知及陈述申辩程序。`
    },
    {
      title: '四、处理决定',
      text: `根据上述事实、证据与法律依据，本机关决定：一、责令退还骗取的医疗保障基金 ${money(d.amount?.fundAmount)} 元；二、处骗取金额 ${(((d.amount?.penaltyAmount || 0) / Math.max(1, d.amount?.fundAmount || 1)) || 2).toFixed(1)} 倍罚款，计 ${money(d.amount?.penaltyAmount)} 元。上列款项合计 ${money(d.amount?.totalAmount)} 元（大写：${d.amount?.totalAmountInWords || '—'}），应于本决定书送达之日起十五日内缴纳。`
    },
    {
      title: '五、权利告知',
      text: `如不服本决定，可自收到本决定书之日起六十日内向芜湖市人民政府申请行政复议，或者自收到本决定书之日起六个月内向芜湖市镜湖区人民法院提起行政诉讼。申请行政复议或提起行政诉讼期间，本决定不停止执行。`
    }
  ]
})

/** 校对批注：把「法条 / 错别字 / 标点 / 口语化 / 金额一致性」统一映射为正文批注 */
const marks = computed<MarkItem[]>(() => {
  const out: MarkItem[] = []
  const t = text.value
  const l = legal.value

  // 1) 法条引用问题 → 定位到法律依据段（target 用「《法规名》第X条」全串，确保唯一命中）
  ;(l?.citedLaws || []).forEach((law: any, li: number) => {
    (law.issues || []).forEach((x: any, xi: number) => {
      out.push({
        id: `LAW-${li}-${xi}`,
        target: `${law.lawName}${law.article}`,
        level: x.level,
        type: `法条引用 · ${x.type}`,
        desc: x.description,
        suggestion: x.suggestion,
        replaceTo: x.correctArticle ? `${law.lawName}${x.correctArticle}` : undefined,
        fixable: !!x.correctArticle
      })
    })
  })

  // 2) 错别字
  ;(t?.textCheck?.typos || []).forEach((x: any, i: number) => {
    out.push({
      id: `TYPO-${i}`,
      target: x.wrongWord ? (x.original || x.wrongWord) : x.original,
      level: '错误',
      type: '错别字',
      desc: `${x.location}：「${x.wrongWord}」应为「${x.correctWord}」`,
      suggestion: '执法文书用字须准确规范，避免同音近义误用',
      replaceTo: x.correction,
      fixable: true
    })
  })

  // 3) 标点不规范
  ;(t?.textCheck?.punctuation || []).forEach((x: any, i: number) => {
    out.push({
      id: `PUNC-${i}`,
      target: x.original,
      level: '警告',
      type: '标点不规范',
      desc: `${x.location}：${x.issue}`,
      suggestion: '按《标点符号用法》规范修改',
      replaceTo: x.correction,
      fixable: true
    })
  })

  // 4) 口语化表述
  ;(t?.textCheck?.colloquialism || []).forEach((x: any, i: number) => {
    out.push({
      id: `COLL-${i}`,
      target: x.original,
      level: '提示',
      type: '口语化表述',
      desc: `${x.location}：${x.reason}`,
      suggestion: '改用法言法语规范表述',
      replaceTo: x.suggestion,
      fixable: true
    })
  })

  // 5) 金额一致性
  ;(t?.consistencyCheck?.amountConsistency?.issues || []).forEach((x: any, i: number) => {
    out.push({
      id: `AMT-${i}`,
      target: curDoc.value?.amount?.totalAmountInWords || '大写',
      level: '错误',
      type: '金额一致性',
      desc: x.actualIssue || x.description,
      suggestion: '核对正文数字金额与中文大写金额，须完全一致',
      fixable: false
    })
  })

  return out
    .filter((m) => m.target && !ignoredIds.value.has(m.id))
    .map((m) => ({ ...m, fixed: fixedIds.value.has(m.id) }))
})

function onFocusMark(id: string) { activeMarkId.value = id }

function onFixMark(m: MarkItem) {
  fixedIds.value = new Set([...fixedIds.value, m.id])
  msg.success(`已采纳修正：${m.type}${m.replaceTo ? ` → ${m.replaceTo}` : ''}`)
}

function onIgnoreMark(m: MarkItem) {
  ignoredIds.value = new Set([...ignoredIds.value, m.id])
  msg.info(`已忽略该${m.level}项，将在校对记录中留痕`)
}

const fixing = ref(false)
async function doFix() {
  const fixables = marks.value.filter((m) => m.fixable && !m.fixed)
  if (!fixables.length) { msg.info('当前无可一键修正的问题'); return }
  fixing.value = true
  try {
    const res: any = await oneClickFix({ documentId: curDocId.value, items: fixables.map((m) => m.type) })
    fixedIds.value = new Set([...fixedIds.value, ...fixables.map((m) => m.id)])
    msg.success(`${res.message}（已修正 ${fixables.length} 处）`)
  } finally { fixing.value = false }
}

const confirming = ref(false)
async function doConfirm() {
  const errs = totalErrors.value
  if (errs > 0) {
    await ElMessageBox.confirm(
      `当前仍有 ${errs} 项「错误」级问题未处理，错误级问题必须修正后方可提交签章。确认强制通过校对？`,
      '存在错误级问题', { type: 'warning', confirmButtonText: '强制通过', cancelButtonText: '返回修正' }
    ).catch(() => Promise.reject())
  }
  confirming.value = true
  try {
    const res: any = await confirmProofread({ documentId: curDocId.value })
    msg.success(res?.message || '已确认')
    await load()
  } finally { confirming.value = false }
}

const totalIssues = computed(() => marks.value.filter((m) => !m.fixed).length)
const totalErrors = computed(() => marks.value.filter((m) => !m.fixed && m.level === '错误').length)
const totalWarnings = computed(() => marks.value.filter((m) => !m.fixed && m.level === '警告').length)
const totalTips = computed(() => marks.value.filter((m) => !m.fixed && m.level === '提示').length)
const fixableLeft = computed(() => marks.value.filter((m) => m.fixable && !m.fixed).length)

/* ---------- 图表 ---------- */
const issueOption = computed(() => {
  const d = st.value?.issueTypeDist || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 118, right: 40, top: 8, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#eef1f7' } }, axisLabel: { fontSize: 10, color: '#9aa7b8' } },
    yAxis: {
      type: 'category', data: d.map((i: any) => i.name).reverse(),
      axisLabel: { fontSize: 10, color: '#43516b' },
      axisLine: { lineStyle: { color: '#e2e8f2' } }, axisTick: { show: false }
    },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: { borderRadius: [0, 3, 3, 0], color: (p: any) => CHART_COLORS[p.dataIndex % CHART_COLORS.length] },
      label: { show: true, position: 'right', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => i.value).reverse()
    }]
  }
})

const lvOption = computed(() => {
  if (!st.value) return {}
  const d = [
    { name: '错误', value: st.value.totalErrors, c: '#e5484d' },
    { name: '警告', value: st.value.totalWarnings, c: '#e8a30c' },
    { name: '提示', value: st.value.totalTips, c: '#1668dc' }
  ]
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 项 ({d}%)' },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
      label: { show: true, formatter: '{c}', fontSize: 11, fontWeight: 700 },
      data: d.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.c } }))
    }]
  }
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="智能校对" tag="M27"
      subtitle="法条引用校对 · 要素完整性校对 · 一致性校对 · 文字规范校对">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
        <el-button type="primary" :icon="'MagicStick'" :loading="running" @click="doRun">运行智能校对</el-button>
      </template>
    </PageHeader>

    <!-- 指标 + 图表 -->
    <div class="top-grid">
      <div class="kpi-col">
        <StatCard label="已校对文书" :value="st?.proofreadTotal || 0" unit="份" icon="DocumentChecked" tone="primary" />
        <StatCard label="错误级问题" :value="st?.totalErrors || 0" unit="项" icon="CircleClose" tone="danger" />
        <StatCard label="警告级问题" :value="st?.totalWarnings || 0" unit="项" icon="Warning" tone="warning" />
        <StatCard label="提示级问题" :value="st?.totalTips || 0" unit="项" icon="InfoFilled" tone="primary" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">问题等级分布</span>
          <span class="section-title__desc">错误必须修正 · 警告建议修正 · 提示可选优化</span>
        </div>
        <EChart :option="lvOption" height="230px" />
      </div>
      <div class="section-card section-card--tight">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">问题类型分布</span>
        </div>
        <EChart :option="issueOption" height="230px" />
      </div>
    </div>

    <!-- 主体：左待校对列表 + 右校对结果 -->
    <div class="pf-layout">
      <!-- 左：待校对文书 -->
      <div class="section-card section-card--tight pf-left">
        <div class="section-title">
          <span class="section-title__dot" />
          <span class="section-title__text">待校对文书</span>
          <span class="section-title__desc">共 {{ total }} 份</span>
        </div>

        <el-form class="pf-query" @submit.prevent>
          <el-input v-model="q.keyword" placeholder="文号 / 名称 / 机构" clearable size="small"
            :prefix-icon="'Search'" @keyup.enter="doQuery" />
          <el-select v-model="q.status" placeholder="全部状态" clearable size="small" @change="doQuery">
            <el-option v-for="s in ['待校对', '校对完成', '待签章', '已签章']" :key="s" :label="s" :value="s" />
          </el-select>
          <div class="pf-query__btns">
            <el-button type="primary" size="small" :icon="'Search'" @click="doQuery">查　询</el-button>
            <el-button size="small" :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
          </div>
        </el-form>

        <div class="doc-list" v-loading="loading">
          <div v-for="d in list" :key="d.documentId" class="doc"
            :class="{ 'is-active': curDocId === d.documentId }" @click="pick(d)">
            <div class="doc__h">
              <span class="doc__no num">{{ d.docNo }}</span>
              <el-tag v-if="d.proofread?.errors" size="small" type="danger" effect="dark">{{ d.proofread.errors }} 错</el-tag>
              <el-tag v-else-if="d.proofread?.warnings" size="small" type="warning" effect="dark">{{ d.proofread.warnings }} 警</el-tag>
              <el-tag v-else-if="d.proofread" size="small" type="success" effect="dark">通过</el-tag>
              <el-tag v-else size="small" effect="plain">未校对</el-tag>
            </div>
            <div class="doc__n">{{ d.documentName }}</div>
            <div class="doc__f">
              <span>{{ d.docType }}</span>
              <span class="num">{{ d.generateTime.slice(5, 16) }}</span>
            </div>
          </div>
          <EmptyState v-if="!list.length && !loading" text="暂无待校对文书" height="140px" />
        </div>

        <div class="pager pager--mini">
          <el-pagination v-model:current-page="q.page" :page-size="q.pageSize" :total="total"
            layout="prev, pager, next" small background @change="load" />
        </div>
      </div>

      <!-- 右：校对结果 -->
      <div class="pf-right">
        <template v-if="curDoc">
          <div class="pf-hero">
            <div class="pf-hero__t">
              {{ curDoc.documentName }}
              <el-tag size="small" effect="plain">{{ curDoc.docType }}</el-tag>
            </div>
            <div class="pf-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curDoc.docNo }}</span>
              <span><el-icon><OfficeBuilding /></el-icon>{{ curDoc.orgName }}</span>
              <span><el-icon><Clock /></el-icon>{{ curDoc.generateTime }}</span>
            </div>
            <div class="pf-hero__sum">
              <div class="pfs"><b class="num">{{ totalIssues }}</b><span>问题总数</span></div>
              <div class="pfs is-danger"><b class="num">{{ totalErrors }}</b><span>错误</span></div>
              <div class="pfs is-warning"><b class="num">{{ totalWarnings }}</b><span>警告</span></div>
              <div class="pfs is-primary"><b class="num">{{ totalTips }}</b><span>提示</span></div>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="pf-tabs" v-loading="running">
            <!-- ===== 批注式全文校对（视觉核心） ===== -->
            <el-tab-pane name="annotate">
              <template #label>
                <el-icon><EditPen /></el-icon> 批注式全文校对
                <el-badge v-if="totalErrors" :value="totalErrors" type="danger" class="tab-badge" />
              </template>

              <AnnotatedDoc
                :doc-title="curDoc.documentName"
                :doc-no="curDoc.docNo"
                :recipient="curDoc.orgName"
                :paragraphs="paragraphs"
                :marks="marks"
                :active-id="activeMarkId"
                @focus="onFocusMark"
                @fix="onFixMark"
                @ignore="onIgnoreMark" />
            </el-tab-pane>

            <!-- ===== 法条引用校对 ===== -->
            <el-tab-pane name="legal">
              <template #label>
                法条引用校对
                <el-badge v-if="legal?.summary?.error" :value="legal.summary.error" type="danger" class="tab-badge" />
              </template>

              <template v-if="legal">
                <div class="lg-sum" :class="legal.summary.criticalIssues ? 'is-no' : 'is-ok'">
                  <el-icon><component :is="legal.summary.criticalIssues ? 'WarningFilled' : 'CircleCheckFilled'" /></el-icon>
                  <b>{{ legal.status }}</b>
                  <span>
                    共引用法条 <b class="num">{{ legal.summary.totalCitations }}</b> 条 ·
                    正确 <b class="num" style="color: var(--zh-success)">{{ legal.summary.correct }}</b> ·
                    警告 <b class="num" style="color: var(--zh-warning)">{{ legal.summary.warning }}</b> ·
                    错误 <b class="num" style="color: var(--zh-danger)">{{ legal.summary.error }}</b>
                  </span>
                  <span class="lg-sum__t num">{{ legal.proofreadTime }}</span>
                </div>

                <div class="law-list">
                  <div v-for="(l, i) in legal.citedLaws" :key="i" class="law"
                    :class="l.checkResult === '正确' ? 'is-ok' : l.issues.some((x: any) => x.level === '错误') ? 'is-err' : 'is-warn'">
                    <div class="law__h">
                      <span class="law__no num">{{ i + 1 }}</span>
                      <b>{{ l.lawName }}</b>
                      <el-tag size="small" effect="dark"
                        :type="l.checkResult === '正确' ? 'success' : l.issues.some((x: any) => x.level === '错误') ? 'danger' : 'warning'">
                        {{ l.checkResult }}
                      </el-tag>
                      <el-tag size="small" effect="plain">{{ l.article }}</el-tag>
                    </div>

                    <div class="law__cite">
                      <span class="law__lb">文书引用</span>
                      <span class="law__ct">{{ l.citedContent }}</span>
                    </div>

                    <!-- 法规库联动 -->
                    <div class="law__lib" :class="{ 'is-no': !l.lawLibraryMatch.matched || !l.lawLibraryMatch.effective }">
                      <div class="law__lib-h">
                        <el-icon><Collection /></el-icon>
                        法规库比对
                        <el-tag size="small" :type="l.lawLibraryMatch.matched ? 'success' : 'danger'" effect="plain">
                          {{ l.lawLibraryMatch.matched ? '匹配成功' : '未匹配' }}
                        </el-tag>
                        <el-tag size="small" :type="l.lawLibraryMatch.effective ? 'success' : 'danger'" effect="plain">
                          {{ l.lawLibraryMatch.effective ? '现行有效' : '已失效' }}
                        </el-tag>
                        <span class="text-mini">生效 {{ l.lawLibraryMatch.effectiveDate }} · {{ l.lawLibraryMatch.latestVersion }}</span>
                      </div>
                      <div class="law__lib-c">
                        <span class="law__lb">法规原文</span>
                        <span class="law__ct">{{ l.lawLibraryMatch.actualContent }}</span>
                      </div>
                    </div>

                    <!-- 问题清单 -->
                    <div v-if="l.issues.length" class="iss-list">
                      <div v-for="(x, j) in l.issues" :key="j" class="iss" :class="`is-${LV_TYPE[x.level]}`">
                        <div class="iss__h">
                          <el-tag :type="LV_TYPE[x.level]" size="small" effect="dark">{{ x.level }}</el-tag>
                          <b>{{ x.type }}</b>
                        </div>
                        <div class="iss__d">{{ x.description }}</div>
                        <div class="iss__s"><el-icon><Opportunity /></el-icon>修正建议：{{ x.suggestion }}</div>
                        <div v-if="x.correctArticle" class="iss__fix">
                          <div class="iss__fix-r">
                            <span class="iss__fix-l">应引用</span>
                            <b class="num">{{ x.correctArticle }}</b>
                          </div>
                          <div class="iss__fix-r">
                            <span class="iss__fix-l">正确原文</span>
                            <span>{{ x.correctContent }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <AiPanel v-if="legal.aiSuggestion" :suggestion="legal.aiSuggestion" :confidence="96"
                  title="AI 法条校对建议" class="mt12" />

                <div v-if="legal.manualConfirmation" class="mc-bar">
                  <el-icon><UserFilled /></el-icon>
                  人工确认：<b>{{ legal.manualConfirmation.confirmer }}</b>
                  <el-tag size="small" :type="legal.manualConfirmation.confirmed ? 'success' : 'warning'" effect="dark">
                    {{ legal.manualConfirmation.confirmed ? '已确认' : '待确认' }}
                  </el-tag>
                  <span class="num text-mini">{{ legal.manualConfirmation.confirmTime }}</span>
                </div>
              </template>
              <EmptyState v-else text="请选择文书并运行校对" height="180px" />
            </el-tab-pane>

            <!-- ===== 要素与文字校对 ===== -->
            <el-tab-pane name="text">
              <template #label>
                要素与文字校对
                <el-badge v-if="text?.summary?.errors" :value="text.summary.errors" type="danger" class="tab-badge" />
              </template>
              <template v-if="text">
                <!-- 要素完整性 -->
                <div class="sub-title">要素完整性校对（6 项必备要素）</div>
                <div class="ec-grid">
                  <div v-for="(k, i) in ['partyInfo', 'violationFacts', 'legalBasis', 'decision', 'rightsNotice', 'signature']"
                    :key="k" class="ec" :class="text.elementCheck[k].complete ? 'is-ok' : 'is-no'">
                    <el-icon class="ec__i"><component :is="text.elementCheck[k].complete ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
                    <div class="ec__b">
                      <div class="ec__n">
                        {{ ['当事人信息', '违规事实', '法律依据', '处罚决定', '权利告知', '签章落款'][i] }}
                      </div>
                      <div class="ec__d">
                        {{ text.elementCheck[k].complete
                          ? '要素齐备，符合执法文书必备要素要求'
                          : '要素不完整，需补录后方可提交签章' }}
                      </div>
                      <div v-if="text.elementCheck[k].missing?.length" class="ec__m">
                        缺失：{{ text.elementCheck[k].missing.join('、') }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 违规事实五要素 -->
                <div class="sub-title">违规事实五要素（时间 / 地点 / 人物 / 行为 / 金额）</div>
                <div class="fe-grid">
                  <div v-for="(f, i) in text.elementCheck.violationFacts.fiveElements" :key="i"
                    class="fe is-ok">
                    <div class="fe__n">{{ String(f).split('：')[0] }}</div>
                    <el-icon class="fe__i"><CircleCheckFilled /></el-icon>
                    <div class="fe__c">{{ String(f).split('：')[1] || '未描述' }}</div>
                  </div>
                </div>

                <!-- 一致性校对 -->
                <div class="sub-title">一致性校对（4 项交叉核对）</div>
                <el-table :data="[
                  { n: '金额一致性', ...text.consistencyCheck.amountConsistency },
                  { n: '当事人名称一致性', ...text.consistencyCheck.partyNameConsistency },
                  { n: '日期逻辑一致性', ...text.consistencyCheck.dateConsistency },
                  { n: '文号一致性', ...text.consistencyCheck.docNoConsistency }
                ]" size="small" border stripe>
                  <el-table-column prop="n" label="校对项" width="150" />
                  <el-table-column label="结果" width="94" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.result === '一致' ? 'success' : 'danger'" size="small" effect="dark">
                        {{ row.result }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="校对详情" min-width="260" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span v-if="row.issues?.length">{{ row.issues[0].actualIssue || row.issues[0].description }}</span>
                      <span v-else class="text-muted">校对通过，未发现不一致</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="修正建议" min-width="180" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span v-if="row.issues?.length" style="color: var(--zh-warning)">核对并修正致一致后方可提交签章</span>
                      <span v-else class="text-muted">—</span>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 文字规范 -->
                <div class="sub-title">文字规范校对（错别字 / 标点 / 口语化表述）</div>
                <div class="tx-grid">
                  <div class="tx-col">
                    <div class="tx-col__h is-danger">
                      <el-icon><EditPen /></el-icon>错别字
                      <b class="num">{{ text.textCheck.typos.length }}</b>
                    </div>
                    <div v-if="!text.textCheck.typos.length" class="tx-none">未发现错别字</div>
                    <div v-for="(t, i) in text.textCheck.typos" :key="i" class="tx">
                      <div class="tx__f">
                        <span class="diff-old">{{ t.wrongWord }}</span>
                        <el-icon><Right /></el-icon>
                        <span class="diff-new">{{ t.correctWord }}</span>
                      </div>
                      <div class="tx__l">{{ t.location }}</div>
                    </div>
                  </div>
                  <div class="tx-col">
                    <div class="tx-col__h is-warning">
                      <el-icon><Warning /></el-icon>标点
                      <b class="num">{{ text.textCheck.punctuation.length }}</b>
                    </div>
                    <div v-if="!text.textCheck.punctuation.length" class="tx-none">标点使用规范</div>
                    <div v-for="(t, i) in text.textCheck.punctuation" :key="i" class="tx">
                      <div class="tx__f">{{ t.issue }}</div>
                      <div class="tx__l">{{ t.location }} · 改为「{{ t.correction }}」</div>
                    </div>
                  </div>
                  <div class="tx-col">
                    <div class="tx-col__h is-primary">
                      <el-icon><ChatLineSquare /></el-icon>口语化表述
                      <b class="num">{{ text.textCheck.colloquialism.length }}</b>
                    </div>
                    <div v-if="!text.textCheck.colloquialism.length" class="tx-none">表述规范</div>
                    <div v-for="(t, i) in text.textCheck.colloquialism" :key="i" class="tx">
                      <div class="tx__f">
                        <span class="diff-old">{{ t.original }}</span>
                        <el-icon><Right /></el-icon>
                        <span class="diff-new">{{ t.suggestion }}</span>
                      </div>
                      <div class="tx__l">{{ t.location }}</div>
                    </div>
                  </div>
                </div>

                <!-- 一键修正 -->
                <div class="fix-bar" :class="{ 'is-off': !fixableLeft }">
                  <el-icon><MagicStick /></el-icon>
                  <div class="fix-bar__b">
                    <div class="fix-bar__t">
                      一键修正
                      <el-tag :type="fixableLeft ? 'primary' : 'info'" size="small" effect="dark">
                        可修正 {{ fixableLeft }} 处
                      </el-tag>
                    </div>
                    <div class="fix-bar__d">
                      {{ fixableLeft
                        ? '错别字、标点不规范、口语化表述、法条错引等明确问题可一键修正，修正后在正文中直接生效并留痕'
                        : '当前无可自动修正的明显错误，其余问题需人工判断处理' }}
                    </div>
                  </div>
                  <el-button type="primary" :icon="'MagicStick'" :disabled="!fixableLeft"
                    :loading="fixing" @click="doFix">一键修正</el-button>
                </div>

                <div v-if="text.manualConfirmation" class="mc-bar">
                  <el-icon><UserFilled /></el-icon>
                  人工确认：<b>{{ text.manualConfirmation.confirmer }}</b>
                  <el-tag size="small" :type="text.manualConfirmation.confirmed ? 'success' : 'warning'" effect="dark">
                    {{ text.manualConfirmation.confirmed ? '已确认' : '待确认' }}
                  </el-tag>
                  <span class="num text-mini">{{ text.manualConfirmation.confirmTime }}</span>
                </div>
              </template>
              <EmptyState v-else text="请选择文书并运行校对" height="180px" />
            </el-tab-pane>
          </el-tabs>

          <div class="pf-actions">
            <el-button :icon="'MagicStick'" :loading="running" @click="doRun">重新校对</el-button>
            <el-button type="warning" :icon="'MagicStick'" :loading="fixing"
              :disabled="!fixableLeft" @click="doFix">一键修正明显错误</el-button>
            <el-button type="primary" :icon="'CircleCheck'" :loading="confirming" @click="doConfirm">
              确认校对并提交签章
            </el-button>
          </div>

          <el-alert type="info" :closable="false" show-icon class="mt12">
            <template #title>
              <span class="text-mini">
                校对定位为「智能辅助」：系统提示问题、给出修正建议，最终由法制人员判断确认；错误级问题必须修正后方可提交签章
              </span>
            </template>
          </el-alert>
        </template>
        <div v-else class="section-card"><EmptyState text="请从左侧选择待校对文书" height="300px" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mt12 { margin-top: 12px; }

.top-grid {
  display: grid; grid-template-columns: 262px 1fr 1.2fr; gap: 12px; align-items: start;
  @media (max-width: 1300px) { grid-template-columns: 1fr; }
}

.kpi-col { display: flex; flex-direction: column; gap: 12px; }

.sub-title {
  margin: 15px 0 9px;
  font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.pf-layout {
  display: grid; grid-template-columns: 306px 1fr; gap: 12px; margin-top: 12px; align-items: start;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

/* ---------- 左侧列表 ---------- */
.pf-left { position: sticky; top: 12px; }

.pf-query {
  display: flex; flex-direction: column; gap: 7px; margin-bottom: 10px;
  &__btns {
    display: flex; gap: 6px;
    :deep(.el-button) { flex: 1; margin-left: 0 !important; }
  }
}

.doc-list {
  display: flex; flex-direction: column; gap: 7px;
  max-height: 520px; overflow-y: auto; padding-right: 3px;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: var(--zh-border-strong); border-radius: 3px; }
}

.doc {
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 2px solid transparent; transition: all .18s;

  &:hover { background: #fff; border-color: var(--zh-primary-light); box-shadow: var(--zh-shadow-sm); }
  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--zh-primary-light); border-left-color: var(--zh-primary);
  }

  &__h { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
  &__no { font-size: 11px; font-weight: 700; color: var(--zh-primary); }
  &__n {
    margin-top: 4px; font-size: var(--zh-font-xs); color: var(--zh-text-primary); font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  &__f {
    display: flex; justify-content: space-between; margin-top: 4px;
    font-size: 10px; color: var(--zh-text-secondary);
  }
}

.pager--mini { justify-content: center; margin-top: 9px; }

/* ---------- 右侧 ---------- */
.pf-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

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
  &__sum {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;
    padding-top: 9px; border-top: 1px dashed var(--zh-primary-light);
  }
}

.pfs {
  text-align: center; padding: 5px 4px; border-radius: 5px; background: #fff;
  border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--pc, var(--zh-text-secondary));
  b { display: block; font-size: 17px; font-weight: 800; color: var(--pc, var(--zh-text-primary)); }
  span { font-size: 10px; color: var(--zh-text-secondary); }

  &.is-danger { --pc: var(--zh-danger); }
  &.is-warning { --pc: var(--zh-warning); }
  &.is-primary { --pc: var(--zh-primary); }
}

.pf-tabs { margin-top: 12px; }
.tab-badge { margin-left: 5px; :deep(.el-badge__content) { transform: none; position: static; } }

/* ---------- 法条 ---------- */
.lg-sum {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  padding: 9px 12px; border-radius: var(--zh-radius); font-size: var(--zh-font-xs);

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); :deep(.el-icon) { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); :deep(.el-icon) { color: var(--zh-danger); } }
  b { color: var(--zh-text-primary); }
  > span { color: var(--zh-text-secondary); }
  &__t { margin-left: auto; font-size: 10px; }
}

.law-list { display: flex; flex-direction: column; gap: 10px; margin-top: 11px; }

.law {
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-left: 3px solid var(--lc, var(--zh-success));

  &.is-ok { --lc: var(--zh-success); }
  &.is-warn { --lc: var(--zh-warning); background: color-mix(in srgb, var(--zh-warning-light) 55%, #fff); }
  &.is-err { --lc: var(--zh-danger); background: color-mix(in srgb, var(--zh-risk-high-bg) 55%, #fff); }

  &__h {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
    b { font-weight: 700; }
  }
  &__no {
    width: 17px; height: 17px; flex-shrink: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--lc); color: #fff; font-size: 9px; font-weight: 700;
  }
  &__cite {
    display: flex; gap: 8px; margin-top: 8px;
    padding: 7px 9px; border-radius: 5px; background: #fff; border: 1px solid var(--zh-border-light);
  }
  &__lb {
    flex-shrink: 0; font-size: 10px; font-weight: 700; color: var(--zh-text-secondary);
    padding: 1px 6px; border-radius: 3px; background: var(--zh-bg-soft); height: fit-content;
  }
  &__ct { font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }

  &__lib {
    margin-top: 7px; padding: 7px 9px; border-radius: 5px;
    background: var(--zh-info-light); border: 1px solid var(--zh-border-strong);
    &.is-no { background: var(--zh-risk-high-bg); border-color: var(--zh-danger); }

    &-h {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 10px; font-weight: 700; color: var(--zh-text-regular);
      :deep(.el-icon) { color: var(--zh-primary); }
    }
    &-c { display: flex; gap: 8px; margin-top: 6px; }
  }
}

.iss-list { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }

.iss {
  padding: 8px 10px; border-radius: 5px;
  border-left: 2px solid var(--ic, var(--zh-primary));
  background: #fff; border: 1px solid var(--zh-border-light);

  &.is-danger { --ic: var(--zh-danger); }
  &.is-warning { --ic: var(--zh-warning); }
  &.is-primary { --ic: var(--zh-primary); }

  &__h {
    display: flex; align-items: center; gap: 6px;
    font-size: var(--zh-font-xs); color: var(--zh-text-primary);
  }
  &__d { margin-top: 5px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); }
  &__s {
    display: flex; align-items: flex-start; gap: 4px; margin-top: 5px;
    font-size: 11px; color: var(--zh-primary);
    :deep(.el-icon) { flex-shrink: 0; margin-top: 2px; }
  }
  &__fix {
    margin-top: 6px; padding: 6px 8px; border-radius: 4px;
    background: var(--zh-success-light); border: 1px dashed var(--zh-success);

    &-r { display: flex; gap: 7px; font-size: 11px; line-height: 1.8; color: var(--zh-text-regular); + .iss__fix-r { margin-top: 4px; } }
    &-l {
      flex-shrink: 0; font-size: 10px; font-weight: 700; color: var(--zh-success);
      padding: 1px 5px; border-radius: 3px; background: #fff; height: fit-content;
    }
  }
}

/* ---------- 要素 ---------- */
.ec-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.ec {
  display: flex; gap: 8px; padding: 9px 11px; border-radius: 6px;

  &.is-ok { background: var(--zh-success-light); border: 1px solid var(--zh-success); .ec__i { color: var(--zh-success); } }
  &.is-no { background: var(--zh-risk-high-bg); border: 1px solid var(--zh-danger); .ec__i { color: var(--zh-danger); } }

  &__i { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
  &__b { min-width: 0; }
  &__n { font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary); }
  &__d { margin-top: 3px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
  &__m { margin-top: 3px; font-size: 10px; color: var(--zh-danger); font-weight: 600; }
}

.fe-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.fe {
  padding: 9px 10px; border-radius: 6px; text-align: center;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  border-top: 2px solid var(--fc, var(--zh-success));

  &.is-ok { --fc: var(--zh-success); }
  &.is-no { --fc: var(--zh-danger); background: var(--zh-risk-high-bg); }

  &__n { font-size: 10px; font-weight: 700; color: var(--zh-text-secondary); }
  &__i { font-size: 16px; color: var(--fc); margin: 3px 0; }
  &__c { font-size: 10px; line-height: 1.6; color: var(--zh-text-regular); }
}

/* ---------- 文字 ---------- */
.tx-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.tx-col {
  padding: 9px 11px; border-radius: 6px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);

  &__h {
    display: flex; align-items: center; gap: 5px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
    padding-bottom: 7px; border-bottom: 1px dashed var(--zh-border-light);
    b { margin-left: auto; font-size: 14px; }

    &.is-danger { :deep(.el-icon) { color: var(--zh-danger); } b { color: var(--zh-danger); } }
    &.is-warning { :deep(.el-icon) { color: var(--zh-warning); } b { color: var(--zh-warning); } }
    &.is-primary { :deep(.el-icon) { color: var(--zh-primary); } b { color: var(--zh-primary); } }
  }
}

.tx-none { padding: 12px 0; text-align: center; font-size: 10px; color: var(--zh-text-placeholder); }

.tx {
  padding: 6px 0; border-bottom: 1px dashed var(--zh-border-light);
  &:last-child { border-bottom: none; }

  &__f {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    font-size: 11px; color: var(--zh-text-regular);
    :deep(.el-icon) { font-size: 10px; color: var(--zh-text-placeholder); }
  }
  &__l { margin-top: 3px; font-size: 10px; color: var(--zh-text-secondary); }
}

.diff-old { color: var(--zh-danger); text-decoration: line-through; }
.diff-new { color: var(--zh-success); font-weight: 600; }

.fix-bar {
  display: flex; align-items: center; gap: 10px; margin-top: 13px;
  padding: 10px 12px; border-radius: var(--zh-radius);
  background: var(--zh-primary-lighter); border: 1px solid var(--zh-primary-light);
  > :deep(.el-icon) { font-size: 19px; color: var(--zh-primary); flex-shrink: 0; }

  &.is-off {
    background: var(--zh-bg-soft); border-color: var(--zh-border-light);
    > :deep(.el-icon) { color: var(--zh-text-placeholder); }
  }
  &__b { flex: 1; min-width: 0; }
  &__t {
    display: flex; align-items: center; gap: 7px;
    font-size: var(--zh-font-xs); font-weight: 700; color: var(--zh-text-primary);
  }
  &__d { margin-top: 4px; font-size: 10px; line-height: 1.7; color: var(--zh-text-secondary); }
}

.mc-bar {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-top: 11px;
  padding: 8px 11px; border-radius: 6px;
  background: var(--zh-success-light); border: 1px solid var(--zh-success);
  font-size: var(--zh-font-xs); color: var(--zh-text-regular);
  :deep(.el-icon) { color: var(--zh-success); }
  b { color: var(--zh-text-primary); }
}

.pf-actions {
  display: flex; gap: 8px; margin-top: 14px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
