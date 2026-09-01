<script setup lang="ts">
import {
  getAnalysisReportStats, getAnalysisReportList, getAnalysisReportDetail,
  generateAnalysisReport, exportAnalysisReport
} from '@/api/agent05-promote/promote'

const msg = ElMessage

const st = ref<any>(null)
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const q = reactive({ keyword: '', reportType: '', status: '', page: 1, pageSize: 10 })

const ST_TONE: Record<string, string> = { 已生成: 'lime', 待审核: 'amber', 生成中: 'cyan' }
const TYPE_TONE: Record<string, string> = {
  月度监管分析报告: 'cyan', 季度监管分析报告: 'blue', 年度监管分析报告: 'violet',
  专项检查总结报告: 'amber', 态势研判报告: 'red', 专题分析报告: 'pink'
}
const CHART_ICON: Record<string, string> = {
  indicatorCards: 'Grid', line: 'TrendCharts', pie: 'PieChart', map: 'MapLocation', bar: 'Histogram'
}

async function loadStats() { st.value = await getAnalysisReportStats() }

async function load() {
  loading.value = true
  try {
    const res: any = await getAnalysisReportList(q)
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally { loading.value = false }
}

function doQuery() { q.page = 1; load() }
function doReset() {
  Object.assign(q, { keyword: '', reportType: '', status: '', page: 1 })
  load()
}

/* ---------- 一键生成（流水线动画） ---------- */
const genVisible = ref(false)
const genRunning = ref(false)
const genStep = ref(-1)
const genResult = ref<any>(null)
const genForm = reactive({ reportType: '月度监管分析报告', period: '2026年8月', area: '芜湖市' })
let stepTimer: any = null

function openGen() {
  genStep.value = -1
  genResult.value = null
  genVisible.value = true
}

async function doGenerate() {
  genRunning.value = true
  genStep.value = 0
  genResult.value = null
  const pipeline = st.value?.pipeline || []
  // 前端流水线动画（与后端耗时并行）
  let i = 0
  const advance = () => {
    if (i >= pipeline.length - 1) return
    stepTimer = setTimeout(() => { i++; genStep.value = i; advance() }, pipeline[i]?.ms || 800)
  }
  advance()
  try {
    const res: any = await generateAnalysisReport(genForm)
    clearTimeout(stepTimer)
    genStep.value = pipeline.length
    genResult.value = res
    msg.success(res.message)
    await Promise.all([loadStats(), load()])
  } finally { genRunning.value = false }
}

/* ---------- 报告详情 ---------- */
const drawer = ref(false)
const cur = ref<any>(null)
const dLoading = ref(false)
const secIdx = ref(0)

async function openDetail(row: any) {
  drawer.value = true
  dLoading.value = true
  secIdx.value = 0
  try { cur.value = await getAnalysisReportDetail(row.reportId) } finally { dLoading.value = false }
}

const exporting = ref(false)
async function doExport(fmt: string) {
  exporting.value = true
  try {
    const res: any = await exportAnalysisReport({ reportId: cur.value?.reportId || list.value[0]?.reportId, format: fmt })
    msg.success(res.message)
  } finally { exporting.value = false }
}

/* ========== 图表 ========== */
const TT = {
  backgroundColor: '#ffffff', borderColor: '#e2e8f2',
  textStyle: { color: '#1a2230', fontSize: 11 }
}
const HEX = ['#0891b2', '#1668dc', '#722ed1', '#d48806', '#e5484d', '#d43878']

const typeOption = computed(() => {
  const d = st.value?.typeDist || []
  return {
    color: HEX,
    tooltip: { trigger: 'item', ...TT, formatter: '{b}<br/>{c} 份（{d}%）' },
    legend: {
      type: 'scroll', orient: 'vertical', right: 0, top: 'middle',
      itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 }, pageIconColor: '#0891b2'
    },
    series: [{
      type: 'pie', radius: ['40%', '66%'], center: ['30%', '50%'], roseType: 'radius',
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 3 },
      label: { show: true, position: 'inside', formatter: '{c}', color: '#1a2230', fontSize: 10, fontWeight: 700 },
      emphasis: { scaleSize: 7, itemStyle: { shadowBlur: 16, shadowColor: 'rgba(22,104,220,.3)' } },
      data: d.map((i: any) => ({ name: i.name, value: i.value }))
    }]
  }
})

onUnmounted(() => clearTimeout(stepTimer))
onMounted(() => { loadStats(); load() })
</script>

<template>
  <div class="viz-page">
    <header class="viz-head">
      <div class="viz-head__t">
        一键分析报告
        <span class="viz-head__sub">AI 自动撰写七章正文 · 图表自动生成 · Word / PDF 双格式导出</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Document /></el-icon>报告 <b>{{ st?.total || 0 }}</b> 份</span>
        <span><el-icon><PieChart /></el-icon>图表 <b>{{ (st?.charts || []).length }}</b> 张</span>
        <span><el-icon><Tickets /></el-icon>统计表 <b>{{ (st?.tables || []).length }}</b> 张</span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="loadStats(); load()">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'MagicStick'" @click="openGen">一键生成报告</el-button>
    </header>

    <!-- ============ 生成流水线 ============ -->
    <VizPanel title="报告生成流水线" tone="cyan" extra="数据抽取 → 指标计算 → 图表生成 → AI 撰写 → 排版导出" glow class="ar-pipe">
      <div class="pipe">
        <div v-for="(p, i) in (st?.pipeline || [])" :key="p.step" class="pi"
          :class="{ 'is-done': genStep > i, 'is-run': genStep === i, 'is-idle': genStep < i }">
          <div class="pi__node">
            <el-icon v-if="genStep > i" :size="14"><Select /></el-icon>
            <el-icon v-else-if="genStep === i" :size="14" class="is-spin"><Loading /></el-icon>
            <el-icon v-else :size="14"><component :is="p.icon" /></el-icon>
          </div>
          <div class="pi__b">
            <div class="pi__n">{{ p.step }}. {{ p.name }}</div>
            <div class="pi__d">{{ p.desc }}</div>
          </div>
          <span v-if="i < (st?.pipeline || []).length - 1" class="pi__link">
            <i :class="{ 'is-on': genStep > i }" />
          </span>
        </div>
      </div>
    </VizPanel>

    <!-- ============ 图表 / 表格清单 ============ -->
    <div class="ar-c1">
      <VizPanel title="报告类型分布" tone="violet" extra="6 类报告" glow>
        <EChart :option="typeOption" height="212px" />
      </VizPanel>

      <VizPanel title="自动生成图表清单" tone="cyan" extra="6 张图表">
        <div class="cl">
          <div v-for="(c, i) in (st?.charts || [])" :key="c.id" class="cli"
            :style="{ '--clc': HEX[i % HEX.length], animationDelay: i * 70 + 'ms' }">
            <el-icon class="cli__i" :size="15"><component :is="CHART_ICON[c.type] || 'DataLine'" /></el-icon>
            <div class="cli__b">
              <div class="cli__n">{{ c.name }}</div>
              <div class="cli__d">{{ c.desc }}</div>
            </div>
            <span class="cli__id viz-num">{{ c.id }}</span>
          </div>
        </div>
      </VizPanel>

      <VizPanel title="附件统计表" tone="amber" extra="3 张统计表">
        <div class="tl">
          <div v-for="t in (st?.tables || [])" :key="t.id" class="tli">
            <el-icon :size="14"><Tickets /></el-icon>
            <div class="tli__b">
              <div class="tli__n">{{ t.name }}</div>
              <div class="tli__d viz-num">{{ t.rows }} 行 × {{ t.cols }} 列</div>
            </div>
            <span class="tli__id viz-num">{{ t.id }}</span>
          </div>
        </div>
        <div class="viz-note" style="margin-top: 9px">
          <el-icon><InfoFilled /></el-icon>
          报告支持自定义模板与数据范围；图表与统计表随数据范围自动重新计算并嵌入正文。
        </div>
      </VizPanel>
    </div>

    <!-- ============ 报告列表 ============ -->
    <VizPanel title="分析报告库" tone="lime" :extra="`共 ${total} 份`">
      <el-form class="viz-form ar-q" :model="q" @submit.prevent>
        <el-input v-model="q.keyword" placeholder="报告ID / 报告名称" clearable size="small"
          :prefix-icon="'Search'" style="width: 236px" @keyup.enter="doQuery" />
        <el-select v-model="q.reportType" placeholder="全部类型" clearable size="small" style="width: 172px">
          <el-option v-for="t in (st?.reportTypes || [])" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="q.status" placeholder="全部状态" clearable size="small" style="width: 112px">
          <el-option v-for="s in ['已生成', '待审核', '生成中']" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button class="viz-btn is-hot" size="small" :icon="'Search'" @click="doQuery">查　询</el-button>
        <el-button class="viz-btn" size="small" :icon="'RefreshLeft'" @click="doReset">重　置</el-button>
      </el-form>

      <el-table class="viz-table" :data="list" size="small" border stripe v-loading="loading"
        element-loading-background="rgba(255,255,255,.65)">
        <el-table-column prop="reportId" label="报告ID" width="184">
          <template #default="{ row }">
            <span class="viz-link" @click="openDetail(row)">{{ row.reportId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reportName" label="报告名称" min-width="250" show-overflow-tooltip />
        <el-table-column prop="reportType" label="类型" width="152" align="center">
          <template #default="{ row }">
            <span class="viz-tag" :class="`viz-tag--${TYPE_TONE[row.reportType] || 'cyan'}`">{{ row.reportType }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="period" label="统计周期" width="98" align="center">
          <template #default="{ row }"><span class="viz-dim viz-mini">{{ row.period }}</span></template>
        </el-table-column>
        <el-table-column label="内容规模" width="150">
          <template #default="{ row }">
            <span class="viz-mini viz-dim viz-num">
              {{ row.totalWordCount }} 字 · {{ row.sections.length }} 章 · {{ row.charts.length }} 图
            </span>
          </template>
        </el-table-column>
        <el-table-column label="阅读" width="76" align="right">
          <template #default="{ row }"><span class="viz-num viz-mini" style="color: var(--viz-cyan)">{{ row.readCount }}</span></template>
        </el-table-column>
        <el-table-column label="导出格式" width="108" align="center">
          <template #default="{ row }">
            <span v-for="f in row.exportFormats" :key="f" class="viz-tag viz-tag--faint mr4">{{ f }}</span>
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
        <template #empty><div class="viz-empty"><el-icon><DocumentDelete /></el-icon>暂无分析报告</div></template>
      </el-table>

      <div class="viz-pager">
        <span class="viz-pager__c">共 {{ total }} 份</span>
        <el-pagination v-model:current-page="q.page" v-model:page-size="q.pageSize" :total="total"
          :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="load" />
      </div>
    </VizPanel>

    <!-- ============ 报告阅读抽屉 ============ -->
    <el-drawer v-model="drawer" size="820px" class="viz-drawer" title="监管分析报告">
      <template v-if="cur">
        <div v-loading="dLoading" element-loading-background="rgba(255,255,255,.65)">
          <!-- 封面 -->
          <div class="rcover">
            <div class="rcover__glow" />
            <div class="rcover__badge">
              <span class="viz-tag" :class="`viz-tag--${TYPE_TONE[cur.reportType] || 'cyan'}`">{{ cur.reportType }}</span>
              <span class="viz-tag viz-tag--solid" :class="`viz-tag--${ST_TONE[cur.status]}`">{{ cur.status }}</span>
            </div>
            <h3 class="rcover__t">{{ cur.reportName }}</h3>
            <div class="rcover__stats">
              <div class="rs"><b class="viz-num">{{ cur.sections.length }}</b><span>章节</span></div>
              <div class="rs"><b class="viz-num">{{ cur.totalWordCount }}</b><span>字数</span></div>
              <div class="rs"><b class="viz-num">{{ cur.charts.length }}</b><span>图表</span></div>
              <div class="rs"><b class="viz-num">{{ cur.tables.length }}</b><span>统计表</span></div>
              <div class="rs"><b class="viz-num">{{ cur.readCount }}</b><span>阅读</span></div>
            </div>
            <div class="rcover__m">
              <span><el-icon><MagicStick /></el-icon>{{ cur.generateMode }}</span>
              <span><el-icon><Location /></el-icon>{{ cur.area }} · {{ cur.period }}</span>
              <span><el-icon><Clock /></el-icon>{{ cur.generateTime }}</span>
            </div>
            <div v-if="cur.reviewOpinion" class="rcover__rv">
              <el-icon :size="11"><CircleCheckFilled /></el-icon>
              <b>{{ cur.reviewer }}</b>
              <span>{{ cur.reviewOpinion }}</span>
            </div>
          </div>

          <!-- 章节导航 -->
          <div class="rsec viz-scroll">
            <button v-for="(s, i) in cur.sections" :key="s.no" class="rsn"
              :class="{ 'is-active': secIdx === i }" @click="secIdx = i">
              <span class="rsn__no">{{ s.no }}</span>{{ s.name }}
            </button>
          </div>

          <!-- 正文 -->
          <article class="rpaper">
            <header class="rpaper__h">
              <span class="rpaper__no">{{ cur.sections[secIdx].no }}</span>
              <h4 class="rpaper__t">{{ cur.sections[secIdx].name }}</h4>
              <span class="rpaper__wc viz-num">{{ cur.sections[secIdx].wordCount }} 字</span>
            </header>

            <!-- 本章配图 -->
            <div v-if="cur.sections[secIdx].charts" class="rpaper__ch">
              <span class="rpaper__chl">本章配图</span>
              <span v-for="c in cur.sections[secIdx].charts" :key="c" class="viz-tag viz-tag--cyan">
                <el-icon :size="9"><PieChart /></el-icon>{{ c }}
              </span>
            </div>

            <!-- 本章案例 -->
            <div v-if="cur.sections[secIdx].cases" class="rpaper__ch">
              <span class="rpaper__chl">重点案例</span>
              <span v-for="c in cur.sections[secIdx].cases" :key="c" class="viz-tag viz-tag--red">{{ c }}</span>
            </div>

            <!-- 风险等级（第五章） -->
            <div v-if="cur.sections[secIdx].riskLevels" class="risks">
              <div v-for="(lv, k) in cur.sections[secIdx].riskLevels" :key="k" class="rk"
                :class="lv === '高' ? 'is-high' : lv === '中' ? 'is-mid' : 'is-low'">
                <span class="rk__n">{{ k }}</span>
                <span class="rk__l">{{ lv }}风险</span>
              </div>
            </div>

            <p class="rpaper__c">{{ cur.sections[secIdx].content }}</p>

            <footer class="rpaper__f">
              <el-button class="viz-btn" size="small" :icon="'ArrowLeft'" :disabled="secIdx === 0" @click="secIdx--">上一章</el-button>
              <span class="rpaper__pg viz-num">{{ secIdx + 1 }} / {{ cur.sections.length }}</span>
              <el-button class="viz-btn" size="small" :icon="'ArrowRight'"
                :disabled="secIdx === cur.sections.length - 1" @click="secIdx++">下一章</el-button>
            </footer>
          </article>

          <!-- 图表清单 -->
          <div class="viz-sub">报告内嵌图表<span class="viz-sub__x" /><span class="viz-sub__e">{{ cur.charts.length }} 张</span></div>
          <div class="cgrid">
            <div v-for="(c, i) in cur.charts" :key="c.id" class="cg" :style="{ '--cgc': HEX[i % HEX.length] }">
              <el-icon :size="16"><component :is="CHART_ICON[c.type] || 'DataLine'" /></el-icon>
              <div class="cg__n">{{ c.name }}</div>
              <div class="cg__t viz-num">{{ c.id }} · {{ c.type }}</div>
            </div>
          </div>

          <!-- 统计表 -->
          <div class="viz-sub">附件统计表<span class="viz-sub__x" /></div>
          <el-table class="viz-table" :data="cur.tables" size="small" border stripe>
            <el-table-column prop="id" label="编号" width="90">
              <template #default="{ row }"><span class="viz-num viz-mini">{{ row.id }}</span></template>
            </el-table-column>
            <el-table-column prop="name" label="统计表名称" min-width="200" />
            <el-table-column label="规模" width="130" align="center">
              <template #default="{ row }"><span class="viz-num viz-mini viz-dim">{{ row.rows }} 行 × {{ row.cols }} 列</span></template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
              <template #default>
                <el-button link :icon="'Download'" style="color: var(--viz-cyan)"
                  @click="msg.success('统计表已导出 Excel')">导出</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="dr-act">
            <el-button class="viz-btn" :icon="'Document'" :loading="exporting" @click="doExport('Word')">导出 Word</el-button>
            <el-button class="viz-btn" :icon="'Tickets'" :loading="exporting" @click="doExport('PDF')">导出 PDF</el-button>
            <el-button class="viz-btn is-hot" :icon="'Printer'" @click="msg.success('已发送至打印队列')">打印报告</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 一键生成弹窗 ============ -->
    <el-dialog v-model="genVisible" title="一键生成分析报告" width="640px" class="viz-dialog" top="6vh">
      <el-form class="viz-form" label-width="94px">
        <el-form-item label="报告类型" required>
          <el-select v-model="genForm.reportType" style="width: 100%">
            <el-option v-for="t in (st?.reportTypes || [])" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <div class="gf-row">
          <el-form-item label="统计周期">
            <el-select v-model="genForm.period" style="width: 100%">
              <el-option v-for="p in ['2026年8月', '2026年7月', '2026年第三季度', '2026年上半年', '2026年度']"
                :key="p" :label="p" :value="p" />
            </el-select>
          </el-form-item>
          <el-form-item label="统计范围">
            <el-select v-model="genForm.area" style="width: 100%">
              <el-option v-for="a in ['芜湖市', '市本级', '镜湖区', '鸠江区', '弋江区', '湾沚区']" :key="a" :label="a" :value="a" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>

      <!-- 流水线动画 -->
      <div class="viz-sub">生成进度<span class="viz-sub__x" /></div>
      <div class="gpipe">
        <div v-for="(p, i) in (st?.pipeline || [])" :key="p.step" class="gp"
          :class="{ 'is-done': genStep > i, 'is-run': genStep === i }">
          <span class="gp__no">
            <el-icon v-if="genStep > i" :size="11"><Select /></el-icon>
            <el-icon v-else-if="genStep === i" :size="11" class="is-spin"><Loading /></el-icon>
            <template v-else>{{ p.step }}</template>
          </span>
          <span class="gp__n">{{ p.name }}</span>
          <span class="gp__bar"><span :class="{ 'is-on': genStep > i, 'is-run': genStep === i }" /></span>
        </div>
      </div>

      <!-- 生成结果 -->
      <div v-if="genResult" class="gres">
        <div class="gres__h">
          <el-icon :size="15"><CircleCheckFilled /></el-icon>
          <b>报告生成完成</b>
          <span class="viz-tag viz-tag--lime">{{ genResult.status }}</span>
        </div>
        <div class="gres__g">
          <div class="gr"><b class="viz-num">{{ genResult.sectionCount }}</b><span>章节</span></div>
          <div class="gr"><b class="viz-num">{{ genResult.totalWordCount }}</b><span>字数</span></div>
          <div class="gr"><b class="viz-num">{{ genResult.chartCount }}</b><span>图表</span></div>
          <div class="gr"><b class="viz-num">{{ genResult.tableCount }}</b><span>统计表</span></div>
        </div>
        <div class="gres__id viz-num">{{ genResult.reportId }} · {{ genResult.reportName }}</div>
      </div>

      <template #footer>
        <el-button class="viz-btn" @click="genVisible = false">{{ genResult ? '关闭' : '取消' }}</el-button>
        <el-button class="viz-btn is-hot" :loading="genRunning" :icon="'MagicStick'" @click="doGenerate">
          {{ genRunning ? '生成中…' : genResult ? '重新生成' : '开始生成' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.mr4 { margin-right: 4px; }
.ar-pipe { margin-bottom: 12px; }

.ar-c1 {
  display: grid; grid-template-columns: 1fr 1.3fr 1.1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.ar-q {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px;
  :deep(.el-button) { margin-left: 0 !important; }
}

/* ---------- 流水线（横向） ---------- */
.pipe {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.pi {
  position: relative;
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid rgba(80, 160, 255, .15);
  transition: all .3s;

  &__node {
    width: 27px; height: 27px; flex-shrink: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-border-light);
    color: var(--viz-text-dim);
    transition: all .3s;
  }
  &__b { min-width: 0; }
  &__n { font-size: 11.5px; font-weight: 700; color: var(--viz-text); }
  &__d { margin-top: 3px; font-size: 9.5px; line-height: 1.6; color: var(--viz-text-faint); }

  &__link {
    position: absolute; right: -8px; top: 22px; width: 16px; height: 2px;
    background: var(--zh-border-light); z-index: 1;
    i {
      display: block; height: 100%; width: 0; background: var(--viz-lime);
      box-shadow: 0 0 8px var(--viz-lime);
      transition: width .5s;
      &.is-on { width: 100%; }
    }
    @media (max-width: 1100px) { display: none; }
  }

  &.is-done {
    border-color: rgba(76, 245, 168, .38);
    background: rgba(76, 245, 168, .07);
    .pi__node { background: var(--viz-lime); color: #fff; }
  }
  &.is-run {
    border-color: var(--viz-cyan);
    background: var(--zh-primary-lighter);
    box-shadow: 0 0 22px -8px var(--viz-cyan);
    .pi__node { background: var(--viz-cyan); color: #fff; }
  }
}

.is-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 图表清单 ---------- */
.cl { display: flex; flex-direction: column; gap: 6px; }

.cli {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border-left: 2px solid var(--clc);
  animation: cliIn .45s cubic-bezier(.2, .9, .3, 1) both;
  transition: background .2s;
  &:hover { background: var(--zh-primary-lighter); }

  &__i { color: var(--clc); flex-shrink: 0; }
  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__d { margin-top: 2px; font-size: 9.5px; color: var(--viz-text-faint); }
  &__id { font-size: 9.5px; color: var(--clc); flex-shrink: 0; }
}

@keyframes cliIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }

.tl { display: flex; flex-direction: column; gap: 6px; }

.tli {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 4px;
  background: rgba(255, 184, 56, .07);
  border: 1px solid rgba(255, 184, 56, .2);

  > :deep(.el-icon) { color: var(--viz-amber); flex-shrink: 0; }
  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__d { margin-top: 2px; font-size: 9.5px; color: var(--viz-text-faint); }
  &__id { font-size: 9.5px; color: var(--viz-amber); }
}

/* ---------- 报告封面 ---------- */
.rcover {
  position: relative; overflow: hidden;
  padding: 16px 18px; border-radius: 5px;
  background: linear-gradient(135deg, var(--zh-primary-lighter), rgba(61, 139, 255, .1) 46%, var(--zh-bg-soft));
  border: 1px solid var(--viz-line-strong);

  &__glow {
    position: absolute; right: -50px; top: -50px;
    width: 180px; height: 180px; border-radius: 50%;
    background: radial-gradient(circle, var(--zh-border), transparent 68%);
    pointer-events: none;
  }

  &__badge { display: flex; gap: 5px; position: relative; }

  &__t {
    position: relative;
    margin: 10px 0 0; font-size: 18px; font-weight: 800; line-height: 1.55;
    color: var(--zh-text-primary); letter-spacing: .8px;
  }

  &__stats {
    display: flex; gap: 20px; flex-wrap: wrap; margin-top: 12px;
    padding: 9px 0; border-top: 1px solid var(--zh-primary-light);
    border-bottom: 1px solid var(--zh-primary-light);
  }

  &__m {
    display: flex; flex-wrap: wrap; gap: 14px; margin-top: 9px;
    font-size: 10.5px; color: var(--viz-text-dim);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--viz-cyan); }
  }

  &__rv {
    display: flex; align-items: flex-start; gap: 5px; margin-top: 9px;
    padding: 7px 9px; border-radius: 4px;
    background: rgba(76, 245, 168, .1);
    border: 1px solid rgba(76, 245, 168, .26);
    font-size: 10.5px; line-height: 1.65; color: var(--viz-text-dim);
    :deep(.el-icon) { color: var(--viz-lime); flex-shrink: 0; margin-top: 2px; }
    b { color: var(--viz-lime); flex-shrink: 0; }
  }
}

.rs {
  text-align: center;
  b { display: block; font-size: 18px; font-weight: 800; color: var(--viz-cyan); }
  span { font-size: 9.5px; color: var(--viz-text-faint); }
}

/* ---------- 章节导航 ---------- */
.rsec { display: flex; gap: 5px; margin: 12px 0 10px; overflow-x: auto; padding-bottom: 4px; }

.rsn {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; cursor: pointer;
  padding: 5px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  color: var(--viz-text-dim); font-size: 11px;
  transition: all .2s;

  &__no {
    width: 15px; height: 15px; border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; background: var(--zh-border-light);
  }
  &:hover { border-color: var(--viz-line-strong); color: var(--viz-text); }
  &.is-active {
    background: var(--zh-primary-lighter); border-color: var(--viz-cyan);
    color: var(--viz-cyan); font-weight: 700;
    box-shadow: 0 0 14px -5px var(--viz-cyan);
    .rsn__no { background: var(--viz-cyan); color: #fff; }
  }
}

/* ---------- 正文 ---------- */
.rpaper {
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

  &__ch {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 10px;
  }
  &__chl { font-size: 9.5px; color: var(--viz-text-faint); margin-right: 2px; }

  &__c {
    margin: 12px 0 0; font-size: 12px; line-height: 2.05;
    color: var(--viz-text-dim); text-align: justify; text-indent: 2em;
    min-height: 130px;
  }

  &__f {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--zh-border-light);
    :deep(.el-button) { margin-left: 0 !important; }
  }
  &__pg { font-size: 11px; color: var(--viz-text-faint); }
}

/* ---------- 风险等级 ---------- */
.risks { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 11px; }

.rk {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 12px; border-radius: 4px;

  &.is-high { background: var(--zh-danger-light); border: 1px solid rgba(255, 90, 95, .34); .rk__l { color: var(--viz-red); } }
  &.is-mid { background: rgba(255, 184, 56, .12); border: 1px solid rgba(255, 184, 56, .34); .rk__l { color: var(--viz-amber); } }
  &.is-low { background: var(--zh-success-light); border: 1px solid rgba(76, 245, 168, .34); .rk__l { color: var(--viz-lime); } }

  &__n { font-size: 10.5px; color: var(--viz-text); font-weight: 600; }
  &__l { font-size: 9.5px; font-weight: 700; }
}

/* ---------- 图表网格 ---------- */
.cgrid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
}

.cg {
  padding: 10px 8px; border-radius: 4px; text-align: center;
  background: color-mix(in srgb, var(--cgc) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--cgc) 26%, transparent);
  transition: transform .2s;
  &:hover { transform: translateY(-3px); }

  > :deep(.el-icon) { color: var(--cgc); }
  &__n { margin-top: 5px; font-size: 10.5px; font-weight: 600; color: var(--viz-text); line-height: 1.4; }
  &__t { margin-top: 3px; font-size: 9px; color: var(--viz-text-faint); }
}

.dr-act {
  display: flex; gap: 8px; margin-top: 16px;
  padding-top: 12px; border-top: 1px dashed var(--zh-border-light);
  :deep(.el-button) { flex: 1; margin-left: 0 !important; }
}

/* ---------- 生成弹窗 ---------- */
.gf-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
}

.gpipe { display: flex; flex-direction: column; gap: 6px; }

.gp {
  display: grid; grid-template-columns: 22px 82px 1fr;
  align-items: center; gap: 9px;

  &__no {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800;
    background: var(--zh-border-light); color: var(--viz-text-dim);
    transition: all .3s;
  }
  &__n { font-size: 11px; color: var(--viz-text-dim); }
  &__bar {
    height: 4px; border-radius: 2px; background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; width: 0; border-radius: 2px;
      transition: width .6s;
      &.is-on { width: 100%; background: var(--viz-lime); box-shadow: 0 0 8px var(--viz-lime); }
      &.is-run {
        width: 100%; background: linear-gradient(90deg, transparent, var(--viz-cyan), transparent);
        background-size: 40% 100%; animation: gpFlow 1.1s linear infinite;
      }
    }
  }

  &.is-done {
    .gp__no { background: var(--viz-lime); color: #fff; }
    .gp__n { color: var(--viz-lime); }
  }
  &.is-run {
    .gp__no { background: var(--viz-cyan); color: #fff; }
    .gp__n { color: var(--viz-cyan); font-weight: 700; }
  }
}

@keyframes gpFlow { from { background-position: -40% 0; } to { background-position: 140% 0; } }

.gres {
  margin-top: 12px; padding: 11px 13px; border-radius: 4px;
  background: rgba(76, 245, 168, .1);
  border: 1px solid rgba(76, 245, 168, .3);

  &__h {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: var(--viz-text);
    :deep(.el-icon) { color: var(--viz-lime); }
    b { color: var(--viz-lime); }
  }
  &__g { display: flex; gap: 20px; margin-top: 9px; }
  &__id { margin-top: 8px; padding-top: 7px; border-top: 1px dashed rgba(76, 245, 168, .24); font-size: 10px; color: var(--viz-text-faint); }
}

.gr {
  text-align: center;
  b { display: block; font-size: 17px; font-weight: 800; color: var(--viz-lime); }
  span { font-size: 9.5px; color: var(--viz-text-faint); }
}
</style>
