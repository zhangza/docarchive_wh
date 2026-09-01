<script setup lang="ts">
/**
 * 文书流水线 —— 横向传送带式流程可视化
 * 每个工位显示在制品数量，工位间用流动光带连接，直观呈现文书从生成到归档的产线状态
 */
export interface PipeStage {
  key: string
  /** 工位名 */
  name: string
  /** 在制数量 */
  count: number
  /** 图标名 */
  icon: string
  /** 色调 */
  tone: 'primary' | 'accent' | 'purple' | 'warning' | 'success' | 'danger' | 'info'
  /** 附注（如平均耗时） */
  note?: string
  /** 是否瓶颈工位（呼吸告警） */
  bottleneck?: boolean
}

interface Props {
  stages: PipeStage[]
  /** 当前高亮工位 key */
  active?: string
  /** 是否显示流动动效 */
  flowing?: boolean
}
withDefaults(defineProps<Props>(), { flowing: true })
defineEmits<{ (e: 'pick', key: string): void }>()

const TONE: Record<string, string> = {
  primary: 'var(--zh-primary)', accent: 'var(--zh-accent)', purple: 'var(--zh-purple)',
  warning: 'var(--zh-warning)', success: 'var(--zh-success)', danger: 'var(--zh-danger)',
  info: 'var(--zh-info)'
}
</script>

<template>
  <div class="pl" :class="{ 'is-flowing': flowing }">
    <div class="pl__track">
      <template v-for="(s, i) in stages" :key="s.key">
        <!-- 工位 -->
        <div class="st" :class="{ 'is-active': active === s.key, 'is-bn': s.bottleneck }"
          :style="{ '--st-c': TONE[s.tone] }" @click="$emit('pick', s.key)">
          <div class="st__hex">
            <el-icon class="st__ic"><component :is="s.icon" /></el-icon>
            <span v-if="s.bottleneck" class="st__pulse" />
          </div>
          <div class="st__n">{{ s.name }}</div>
          <div class="st__v num">{{ s.count }}</div>
          <div v-if="s.note" class="st__note">{{ s.note }}</div>
          <span class="st__idx num">{{ i + 1 }}</span>
        </div>

        <!-- 传送带 -->
        <div v-if="i < stages.length - 1" class="cv">
          <span class="cv__belt" />
          <span class="cv__dot" :style="{ animationDelay: (i * 0.28) + 's' }" />
          <span class="cv__dot cv__dot--2" :style="{ animationDelay: (i * 0.28 + 0.7) + 's' }" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pl {
  overflow-x: auto;
  padding: 4px 2px 6px;
  &::-webkit-scrollbar { height: 5px; }
  &::-webkit-scrollbar-thumb { background: var(--zh-border-strong); border-radius: 3px; }

  &__track {
    display: flex; align-items: flex-start;
    min-width: max-content;
  }
}

/* ---------- 工位 ---------- */
.st {
  position: relative;
  flex-shrink: 0;
  width: 96px;
  text-align: center;
  cursor: pointer;
  padding: 4px 2px;
  border-radius: var(--zh-radius);
  transition: transform .22s, background .22s;

  &:hover { transform: translateY(-4px); background: var(--zh-bg-hover); }
  &.is-active { background: color-mix(in srgb, var(--st-c) 9%, transparent); }

  /* 六边形工位徽 */
  &__hex {
    position: relative;
    width: 46px; height: 52px; margin: 0 auto;
    display: grid; place-items: center;
    background: linear-gradient(150deg, color-mix(in srgb, var(--st-c) 16%, #fff), #fff);
    border: 1.5px solid var(--st-c);
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    transition: box-shadow .24s, transform .24s;
  }
  &.is-active &__hex {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--st-c) 16%, transparent);
    transform: scale(1.06);
  }

  &__ic { font-size: 19px; color: var(--st-c); }

  /* 瓶颈呼吸圈 */
  &__pulse {
    position: absolute; inset: -5px;
    border: 1.5px solid var(--zh-danger);
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    animation: st-pulse 1.7s ease-out infinite;
  }

  &__n {
    margin-top: 7px;
    font-size: 11px; font-weight: 700; color: var(--zh-text-primary);
    line-height: 1.35;
  }
  &__v {
    margin-top: 2px;
    font-size: 19px; font-weight: 800; color: var(--st-c);
    line-height: 1.1;
  }
  &__note { margin-top: 1px; font-size: 9px; color: var(--zh-text-secondary); }

  &__idx {
    position: absolute; top: 2px; left: 12px;
    width: 15px; height: 15px; border-radius: 50%;
    display: grid; place-items: center;
    background: var(--st-c); color: #fff;
    font-size: 9px; font-weight: 700;
  }

  &.is-bn &__v { color: var(--zh-danger); }
}

/* ---------- 传送带 ---------- */
.cv {
  position: relative;
  flex-shrink: 0;
  width: 46px; height: 52px;
  display: grid; place-items: center;

  &__belt {
    width: 100%; height: 3px; border-radius: 2px;
    background: repeating-linear-gradient(90deg,
      var(--zh-border-strong) 0 5px, transparent 5px 9px);
  }

  &__dot {
    position: absolute; top: 50%; left: 0;
    width: 6px; height: 6px; margin-top: -3px;
    border-radius: 50%;
    background: var(--zh-primary);
    box-shadow: 0 0 7px rgba(22, 104, 220, .7);
    opacity: 0;
  }

  &--2 { background: var(--zh-accent); box-shadow: 0 0 7px rgba(19, 194, 194, .7); }
}

.pl.is-flowing .cv__dot { animation: cv-run 2.1s linear infinite; }

@keyframes cv-run {
  0% { left: -3px; opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { left: calc(100% - 3px); opacity: 0; }
}

@keyframes st-pulse {
  0% { transform: scale(1); opacity: .85; }
  100% { transform: scale(1.34); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .pl.is-flowing .cv__dot, .st__pulse { animation: none; }
  .cv__dot { opacity: .8; left: 45%; }
}
</style>
