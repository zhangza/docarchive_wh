<script setup lang="ts">
import { getEvaluation, exportEvaluation } from '@/api/agent05-promote/promote'
import { fmtNum } from '@/utils/format'

const msg = ElMessage

const data = ref<any>(null)
const loading = ref(false)
const exporting = ref(false)

async function load() {
  loading.value = true
  try { data.value = await getEvaluation() } finally { loading.value = false }
}

async function doExport() {
  exporting.value = true
  try {
    const res: any = await exportEvaluation()
    msg.success(res.message)
  } finally { exporting.value = false }
}

const DIM_TONE: Record<string, string> = {
  效率提升: 'cyan', 人力节约: 'blue', 基金挽回: 'lime', 震慑效应: 'red', 覆盖率提升: 'violet'
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

/** 五维评估雷达（含权重） */
const dimOption = computed(() => {
  const d = data.value?.dimensionScores || []
  if (!d.length) return {}
  return {
    tooltip: { ...TT, formatter: (p: any) => {
      const it = d[p.dataIndex]
      return `${it?.dimension || p.name}<br/>得分 ${p.value}<br/>权重 ${it?.weight}%`
    } },
    radar: {
      indicator: d.map((x: any) => ({ name: `${x.dimension}\n${x.weight}%`, max: 100 })),
      radius: '64%', center: ['50%', '52%'],
      axisName: { color: '#6b7a90', fontSize: 10, lineHeight: 13 },
      splitLine: { lineStyle: { color: '#eef1f7' } },
      splitArea: { areaStyle: { color: ['rgba(33,230,255,.04)', 'rgba(114,46,209,.05)'] } },
      axisLine: { lineStyle: { color: '#cdd7e6' } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: d.map((x: any) => x.score), name: '效能得分',
        areaStyle: {
          color: {
            type: 'radial', x: .5, y: .5, r: .6,
            colorStops: [{ offset: 0, color: 'rgba(22,104,220,.08)' }, { offset: 1, color: 'rgba(18,161,80,.22)' }]
          }
        },
        lineStyle: { color: '#12a150', width: 2.4, shadowColor: '#12a150', shadowBlur: 14 },
        itemStyle: { color: '#12a150', borderColor: '#ffffff', borderWidth: 1.5 },
        label: { show: true, color: '#1a2230', fontSize: 11, fontWeight: 800 }
      }]
    }]
  }
})

/** 人力节约（对比条：before vs after） */
const laborOption = computed(() => {
  const d = data.value?.laborSaving?.byRole || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: { data: ['上线前', '上线后'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 8, right: 34, top: 28, bottom: 6, containLabel: true },
    xAxis: { type: 'value', name: '人', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
    yAxis: { type: 'category', data: d.map((i: any) => i.role), ...AXIS_DARK, splitLine: { show: false }, inverse: true },
    series: [
      {
        name: '上线前', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: 'rgba(143,171,212,.5)' },
        label: { show: true, position: 'right', color: '#6b7a90', fontSize: 9.5 },
        data: d.map((i: any) => i.before)
      },
      {
        name: '上线后', type: 'bar', barWidth: 9,
        itemStyle: { borderRadius: [0, 5, 5, 0], color: '#12a150', shadowBlur: 8, shadowColor: 'rgba(76,245,168,.5)' },
        label: { show: true, position: 'right', color: '#12a150', fontSize: 9.5, fontWeight: 700 },
        data: d.map((i: any) => i.after)
      }
    ]
  }
})

/** 基金追回：按类型环 + 按季度柱 */
const fundTypeOption = computed(() => {
  const d = data.value?.fundRecovery?.byType || []
  const cs = ['#12a150', '#0891b2', '#722ed1']
  return {
    tooltip: { trigger: 'item', ...TT, formatter: (p: any) => `${p.name}<br/>${p.value} 万元<br/>追回率 ${d[p.dataIndex]?.rate}%` },
    legend: { bottom: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: '#6b7a90', fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['46%', '70%'], center: ['50%', '44%'],
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5, borderRadius: 4 },
      label: {
        show: true, position: 'center',
        formatter: () => `{a|${data.value?.fundRecovery?.annualRecovered || 0}}\n{b|万元 · 追回率 ${data.value?.fundRecovery?.recoveryRate || 0}%}`,
        rich: {
          a: { fontSize: 22, fontWeight: 800, color: '#12a150', lineHeight: 28 },
          b: { fontSize: 10, color: '#6b7a90' }
        }
      },
      emphasis: { scaleSize: 6, label: { show: true } },
      data: d.map((i: any, k: number) => ({ name: i.type, value: i.amount, itemStyle: { color: cs[k] } }))
    }]
  }
})

const quarterOption = computed(() => {
  const d = data.value?.fundRecovery?.byQuarter || []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(22,104,220,.05)' } }, ...TT },
    legend: { data: ['应追回', '已追回', '追回率'], top: 0, right: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: '#6b7a90', fontSize: 10 } },
    grid: { left: 38, right: 40, top: 28, bottom: 20 },
    xAxis: { type: 'category', data: d.map((i: any) => i.quarter), ...AXIS_DARK },
    yAxis: [
      { type: 'value', name: '万元', nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK },
      { type: 'value', name: '%', min: 85, max: 100, nameTextStyle: { color: '#8290a5', fontSize: 9 }, ...AXIS_DARK, splitLine: { show: false } }
    ],
    series: [
      { name: '应追回', type: 'bar', barWidth: 15, itemStyle: { color: 'rgba(143,171,212,.42)', borderRadius: [3, 3, 0, 0] }, data: d.map((i: any) => i.shouldRecover) },
      { name: '已追回', type: 'bar', barWidth: 15, itemStyle: { color: '#12a150', borderRadius: [3, 3, 0, 0], shadowBlur: 10, shadowColor: 'rgba(76,245,168,.45)' }, data: d.map((i: any) => i.recovered) },
      {
        name: '追回率', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 7,
        lineStyle: { color: '#d48806', width: 2.4, shadowColor: '#d48806', shadowBlur: 10 },
        itemStyle: { color: '#d48806' },
        label: { show: true, formatter: '{c}%', color: '#d48806', fontSize: 10, fontWeight: 700 },
        data: d.map((i: any) => i.rate)
      }
    ]
  }
})

/** 目标达成率（进度环矩阵，自绘） */
const targets = computed(() => data.value?.targetAchievement || [])

onMounted(load)
</script>

<template>
  <div class="viz-page" v-loading="loading" element-loading-background="rgba(255,255,255,.65)">
    <header class="viz-head">
      <div class="viz-head__t">
        成果效能评估
        <span class="viz-head__sub">效率 · 人力 · 基金 · 震慑 · 覆盖 五维评估 · 目标达成分析</span>
      </div>
      <div class="viz-head__mid" />
      <div class="viz-head__meta">
        <span><el-icon><Calendar /></el-icon>{{ data?.evaluationPeriod }}</span>
        <span><el-icon><Sort /></el-icon>对标 {{ data?.compareBase }}</span>
      </div>
      <el-button class="viz-btn" size="small" :icon="'Refresh'" @click="load">刷新</el-button>
      <el-button class="viz-btn is-hot" size="small" :icon="'Download'" :loading="exporting" @click="doExport">
        导出评估报告
      </el-button>
    </header>

    <!-- ============ 总分英雄区 ============ -->
    <div class="hero">
      <div class="hero__score">
        <div class="hero__ring" :style="{ '--p': (data?.overallScore || 0) + '%' }">
          <b class="viz-num">{{ data?.overallScore || 0 }}</b>
          <small>综合效能分</small>
        </div>
      </div>
      <div class="hero__mid">
        <div class="hero__t">系统上线成效评估结论</div>
        <p class="hero__c">{{ data?.overallConclusion }}</p>
        <div class="hero__badges">
          <span v-for="t in targets" :key="t.target" class="hb"
            :class="t.exceeded ? 'is-exceed' : t.ahead ? 'is-ahead' : 'is-ok'">
            <el-icon :size="11"><component :is="t.exceeded ? 'Trophy' : t.ahead ? 'Timer' : 'CircleCheckFilled'" /></el-icon>
            {{ t.target }}
          </span>
        </div>
      </div>
      <div class="hero__dims">
        <div v-for="dm in (data?.dimensionScores || [])" :key="dm.dimension" class="hd"
          :class="`hd--${DIM_TONE[dm.dimension]}`">
          <el-icon class="hd__i" :size="14"><component :is="dm.icon" /></el-icon>
          <div class="hd__b">
            <div class="hd__n">{{ dm.dimension }}</div>
            <div class="hd__bar"><span :style="{ width: dm.score + '%' }" /></div>
          </div>
          <b class="hd__v viz-num">{{ dm.score }}</b>
        </div>
      </div>
    </div>

    <!-- ============ 五维雷达 + 效率提升 ============ -->
    <div class="ev-c1">
      <VizPanel title="五大评估维度得分" tone="lime" extra="含权重占比" glow>
        <EChart :option="dimOption" height="272px" />
      </VizPanel>

      <VizPanel title="效率提升明细" tone="cyan" extra="5 项指标 · 全部达标" glow>
        <div class="effs viz-scroll">
          <div v-for="(e, i) in (data?.efficiencyImprovement || [])" :key="e.indicator" class="eff"
            :style="{ animationDelay: i * 80 + 'ms' }">
            <div class="eff__h">
              <span class="eff__n">{{ e.indicator }}</span>
              <span class="viz-tag" :class="e.achieved ? 'viz-tag--lime' : 'viz-tag--amber'">
                {{ e.achieved ? '达标' : '未达标' }} {{ e.target }}
              </span>
              <b class="eff__v viz-num">↑{{ e.improvement }}%</b>
            </div>
            <div class="eff__cmp">
              <span class="eff__b">{{ e.before }}</span>
              <span class="eff__arrow">
                <i /><el-icon :size="11"><DArrowRight /></el-icon><i />
              </span>
              <span class="eff__a">{{ e.after }}</span>
            </div>
            <div class="eff__track"><span :style="{ width: e.improvement + '%' }" /></div>
            <div class="eff__d">{{ e.description }}</div>
          </div>
        </div>
      </VizPanel>
    </div>

    <!-- ============ 人力节约 + 基金挽回 ============ -->
    <div class="ev-c2">
      <VizPanel title="人力投入变化" tone="blue" extra="按岗位对比">
        <EChart :option="laborOption" height="196px" />
        <div class="lab">
          <div class="lab__i">
            <span class="lab__l">上线前</span>
            <b class="viz-num">{{ data?.laborSaving?.before }}<small>人</small></b>
          </div>
          <el-icon :size="14" class="lab__ar"><DArrowRight /></el-icon>
          <div class="lab__i is-good">
            <span class="lab__l">上线后</span>
            <b class="viz-num">{{ data?.laborSaving?.after }}<small>人</small></b>
          </div>
          <div class="lab__i is-save">
            <span class="lab__l">节约</span>
            <b class="viz-num">{{ data?.laborSaving?.savingCount }}<small>人</small></b>
          </div>
          <div class="lab__i is-money">
            <span class="lab__l">年节约成本</span>
            <b class="viz-num">{{ ((data?.laborSaving?.costSaving?.totalAnnualSaving || 0) / 10000).toFixed(1) }}<small>万元</small></b>
          </div>
        </div>
        <div class="viz-note" style="margin-top: 8px">
          <el-icon><Opportunity /></el-icon>{{ data?.laborSaving?.redeployment }}
        </div>
      </VizPanel>

      <VizPanel title="基金挽回构成" tone="lime" extra="按处置类型">
        <EChart :option="fundTypeOption" height="230px" />
      </VizPanel>

      <VizPanel title="分季度追回情况" tone="amber" extra="应追 vs 已追 vs 追回率">
        <EChart :option="quarterOption" height="230px" />
      </VizPanel>
    </div>

    <!-- ============ 震慑效应 + 覆盖率 ============ -->
    <div class="ev-c3">
      <VizPanel title="震慑效应" tone="red" extra="4 项行为指标" glow>
        <div class="det">
          <div class="deti deti--red">
            <div class="deti__h">
              <span class="deti__n">屡查屡犯率</span>
              <b class="deti__d viz-num">↓{{ ((data?.deterrenceEffect?.repeatOffenderRate?.decline || 0) * 100).toFixed(1) }}%</b>
            </div>
            <div class="deti__cmp">
              <span class="deti__b viz-num">{{ ((data?.deterrenceEffect?.repeatOffenderRate?.before || 0) * 100).toFixed(1) }}%</span>
              <el-icon :size="11"><Right /></el-icon>
              <span class="deti__a viz-num">{{ ((data?.deterrenceEffect?.repeatOffenderRate?.after || 0) * 100).toFixed(1) }}%</span>
            </div>
            <div class="deti__bar">
              <span class="deti__f1" :style="{ width: ((data?.deterrenceEffect?.repeatOffenderRate?.before || 0) * 100 * 5) + '%' }" />
              <span class="deti__f2" :style="{ width: ((data?.deterrenceEffect?.repeatOffenderRate?.after || 0) * 100 * 5) + '%' }" />
            </div>
            <div class="deti__t">{{ data?.deterrenceEffect?.repeatOffenderRate?.description }}</div>
          </div>

          <div class="deti deti--amber">
            <div class="deti__h">
              <span class="deti__n">违规金额增长率</span>
              <b class="deti__d viz-num">↓{{ ((data?.deterrenceEffect?.violationGrowthRate?.decline || 0) * 100).toFixed(1) }}%</b>
            </div>
            <div class="deti__cmp">
              <span class="deti__b viz-num">{{ ((data?.deterrenceEffect?.violationGrowthRate?.before || 0) * 100).toFixed(0) }}%</span>
              <el-icon :size="11"><Right /></el-icon>
              <span class="deti__a viz-num">{{ ((data?.deterrenceEffect?.violationGrowthRate?.after || 0) * 100).toFixed(0) }}%</span>
            </div>
            <div class="deti__bar">
              <span class="deti__f1" :style="{ width: ((data?.deterrenceEffect?.violationGrowthRate?.before || 0) * 100 * 7) + '%' }" />
              <span class="deti__f2" :style="{ width: ((data?.deterrenceEffect?.violationGrowthRate?.after || 0) * 100 * 7) + '%' }" />
            </div>
            <div class="deti__t">{{ data?.deterrenceEffect?.violationGrowthRate?.description }}</div>
          </div>

          <div class="deti deti--lime">
            <div class="deti__h">
              <span class="deti__n">机构合规率</span>
              <b class="deti__d viz-num">↑{{ ((data?.deterrenceEffect?.orgComplianceRate?.improvement || 0) * 100).toFixed(0) }}%</b>
            </div>
            <div class="deti__cmp">
              <span class="deti__b viz-num">{{ ((data?.deterrenceEffect?.orgComplianceRate?.before || 0) * 100).toFixed(0) }}%</span>
              <el-icon :size="11"><Right /></el-icon>
              <span class="deti__a viz-num">{{ ((data?.deterrenceEffect?.orgComplianceRate?.after || 0) * 100).toFixed(0) }}%</span>
            </div>
            <div class="deti__bar">
              <span class="deti__f1" :style="{ width: ((data?.deterrenceEffect?.orgComplianceRate?.before || 0) * 100) + '%' }" />
              <span class="deti__f2" :style="{ width: ((data?.deterrenceEffect?.orgComplianceRate?.after || 0) * 100) + '%' }" />
            </div>
            <div class="deti__t">{{ data?.deterrenceEffect?.orgComplianceRate?.description }}</div>
          </div>

          <div class="deti deti--violet">
            <div class="deti__h">
              <span class="deti__n">公众防骗意识</span>
              <b class="deti__d">{{ data?.deterrenceEffect?.publicAwareness?.after }}</b>
            </div>
            <div class="deti__cmp">
              <span class="deti__b">{{ data?.deterrenceEffect?.publicAwareness?.before }}</span>
              <el-icon :size="11"><Right /></el-icon>
              <span class="deti__a">{{ data?.deterrenceEffect?.publicAwareness?.after }}</span>
            </div>
            <div class="deti__t">{{ data?.deterrenceEffect?.publicAwareness?.description }}</div>
          </div>
        </div>
      </VizPanel>

      <VizPanel title="覆盖率提升" tone="violet" extra="3 项覆盖指标">
        <div class="cov">
          <div v-for="(k, i) in ['inspectionCoverage', 'dataCoverage']" :key="k" class="covi">
            <div class="covi__n">{{ ['定点机构检查覆盖率', '数据接入覆盖率'][i] }}</div>
            <div class="covi__ring"
              :style="{ '--p': ((data?.coverageImprovement?.[k]?.after || 0) * 100) + '%', '--pc': i ? '#722ed1' : '#0891b2' }">
              <b class="viz-num">{{ ((data?.coverageImprovement?.[k]?.after || 0) * 100).toFixed(1) }}%</b>
            </div>
            <div class="covi__cmp viz-num">
              <span>{{ ((data?.coverageImprovement?.[k]?.before || 0) * 100).toFixed(0) }}%</span>
              <el-icon :size="10"><Right /></el-icon>
              <span class="is-a">{{ ((data?.coverageImprovement?.[k]?.after || 0) * 100).toFixed(1) }}%</span>
              <span class="covi__up">+{{ ((data?.coverageImprovement?.[k]?.improvement || 0) * 100).toFixed(1) }}pt</span>
            </div>
          </div>
          <div class="covi covi--rt">
            <div class="covi__n">实时监测能力</div>
            <div class="covi__rt">
              <el-icon :size="22"><AlarmClock /></el-icon>
              <b>{{ data?.coverageImprovement?.realTimeMonitoring?.after }}</b>
            </div>
            <div class="covi__cmp">
              <span>上线前：{{ data?.coverageImprovement?.realTimeMonitoring?.before }}</span>
            </div>
          </div>
        </div>
        <div class="viz-note" style="margin-top: 9px">
          <el-icon><InfoFilled /></el-icon>{{ data?.coverageImprovement?.realTimeMonitoring?.description }}
        </div>
      </VizPanel>
    </div>

    <!-- ============ 目标达成率 ============ -->
    <VizPanel title="年度目标达成情况" tone="cyan" extra="5 项建设目标 · 全部达成" glow>
      <div class="tg">
        <div v-for="(t, i) in targets" :key="t.target" class="tgi"
          :class="t.exceeded ? 'is-exceed' : t.ahead ? 'is-ahead' : 'is-ok'"
          :style="{ animationDelay: i * 90 + 'ms' }">
          <div class="tgi__ring" :style="{ '--p': Math.min(100, t.rate) + '%' }">
            <b class="viz-num">{{ t.rate }}%</b>
          </div>
          <div class="tgi__n">{{ t.target }}</div>
          <div class="tgi__cmp">
            <span class="tgi__pl">目标 {{ t.planned }}</span>
            <span class="tgi__ac">实际 {{ t.actual }}</span>
          </div>
          <span class="tgi__badge">
            <el-icon :size="10"><component :is="t.exceeded ? 'Trophy' : t.ahead ? 'Timer' : 'Select'" /></el-icon>
            {{ t.exceeded ? '超额完成' : t.ahead ? '提前达成' : '按期达成' }}
          </span>
        </div>
      </div>
    </VizPanel>
  </div>
</template>

<style scoped lang="scss">
/* ---------- 英雄区 ---------- */
.hero {
  display: grid; grid-template-columns: auto 1fr 300px; gap: 18px; align-items: center;
  padding: 16px 20px; margin-bottom: 12px; border-radius: 5px;
  background:
    radial-gradient(600px 220px at 12% 50%, rgba(76, 245, 168, .16), transparent 66%),
    linear-gradient(120deg, var(--zh-primary-lighter), var(--zh-bg-soft) 58%, rgba(114, 46, 209, .08));
  border: 1px solid rgba(76, 245, 168, .3);

  @media (max-width: 1300px) { grid-template-columns: auto 1fr; }
  @media (max-width: 860px) { grid-template-columns: 1fr; }

  &__ring {
    width: 132px; height: 132px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: conic-gradient(from -90deg, #12a150 var(--p), var(--zh-border-light) 0);
    position: relative;
    box-shadow: 0 0 42px -12px rgba(18, 161, 80, .3);

    &::before {
      content: ''; position: absolute; inset: 9px;
      border-radius: 50%;
      background: radial-gradient(circle, #ffffff, #f7faff);
      border: 1px solid rgba(76, 245, 168, .2);
    }
    b {
      position: relative; font-size: 42px; font-weight: 800; line-height: 1;
      color: #12a150;
    }
    small { position: relative; margin-top: 3px; font-size: 10px; color: var(--viz-text-dim); }
  }

  &__t {
    font-size: 14px; font-weight: 700; color: var(--viz-text); letter-spacing: .6px;
  }
  &__c {
    margin: 8px 0 0; font-size: 12px; line-height: 2; color: var(--viz-text-dim); text-align: justify;
  }
  &__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

  &__dims { display: flex; flex-direction: column; gap: 6px; }
}

.hb {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 9px; border-radius: 11px;
  font-size: 10px; font-weight: 600;

  &.is-exceed { color: var(--viz-amber); background: rgba(255, 184, 56, .13); border: 1px solid rgba(255, 184, 56, .34); }
  &.is-ahead { color: var(--viz-cyan); background: var(--zh-primary-lighter); border: 1px solid var(--viz-line-strong); }
  &.is-ok { color: var(--viz-lime); background: rgba(76, 245, 168, .13); border: 1px solid rgba(76, 245, 168, .34); }
}

.hd {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  border-left: 2px solid var(--hdc);

  &--cyan { --hdc: var(--viz-cyan); }
  &--blue { --hdc: var(--viz-blue); }
  &--lime { --hdc: var(--viz-lime); }
  &--red { --hdc: var(--viz-red); }
  &--violet { --hdc: var(--viz-violet); }

  &__i { color: var(--hdc); flex-shrink: 0; }
  &__b { flex: 1; min-width: 0; }
  &__n { font-size: 10.5px; color: var(--viz-text-dim); }
  &__bar {
    margin-top: 3px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: var(--hdc); box-shadow: 0 0 8px var(--hdc);
      transition: width .9s cubic-bezier(.22, .8, .3, 1);
    }
  }
  &__v { font-size: 16px; font-weight: 800; color: var(--hdc); flex-shrink: 0; }
}

/* ---------- 布局 ---------- */
.ev-c1 {
  display: grid; grid-template-columns: 1fr 1.25fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

.ev-c2 {
  display: grid; grid-template-columns: 1.25fr 1fr 1.25fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1440px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 940px) { grid-template-columns: 1fr; }
}

.ev-c3 {
  display: grid; grid-template-columns: 1.15fr 1fr; gap: 12px; margin-bottom: 12px;
  @media (max-width: 1200px) { grid-template-columns: 1fr; }
}

/* ---------- 效率提升 ---------- */
.effs { display: flex; flex-direction: column; gap: 8px; max-height: 272px; }

.eff {
  padding: 8px 10px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);
  animation: effIn .5s cubic-bezier(.2, .9, .3, 1) both;

  &__h { display: flex; align-items: center; gap: 7px; }
  &__n { font-size: 11.5px; font-weight: 600; color: var(--viz-text); }
  &__v { margin-left: auto; font-size: 14px; font-weight: 800; color: var(--viz-lime); }

  &__cmp {
    display: flex; align-items: center; gap: 8px; margin-top: 6px;
    font-size: 10.5px;
  }
  &__b { color: var(--viz-text-faint); text-decoration: line-through; }
  &__a { color: var(--viz-lime); font-weight: 700; }
  &__arrow {
    display: inline-flex; align-items: center; gap: 2px;
    i {
      width: 12px; height: 1px; background: linear-gradient(90deg, transparent, var(--viz-cyan));
      &:last-child { background: linear-gradient(90deg, var(--viz-cyan), transparent); }
    }
    :deep(.el-icon) { color: var(--viz-cyan); }
  }

  &__track {
    margin-top: 6px; height: 3px; border-radius: 2px;
    background: var(--zh-border-light); overflow: hidden;
    span {
      display: block; height: 100%; border-radius: 2px;
      background: linear-gradient(90deg, var(--viz-line-strong), var(--viz-lime));
      box-shadow: 0 0 8px var(--viz-lime);
      animation: effGrow .9s cubic-bezier(.22, .8, .3, 1) both;
    }
  }

  &__d { margin-top: 5px; font-size: 9.5px; line-height: 1.6; color: var(--viz-text-faint); }
}

@keyframes effIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes effGrow { from { width: 0 !important; } }

/* ---------- 人力 ---------- */
.lab {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px;
  padding: 9px 11px; border-radius: 4px;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__i {
    text-align: center;
    &__l { display: block; }
    b {
      display: block; font-size: 18px; font-weight: 800; color: var(--viz-text-dim);
      small { font-size: 9px; font-weight: 400; margin-left: 1px; }
    }
    &.is-good b { color: var(--viz-lime); }
    &.is-save b { color: var(--viz-cyan); }
    &.is-money b { color: var(--viz-amber); font-size: 16px; }
  }
  &__l { font-size: 9.5px; color: var(--viz-text-faint); }
  &__ar { color: var(--viz-cyan) !important; }
}

/* ---------- 震慑效应 ---------- */
.det {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
}

.deti {
  padding: 9px 11px; border-radius: 4px;
  background: color-mix(in srgb, var(--dtc) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--dtc) 26%, transparent);

  &--red { --dtc: var(--viz-red); }
  &--amber { --dtc: var(--viz-amber); }
  &--lime { --dtc: var(--viz-lime); }
  &--violet { --dtc: var(--viz-violet); }

  &__h { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  &__n { font-size: 11px; font-weight: 600; color: var(--viz-text); }
  &__d { font-size: 13px; font-weight: 800; color: var(--dtc); }

  &__cmp {
    display: flex; align-items: center; gap: 7px; margin-top: 6px;
    font-size: 11px;
    :deep(.el-icon) { color: var(--viz-text-faint); }
  }
  &__b { color: var(--viz-text-faint); }
  &__a { color: var(--dtc); font-weight: 800; font-size: 13px; }

  &__bar {
    position: relative; margin-top: 7px; height: 8px; border-radius: 4px;
    background: var(--zh-border-light); overflow: hidden;
  }
  &__f1 {
    position: absolute; left: 0; top: 0; height: 100%; border-radius: 4px;
    background: rgba(143, 171, 212, .38);
  }
  &__f2 {
    position: absolute; left: 0; top: 0; height: 100%; border-radius: 4px;
    background: var(--dtc); box-shadow: 0 0 10px var(--dtc);
    animation: effGrow .9s cubic-bezier(.22, .8, .3, 1) both;
  }

  &__t { margin-top: 6px; font-size: 9.5px; line-height: 1.6; color: var(--viz-text-faint); }
}

/* ---------- 覆盖率 ---------- */
.cov {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  @media (max-width: 800px) { grid-template-columns: 1fr; }
}

.covi {
  padding: 10px; border-radius: 4px; text-align: center;
  background: var(--zh-bg-soft);
  border: 1px solid var(--zh-border-light);

  &__n { font-size: 10.5px; color: var(--viz-text-dim); }

  &__ring {
    width: 78px; height: 78px; margin: 8px auto 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: conic-gradient(from -90deg, var(--pc) var(--p), var(--zh-border-light) 0);
    position: relative;
    box-shadow: 0 0 24px -10px var(--pc);

    &::before { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: #ffffff; }
    b { position: relative; font-size: 15px; font-weight: 800; color: var(--pc); }
  }

  &__cmp {
    display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 8px;
    font-size: 10px; color: var(--viz-text-faint);
    .is-a { color: var(--viz-text); font-weight: 700; }
    :deep(.el-icon) { color: var(--viz-text-faint); }
  }
  &__up {
    padding: 0 5px; border-radius: 3px;
    color: var(--viz-lime); background: var(--zh-success-light);
    font-weight: 700;
  }

  &__rt {
    display: flex; flex-direction: column; align-items: center; gap: 5px; margin: 12px 0 6px;
    :deep(.el-icon) { color: var(--viz-lime); }
    b { font-size: 12px; font-weight: 700; color: var(--viz-lime); }
  }

  &--rt { border-color: rgba(76, 245, 168, .26); background: rgba(76, 245, 168, .06); }
}

/* ---------- 目标达成 ---------- */
.tg {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 760px) { grid-template-columns: repeat(2, 1fr); }
}

.tgi {
  position: relative;
  padding: 12px 10px 32px; border-radius: 5px; text-align: center;
  background: linear-gradient(160deg, color-mix(in srgb, var(--tgc) 14%, transparent), var(--zh-bg-soft));
  border: 1px solid color-mix(in srgb, var(--tgc) 30%, transparent);
  animation: tgIn .55s cubic-bezier(.2, .9, .3, 1) both;
  transition: transform .22s, box-shadow .22s;
  &:hover { transform: translateY(-4px); box-shadow: 0 12px 30px -12px color-mix(in srgb, var(--tgc) 55%, transparent); }

  &.is-exceed { --tgc: var(--viz-amber); }
  &.is-ahead { --tgc: var(--viz-cyan); }
  &.is-ok { --tgc: var(--viz-lime); }

  &__ring {
    width: 66px; height: 66px; margin: 0 auto; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: conic-gradient(from -90deg, var(--tgc) var(--p), var(--zh-border-light) 0);
    position: relative;
    box-shadow: 0 0 22px -8px var(--tgc);

    &::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #ffffff; }
    b { position: relative; font-size: 14px; font-weight: 800; color: var(--tgc); }
  }

  &__n {
    margin-top: 9px; font-size: 11px; font-weight: 700; line-height: 1.5; color: var(--viz-text);
  }

  &__cmp {
    display: flex; flex-direction: column; gap: 2px; margin-top: 6px;
    font-size: 9.5px;
  }
  &__pl { color: var(--viz-text-faint); }
  &__ac { color: var(--tgc); font-weight: 700; }

  &__badge {
    position: absolute; left: 50%; bottom: 9px; transform: translateX(-50%);
    display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;
    padding: 2px 8px; border-radius: 9px;
    font-size: 9px; font-weight: 700;
    color: #fff; background: var(--tgc);
    box-shadow: 0 0 14px -4px var(--tgc);
  }
}

@keyframes tgIn { from { opacity: 0; transform: translateY(14px) scale(.94); } to { opacity: 1; transform: none; } }
</style>
