<script setup lang="ts">
interface Props {
  title?: string
  desc?: string
  flat?: boolean
  tight?: boolean
  bodyPadding?: string
}
withDefaults(defineProps<Props>(), { flat: false, tight: false })
</script>

<template>
  <section class="section-card" :class="{ 'section-card--flat': flat, 'section-card--tight': tight }">
    <div v-if="title || $slots.extra" class="section-title">
      <i class="section-title__dot" />
      <span class="section-title__text">{{ title }}</span>
      <span v-if="desc" class="section-title__desc">{{ desc }}</span>
      <div v-if="$slots.extra" class="section-title__extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="section-card__body" :style="bodyPadding ? { padding: bodyPadding } : undefined">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.section-card__body { min-width: 0; }
</style>
