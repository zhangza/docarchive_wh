<script setup lang="ts">
interface Reason { title: string; desc: string; weight: number }
interface SimilarCase { caseId: string; title: string; result: string; amount: number; sim: number }
interface PolicyRef { code?: string; title: string; clause?: string }

interface Props {
  loading?: boolean
  suggestion?: string
  suggestLevel?: string
  confidence?: number
  modelVersion?: string
  analyzeTime?: string
  costMs?: number
  reasons?: Reason[]
  similarCases?: SimilarCase[]
  policyRefs?: any[]
  riskFactors?: Record<string, number>
}
const props = withDefaults(defineProps<Props>(), { loading: false, confidence: 0 })

const radarOption = computed(() => {
  const rf = props.riskFactors || {}
  const keys = Object.keys(rf)
  if (!keys.length) return null
  return {
    tooltip: { trigger: 'item' },
    radar: {
      indicator: keys.map((k) => ({ name: k, max: 100 })),
      radius: '66%',
      center: ['50%', '54%'],
      splitNumber: 4,
      axisName: { color: '#6b7a90', fontSize: 11 },
      splitLine: { lineStyle: { color: '#e2e8f2' } },
      splitArea: { areaStyle: { color: ['#fff', '#f8fafd'] } },
      axisLine: { lineStyle: { color: '#e2e8f2' } }
    },
    series: [
      {
        type: 'radar',
        symbolSize: 4,
        data: [
          {
            value: keys.map((k) => rf[k]),
            name: '风险因子',
            areaStyle: { color: 'rgba(22,104,220,.22)' },
            lineStyle: { color: '#1668dc', width: 2 },
            itemStyle: { color: '#1668dc' }
          }
        ]
      }
    ]
  } as any
})

const confTone = computed(() => {
  if (props.confidence >= 90) return 'danger'
  if (props.confidence >= 70) return 'warning'
  return 'success'
})
</script>

<template>
  <div class="ai-panel" :class="{ 'is-loading': loading }">
    <div class="ai-panel__head">
      <div class="ai-panel__brand">
        <span class="ai-panel__spark">AI</span>
        <span class="ai-panel__title">智能研判建议</span>
      </div>
      <div class="ai-panel__meta">
        <span v-if="modelVersion">模型 {{ modelVersion }}</span>
        <span v-if="costMs">· 耗时 {{ costMs }}ms</span>
      </div>
    </div>

    <div v-if="loading" class="ai-panel__loading">
      <div class="ai-panel__scan" />
      <div class="ai-panel__loading-text">AI 正在关联结算数据、处方明细、政策规则与历史案例…</div>
      <el-skeleton :rows="4" animated />
    </div>

    <template v-else>
      <div class="ai-panel__verdict">
        <div class="ai-panel__verdict-main">
          <div class="ai-panel__label">研判建议</div>
          <div class="ai-panel__suggestion">{{ suggestion || '—' }}</div>
        </div>
        <div class="ai-panel__conf">
          <el-progress
            type="dashboard"
            :percentage="confidence"
            :width="86"
            :stroke-width="8"
            :color="confTone === 'danger' ? '#e5484d' : confTone === 'warning' ? '#e8a30c' : '#12a150'"
          >
            <template #default="{ percentage }">
              <div class="ai-panel__conf-inner">
                <span class="num">{{ percentage }}<i>%</i></span>
                <em>置信度</em>
              </div>
            </template>
          </el-progress>
        </div>
      </div>

      <div v-if="reasons?.length" class="ai-panel__block">
        <div class="ai-panel__block-title">研判依据</div>
        <ul class="ai-reasons">
          <li v-for="(r, i) in reasons" :key="i" class="ai-reasons__item">
            <span class="ai-reasons__idx">{{ i + 1 }}</span>
            <div class="ai-reasons__body">
              <div class="ai-reasons__title">
                {{ r.title }}
                <span class="ai-reasons__weight">权重 {{ r.weight }}%</span>
              </div>
              <div class="ai-reasons__desc">{{ r.desc }}</div>
              <el-progress :percentage="r.weight" :stroke-width="4" :show-text="false" color="#1668dc" />
            </div>
          </li>
        </ul>
      </div>

      <div v-if="radarOption" class="ai-panel__block">
        <div class="ai-panel__block-title">风险因子画像</div>
        <EChart :option="radarOption" height="210px" />
      </div>

      <div v-if="policyRefs?.length" class="ai-panel__block">
        <div class="ai-panel__block-title">政策依据</div>
        <div class="ai-policy">
          <div v-for="(p, i) in policyRefs" :key="i" class="ai-policy__item">
            <span class="ai-policy__code">{{ p.code || p.docNo || '政策' }}</span>
            <div class="ai-policy__text">
              <div class="ai-policy__title">{{ p.title || p.name }}</div>
              <div v-if="p.clause || p.content" class="ai-policy__clause">{{ p.clause || p.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="similarCases?.length" class="ai-panel__block">
        <div class="ai-panel__block-title">相似历史案例</div>
        <div class="ai-cases">
          <div v-for="c in similarCases" :key="c.caseId" class="ai-cases__item">
            <div class="ai-cases__head">
              <span class="ai-cases__id">{{ c.caseId }}</span>
              <span class="ai-cases__sim">相似度 {{ c.sim }}%</span>
            </div>
            <div class="ai-cases__title text-ellipsis">{{ c.title }}</div>
            <div class="ai-cases__foot">
              <span class="ai-cases__result">{{ c.result }}</span>
              <span class="num num--money">¥{{ c.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="$slots.footer" class="ai-panel__footer"><slot name="footer" /></div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.ai-panel {
  position: relative;
  border: 1px solid #cfe0ff;
  border-radius: var(--zh-radius);
  background: linear-gradient(180deg, #f4f9ff 0%, #ffffff 34%);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: linear-gradient(96deg, #0a2f6b 0%, #1668dc 62%, #1495b3 100%);
  }

  &__brand { display: flex; align-items: center; gap: 8px; }

  &__spark {
    width: 24px; height: 24px;
    border-radius: 6px;
    background: rgba(255, 255, 255, .2);
    border: 1px solid rgba(255, 255, 255, .35);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    letter-spacing: .5px;
  }

  &__title { color: #fff; font-size: var(--zh-font-lg); font-weight: 600; letter-spacing: .5px; }

  &__meta {
    margin-left: auto;
    font-size: var(--zh-font-xs);
    color: rgba(255, 255, 255, .78);
    font-family: var(--zh-font-num);
  }

  &__loading { padding: 20px 16px; }
  &__scan {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--zh-primary), var(--zh-accent), transparent);
    background-size: 220% 100%;
    animation: ai-scan 1.4s linear infinite;
    margin-bottom: 12px;
  }
  &__loading-text {
    font-size: var(--zh-font-sm);
    color: var(--zh-primary);
    margin-bottom: 14px;
  }

  &__verdict {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px;
    border-bottom: 1px dashed var(--zh-border);
  }
  &__verdict-main { flex: 1; min-width: 0; }
  &__label { font-size: var(--zh-font-xs); color: var(--zh-text-secondary); }
  &__suggestion {
    margin-top: 4px;
    font-size: 19px;
    font-weight: 700;
    color: var(--zh-primary-active);
    letter-spacing: .5px;
  }
  &__conf-inner {
    display: flex; flex-direction: column; align-items: center; line-height: 1.2;
    .num { font-family: var(--zh-font-num); font-size: 20px; font-weight: 700; color: var(--zh-text-primary); i { font-size: 11px; font-style: normal; } }
    em { font-style: normal; font-size: 11px; color: var(--zh-text-secondary); }
  }

  &__block { padding: 12px 14px; border-bottom: 1px dashed var(--zh-border-light); &:last-child { border-bottom: none; } }
  &__block-title {
    font-size: var(--zh-font-sm);
    font-weight: 600;
    color: var(--zh-text-primary);
    margin-bottom: 10px;
    padding-left: 8px;
    border-left: 3px solid var(--zh-primary);
    line-height: 1.1;
  }

  &__footer { padding: 12px 14px; background: var(--zh-bg-soft); }
}

.ai-reasons {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item { display: flex; gap: 8px; }
  &__idx {
    flex-shrink: 0;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: var(--zh-primary-light);
    color: var(--zh-primary);
    font-size: 11px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-top: 2px;
  }
  &__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  &__title {
    font-size: var(--zh-font-sm);
    font-weight: 600;
    color: var(--zh-text-primary);
    display: flex; align-items: center; gap: 6px;
  }
  &__weight {
    font-size: 11px;
    font-weight: 500;
    color: var(--zh-primary);
    background: var(--zh-primary-lighter);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--zh-font-num);
  }
  &__desc { font-size: var(--zh-font-xs); color: var(--zh-text-regular); line-height: 1.6; }
}

.ai-policy {
  display: flex; flex-direction: column; gap: 8px;
  &__item {
    display: flex; gap: 8px;
    padding: 8px 10px;
    background: var(--zh-bg-soft);
    border-radius: var(--zh-radius-sm);
    border-left: 3px solid var(--zh-accent);
  }
  &__code {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--zh-accent);
    font-weight: 600;
    font-family: var(--zh-font-num);
  }
  &__text { min-width: 0; }
  &__title { font-size: var(--zh-font-xs); color: var(--zh-text-primary); font-weight: 600; }
  &__clause { font-size: 11px; color: var(--zh-text-secondary); line-height: 1.6; margin-top: 2px; }
}

.ai-cases {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;

  &__item {
    padding: 8px 10px;
    border: 1px solid var(--zh-border-light);
    border-radius: var(--zh-radius-sm);
    background: #fff;
    transition: all .2s;
    &:hover { border-color: var(--zh-primary); box-shadow: var(--zh-shadow-xs); }
  }
  &__head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  &__id { font-size: 11px; color: var(--zh-text-placeholder); font-family: var(--zh-font-num); }
  &__sim { font-size: 11px; font-weight: 700; color: var(--zh-purple); font-family: var(--zh-font-num); }
  &__title { font-size: var(--zh-font-xs); color: var(--zh-text-primary); margin: 5px 0; }
  &__foot { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
  &__result { color: var(--zh-success); font-weight: 600; }
}

@keyframes ai-scan {
  0% { background-position: -120% 0; }
  100% { background-position: 220% 0; }
}
</style>
