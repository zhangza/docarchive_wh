<script setup lang="ts">
import { getOrgTree, getOrgUsers, getRoleList, getRoleDetail, getReviewConfigs, toggleReviewConfig, saveOrgUser, saveRole, saveReviewConfig } from '@/api/agent06-system/system'

const ROLE_OPTIONS = ['监管领导', '稽核组长', '稽核员', '法制审核', '规则管理员', '运维工程师', '宣传人员', '模型运营']
const MODULE_PERMS: Record<string, string[]> = {
  疑点线索管理: ['线索列表查看', '线索详情查看', '线索研判', '线索核查', '线索反馈', '线索申诉处理'],
  专项任务管理: ['任务列表查看', '任务签收', '任务执行', '核查记录填写', '任务结果提交'],
  违规处置: ['处置列表查看', '处置建议提交', '整改跟踪', '整改验收'],
  文书生成: ['文书生成', '文书编辑', '文书提交审核'],
  成果宣教: ['复盘参与', '案例查看'],
  系统管理: ['规则配置', '参数管理', '权限管理', '审计查询', '个人信息修改']
}

const msg = ElMessage
const activeTab = ref('org')

/* ================= 组织人员 ================= */
const tree = ref<any[]>([])
const uList = ref<any[]>([])
const uTotal = ref(0)
const uLoading = ref(false)
const uQ = reactive({ keyword: '', status: '', orgName: '', page: 1, pageSize: 10 })

async function loadTree() { tree.value = await getOrgTree() }

async function loadUsers() {
  uLoading.value = true
  try {
    const res: any = await getOrgUsers(uQ)
    uList.value = res?.list || []
    uTotal.value = res?.total || 0
  } finally { uLoading.value = false }
}

function pickOrg(node: any) {
  uQ.orgName = uQ.orgName === node.label ? '' : node.label
  uQ.page = 1
  loadUsers()
}

const uDrawer = ref(false)
const curUser = ref<any>(null)
function openUser(row: any) { curUser.value = row; uDrawer.value = true }

/* ---------- 人员新增 / 编辑 ---------- */
const ufVisible = ref(false)
const ufSaving = ref(false)
const ufEditing = ref<any>(null)
const uf = reactive({ userName: '', account: '', orgName: '基金监管处', position: '', roles: [] as string[], dataScope: '本组', phone: '', status: '在职' })

function openUserForm(row?: any) {
  ufEditing.value = row || null
  if (row) {
    Object.assign(uf, { userName: row.userName, account: row.account, orgName: row.orgName, position: row.position, roles: [...row.roles], dataScope: row.dataScope, phone: row.phone, status: row.status })
  } else {
    Object.assign(uf, { userName: '', account: '', orgName: '基金监管处', position: '', roles: [], dataScope: '本组', phone: '', status: '在职' })
  }
  ufVisible.value = true
}

async function doSaveUser() {
  if (!uf.userName || !uf.account) { msg.warning('请填写姓名与登录账号'); return }
  if (!uf.roles.length) { msg.warning('请至少分配一个角色'); return }
  ufSaving.value = true
  try {
    const res: any = await saveOrgUser({ userId: ufEditing.value?.userId, ...uf })
    msg.success(res.message)
    if (ufEditing.value) {
      Object.assign(ufEditing.value, { ...uf, roles: [...uf.roles] })
    } else {
      uList.value.unshift({
        userId: res.userId, ...uf, roles: [...uf.roles], employeeNo: 'WHYB2026' + String(Date.now()).slice(-3),
        email: uf.account + '@yibao.wuhu.gov.cn', mfaEnabled: false, lastLoginTime: '—', entryDate: '2026-09-01',
        taskCount: { pending: 0, processing: 0, completed: 0 }
      })
      uTotal.value += 1
    }
    ufVisible.value = false
    uDrawer.value = false
  } finally { ufSaving.value = false }
}

/* ================= 角色权限 ================= */
const rList = ref<any[]>([])
const rTotal = ref(0)
const rLoading = ref(false)

async function loadRoles() {
  rLoading.value = true
  try {
    const res: any = await getRoleList({ page: 1, pageSize: 20 })
    rList.value = res?.list || []
    rTotal.value = res?.total || 0
  } finally { rLoading.value = false }
}

const rDrawer = ref(false)
const curRole = ref<any>(null)
const rDetailLoading = ref(false)

/* 角色权限编辑态：按模块勾选 */
const permEdit = reactive<Record<string, string[]>>({})
const permSaving = ref(false)

async function openRole(row: any) {
  rDrawer.value = true
  rDetailLoading.value = true
  try {
    curRole.value = await getRoleDetail(row.roleId)
    Object.keys(permEdit).forEach((k) => delete permEdit[k])
    ;(curRole.value.functionalPermissions || []).forEach((m: any) => { permEdit[m.module] = [...m.permissions] })
  } finally { rDetailLoading.value = false }
}

async function doSavePerms() {
  permSaving.value = true
  try {
    const res: any = await saveRole({
      roleId: curRole.value.roleId,
      functionalPermissions: Object.entries(permEdit).map(([module, permissions]) => ({ module, permissions }))
    })
    msg.success(res.message)
    const target = rList.value.find((r) => r.roleId === curRole.value.roleId)
    if (target) target.permissionSummary = Object.values(permEdit).flat().slice(0, 5)
  } finally { permSaving.value = false }
}

/* ---------- 角色新增 ---------- */
const rfVisible = ref(false)
const rfSaving = ref(false)
const rForm = reactive({ roleName: '', roleCode: '', roleType: '自定义角色', dataScope: '本组', description: '' })

async function doSaveRole() {
  if (!rForm.roleName || !rForm.roleCode) { msg.warning('请填写角色名称与编码'); return }
  rfSaving.value = true
  try {
    const res: any = await saveRole(rForm)
    msg.success(res.message)
    rList.value.unshift({
      roleId: res.roleId, ...rForm, status: '启用', userCount: 0,
      permissionSummary: [], updateTime: '2026-09-01 09:00:00'
    })
    rTotal.value += 1
    rfVisible.value = false
    Object.assign(rForm, { roleName: '', roleCode: '', roleType: '自定义角色', dataScope: '本组', description: '' })
  } finally { rfSaving.value = false }
}

/* ================= 双人复核 ================= */
const rcList = ref<any[]>([])
const rcLoading = ref(false)

async function loadReviewConfigs() {
  rcLoading.value = true
  try { rcList.value = await getReviewConfigs() } finally { rcLoading.value = false }
}

async function doToggleRc(row: any) {
  const enabled = row.status !== '启用'
  const res: any = await toggleReviewConfig({ reviewConfigId: row.reviewConfigId, sceneName: row.sceneName, enabled })
  msg.success(res.message)
  row.status = enabled ? '启用' : '停用'
}

/* ---------- 复核配置编辑 ---------- */
const rcfVisible = ref(false)
const rcfSaving = ref(false)
const rcEditing = ref<any>(null)
const rcf = reactive({ sceneName: '', triggerCondition: '', levels: [] as any[] })

function openRcForm(row: any) {
  rcEditing.value = row
  Object.assign(rcf, {
    sceneName: row.sceneName,
    triggerCondition: row.triggerCondition,
    levels: row.reviewLevels.map((l: any) => ({ ...l }))
  })
  rcfVisible.value = true
}

async function doSaveRc() {
  if (!rcf.triggerCondition) { msg.warning('请填写触发条件'); return }
  rcfSaving.value = true
  try {
    const res: any = await saveReviewConfig({ reviewConfigId: rcEditing.value.reviewConfigId, ...rcf })
    msg.success(res.message)
    rcEditing.value.triggerCondition = rcf.triggerCondition
    rcEditing.value.reviewLevels = rcf.levels.map((l: any) => ({ ...l }))
    rcfVisible.value = false
  } finally { rcfSaving.value = false }
}

watch(activeTab, (v) => {
  if (v === 'role' && !rList.value.length) loadRoles()
  else if (v === 'review' && !rcList.value.length) loadReviewConfigs()
})

onMounted(() => { loadTree(); loadUsers() })
</script>

<template>
  <div class="zh-page">
    <PageHeader title="组织与权限" tag="M45"
      subtitle="组织人员管理 · RBAC 角色权限 · 关键操作双人复核配置">
      <template #actions>
        <el-button :icon="'Refresh'" @click="loadTree(); loadUsers()">刷新</el-button>
        <el-button v-if="activeTab === 'org'" type="primary" :icon="'Plus'" @click="openUserForm()">新增人员</el-button>
        <el-button v-if="activeTab === 'role'" type="primary" :icon="'Plus'" @click="rfVisible = true">新增角色</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab">
      <!-- ================= 组织人员管理 ================= -->
      <el-tab-pane label="组织人员管理" name="org">
        <div class="org-grid">
          <!-- 组织树 -->
          <div class="section-card section-card--tight org-tree">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">组织架构</span>
              <span class="section-title__desc">点击组织筛选人员</span>
            </div>
            <el-tree :data="tree" node-key="id" default-expand-all :props="{ label: 'label', children: 'children' }"
              :expand-on-click-node="false" @node-click="pickOrg">
              <template #default="{ data }">
                <span class="org-node" :class="{ 'is-active': uQ.orgName === data.label }">
                  <el-icon :size="12"><OfficeBuilding /></el-icon>
                  <span class="org-node__l">{{ data.label }}</span>
                  <span class="org-node__c num">{{ data.count }}</span>
                </span>
              </template>
            </el-tree>
          </div>

          <!-- 人员表 -->
          <div class="section-card org-users">
            <div class="section-title">
              <span class="section-title__dot" />
              <span class="section-title__text">人员账号</span>
              <span class="section-title__desc">{{ uQ.orgName ? `当前组织：${uQ.orgName}` : '全部组织' }} · 支持批量导入与离职交接</span>
            </div>
            <el-form class="query-form" :model="uQ" @submit.prevent>
              <el-input v-model="uQ.keyword" placeholder="姓名 / 账号 / 工号" clearable :prefix-icon="'Search'"
                style="width: 200px" @keyup.enter="uQ.page = 1; loadUsers()" />
              <el-select v-model="uQ.status" placeholder="状态" clearable style="width: 96px">
                <el-option v-for="s in ['在职', '离职', '停用']" :key="s" :label="s" :value="s" />
              </el-select>
              <el-button type="primary" :icon="'Search'" @click="uQ.page = 1; loadUsers()">查　询</el-button>
              <el-button :icon="'RefreshLeft'" @click="Object.assign(uQ, { keyword: '', status: '', orgName: '', page: 1 }); loadUsers()">重　置</el-button>
            </el-form>

            <el-table :data="uList" size="small" border stripe v-loading="uLoading">
              <el-table-column label="姓名" width="120">
                <template #default="{ row }">
                  <span class="text-link" style="font-weight: 600" @click="openUser(row)">{{ row.userName }}</span>
                  <el-icon v-if="row.mfaEnabled" :size="11" style="color: var(--zh-success); margin-left: 3px" title="已启用MFA"><Lock /></el-icon>
                </template>
              </el-table-column>
              <el-table-column prop="account" label="账号" width="92">
                <template #default="{ row }"><span class="num text-mini">{{ row.account }}</span></template>
              </el-table-column>
              <el-table-column prop="employeeNo" label="工号" width="120">
                <template #default="{ row }"><span class="num text-mini">{{ row.employeeNo }}</span></template>
              </el-table-column>
              <el-table-column prop="orgName" label="所属组织" min-width="160" show-overflow-tooltip />
              <el-table-column prop="position" label="岗位" width="96" />
              <el-table-column label="角色" min-width="150">
                <template #default="{ row }">
                  <el-tag v-for="r in row.roles" :key="r" size="small" effect="plain" style="margin-right: 3px">{{ r }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="数据范围" width="80" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.dataScope === '全市' ? 'primary' : 'info'" effect="plain">{{ row.dataScope }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="待办" width="70" align="right">
                <template #default="{ row }">
                  <span class="num" :style="{ color: row.taskCount.pending > 8 ? 'var(--zh-warning)' : 'var(--zh-text-regular)' }">{{ row.taskCount.pending }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="72" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.status === '在职' ? 'success' : 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="128" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" :icon="'View'" @click="openUser(row)">详情</el-button>
                  <el-button link type="warning" :icon="'EditPen'" @click="openUserForm(row)">编辑</el-button>
                </template>
              </el-table-column>
              <template #empty><EmptyState text="暂无人员" height="140px" /></template>
            </el-table>

            <div class="pager">
              <span class="text-mini">共 {{ uTotal }} 条</span>
              <el-pagination v-model:current-page="uQ.page" v-model:page-size="uQ.pageSize" :total="uTotal"
                :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" small background @change="loadUsers" />
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ================= 角色权限管理 ================= -->
      <el-tab-pane label="角色权限管理" name="role">
        <div class="section-card">
          <div class="section-title">
            <span class="section-title__dot" />
            <span class="section-title__text">角色清单</span>
            <span class="section-title__desc">RBAC 模型 · 功能 / 数据 / 接口三维权限 · 变更全程留痕</span>
          </div>

          <el-table :data="rList" size="small" border stripe v-loading="rLoading">
            <el-table-column prop="roleId" label="角色ID" width="100">
              <template #default="{ row }"><span class="num text-mini">{{ row.roleId }}</span></template>
            </el-table-column>
            <el-table-column prop="roleName" label="角色名称" width="120">
              <template #default="{ row }">
                <span class="text-link" style="font-weight: 600" @click="openRole(row)">{{ row.roleName }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="roleCode" label="编码" width="120">
              <template #default="{ row }"><span class="num text-mini">{{ row.roleCode }}</span></template>
            </el-table-column>
            <el-table-column prop="roleType" label="类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.roleType === '系统角色' ? 'primary' : 'warning'" effect="plain">{{ row.roleType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="角色描述" min-width="240" show-overflow-tooltip />
            <el-table-column label="数据范围" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.dataScope === '全市' ? 'primary' : 'info'" effect="plain">{{ row.dataScope }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="userCount" label="人数" width="70" align="right">
              <template #default="{ row }"><span class="num">{{ row.userCount }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small" effect="dark">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
              <el-table-column label="操作" width="96" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" :icon="'Key'" @click="openRole(row)">配置权限</el-button>
                </template>
              </el-table-column>
              <template #empty><EmptyState text="暂无角色" height="140px" /></template>
          </el-table>

          <div class="pager"><span class="text-mini">共 {{ rTotal }} 条</span></div>
        </div>
      </el-tab-pane>

      <!-- ================= 双人复核配置 ================= -->
      <el-tab-pane label="双人复核配置" name="review">
        <div v-loading="rcLoading">
          <div class="rc-grid">
            <div v-for="rc in rcList" :key="rc.reviewConfigId" class="section-card rc">
              <div class="rc__h">
                <b class="rc__n">{{ rc.sceneName }}</b>
                <span class="rc__ops">
                  <el-button link type="primary" size="small" :icon="'EditPen'" @click="openRcForm(rc)">编辑</el-button>
                  <el-switch :model-value="rc.status === '启用'" size="small" @change="doToggleRc(rc)" />
                </span>
              </div>
              <div class="rc__d text-mini">{{ rc.description }}</div>
              <div class="rc__cond">
                <el-icon :size="11"><Filter /></el-icon>
                <span class="num">{{ rc.triggerCondition }}</span>
              </div>
              <div class="rc__flow">
                <template v-for="(lv, i) in rc.reviewLevels" :key="lv.level">
                  <div class="rlv">
                    <span class="rlv__lv num">L{{ lv.level }}</span>
                    <b>{{ lv.levelName }}</b>
                    <span class="rlv__role">{{ lv.reviewerRole }}</span>
                    <span class="rlv__tl num">{{ lv.timeLimit }}</span>
                  </div>
                  <el-icon v-if="i < rc.reviewLevels.length - 1" class="rc__arrow"><Right /></el-icon>
                </template>
              </div>
              <div class="rc__kpi">
                <div><b class="num">{{ rc.stats.totalReviews }}</b><span>累计复核</span></div>
                <div><b class="num" style="color: var(--zh-warning)">{{ rc.stats.pending }}</b><span>待复核</span></div>
                <div><b class="num" style="color: var(--zh-success)">{{ rc.stats.approved }}</b><span>已通过</span></div>
                <div><b class="num" style="color: var(--zh-danger)">{{ rc.stats.rejected }}</b><span>已驳回</span></div>
                <div><b class="num">{{ rc.stats.avgReviewTime }}</b><span>平均时长</span></div>
                <div>
                  <b class="num" :style="{ color: rc.stats.timeoutRate > 0.03 ? 'var(--zh-warning)' : 'var(--zh-text-primary)' }">
                    {{ (rc.stats.timeoutRate * 100).toFixed(1) }}%
                  </b>
                  <span>超时率</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 人员详情抽屉 ============ -->
    <el-drawer v-model="uDrawer" size="560px" title="人员账号详情">
      <template v-if="curUser">
        <div class="dt-hero">
          <div class="dt-hero__t">
            {{ curUser.userName }}
            <el-tag :type="curUser.status === '在职' ? 'success' : 'info'" size="small" effect="dark">{{ curUser.status }}</el-tag>
            <el-tag v-if="curUser.mfaEnabled" type="success" size="small" effect="plain">MFA 已启用</el-tag>
          </div>
          <div class="dt-hero__m">
            <span><el-icon><User /></el-icon>{{ curUser.account }} · {{ curUser.employeeNo }}</span>
            <span><el-icon><OfficeBuilding /></el-icon>{{ curUser.orgName }} · {{ curUser.position }}</span>
          </div>
        </div>

        <div class="sub-title">角色与权限</div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="角色">
            <el-tag v-for="r in curUser.roles" :key="r" size="small" effect="plain" style="margin-right: 4px">{{ r }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="数据范围">{{ curUser.dataScope }}</el-descriptions-item>
          <el-descriptions-item label="联系方式">{{ curUser.phone }} · {{ curUser.email }}</el-descriptions-item>
          <el-descriptions-item label="最近登录"><span class="num">{{ curUser.lastLoginTime }}</span></el-descriptions-item>
          <el-descriptions-item label="入职日期"><span class="num">{{ curUser.entryDate }}</span></el-descriptions-item>
        </el-descriptions>

        <div class="sub-title">任务概览</div>
        <div class="dt-kpi">
          <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-warning)">{{ curUser.taskCount.pending }}</div><div class="dt-kpi__l">待办</div></div>
          <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-primary)">{{ curUser.taskCount.processing }}</div><div class="dt-kpi__l">在办</div></div>
          <div class="dt-kpi__c"><div class="dt-kpi__v num" style="color: var(--zh-success)">{{ curUser.taskCount.completed }}</div><div class="dt-kpi__l">已办结</div></div>
          <div class="dt-kpi__c"><div class="dt-kpi__v num">{{ ((curUser.taskCount.completed / Math.max(1, curUser.taskCount.pending + curUser.taskCount.processing + curUser.taskCount.completed)) * 100).toFixed(0) }}%</div><div class="dt-kpi__l">办结率</div></div>
        </div>

        <el-alert type="info" :closable="false" show-icon style="margin-top: 14px">
          <template #title>
            <span class="text-mini">角色调整与数据范围变更需人事处初审 + 系统管理员复审（RC-004）；密码重置与账号停用操作全程审计留痕。</span>
          </template>
        </el-alert>
      </template>
    </el-drawer>

    <!-- ============ 角色权限抽屉 ============ -->
    <el-drawer v-model="rDrawer" size="640px" title="角色权限详情">
      <template v-if="curRole">
        <div v-loading="rDetailLoading">
          <div class="dt-hero">
            <div class="dt-hero__t">
              {{ curRole.roleName }}
              <el-tag size="small" :type="curRole.roleType === '系统角色' ? 'primary' : 'warning'" effect="plain">{{ curRole.roleType }}</el-tag>
              <el-tag :type="curRole.status === '启用' ? 'success' : 'info'" size="small" effect="dark">{{ curRole.status }}</el-tag>
            </div>
            <div class="dt-hero__m">
              <span><el-icon><Ticket /></el-icon>{{ curRole.roleCode }}</span>
              <span><el-icon><User /></el-icon>{{ curRole.userCount }} 人</span>
              <span><el-icon><Aim /></el-icon>数据范围：{{ curRole.dataScope }}</span>
            </div>
            <div class="dt-hero__d">{{ curRole.description }}</div>
          </div>

          <div class="sub-title">功能权限分配（勾选后保存生效）</div>
          <div v-for="(perms, module) in MODULE_PERMS" :key="module" class="perm">
            <div class="perm__m">
              <el-checkbox
                :model-value="(permEdit[module] || []).length === perms.length"
                :indeterminate="(permEdit[module] || []).length > 0 && (permEdit[module] || []).length < perms.length"
                @change="(v: any) => { permEdit[module] = v ? [...perms] : [] }">
                {{ module }}
              </el-checkbox>
            </div>
            <div class="perm__ps">
              <el-checkbox-group v-model="permEdit[module]">
                <el-checkbox v-for="p in perms" :key="p" :label="p" style="margin-right: 10px" />
              </el-checkbox-group>
            </div>
          </div>

          <div class="dt-actions">
            <el-button type="primary" :loading="permSaving" :icon="'CircleCheck'" @click="doSavePerms">保存权限配置</el-button>
          </div>

          <template v-if="!curRole.functionalPermissions?.length && curRole.permissionSummary?.length">
            <div class="sub-title">权限摘要</div>
            <el-tag v-for="p in curRole.permissionSummary" :key="p" size="small" effect="plain" style="margin: 0 4px 4px 0">{{ p }}</el-tag>
          </template>

          <template v-if="curRole.fieldPermissions">
            <div class="sub-title">字段级数据权限</div>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item v-for="(v, k) in curRole.fieldPermissions" :key="k" :label="String(k)">{{ v }}</el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="curRole.changeHistory?.length">
            <div class="sub-title">权限变更历史</div>
            <el-timeline>
              <el-timeline-item v-for="h in curRole.changeHistory" :key="h.version" :timestamp="h.date" size="normal">
                <div class="tl__n">{{ h.version }} · {{ h.change }}</div>
                <div class="tl__d">操作人：{{ h.operator }}</div>
              </el-timeline-item>
            </el-timeline>
          </template>
        </div>
      </template>
    </el-drawer>

    <!-- ============ 人员新增 / 编辑弹窗 ============ -->
    <el-dialog v-model="ufVisible" :title="ufEditing ? '编辑人员' : '新增人员'" width="620px" destroy-on-close>
      <el-alert v-if="ufEditing" type="warning" :closable="false" show-icon style="margin-bottom: 12px">
        <template #title>
          <span class="text-mini">角色或数据范围变更将触发 RC-004 双人复核（人事处初审 + 系统管理员复审）。</span>
        </template>
      </el-alert>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="姓名" required>
              <el-input v-model="uf.userName" placeholder="真实姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="登录账号" required>
              <el-input v-model="uf.account" placeholder="拼音账号" :disabled="!!ufEditing" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属组织" required>
              <el-select v-model="uf.orgName" style="width: 100%">
                <el-option v-for="o in ['基金监管处', '基金监管处稽核一组', '基金监管处稽核二组', '基金监管处稽核三组', '法制科', '信息中心', '人事处', '医保中心']" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="岗位">
              <el-input v-model="uf.position" placeholder="如：稽核员" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号">
              <el-input v-model="uf.phone" placeholder="用于MFA短信验证" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账号状态" required>
              <el-radio-group v-model="uf.status">
                <el-radio-button label="在职" /><el-radio-button label="停用" />
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="角色分配" required>
          <el-checkbox-group v-model="uf.roles">
            <el-checkbox v-for="r in ROLE_OPTIONS" :key="r" :label="r" style="margin-right: 14px" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="数据范围" required>
          <el-radio-group v-model="uf.dataScope">
            <el-radio-button label="全市" /><el-radio-button label="本处室" /><el-radio-button label="本组" /><el-radio-button label="本人" />
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ufVisible = false">取消</el-button>
        <el-button type="primary" :loading="ufSaving" @click="doSaveUser">{{ ufEditing ? '保存' : '创建账号' }}</el-button>
      </template>
    </el-dialog>

    <!-- ============ 角色新增弹窗 ============ -->
    <el-dialog v-model="rfVisible" title="新增角色" width="560px" destroy-on-close>
      <el-form label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="角色名称" required>
              <el-input v-model="rForm.roleName" placeholder="如：飞行检查员" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色编码" required>
              <el-input v-model="rForm.roleCode" placeholder="如：FLIGHT_AUDITOR" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色类型" required>
              <el-radio-group v-model="rForm.roleType">
                <el-radio-button label="系统角色" /><el-radio-button label="自定义角色" />
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据范围" required>
              <el-select v-model="rForm.dataScope" style="width: 100%">
                <el-option v-for="s in ['全市', '本处室', '本组', '本人']" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="角色描述">
          <el-input v-model="rForm.description" type="textarea" :rows="2" placeholder="角色职责说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rfVisible = false">取消</el-button>
        <el-button type="primary" :loading="rfSaving" @click="doSaveRole">创建角色</el-button>
      </template>
    </el-dialog>

    <!-- ============ 复核配置编辑弹窗 ============ -->
    <el-dialog v-model="rcfVisible" title="编辑双人复核配置" width="660px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="场景名称">
          <el-input v-model="rcf.sceneName" disabled />
        </el-form-item>
        <el-form-item label="触发条件" required>
          <el-input v-model="rcf.triggerCondition" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item v-for="(lv, i) in rcf.levels" :key="i" :label="`L${lv.level} ${lv.levelName}`">
          <div class="rcf-level">
            <span class="rcf-level__role">{{ lv.reviewerRole }}</span>
            <el-input v-model="lv.timeLimit" style="width: 110px" size="small" placeholder="时限" />
            <el-input v-model="lv.timeoutAction" style="flex: 1" size="small" placeholder="超时处理动作" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rcfVisible = false">取消</el-button>
        <el-button type="primary" :loading="rcfSaving" @click="doSaveRc">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.org-grid {
  display: grid; grid-template-columns: 260px 1fr; gap: 12px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

.org-tree :deep(.el-tree-node__content) { height: 30px; }

.org-node {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 6px; border-radius: 4px;

  &.is-active { background: var(--zh-primary-lighter); color: var(--zh-primary); font-weight: 700; }
  &__l { font-size: 11.5px; }
  &__c {
    padding: 0 5px; border-radius: 8px;
    background: var(--zh-info-light); color: var(--zh-text-secondary);
    font-size: 9.5px; font-weight: 700;
  }
}

.rc-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
}

.rc {
  &__h {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  &__ops { display: inline-flex; align-items: center; gap: 6px; }
  &__n { font-size: 13.5px; font-weight: 700; color: var(--zh-text-primary); }
  &__d { margin-top: 5px; line-height: 1.7; }
  &__cond {
    display: flex; align-items: center; gap: 5px; margin-top: 8px;
    padding: 6px 9px; border-radius: 5px;
    background: var(--zh-warning-light); border: 1px solid var(--zh-risk-mid-border);
    font-size: 10.5px; color: var(--zh-text-regular);
    :deep(.el-icon) { color: var(--zh-warning); }
  }

  &__flow {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 10px;
  }
  &__arrow { color: var(--zh-text-placeholder); }

  &__kpi {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 12px;
    padding-top: 10px; border-top: 1px dashed var(--zh-border-light);

    > div {
      text-align: center;
      b { display: block; font-size: 14px; font-weight: 800; color: var(--zh-text-primary); }
      span { font-size: 9px; color: var(--zh-text-secondary); }
    }
  }
}

.rlv {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 9px; border-radius: 5px;
  background: var(--zh-bg-soft); border: 1px solid var(--zh-border-light);
  font-size: 10.5px;

  &__lv {
    width: 20px; height: 20px; border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    background: var(--zh-primary); color: #fff; font-size: 9.5px; font-weight: 800;
  }
  b { color: var(--zh-text-primary); }
  &__role { color: var(--zh-text-secondary); }
  &__tl { color: var(--zh-warning); font-weight: 700; }
}

.perm {
  display: flex; gap: 10px; margin-bottom: 8px;

  &__m {
    flex-shrink: 0; width: 110px; padding-top: 3px;
    font-size: 11px; font-weight: 700; color: var(--zh-text-primary);
  }
  &__ps { flex: 1; }
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

.dt-kpi {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px;

  &__c {
    padding: 9px 6px; text-align: center;
    border-radius: 6px; background: var(--zh-bg-soft);
    border: 1px solid var(--zh-border-light);
  }
  &__v { font-size: 14px; font-weight: 700; color: var(--zh-text-primary); }
  &__l { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; }
}

.tl__n { font-size: var(--zh-fs-xs); font-weight: 700; color: var(--zh-text-primary); }
.tl__d { font-size: 10px; color: var(--zh-text-secondary); margin-top: 2px; line-height: 1.6; }

.rcf-level {
  display: flex; align-items: center; gap: 8px; width: 100%;

  &__role {
    flex-shrink: 0; min-width: 96px;
    font-size: 11px; font-weight: 700; color: var(--zh-text-primary);
  }
}
</style>
