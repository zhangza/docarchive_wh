<script setup lang="ts">
import { exportWord, exportPdf, type LegalDoc } from '@/utils/legalDoc'

interface Props {
  /** 文书对象 */
  doc?: LegalDoc | null
  /** 是否显示为弹窗（v-model:visible） */
  visible?: boolean
  /** 弹窗标题，默认取文书文种 */
  title?: string
}
const props = withDefaults(defineProps<Props>(), { visible: false })
const emit = defineEmits<{ 'update:visible': [boolean] }>()

const msg = ElMessage

const show = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v)
})

function doWord() {
  if (!props.doc) return
  exportWord(props.doc)
  msg.success(`《${props.doc.docName}》已导出 Word，正在下载`)
}

function doPdf() {
  if (!props.doc) return
  const ok = exportPdf(props.doc)
  if (ok) msg.success('已调起打印，可在打印对话框中选择「另存为 PDF」')
  else msg.warning('浏览器拦截了新窗口，请允许弹出窗口后重试')
}

function doPrint() {
  doPdf()
}
</script>

<template>
  <el-dialog v-model="show" :title="title || (doc ? `${doc.docName} · 预览` : '文书预览')"
    width="920px" top="4vh" class="doc-dialog" append-to-body>
    <div v-if="doc" class="doc-wrap">
      <!-- ============ 公文版式 ============ -->
      <div class="doc-paper">
        <!-- 报告体：封面标题 -->
        <template v-if="doc.isReport">
          <h1 class="doc-title--report">{{ doc.fullTitle || doc.docName }}</h1>
          <div class="doc-no--center">{{ doc.docNo }}</div>
          <div class="doc-issuer--report">{{ doc.issuer }}</div>
        </template>

        <!-- 公文体：红头 + 文种 + 文号 + 红线 -->
        <template v-else>
          <div class="doc-head">
            <div class="doc-head__org">{{ doc.issuer }}</div>
            <h1 class="doc-head__name">{{ doc.docName }}</h1>
            <div class="doc-head__no">{{ doc.docNo }}</div>
          </div>
          <div class="doc-redline" />
          <div v-if="doc.recipient" class="doc-recipient">{{ doc.recipient }}：</div>
        </template>

        <!-- ============ 正文段落 ============ -->
        <div class="doc-body">
          <section v-for="(s, i) in doc.sections" :key="i" class="doc-sec">
            <h3 v-if="s.title" class="doc-sec__t">
              <span v-if="s.no" class="doc-sec__no">{{ s.no }}、</span>{{ s.title }}
            </h3>

            <!-- 正文段 -->
            <template v-if="s.type === 'paragraph'">
              <p v-for="(t, k) in (Array.isArray(s.text) ? s.text : [s.text])" :key="k" class="doc-p">{{ t }}</p>
            </template>

            <!-- 列举 -->
            <template v-else-if="s.type === 'list'">
              <p v-for="(t, k) in s.items" :key="k" class="doc-p">{{ t }}</p>
            </template>

            <!-- 表格 -->
            <template v-else-if="s.type === 'table'">
              <table class="doc-table">
                <thead>
                  <tr><th v-for="(h, k) in s.head" :key="k">{{ h }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, ri) in s.rows" :key="ri">
                    <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
                  </tr>
                </tbody>
              </table>
            </template>

            <!-- 要素对照 -->
            <template v-else-if="s.type === 'kv'">
              <table class="doc-table doc-table--kv">
                <tbody>
                  <tr v-for="(item, k) in s.kv" :key="k">
                    <td class="doc-table__k">{{ item.k }}</td>
                    <td>{{ item.v }}</td>
                  </tr>
                </tbody>
              </table>
            </template>

            <!-- 提示 -->
            <template v-else-if="s.type === 'note'">
              <div class="doc-note">{{ s.note }}</div>
            </template>
          </section>
        </div>

        <!-- ============ 落款 ============ -->
        <div class="doc-sign">
          <div v-for="(e, i) in doc.signExtra" :key="i" class="doc-sign__x">{{ e.k }}：{{ e.v }}</div>
          <div class="doc-sign__org">{{ doc.issuer }}</div>
          <div v-if="doc.sealed" class="doc-seal">
            <span class="doc-seal__ring">{{ doc.sealText || doc.issuer }}</span>
          </div>
          <div class="doc-sign__date">{{ doc.signDate }}</div>
        </div>

        <!-- 页脚系统标识 -->
        <div v-if="doc.bizId" class="doc-foot">
          系统业务编号：{{ doc.bizId }}　｜　本文书由「智行合医」医保基金智能监管平台生成
        </div>
      </div>
    </div>
    <EmptyState v-else text="暂无文书内容" height="220px" />

    <template #footer>
      <div class="doc-actions">
        <span class="text-mini">{{ doc?.docNo }}</span>
        <div class="doc-actions__r">
          <el-button @click="show = false">关闭</el-button>
          <el-button :icon="'Printer'" @click="doPrint">打印</el-button>
          <el-button type="primary" :icon="'Download'" @click="doWord">导出 Word</el-button>
          <el-button type="danger" :icon="'Document'" @click="doPdf">导出 PDF</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.doc-wrap {
  max-height: 70vh;
  overflow-y: auto;
  padding: 0 4px;
  background: var(--zh-bg-page);
}

/* ============ 纸张 ============ */
.doc-paper {
  background: #fff;
  padding: 42px 52px 36px;
  box-shadow: 0 2px 14px rgba(16, 35, 68, .1);
  font-family: 'FangSong', 仿宋, 'Songti SC', serif;
  color: #1a1a1a;
}

/* ---------- 报告体标题 ---------- */
.doc-title--report {
  margin: 8px 0 10px;
  font-family: 'SimSun', 宋体, serif;
  font-size: 25px;
  font-weight: 700;
  text-align: center;
  line-height: 1.5;
  letter-spacing: 1px;
}

.doc-no--center {
  text-align: center;
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
}

.doc-issuer--report {
  text-align: center;
  font-size: 14px;
  color: #333;
  padding-bottom: 18px;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

/* ---------- 公文红头 ---------- */
.doc-head {
  text-align: center;
  padding-top: 6px;

  &__org {
    font-family: 'SimSun', 宋体, serif;
    font-size: 27px;
    font-weight: 700;
    color: #c00;
    letter-spacing: 6px;
    line-height: 1.4;
  }

  &__name {
    margin: 10px 0 6px;
    font-family: 'SimSun', 宋体, serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 3px;
  }

  &__no { font-size: 13px; color: #444; }
}

.doc-redline {
  height: 2px;
  background: #c00;
  margin: 12px 0 22px;
}

.doc-recipient {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
}

/* ---------- 正文 ---------- */
.doc-body { font-size: 15px; }

.doc-sec { margin-bottom: 14px; }

.doc-sec__t {
  margin: 16px 0 8px;
  font-family: 'SimHei', 黑体, sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #111;
}

.doc-sec__no { color: #c00; }

.doc-p {
  margin: 7px 0;
  font-size: 15px;
  line-height: 2.05;
  text-indent: 2em;
  text-align: justify;
}

/* ---------- 表格 ---------- */
.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  margin: 8px 0;

  th, td {
    border: 1px solid #999;
    padding: 6px 8px;
    line-height: 1.7;
    vertical-align: top;
    word-break: break-all;
  }

  th {
    background: #f0f4fa;
    font-weight: 700;
    font-family: 'SimHei', 黑体, sans-serif;
    text-align: center;
    white-space: nowrap;
  }

  &--kv td:first-child { white-space: nowrap; }

  &__k {
    width: 168px;
    background: #f0f4fa;
    font-weight: 700;
  }
}

.doc-note {
  margin: 12px 0;
  padding: 9px 12px;
  background: #f5f7fa;
  border-left: 3px solid #999;
  font-size: 12.5px;
  line-height: 1.85;
  color: #555;
}

/* ---------- 落款 ---------- */
.doc-sign {
  margin-top: 36px;
  text-align: right;
  position: relative;

  &__x { font-size: 13px; color: #444; line-height: 1.9; }

  &__org {
    margin-top: 16px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  &__date { font-size: 15px; margin-top: 4px; }
}

.doc-seal {
  position: absolute;
  right: 6px;
  bottom: -6px;
  pointer-events: none;

  &__ring {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 104px;
    height: 104px;
    border: 3px solid rgba(204, 0, 0, .62);
    border-radius: 50%;
    color: rgba(204, 0, 0, .72);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
    padding: 12px;
    transform: rotate(-14deg);
    background: rgba(204, 0, 0, .03);
  }
}

.doc-foot {
  margin-top: 30px;
  padding-top: 8px;
  border-top: 1px solid #e5e5e5;
  font-size: 10px;
  color: #999;
  font-family: var(--zh-font);
}

/* ---------- 操作条 ---------- */
.doc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &__r { display: flex; gap: 8px; }
}

:deep(.doc-dialog .el-dialog__body) {
  padding: 12px 14px;
  background: var(--zh-bg-page);
}
</style>
