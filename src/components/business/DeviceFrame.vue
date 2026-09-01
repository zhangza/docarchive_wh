<script setup lang="ts">
/**
 * DeviceFrame —— 三端推送预览设备外框（agent05 M42 专属）
 * 医院端 / 医保端 → 平板样式；公众端 → 手机样式
 * 内含状态栏、应用头、消息卡列表，模拟真实推送观感
 */
withDefaults(defineProps<{
  /** 端名称 */
  end: string
  /** 设备形态 */
  variant?: 'phone' | 'tablet'
  tone?: 'cyan' | 'blue' | 'violet'
  /** 应用标题 */
  appName?: string
  /** 推送内容 */
  items?: { title: string; type: string; priority: string }[]
  /** 触达数量 */
  targetCount?: number | string
  /** 阅读率 */
  readRate?: number
  /** 推送状态 */
  status?: string
}>(), { variant: 'phone', tone: 'cyan', items: () => [] })

const TYPE_TONE: Record<string, string> = {
  典型案例: '#ff5a5f', 合规要点: '#3d8bff', 政策解读: '#a35bff',
  防骗提示: '#ffb838', 就医指引: '#21e6ff', 业务培训: '#4cf5a8',
  监管动态: '#ff5fa2', 政策科普: '#21e6ff'
}
</script>

<template>
  <div class="df" :class="[`df--${variant}`, `df--${tone}`]">
    <!-- 端标签 -->
    <div class="df__tag">
      <span class="df__dot" />{{ end }}
      <span v-if="status" class="df__st" :class="status === '已推送' ? 'is-ok' : status === '推送中' ? 'is-run' : 'is-wait'">
        {{ status }}
      </span>
    </div>

    <!-- 设备外壳 -->
    <div class="df__shell">
      <span v-if="variant === 'phone'" class="df__notch" />
      <div class="df__screen">
        <!-- 状态栏 -->
        <div class="df__bar">
          <span class="df__time">15:30</span>
          <span class="df__sig">
            <i /><i /><i /><i />
          </span>
        </div>

        <!-- 应用头 -->
        <div class="df__app">
          <el-icon :size="12"><ChatDotRound /></el-icon>
          <span>{{ appName || '芜湖医保' }}</span>
        </div>

        <!-- 消息列表 -->
        <div class="df__list">
          <div v-for="(it, i) in items" :key="i" class="df__msg"
            :style="{ '--mc': TYPE_TONE[it.type] || '#3d8bff', animationDelay: i * 140 + 'ms' }">
            <div class="df__msg-h">
              <span class="df__type">{{ it.type }}</span>
              <span v-if="it.priority === '高'" class="df__pri">紧急</span>
            </div>
            <div class="df__msg-t">{{ it.title }}</div>
            <div class="df__msg-f">
              <span>点击查看详情</span>
              <el-icon :size="9"><ArrowRight /></el-icon>
            </div>
          </div>
          <div v-if="!items.length" class="df__empty">暂无推送内容</div>
        </div>
      </div>
      <span v-if="variant === 'phone'" class="df__home" />
    </div>

    <!-- 底部指标 -->
    <div class="df__foot">
      <span class="df__m">
        <b>{{ typeof targetCount === 'number' ? targetCount.toLocaleString() : (targetCount || '—') }}</b>触达
      </span>
      <span v-if="readRate !== undefined" class="df__m">
        <b>{{ (readRate * 100).toFixed(1) }}%</b>阅读率
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.df {
  --dc: var(--viz-cyan);
  display: flex; flex-direction: column; align-items: center; gap: 8px;

  &--cyan { --dc: var(--viz-cyan); }
  &--blue { --dc: var(--viz-blue); }
  &--violet { --dc: var(--viz-violet); }

  &__tag {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 700; color: var(--viz-text);
  }

  &__dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--dc); box-shadow: 0 0 8px var(--dc);
  }

  &__st {
    padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 700;
    &.is-ok { color: var(--viz-lime); background: rgba(76, 245, 168, .14); }
    &.is-run { color: var(--viz-amber); background: rgba(255, 184, 56, .14); }
    &.is-wait { color: var(--viz-text-faint); background: rgba(143, 171, 212, .12); }
  }

  /* ---------- 外壳 ---------- */
  &__shell {
    position: relative;
    padding: 8px 5px;
    border-radius: 16px;
    background: var(--zh-bg-card);
    border: 1px solid color-mix(in srgb, var(--dc) 34%, transparent);
    box-shadow: 0 10px 24px -14px color-mix(in srgb, var(--dc) 42%, transparent);
  }

  &--phone .df__shell { width: 178px; }
  &--tablet .df__shell { width: 228px; border-radius: 10px; }

  &__notch {
    position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
    width: 42px; height: 3px; border-radius: 2px;
    background: var(--zh-border-strong);
  }

  &__home {
    display: block; margin: 5px auto 0;
    width: 48px; height: 3px; border-radius: 2px;
    background: var(--zh-border-strong);
  }

  &__screen {
    border-radius: 9px; overflow: hidden;
    background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }

  /* ---------- 状态栏 ---------- */
  &__bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 3px 8px;
    background: var(--zh-bg-card);
    border-bottom: 1px solid var(--zh-border-light);
  }

  &__time { font-size: 8px; color: var(--viz-text-dim); font-variant-numeric: tabular-nums; }

  &__sig {
    display: inline-flex; align-items: flex-end; gap: 1.5px;
    i {
      width: 2px; background: var(--viz-text-dim); border-radius: 1px;
      &:nth-child(1) { height: 3px; }
      &:nth-child(2) { height: 4.5px; }
      &:nth-child(3) { height: 6px; }
      &:nth-child(4) { height: 7.5px; }
    }
  }

  /* ---------- 应用头 ---------- */
  &__app {
    display: flex; align-items: center; gap: 4px;
    padding: 5px 9px;
    font-size: 9.5px; font-weight: 700; color: var(--viz-text);
    background: linear-gradient(90deg, color-mix(in srgb, var(--dc) 12%, transparent), transparent);
    border-bottom: 1px solid var(--zh-border-light);
    :deep(.el-icon) { color: var(--dc); }
  }

  /* ---------- 消息列表 ---------- */
  &__list {
    padding: 6px; display: flex; flex-direction: column; gap: 5px;
    min-height: 150px;
  }

  &__msg {
    padding: 6px 7px; border-radius: 5px;
    background: var(--zh-bg-card);
    border: 1px solid var(--zh-border-light);
    border-left: 2px solid var(--mc);
    animation: dfIn .5s cubic-bezier(.2, .9, .3, 1) both;

    &-h { display: flex; align-items: center; gap: 4px; }
    &-t {
      margin-top: 3px; font-size: 8.5px; line-height: 1.55; color: var(--viz-text);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    &-f {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 4px; padding-top: 3px;
      border-top: 1px dashed var(--zh-border-light);
      font-size: 7.5px; color: var(--viz-text-faint);
      :deep(.el-icon) { color: var(--mc); }
    }
  }

  &__type {
    padding: 0 4px; border-radius: 2px;
    font-size: 7.5px; font-weight: 700;
    color: var(--mc); background: color-mix(in srgb, var(--mc) 16%, transparent);
  }

  &__pri {
    padding: 0 4px; border-radius: 2px;
    font-size: 7.5px; font-weight: 700;
    color: #fff; background: var(--viz-red);
  }

  &__empty {
    padding: 40px 0; text-align: center;
    font-size: 9px; color: var(--viz-text-faint);
  }

  /* ---------- 底部指标 ---------- */
  &__foot {
    display: flex; gap: 12px;
    font-size: 9.5px; color: var(--viz-text-faint);
    b {
      color: var(--dc); font-size: 12px; font-weight: 800; margin-right: 2px;
      font-variant-numeric: tabular-nums;
    }
  }
}

@keyframes dfIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
</style>
