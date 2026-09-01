<script setup lang="ts">
interface Props {
  status?: string
}
const props = withDefaults(defineProps<Props>(), { status: '待研判' })

const MAP: Record<string, { color: string; bg: string; border: string }> = {
  待研判: { color: '#e8a30c', bg: '#fff7e6', border: '#ffe0a3' },
  研判中: { color: '#1668dc', bg: '#e8f1ff', border: '#b7d4ff' },
  线上筛查中: { color: '#13c2c2', bg: '#e6fffb', border: '#a8ecec' },
  线下核查中: { color: '#722ed1', bg: '#f6efff', border: '#d9bfff' },
  申诉中: { color: '#d4380d', bg: '#fff2e8', border: '#ffc4a3' },
  已驳回: { color: '#5a7189', bg: '#eef2f7', border: '#d3dce7' },
  已流转: { color: '#0f52b3', bg: '#e8f1ff', border: '#a8c9ff' },
  已结案: { color: '#12a150', bg: '#eafaf0', border: '#b7ebc9' },
  处置中: { color: '#722ed1', bg: '#f6efff', border: '#d9bfff' },
  已确认: { color: '#e5484d', bg: '#fff1f1', border: '#ffccc7' }
}

const style = computed(() => {
  const c = MAP[props.status] || MAP['待研判']
  return { color: c.color, background: c.bg, borderColor: c.border }
})
</script>

<template>
  <span class="status-tag" :style="style">{{ status }}</span>
</template>

<style scoped lang="scss">
.status-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--zh-radius-sm);
  font-size: var(--zh-font-xs);
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
}
</style>
