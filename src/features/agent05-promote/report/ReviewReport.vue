<script setup lang="ts">
import {
  getReviewReportStats, getReviewReportList, getReviewReportDetail,
  generateReviewReport, publishReviewReport
} from '@/api/agent05-promote/promote'

const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', reportType: '', status: '', page: 1, pageSize: 10 })

const ST_TONE: Record<string, string> = { 已发布: 'lime', 待审核: 'amber', 已生成: 'cyan', 已归档: 'faint' }
const TYPE_TONE: Record<string, string> = {
  个案复盘报告: 'cyan', 类案复盘报告: 'violet', 月度复盘报告: 'blue',
  季度复盘报告: 'amber', 年度复盘报告: 'pink'
}
const CONF_TONE: Record<string, string> = { 公开: 'lime', 内部: 'amber', 秘密: 'red' }

async function loadStats() { st.value = await getReviewReportStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getReviewReportList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', reportType: '', status: '', page: 1 })
  load()
}

/* ---------- 报告详情（书本式阅读） ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const dLoading = ref(false)
const secIdx = ref(0)

async function openDetail(row: any) {
  drawer.value = true
  dLoading.value = true
  secIdx.value = 0
  try { cur.value = await getReviewReportDetail(row.reportId) } finally { dLoading.value = false }
}

/* ---------- 生成报告 ---------- */
const genVisible = ref(false)
const genRunning = ref(false)
const genForm = reactive({ reportType: '个案复盘报告', reviewId: '', confidentiality: '内部' })

async function doGenerate() {
  genRunning.value = true
  try {
    const res: any = await generateReviewReport(genForm)
    msg.success(`${res.message}（${res.sectionCount} 章 / ${res.totalWordCount} 字）`)
    genVisible.value = false
    await Promise.all([loadStats(), load()])
  } finally { genRunning.value = false }
}

/* ---------- 发布报告 ---------- */
const pubSaving = ref(false)
const DISTRIBUTION_ALL = ['局领导', '基金监管处全体', '法制科', '各稽核组（学习参考）', '模型运营组', '人事处']
const pubVisible = ref(false)
const pubForm = reactive({ distribution: [...DISTRIBUTION_ALL.slice(0, 4)] })

function openPublish() {
  pubForm.distribution = cur.value?.distribution?.length ? [...cur.value.distribution] : [...DISTRIBUTION_ALL.slice(0, 4)]
  pubVisible.value = true
}

async function doPublish() {
  if (!pubForm.distribution.length) { msg.warning('请至少选择一个分发对象'); return }
  pubSaving.value = true
  try {
    const res: any = await publishReviewReport({ reportId: cur.value.reportId, distribution: pubForm.distribution })
    msg.success(res.message)
    pubVisible.value = false
    cur.value = await getReviewReportDetail(cur.value.reportId)
    await Promise.all([loadStats(), load()])
  } finally { pubSaving.value = false }
}

/* ========== 图表 ========== */
const AXIS_DARK = {
  axisLine: { lineStyle: { color: '#cdd7e6' } },
  axisTick: { show: false },
  axisLabel: { color: '#6b7a90', fontSize: 10 },
  splitLine: { lineStyle: { color: '#eef1f7', type: 'dashed' } }
}
const TT = {
  backgroundColor: '#ffffff', borderColor: '#e2e8f2',
  textStyle: { color: '#1a2230', fontSize: 11 }
}
const HEX = ['#0891b2', '#722ed1', '#1668dc', '#d48806', '#d43878', '#12a150']

/** 报告类型分布（环形） */
const typeOption = computed(() => {
  const d = st.value?.reportTypeDist || []
  return {
    color: HEX,
    tooltip: { trigger: 'item', ...TT, formatter: '{b}<br/>{c} 份（{d}%）' },
    legend: {
      type: 'scroll', orient: 'vertical', right: 0, top: 'middle',
      itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 }, pageIconColor: '#0891b2'
    },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['32%', '50%'],
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
      label: { show: true, position: 'inside', formatter: '{c}', color: '#1a2230', fontSize: 10, fontWeight: 700 },
      emphasis: { scaleSize: 6, itemStyle: { shadowBlur: 16, shadowColor: 'rgba(22,104,220,.3)' } },
      data: d.map((i: any) => ({ name: i.name, value: i.value }))
    }]
  }
})

/** 报告阅读率排行 */
const readOption = computed(() => {
  const d = [...list.value].filter((r) => r.status === '已发布')
    .sort((a, b) => b.readStatus.readRate - a.readStatus.readRate).slice(0, 8)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT,
      formatter: (p: any) => {
        const it = d[d.length - 1 - p[0].dataIndex]
        return `${it.reportName}<br/>阅读 ${it.readStatus.read}/${it.readStatus.total} 人<br/>阅读率 ${(it.readStatus.readRate * 100).toFixed(1)}%`
      } },
    grid: { left: 8, right: 48, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', max: 100, ...AXIS_DARK, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: d.map((i: any) => (i.reportName.length > 13 ? i.reportName.slice(0, 13) + '…' : i.reportName)).reverse(),
      ...AXIS_DARK, splitLine: { show: false }, axisLabel: { color: '#6b7a90', fontSize: 9.5 }
    },
    series: [{
      type: 'bar', barWidth: 11,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: 'rgba(76,245,168,.28)' }, { offset: 1, color: '#12a150' }] }
      },
      label: { show: true, position: 'right', formatter: '{c}%', color: '#12a150', fontSize: 10, fontWeight: 700 },
      data: d.map((i: any) => Number((i.readStatus.readRate * 100).toFixed(1))).reverse()
    }]
  }
})

onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="viz-page">
    <header class="viz-head">
      <div class="viz-head__t">
        复盘报告管理
        <span class="viz-head__sub">标准化七章结构 · AI 生成 + 人工审核 · 分发阅读与反馈闭环</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Document /></el-icon>报告 <b>{{ st?.reportTotal || 0 }}</b> 份</span>
        <span><el-icon><Promotion /></el-icon>已发布 <b>{{ st?.reportPublished || 0 }}</b></span>
        <span><el-icon><View /></el-icon>平均阅读率 <b>{{ st?.avgReadRate || 0 }}%</b></span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'MagicStick'" @click="genVisible = true">AI 生成报告</el-button>
    </header>

    <div class="viz-grid viz-grid--4 rr-kpi">
      <VizMetric label="复盘报告总数" :value="st?.reportTotal || 0" unit="份" icon="Document" tone="cyan"
        :desc="`已发布 ${st?.reportPublished || 0} · 待审核 ${st?.reportPending || 0}`"
        :progress="st?.reportTotal ? (st.reportPublished / st.reportTotal) * 100 : 0" />
      <VizMetric label="已发布报告" :value="st?.reportPublished || 0" unit="份" icon="Promotion" tone="lime"
        desc="已纳入复盘库供检索调阅" />
      <VizMetric label="待审核报告" :value="st?.reportPending || 0" unit="份" icon="Clock" tone="amber"
        desc="需经基金监管处审批后发布" />
      <VizMetric label="平均阅读率" :value="st?.avgReadRate || 0" unit="%" icon="View" tone="violet" :precision="1"
        desc="分发对象阅读完成情况" :progress="st?.avgReadRate || 0" />
    </div>

    <div class="rr-charts">
      <VizPanel title="报告类型构成" tone="violet" extra="个案 / 类案 / 周期" glow>
        <EChart :option="typeOption" height="216px" />
      </VizPanel>
      <VizPanel title="报告阅读率 TOP8" tone="lime" extra="已发布报告">
        <EChart :option="readOption" height="216px" />
      </VizPanel>
      <VizPanel title="标准化报告结构" tone="cyan" extra="七章固定结构">
        <div class="chs">
          <div v-for="(c, i) in ['复盘概述', '案件回顾', '质量评分', '问题剖析', '原因分析', '改进措施', '经验教训']"
            :key="c" class="ch" :style="{ animationDelay: i * 70 + 'ms' }">
            <span class="ch__no">{{ ['一', '二', '三', '四', '五', '六', '七'][i] }}</span>
            <span class="ch__n">{{ c }}</span>
            <span class="ch__line" />
          </div>
        </div>
        <div class="viz-note" style="margin-top: 8px">
          <el-icon><InfoFilled /></el-icon>
          AI 按七章结构自动撰写，人工审核确认后发布并分发，全文纳入复盘库支持全文检索。
        </div>
      </VizPanel>
    </div>

    <VizPanel title="复盘报告库" tone="cyan" :extra="`共 ${total} 份`">
      <el-form class="viz-form rr-q" :model="q" @submit.prevent>
        <el-input v-model="q.keyword" placeholder="报告ID / 报告名称" clearable size="small"
          :prefix-icon="'Search'" style="width: 232px" @keyup.enter="doQuery" />
        <el-select v-model="q.reportType" placeholder="全部类型" clearable size="small" style="width: 148px">
          <el-option v-for="t in (st?.reportTypes || [])" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="q.status" placeholder="全部状态" clearable size="small" style="width: 116px">
          <el-option v-for="s in (st?.statusList || [])" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="doQuery">查　询</el-button>
        <el-button class="viz-btn" size="small" :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
      </el-form>

      <el-table class="viz-table" :data="list" size="small" border stripe v-loading="loading"
        element-loading-background="rgba(255,255,255,.65)">
        <el-table-column prop="reportId" label="报告ID" width="144">
          <template #default="{ row }">
            <span class="viz-link" @click="openDetail(row)">{{ row.reportId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reportName" label="报告名称" min-width="250" show-overflow-tooltip />
        <el-table-column prop="reportType" label="类型" width="126" align="center">
          <template #default="{ row }">
            <span class="viz-tag" :class="`viz-tag--${TYPE_TONE[row.reportType] || 'cyan'}`">{{ row.reportType }}</span>
          </template>
        </el-table-column>
        <el-table-column label="字数" width="84" align="right">
          <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.totalWordCount }}</span></template>
        </el-table-column>
        <el-table-column label="阅读情况" width="150">
          <template #default="{ row }">
            <div class="rdb">
              <span class="rdb__t viz-num">{{ row.readStatus.read }}/{{ row.readStatus.total }}</span>
              <span class="rdb__bar">
                <span class="rdb__f" :style="{ width: row.readStatus.readRate * 100 + '%' }" />
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="反馈" width="66" align="center">
          <template #default="{ row }">
            <span v-if="row.feedback.length" class="viz-tag viz-tag--cyan">{{ row.feedback.length }}</span>
            <span v-else class="viz-faint viz-mini">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="confidentiality" label="密级" width="72" align="center">
          <template #default="{ row }">
            <span class="viz-tag" :class="`viz-tag--${CONF_TONE[row.confidentiality]}`">{{ row.confidentiality }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="82" align="center">
          <template #default="{ row }">
            <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[row.status]}`">{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="generateTime" label="生成时间" width="146">
          <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.generateTime }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="72" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link :icon="'Reading'" style="color: var(--viz-cyan)" @click="openDetail(row)">阅读</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无复盘报告</div></template>
      </el-table>

      <div class="viz-pager">
        <span class="viz-pager__c">共 {{ total }} 份</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </VizPanel>

    <!-- ============ 报告阅读抽屉（书本式） ============ -->
    <el-drawer v-model="drawer" size="780px" class="viz-drawer" title="复盘报告">
      <template v-if="cur">
        <div v-loading="dLoading" element-loading-background="rgba(255,255,255,.65)">
          <!-- 封面 -->
          <div class="cover">
            <div class="cover__deco" />
            <div class="cover__top">
              <span class="viz-tag" :class="`viz-tag--${TYPE_TONE[cur.reportType] || 'cyan'}`">{{ cur.reportType }}</span>
              <span class="viz-tag" :class="`viz-tag--${CONF_TONE[cur.confidentiality]}`">{{ cur.confidentiality }}</span>
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[cur.status]}`">{{ cur.status }}</span>
            </div>
            <h3 class="cover__t">{{ cur.reportName }}</h3>
            <div class="cover__m">
              <span><el-icon><Ticket /></el-icon>{{ cur.reportId }}</span>
              <span><el-icon><MagicStick /></el-icon>{{ cur.generateMode }}</span>
              <span><el-icon><EditPen /></el-icon>{{ cur.totalWordCount }} 字</span>
              <span><el-icon><Clock /></el-icon>{{ cur.generateTime }}</span>
            </div>
            <div class="cover__ap">
              <span><el-icon :size="11"><UserFilled /></el-icon>审批：{{ cur.approver }}</span>
              <span v-if="cur.approvalTime" class="viz-num">{{ cur.approvalTime }}</span>
            </div>
            <div class="cover__tags">
              <span v-for="t in cur.tags" :key="t" class="cover__tag">#{{ t }}</span>
            </div>
          </div>

          <!-- 章节导航 -->
          <div class="secnav viz-scroll">
            <button v-for="(s, i) in cur.sections" :key="s.no" class="sn"
              :class="{ 'is-active': secIdx === i }" @click="secIdx = i">
              <span class="sn__no">{{ s.no }}</span>
              <span class="sn__n">{{ s.name }}</span>
            </button>
          </div>

          <!-- 章节正文 -->
          <article class="paper">
            <header class="paper__h">
              <span class="paper__no">{{ cur.sections[secIdx].no }}</span>
              <h4 class="paper__t">{{ cur.sections[secIdx].name }}</h4>
              <span class="paper__wc viz-num">{{ cur.sections[secIdx].wordCount }} 字</span>
            </header>
            <p class="paper__c">{{ cur.sections[secIdx].content }}</p>
            <footer class="paper__f">
              <el-button class="viz-btn" size="small" :icon="'ArrowLeft'" :disabled="secIdx === 0" @click="secIdx--">
                上一章
              </el-button>
              <span class="paper__pg viz-num">{{ secIdx + 1 }} / {{ cur.sections.length }}</span>
              <el-button class="viz-btn" size="small" :icon="'ArrowRight'"
                :disabled="secIdx === cur.sections.length - 1" @click="secIdx++">下一章</el-button>
            </footer>
          </article>

          <!-- 附件 -->
          <div class="viz-sub">报告附件<span class="viz-sub__x" /><span class="viz-sub__e">{{ cur.attachments.length }} 个</span></div>
          <div class="atts">
            <div v-for="a in cur.attachments" :key="a" class="att">
              <el-icon :size="13"><component :is="a.endsWith('.pdf') ? 'Document' : 'Tickets'" /></el-icon>
              <span class="att__n">{{ a }}</span>
              <el-icon class="att__d" :size="12"><Download /></el-icon>
            </div>
          </div>

          <!-- 分发与阅读 -->
          <div class="viz-sub">分发范围与阅读情况<span class="viz-sub__x" /></div>
          <div class="dist">
            <div class="dist__l">
              <span v-for="dd in cur.distribution" :key="dd" class="viz-tag viz-tag--blue">{{ dd }}</span>
            </div>
            <div class="dist__r">
              <div class="dist__ring" :style="{ '--p': cur.readStatus.readRate * 100 + '%' }">
                <b class="viz-num">{{ (cur.readStatus.readRate * 100).toFixed(0) }}%</b>
              </div>
              <div class="dist__t viz-num">{{ cur.readStatus.read }} / {{ cur.readStatus.total }} 人已阅</div>
            </div>
          </div>

          <!-- 反馈 -->
          <template v-if="cur.feedback.length">
            <div class="viz-sub">阅读反馈<span class="viz-sub__x" /><span class="viz-sub__e">{{ cur.feedback.length }} 条</span></div>
            <div class="fbs">
              <div v-for="(f, i) in cur.feedback" :key="i" class="fbi">
                <div class="fbi__h">
                  <el-icon :size="12"><ChatDotRound /></el-icon>
                  <b>{{ f.from }}</b>
                  <span class="fbi__t viz-num">{{ f.time }}</span>
                </div>
                <p class="fbi__c">{{ f.content }}</p>
              </div>
            </div>
          </template>

          <div class="dr-act">
            <el-button class="viz-btn" :icon="'Download'" @click="msg.success('报告 PDF 已导出，正在下载')">导出 PDF</el-button>
            <el-button class="viz-btn" :icon="'Printer'" @click="msg.success('已发送至打印队列')">打印</el-button>
            <el-button v-if="cur.status !== '已发布'" class="viz-btn is-hot" :icon="'Promotion'" @click="openPublish">
              审核并发布
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ AI 生成报告 ============ -->
    <el-dialog v-model="genVisible" title="AI 生成复盘报告" width="560px" class="viz-dialog">
      <el-form class="viz-form" label-width="94px">
        <el-form-item label="报告类型" required>
          <el-select v-model="genForm.reportType" style="width: 100%">
            <el-option v-for="t in (st?.reportTypes || [])" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联复盘">
          <el-input v-model="genForm.reviewId" placeholder="如 REVIEW202610250001（周期报告可留空）" />
        </el-form-item>
        <el-form-item label="报告密级">
          <el-radio-group v-model="genForm.confidentiality">
            <el-radio-button v-for="c in (st?.confidentiality || [])" :key="c" :value="c" :label="c" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="生成说明">
          <div class="viz-note">
            <el-icon><InfoFilled /></el-icon>
            AI 将按「复盘概述→案件回顾→质量评分→问题剖析→原因分析→改进措施→经验教训」七章结构撰写，
            自动引用评分数据、问题清单与措施台账，生成后进入待审核状态。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="genVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="genRunning" @click="doGenerate">开始生成</el-button>
      </template>
    </el-dialog>

    <!-- ============ 发布报告 ============ -->
    <el-dialog v-model="pubVisible" title="审核并发布报告" width="520px" class="viz-dialog">
      <el-alert class="viz-alert" type="warning" :closable="false" show-icon>
        <template #title>
          <span class="viz-mini">发布后报告将分发至所选对象并纳入复盘库，支持全文检索调阅</span>
        </template>
      </el-alert>
      <el-form class="viz-form" label-width="80px" style="margin-top: 12px">
        <el-form-item label="分发范围" required>
          <el-checkbox-group v-model="pubForm.distribution">
            <el-checkbox v-for="dd in DISTRIBUTION_ALL" :key="dd" :value="dd" :label="dd" />
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button class="viz-btn" @click="pubVisible = false">取消</el-button>
        <el-button class="viz-btn is-hot" :loading="pubSaving" @click="doPublish">确认发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.rr-kpi { margin-bottom: 12px; }

.rr-charts {
  display: grid; grid-template-columns: 1fr 1.15fr 1.05fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.rr-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

/* ---------- 章节结构 ---------- */
.chs { display: flex; flex-direction: column; gap: 4px; }

.ch {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; border-radius: 3px;
  background: var(--zh-bg-soft);
  animation: chIn .45s cubic-bezier(.2, .9, .3, 1) both;

  &__no {
    width: 18px; height: 18px; flex-shrink: 0; border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; color: #fff;
    background: var(--viz-cyan);
  }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); flex-shrink: 0; }
  &__line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--zh-border-strong), transparent); }
}

@keyframes chIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }

/* ---------- 阅读率条 ---------- */
.rdb {
  display: flex; align-items: center; gap: 7px;
  &__t { font-size: 10.5px; font-weight: 700; color: var(--viz-text-dim); min-width: 40px; }
  &__bar { flex: 1; height: 4px; border-radius: 2px; background: var(--zh-border-light); overflow: hidden; }
  &__f {
    display: block; height: 100%; border-radius: 2px;
    background: var(--viz-lime); box-shadow: 0 0 8px var(--viz-lime);
  }
}

/* ---------- 报告封面 ---------- */
.cover {
  position: relative; overflow: hidden;
  padding: 16px 18px;
  border-radius: 5px;
  background: linear-gradient(140deg, var(--zh-primary-lighter), rgba(114, 46, 209, .08) 52%, var(--zh-bg-soft));
  border: 1px solid var(--viz-line-strong);

  &__deco {
    position: absolute; right: -40px; top: -40px;
    width: 150px; height: 150px; border-radius: 50%;
    background: radial-gradient(circle, rgba(114, 46, 209, .12), transparent 68%);
    pointer-events: none;
  }

  &__top { display: flex; gap: 5px; flex-wrap: wrap; position: relative; }

  &__t {
    margin: 10px 0 0; font-size: 17px; font-weight: 800; line-height: 1.55;
    color: var(--zh-text-primary); letter-spacing: .6px;
    position: relative;
  }

  &__m {
    display: flex; flex-wrap: wrap; gap: 13px; margin-top: 9px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--viz-cyan); }
  }

  &__ap {
    display: flex; align-items: center; gap: 12px; margin-top: 8px; padding-top: 7px;
    border-top: 1px dashed var(--zh-border);
    font-size: 10px; color: var(--viz-text-faint);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--viz-lime); }
  }

  &__tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
  &__tag { font-size: 9.5px; color: var(--viz-violet); }
}

/* ---------- 章节导航 ---------- */
.secnav {
  display: flex; gap: 5px; margin: 12px 0 10px;
  overflow-x: auto; padding-bottom: 4px;
}

.sn {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  padding: 5px 10px; border-radius: 4px; cursor: pointer;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  color: var(--viz-text-dim); font-size: 11px;
  transition: all .2s;

  &__no {
    width: 15px; height: 15px; border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800;
    background: var(--zh-border-light);
  }

  &:hover { border-color: var(--viz-line-strong); color: var(--viz-text); }
  &.is-active {
    background: var(--zh-primary-lighter);
    border-color: var(--viz-cyan); color: var(--viz-cyan); font-weight: 700;
    box-shadow: 0 0 14px -5px var(--viz-cyan);
    .sn__no { background: var(--viz-cyan); color: #fff; }
  }
}

/* ---------- 正文纸 ---------- */
.paper {
  padding: 14px 16px; border-radius: 5px;
  background: linear-gradient(180deg, var(--zh-bg-soft), var(--zh-bg-soft));
  border: 1px solid var(--zh-border-light);

  &__h {
    display: flex; align-items: center; gap: 8px;
    padding-bottom: 9px; border-bottom: 1px solid var(--zh-border-light);
  }
  &__no {
    width: 22px; height: 22px; flex-shrink: 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #fff;
    background: linear-gradient(135deg, var(--viz-cyan), var(--viz-blue));
  }
  &__t { flex: 1; margin: 0; font-size: 14px; font-weight: 700; color: var(--viz-text); letter-spacing: .5px; }
  &__wc { font-size: 10px; color: var(--viz-text-faint); }

  &__c {
    margin: 12px 0 0; font-size: 12px; line-height: 2.05;
    color: var(--viz-text-dim); text-align: justify; text-indent: 2em;
    min-height: 130px;
  }

  &__f {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-top: 12px; padding-top: 10px;
    border-top: 1px dashed var(--zh-border-light);
    :deep(.el-button) { margin-left: 0 !important; }
  }
  &__pg { font-size: 11px; color: var(--viz-text-faint); }
}

/* ---------- 附件 ---------- */
.atts { display: flex; flex-direction: column; gap: 5px; }

.att {
  display: flex; align-items: center; gap: 7px; cursor: pointer;
  padding: 6px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  transition: all .2s;
  &:hover { border-color: var(--viz-line-strong); background: var(--zh-primary-lighter); }

  > :deep(.el-icon) { color: var(--viz-cyan); }
  &__n { flex: 1; font-size: 11px; color: var(--viz-text-dim); }
  &__d { color: var(--viz-text-faint) !important; }
}

/* ---------- 分发与阅读 ---------- */
.dist {
  display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center;
  padding: 11px 13px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__l { display: flex; flex-wrap: wrap; gap: 5px; }
  &__r { text-align: center; }

  &__ring {
    width: 62px; height: 62px; margin: 0 auto; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: conic-gradient(var(--viz-lime) var(--p), var(--zh-border-light) 0);
    position: relative;

    &::before {
      content: ''; position: absolute; inset: 6px;
      border-radius: 50%; background: #ffffff;
    }
    b {
      position: relative; font-size: 15px; font-weight: 800; color: var(--viz-lime);
    }
  }
  &__t { margin-top: 5px; font-size: 10px; color: var(--viz-text-faint); }
}

/* ---------- 反馈 ---------- */
.fbs { display: flex; flex-direction: column; gap: 7px; }

.fbi {
  padding: 9px 11px; border-radius: 4px;
  background: var(--zh-primary-lighter);
  border: 1px solid var(--zh-border);
  border-left: 2px solid var(--viz-cyan);

  &__h {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-cyan); }
  }
  &__t { margin-left: auto; font-size: 9.5px; color: var(--viz-text-faint); }
  &__c { margin: 6px 0 0; font-size: 11px; line-height: 1.8; color: var(--viz-text-dim); }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}
</style>
