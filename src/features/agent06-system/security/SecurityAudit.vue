<script setup lang="ts">
import { getDesensitize, getAuditStats, getAuditList, getXinchuang, saveSecurityRule } from '@/api/agent06-system/system'

const msg = ElMessage
const activeTab = ref('desensitize')

const SENS_TONE: Record<string, any> = { 极高: 'danger', 高: 'warning', 中: 'primary', 低: 'info' }
const RISK_TONE: Record<string, any> = { 高: 'danger', 中: 'warning', 低: 'info' }
const XC_TONE: Record<string, any> = { 已适配: 'success', 适配中: 'warning', 兼容支持: 'info' }

/* ================= 脱敏加密 ================= */
const ds = ref<any>(null)
const dsLoading = ref(false)

async function loadDs() {
  dsLoading.value = true
  try { ds.value = await getDesensitize() } finally { dsLoading.value = false }
}

/* ---------- 脱敏规则新增 / 编辑 ---------- */
const drfVisible = ref(false)
const drfSaving = ref(false)
const drfEditing = ref<any>(null)
const drf = reactive({
  fieldName: '', fieldCode: '', sensitivityLevel: '高', rule: '',
  storageMode: '加密存储（AES-256）', queryMode: '动态脱敏（按权限）', exportMode: '强制脱敏', auditRequired: true
})

function openRuleForm(row?: any) {
  drfEditing.value = row || null
  if (row) {
    Object.assign(drf, { fieldName: row.fieldName, fieldCode: row.fieldCode, sensitivityLevel: row.sensitivityLevel, rule: row.rule, storageMode: row.storageMode, queryMode: row.queryMode, exportMode: row.exportMode, auditRequired: row.auditRequired })
  } else {
    Object.assign(drf, { fieldName: '', fieldCode: '', sensitivityLevel: '高', rule: '', storageMode: '加密存储（AES-256）', queryMode: '动态脱敏（按权限）', exportMode: '强制脱敏', auditRequired: true })
  }
  drfVisible.value = true
}

async function doSaveRule() {
  if (!drf.fieldName || !drf.rule) { msg.warning('请填写字段名称与脱敏规则'); return }
  drfSaving.value = true
  try {
    const res: any = await saveSecurityRule({ fieldId: drfEditing.value?.fieldId, ...drf })
    msg.success(res.message)
    if (drfEditing.value) {
      Object.assign(drfEditing.value, drf)
    } else {
      ds.value.rules.push({
        fieldId: res.fieldId, ...drf,
        example: { original: '（示例待配置）', desensitized: '（预览待配置）' }
      })
      ds.value.effect.desensitizedFields += 1
      ds.value.effect.totalFields += 1
    }
    drfVisible.value = false
  } finally { drfSaving.value = false }
}

/* ================= 留痕审计 ================= */
const aSt = ref<any>(null)
const aList = ref<any[]>([])
const aTotal = ref(0)
const aLoading = ref(false)
const aQ = reactive({ keyword: '', operationType: '', operationModule: '', riskLevel: '', page: 1, pageSize: 10 })

async function loadAuditStats() { aSt.value = await getAuditStats() }

async function loadAudits() {
  aLoading.value = true
  try {
    const res: any = await getAuditList(aQ)
    aList.value = res?.list || []
    aTotal.value = res?.total || 0
  } finally { aLoading.value = false }
}

const aDrawer = ref(false)
const curAudit = ref<any>(null)
function openAudit(row: any) { curAudit.value = row; aDrawer.value = true }

/** 前后值对比行 */
const diffRows = computed(() => {
  const a = curAudit.value
  if (!a?.before && !a?.after) return []
  const keys = Array.from(new Set([...Object.keys(a.before || {}), ...Object.keys(a.after || {})]))
  return keys.map((k) => ({
    field: k,
    before: a.before?.[k] === null || a.before?.[k] === undefined ? '—' : JSON.stringify(a.before[k]),
    after: a.after?.[k] === null || a.after?.[k] === undefined ? '—' : JSON.stringify(a.after[k])
  }))
})

/* ================= 信创适配 ================= */
const xc = ref<any>(null)
const xcLoading = ref(false)

async function loadXc() {
  xcLoading.value = true
  try { xc.value = await getXinchuang() } finally { xcLoading.value = false }
}

watch(activeTab, (v) => {
  if (v === 'audit' && !aList.value.length) { loadAuditStats(); loadAudits() }
  else if (v === 'xinchuang' && !xc.value) loadXc()
})

onMounted(() => { loadDs() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="数据安全与审计" tag="M46"
      subtitle="敏感数据脱敏加密 · 操作全程留痕不可篡改 · 信创环境全栈适配">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadDs(); if (activeTab === 'audit') { loadAuditStats(); loadAudits() }">刷新</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <!-- ================= 脱敏加密 ================= -->
      <el-tab-pane label="脱敏加密配置" name="desensitize">
        <div v-loading="dsLoading">
          <template v-if="ds">
            <!-- 加密状态 -->
            <div class="enc-grid">
              <div v-for="e in [
                { name: '传输加密', icon: 'Connection', items: [['协议', ds.encryption.transport.protocol], ['加密套件', ds.encryption.transport.cipherSuite], ['证书', ds.encryption.transport.certificate]], status: ds.encryption.transport.status },
                { name: '存储加密', icon: 'Coin', items: [['算法', ds.encryption.storage.algorithm], ['密钥管理', ds.encryption.storage.keyManagement], ['密钥轮换', ds.encryption.storage.keyRotation], ['库级加密', ds.encryption.storage.databaseEncryption]], status: ds.encryption.storage.status },
                { name: '备份加密', icon: 'Files', items: [['算法', ds.encryption.backup.algorithm]], status: ds.encryption.backup.status }
              ]" :key="e.name" class="section-card enc">
                <div class="enc__h">
                  <el-icon :size="14"><component :is="e.icon" /></el-icon>
                  <b>{{ e.name }}</b>
                  <el-tag type="success" size="small" effect="dark" style="margin-left: auto">{{ e.status }}</el-tag>
                </div>
                <div class="enc__i" v-for="[k, v] in e.items" :key="k">
                  <span class="enc__k">{{ k }}</span><span class="enc__v num">{{ v }}</span>
                </div>
              </div>

              <div class="section-card enc">
                <div class="enc__h">
                  <el-icon :size="14"><DataAnalysis /></el-icon>
                  <b>脱敏覆盖</b>
                  <el-tag type="success" size="small" effect="plain" style="margin-left: auto">审计{{ ds.effect.auditResult }}</el-tag>
                </div>
                <div class="enc__rate">
                  <el-progress type="dashboard" :percentage="Math.round(ds.effect.coverageRate * 100)" :width="86" :stroke-width="8" color="#1668dc" />
                  <div class="enc__nums">
                    <div><b class="num">{{ ds.effect.totalFields }}</b><span>敏感字段</span></div>
                    <div><b class="num" style="color: var(--zh-primary)">{{ ds.effect.desensitizedFields }}</b><span>已脱敏</span></div>
                    <div><b class="num" style="color: var(--zh-success)">{{ ds.effect.encryptedFields }}</b><span>已加密</span></div>
                  </div>
                </div>
                <div class="text-mini" style="margin-top: 6px">最近审计：{{ ds.effect.lastAuditTime }}</div>
              </div>
            </div>

            <!-- 脱敏规则表 -->
            <div class="section-card">
              <div class="section-title">
                <span class="section-title__dot" />
                <span class="section-title__text">脱敏规则（{{ ds.configName }}）</span>
                <span class="section-title__desc">作用范围：{{ ds.scope }} · 静态 / 动态 / 导出三级脱敏</span>
                <span class="section-title__extra">
                  <el-button type="primary" size="small" :icon="'Plus'" @click="openRuleForm()">新增规则</el-button>
                </span>
              </div>
              <el-table :data="ds.rules" size="small" border stripe>
                <el-table-column prop="fieldName" label="敏感字段" width="96">
                  <template #default="{ row }"><b style="font-size: 12px">{{ row.fieldName }}</b></template>
                </el-table-column>
                <el-table-column prop="fieldCode" label="字段编码" width="130">
                  <template #default="{ row }"><span class="num text-mini">{{ row.fieldCode }}</span></template>
                </el-table-column>
                <el-table-column label="敏感级" width="76" align="center">
                  <template #default="{ row }">
                    <el-tag :type="SENS_TONE[row.sensitivityLevel]" size="small" effect="dark">{{ row.sensitivityLevel }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="rule" label="脱敏规则" min-width="220" show-overflow-tooltip />
                <el-table-column label="效果示例" width="260">
                  <template #default="{ row }">
                    <span class="num text-mini" style="color: var(--zh-text-placeholder); text-decoration: line-through">{{ row.example.original }}</span>
                    <el-icon :size="10" style="margin: 0 4px"><Right /></el-icon>
                    <span class="num text-mini" style="color: var(--zh-primary); font-weight: 700">{{ row.example.desensitized }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="storageMode" label="存储" width="140" show-overflow-tooltip />
                <el-table-column prop="exportMode" label="导出" width="110" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.exportMode === '禁止导出' ? 'danger' : 'warning'" size="small" effect="plain">{{ row.exportMode }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="审计" width="64" align="center">
                  <template #default="{ row }">
                    <el-icon v-if="row.auditRequired" :size="13" style="color: var(--zh-success)"><CircleCheck /></el-icon>
                    <span v-else class="text-mini">—</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="76" fixed="right" align="center">
                  <template #default="{ row }">
                    <el-button link type="warning" :icon="'EditPen'" @click="openRuleForm(row)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>

      <!-- ================= 留痕审计 ================= -->
      <el-tab-pane label="全程留痕审计" name="audit">
        <div class="kpi-grid">
          <StatCard label="今日审计日志" :value="aSt?.todayLogs || 0" unit="条" icon="Document" tone="primary" />
          <StatCard label="敏感数据访问" :value="aSt?.sensitiveAccess || 0" unit="次" icon="View" tone="warning" />
          <StatCard label="数据导出操作" :value="aSt?.exportOperations || 0" unit="次" icon="Download" tone="accent" />
          <StatCard label="风险事件" :value="aSt?.riskEvents || 0" unit="起" icon="WarnTriangleFilled" tone="danger" />
          <StatCard label="哈希链状态" value="有效" icon="Link" tone="success"
            desc="WORM 存储 · 区块链存证" />
        </div>

        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">审计日志</span>
            <span class="section-title__desc">日志不可篡改 · 永久保存 · 支持变更前后对比与轨迹回放</span>
          </div>
          <el-form class="query-form" :model="aQ" @submit.prevent>
            <el-input v-model="aQ.keyword" placeholder="操作 / 对象 / 操作人" clearable :prefix-icon="'Search'"
              style="width: 210px" @keyup.enter="aQ.page = 1; loadAudits()" />
            <el-select v-model="aQ.operationType" placeholder="操作类型" clearable style="width: 120px">
              <el-option v-for="t in ['数据查询', '数据修改', '配置变更', '审批操作', '数据导出', '登录登出']" :key="t" :label="t" :value="t" />
            </el-select>
            <el-select v-model="aQ.operationModule" placeholder="所属模块" clearable style="width: 170px">
              <el-option v-for="m in ['疑点线索管理智能体', '专项任务管理智能体', '违规处置智能体', '文书生成智能体', '成果宣教智能体', '系统管理与支撑模块', '全平台']" :key="m" :label="m" :value="m" />
            </el-select>
            <el-select v-model="aQ.riskLevel" placeholder="风险等级" clearable style="width: 106px">
              <el-option v-for="r in ['高', '中', '低']" :key="r" :label="r" :value="r" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="aQ.page = 1; loadAudits()">查　询</el-button>
            <el-button :icon="'RefreshLeft'" @click="Object.assign(aQ, { keyword: '', operationType: '', operationModule: '', riskLevel: '', page: 1 }); loadAudits()">重　置</el-button>
          </el-form>

          <el-table :data="aList" size="small" border stripe v-loading="aLoading">
            <el-table-column prop="auditLogId" label="审计ID" width="196">
              <template #default="{ row }">
                <span class="num text-link" @click="openAudit(row)">{{ row.auditLogId }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="operationTime" label="操作时间" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.operationTime }}</span></template>
            </el-table-column>
            <el-table-column label="操作人" width="130">
              <template #default="{ row }">
                <span style="font-weight: 600; font-size: 12px">{{ row.operator.userName }}</span>
                <span class="text-mini">（{{ row.operator.role }}）</span>
              </template>
            </el-table-column>
            <el-table-column prop="operationType" label="类型" width="88" align="center">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.operationType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operationAction" label="操作" min-width="150" show-overflow-tooltip />
            <el-table-column label="操作对象" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ row.operationObject.objectName }}</template>
            </el-table-column>
            <el-table-column label="结果" width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.operationResult === '成功' ? 'success' : 'danger'" size="small" effect="dark">{{ row.operationResult }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="风险" width="66" align="center">
              <template #default="{ row }">
                <el-tag :type="RISK_TONE[row.riskLevel]" size="small" effect="dark">{{ row.riskLevel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="存证" width="70" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.integrity.chainStatus === '有效'" type="success" size="small" effect="plain">已存证</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="76" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" :icon="'View'" @click="openAudit(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty><EmptyState text="暂无审计日志" height="140px" /></template>
          </el-table>

          <div class="pager">
            <span class="text-mini">共 {{ aTotal }} 条</span>
            <el-pagination v-model:current-page="aQ.page" v-model:page-size="aQ.pageSize" :total="aTotal"
              :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next, jumper" small background @change="loadAudits" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 信创适配 ================= -->
      <el-tab-pane label="信创适配管理" name="xinchuang">
        <div v-loading="xcLoading">
          <template v-if="xc">
            <!-- 当前部署 -->
            <div class="section-card xc-deploy">
              <div class="xc-deploy__h">
                <b>当前生产部署（全栈国产化）</b>
                <el-tag type="success" effect="dark" size="small">{{ xc.currentDeployment.status }}</el-tag>
              </div>
              <div class="xc-deploy__grid">
                <div class="xcd"><span>操作系统</span><b>{{ xc.currentDeployment.os }}</b></div>
                <div class="xcd"><span>数据库</span><b>{{ xc.currentDeployment.database }}</b></div>
                <div class="xcd"><span>中间件</span><b>{{ xc.currentDeployment.middleware }}</b></div>
                <div class="xcd"><span>浏览器</span><b>{{ xc.currentDeployment.browser }}</b></div>
                <div class="xcd xcd--rate">
                  <el-progress type="circle" :percentage="Math.round(xc.currentDeployment.domesticRate * 100)" :width="72" :stroke-width="7" color="#12a150" />
                  <span>国产化率</span>
                </div>
              </div>
            </div>

            <!-- 适配清单 -->
            <div class="xc-grid">
              <div v-for="cat in xc.categories" :key="cat.name" class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">{{ cat.name }}</span>
                </div>
                <el-table :data="cat.items" size="small" border stripe>
                  <el-table-column prop="name" label="产品" min-width="150" show-overflow-tooltip />
                  <el-table-column prop="version" label="版本" width="130" show-overflow-tooltip />
                  <el-table-column label="状态" width="86" align="center">
                    <template #default="{ row }">
                      <el-tag :type="XC_TONE[row.status]" size="small" effect="dark">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="cat.items.some((i: any) => i.performance)" prop="performance" label="性能" width="130">
                    <template #default="{ row }"><span class="text-mini">{{ row.performance || '—' }}</span></template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <!-- 国密 + 报告 + 问题 -->
            <div class="xc-grid xc-grid--3">
              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">国密算法适配</span>
                  <el-tag type="success" size="small" effect="dark">{{ xc.cryptography.status }}</el-tag>
                </div>
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="签名算法">{{ xc.cryptography.signatureAlgorithm }}</el-descriptions-item>
                  <el-descriptions-item label="哈希算法">{{ xc.cryptography.hashAlgorithm }}</el-descriptions-item>
                  <el-descriptions-item label="对称加密">{{ xc.cryptography.symmetricAlgorithm }}</el-descriptions-item>
                  <el-descriptions-item label="SSL证书">{{ xc.cryptography.sslCertificate }}</el-descriptions-item>
                </el-descriptions>
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">适配测试报告</span>
                </div>
                <div v-for="r in xc.testReports" :key="r.reportId" class="xcr">
                  <el-icon :size="12" style="color: var(--zh-success)"><DocumentChecked /></el-icon>
                  <span class="xcr__n">{{ r.name }}</span>
                  <span class="text-mini num">{{ r.date }}</span>
                  <el-tag type="success" size="small" effect="plain" style="margin-left: auto">{{ r.result }}</el-tag>
                </div>
              </div>

              <div class="section-card section-card--tight">
                <div class="section-title">
                  <span class="section-title__dot" />
                  <span class="section-title__text">已知问题跟踪</span>
                </div>
                <div v-for="i in xc.knownIssues" :key="i.issueId" class="xci">
                  <div class="xci__h">
                    <el-tag type="warning" size="small" effect="plain">{{ i.severity }}</el-tag>
                    <b>{{ i.description }}</b>
                  </div>
                  <div class="text-mini" style="margin-top: 4px">
                    状态：{{ i.status }} · 规避方案：{{ i.workaround }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <el-skeleton v-else :rows="10" animated />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 脱敏规则新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="drfVisible" :title="drfEditing ? '编辑脱敏规则' : '新增脱敏规则'" width="600px" destroy-on-close>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="字段名称" required>
              <el-input v-model="drf.fieldName" placeholder="如：参保人住址" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="字段编码" required>
              <el-input v-model="drf.fieldCode" placeholder="如：patient_address" :disabled="!!drfEditing" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="敏感等级" required>
              <el-select v-model="drf.sensitivityLevel" style="width: 100%">
                <el-option v-for="l in ['极高', '高', '中', '低']" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="访问留痕">
              <el-switch v-model="drf.auditRequired" active-text="审计" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="脱敏规则" required>
          <el-input v-model="drf.rule" placeholder="如：保留到区，其余用*代替" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="存储方式" required>
              <el-select v-model="drf.storageMode" style="width: 100%">
                <el-option v-for="m in ['加密存储（AES-256）', '加密存储+哈希索引', '加密存储', '明文存储（业务需要）']" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="查询模式" required>
              <el-select v-model="drf.queryMode" style="width: 100%">
                <el-option v-for="m in ['动态脱敏（按权限）', '动态脱敏（按角色）', '动态脱敏', '审批后解密查看']" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="导出模式" required>
              <el-select v-model="drf.exportMode" style="width: 100%">
                <el-option v-for="m in ['强制脱敏', '按权限脱敏', '禁止导出']" :key="m" :label="m" :value="m" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="drfVisible = false">取消</el-button>
        <el-button type="primary" :loading="drfSaving" @click="doSaveRule">{{ drfEditing ? '保存' : '创建规则' }}</el-button>
      </template>
    </el-dialog>

    <!-- ============ 审计详情抽屉 ============ -->
    <el-drawer v-model="aDrawer" size="620px" title="审计日志详情">
      <template v-if="curAudit">
        <div class="dt-hero">
          <div class="dt-hero__t">
            {{ curAudit.operationAction }}
            <el-tag size="small" effect="plain">{{ curAudit.operationType }}</el-tag>
            <el-tag :type="RISK_TONE[curAudit.riskLevel]" size="small" effect="dark">风险 {{ curAudit.riskLevel }}</el-tag>
          </div>
          <div class="dt-hero__m">
            <span><el-icon><Ticket /></el-icon>{{ curAudit.auditLogId }}</span>
            <span><el-icon><Clock /></el-icon>{{ curAudit.operationTime }}</span>
          </div>
          <div class="dt-hero__d" v-if="curAudit.riskReason">风险提示：{{ curAudit.riskReason }}</div>
        </div>

        <div class="sub-title">操作人与环境</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="操作人">{{ curAudit.operator.userName }}（{{ curAudit.operator.role }}）</el-descriptions-item>
          <el-descriptions-item label="所属组织">{{ curAudit.operator.org }}</el-descriptions-item>
          <el-descriptions-item label="客户端IP"><span class="num">{{ curAudit.ip }}</span></el-descriptions-item>
          <el-descriptions-item label="所属模块">{{ curAudit.operationModule }}</el-descriptions-item>
          <el-descriptions-item label="操作对象" :span="2">
            {{ curAudit.operationObject.objectType }} · {{ curAudit.operationObject.objectName }}（{{ curAudit.operationObject.objectId }}）
          </el-descriptions-item>
        </el-descriptions>

        <template v-if="diffRows.length">
          <div class="sub-title">变更前后对比</div>
          <el-table :data="diffRows" size="small" border stripe>
            <el-table-column prop="field" label="字段" width="150">
              <template #default="{ row }"><span class="num text-mini">{{ row.field }}</span></template>
            </el-table-column>
            <el-table-column prop="before" label="操作前" min-width="170" show-overflow-tooltip />
            <el-table-column prop="after" label="操作后" min-width="190" show-overflow-tooltip>
              <template #default="{ row }"><span style="color: var(--zh-primary); font-weight: 600">{{ row.after }}</span></template>
            </el-table-column>
          </el-table>
        </template>

        <div class="sub-title">完整性与存证</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="哈希链状态">
            <el-tag type="success" size="small" effect="plain">{{ curAudit.integrity.chainStatus }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="区块链存证">{{ curAudit.integrity.blockchainEvidence }}</el-descriptions-item>
          <el-descriptions-item label="存储方式">审计日志库（WORM 存储，不可篡改）· 永久保存</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1300px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
}

.enc-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1400px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 800px) { grid-template-columns: 1fr; }
}

.enc {
  &__h {
    display: flex; align-items: center; gap: 6px; margin-bottom: 9px;
    :deep(.el-icon) { color: var(--zh-primary); }
    b { font-size: 13px; color: var(--zh-text-primary); }
  }
  &__i {
    display: flex; gap: 8px; padding: 4px 0;
    border-bottom: 1px dashed var(--zh-border-light);
    &:last-child { border-bottom: none; }
  }
  &__k { flex-shrink: 0; width: 60px; font-size: 10.5px; color: var(--zh-text-secondary); }
  &__v { font-size: 10.5px; color: var(--zh-text-primary); }

  &__rate { display: flex; align-items: center; gap: 12px; }
  &__nums {
    display: flex; flex-direction: column; gap: 5px;
    > div {
      b { font-size: 15px; font-weight: 800; margin-right: 5px; }
      span { font-size: 10px; color: var(--zh-text-secondary); }
    }
  }
}

.xc-deploy {
  margin-bottom: 12px;
  background: linear-gradient(120deg, var(--zh-success-light), #fff);
  border-color: var(--zh-risk-low-border);

  &__h {
    display: flex; align-items: center; gap: 10px;
    b { font-size: 14px; color: var(--zh-text-primary); }
  }

  &__grid {
    display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 10px; margin-top: 12px;
    @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
  }
}

.xcd {
  padding: 9px 11px; border-radius: 6px;
  background: #fff; border: 1px solid var(--zh-border-light);

  span { display: block; font-size: 10px; color: var(--zh-text-secondary); }
  b { display: block; margin-top: 3px; font-size: 11.5px; color: var(--zh-text-primary); }

  &--rate {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    span { margin-top: 3px; }
  }
}

.xc-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }

  &--3 { grid-template-columns: 1fr 1fr 1fr; @media (max-width: 1300px) { grid-template-columns: 1fr; } }
}

.xcr {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 0; border-bottom: 1px dashed var(--zh-border-light);
  &:last-child { border-bottom: none; }

  &__n { flex: 1; font-size: 11.5px; color: var(--zh-text-primary); }
}

.xci {
  padding: 8px 10px; border-radius: 6px;
  background: var(--zh-warning-light); border: 1px solid var(--zh-risk-mid-border);

  &__h {
    display: flex; align-items: center; gap: 6px;
    b { font-size: 11.5px; color: var(--zh-text-primary); }
  }
}

.sub-title {
  margin: 16px 0 10px;
  font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-regular);
  padding-left: 7px; border-left: 2px solid var(--zh-accent);
}

.dt-hero {
  padding: 12px 14px; border-radius: var(--zh-radius);
  background: linear-gradient(120deg, var(--zh-primary-lighter), #fff);
  border: 1px solid var(--zh-primary-light);

  &__t {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: var(--zh-fs-md); font-weight: 700; color: var(--zh-text-primary); line-height: 1.5;
  }
  &__m {
    display: flex; flex-wrap: wrap; gap: 14px; margin-top: 7px;
    font-size: 11px; color: var(--zh-text-secondary);
    span { display: inline-flex; align-items: center; gap: 3px; }
    :deep(.el-icon) { color: var(--zh-primary); }
  }
  &__d { margin-top: 8px; font-size: 11px; line-height: 1.8; color: var(--zh-text-secondary); }
}
</style>
