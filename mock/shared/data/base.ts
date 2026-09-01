/**
 * Mock 基础数据集 —— 全局口径唯一来源
 * 采用确定性伪随机（seed），保证每次启动数据一致、跨页面数值自洽
 */

/* ---------------- 确定性随机工具 ---------------- */
let _seed = 20260829
export function rnd(): number {
  _seed = (_seed * 9301 + 49297) % 233280
  return _seed / 233280
}
export function resetSeed(s = 20260829) {
  _seed = s
}
export function rndInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}
export function pickMany<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  }
  return out
}
export function pad(n: number, len: number): string {
  return String(n).padStart(len, '0')
}
export function money(min: number, max: number): number {
  return Math.round((rnd() * (max - min) + min) * 100) / 100
}
/** 生成 yyyy-MM-dd HH:mm:ss */
export function dt(dayOffset: number, hour = 9, minute = 0, second = 0): string {
  const base = new Date(2026, 7, 29, hour, minute, second)
  base.setDate(base.getDate() + dayOffset)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())} ${p(base.getHours())}:${p(base.getMinutes())}:${p(base.getSeconds())}`
}
export function d(dayOffset: number): string {
  return dt(dayOffset).slice(0, 10)
}

/* ---------------- 行政区划 ---------------- */
export const DISTRICTS = ['镜湖区', '鸠江区', '弋江区', '湾沚区', '繁昌区', '南陵县', '无为市'] as const

/* ---------------- 定点机构（60家） ---------------- */
export interface MockOrg {
  orgCode: string
  orgName: string
  orgType: string
  level: string
  district: string
  creditScore: number
  clueCount: number
  contact: string
  phone: string
}

const HOSPITAL_SEED: Array<[string, string, string, string]> = [
  ['芜湖市第一人民医院', '三级医院', '三级甲等', '镜湖区'],
  ['皖南医学院弋矶山医院', '三级医院', '三级甲等', '镜湖区'],
  ['皖南医学院第二附属医院', '三级医院', '三级甲等', '弋江区'],
  ['芜湖市第二人民医院', '三级医院', '三级甲等', '鸠江区'],
  ['芜湖市中医医院', '三级医院', '三级甲等', '镜湖区'],
  ['芜湖市第五人民医院', '二级医院', '二级甲等', '弋江区'],
  ['芜湖市妇幼保健院', '三级医院', '三级乙等', '镜湖区'],
  ['湾沚区人民医院', '二级医院', '二级甲等', '湾沚区'],
  ['繁昌区人民医院', '二级医院', '二级甲等', '繁昌区'],
  ['南陵县人民医院', '二级医院', '二级甲等', '南陵县'],
  ['无为市人民医院', '二级医院', '二级甲等', '无为市'],
  ['芜湖市康复医院', '二级医院', '二级乙等', '鸠江区'],
  ['芜湖广济医院', '二级医院', '二级乙等', '镜湖区'],
  ['芜湖仁济医院', '一级医院', '一级甲等', '弋江区'],
  ['芜湖同仁医院', '一级医院', '一级甲等', '鸠江区'],
  ['镜湖区北门街道社区卫生服务中心', '社区卫生服务中心', '基层', '镜湖区'],
  ['镜湖区赭山街道社区卫生服务中心', '社区卫生服务中心', '基层', '镜湖区'],
  ['鸠江区官陡街道社区卫生服务中心', '社区卫生服务中心', '基层', '鸠江区'],
  ['鸠江区四褐山社区卫生服务中心', '社区卫生服务中心', '基层', '鸠江区'],
  ['弋江区利民路社区卫生服务中心', '社区卫生服务中心', '基层', '弋江区'],
  ['弋江区马塘街道社区卫生服务中心', '社区卫生服务中心', '基层', '弋江区'],
  ['湾沚区六郎镇卫生院', '社区卫生服务中心', '基层', '湾沚区'],
  ['繁昌区孙村镇卫生院', '社区卫生服务中心', '基层', '繁昌区'],
  ['南陵县籍山镇卫生院', '社区卫生服务中心', '基层', '南陵县'],
  ['无为市襄安镇卫生院', '社区卫生服务中心', '基层', '无为市'],
  ['芜湖惠民门诊部', '基层诊所', '基层', '镜湖区'],
  ['芜湖济仁中医门诊部', '基层诊所', '基层', '鸠江区'],
  ['芜湖安康口腔诊所', '基层诊所', '基层', '弋江区']
]

const PHARMACY_SEED: Array<[string, string]> = [
  ['芜湖益丰大药房（中山路店）', '镜湖区'],
  ['芜湖益丰大药房（北京路店）', '镜湖区'],
  ['芜湖国胜大药房（银湖路店）', '鸠江区'],
  ['芜湖国胜大药房（万春店）', '鸠江区'],
  ['芜湖老百姓大药房（步行街店）', '镜湖区'],
  ['芜湖老百姓大药房（弋江嘉园店）', '弋江区'],
  ['芜湖大参林药店（凤鸣湖店）', '弋江区'],
  ['芜湖大参林药店（保兴垾店）', '镜湖区'],
  ['芜湖华人健康大药房（长江路店）', '镜湖区'],
  ['芜湖华人健康大药房（绿地店）', '鸠江区'],
  ['芜湖同仁堂药店（镜湖店）', '镜湖区'],
  ['芜湖康德乐大药房', '弋江区'],
  ['芜湖仁和堂大药房（湾沚店）', '湾沚区'],
  ['芜湖百姓缘大药房（繁昌店）', '繁昌区'],
  ['芜湖德善堂大药房（南陵店）', '南陵县'],
  ['芜湖济世堂大药房（无为店）', '无为市'],
  ['芜湖恒生大药房（赭山店）', '镜湖区'],
  ['芜湖九州通大药房', '鸠江区'],
  ['芜湖万家福大药房', '弋江区'],
  ['芜湖健之佳药店（万达店）', '镜湖区'],
  ['芜湖漱玉平民大药房', '鸠江区'],
  ['芜湖立健药店（三山店）', '繁昌区'],
  ['芜湖百信大药房', '南陵县'],
  ['芜湖天济堂大药房', '无为市'],
  ['芜湖民生大药房（凤凰美食街店）', '镜湖区'],
  ['芜湖济民康大药房', '湾沚区'],
  ['芜湖安泰大药房', '弋江区'],
  ['芜湖普康大药房', '鸠江区'],
  ['芜湖长寿堂大药房', '镜湖区'],
  ['芜湖惠仁大药房', '弋江区'],
  ['芜湖三九药店（银湖店）', '鸠江区'],
  ['芜湖福康大药房', '繁昌区']
]

resetSeed(11001)
export const ORGS: MockOrg[] = [
  ...HOSPITAL_SEED.map((h, i) => ({
    orgCode: `H3402${pad(i + 1, 5)}`,
    orgName: h[0],
    orgType: h[1],
    level: h[2],
    district: h[3],
    creditScore: rndInt(62, 99),
    clueCount: rndInt(2, 46),
    contact: `${pick(['张', '李', '王', '陈', '刘', '杨', '赵', '周'])}${pick(['主任', '科长', '经理'])}`,
    phone: `0553-${rndInt(2000000, 8999999)}`
  })),
  ...PHARMACY_SEED.map((p, i) => ({
    orgCode: `Y3402${pad(i + 1, 5)}`,
    orgName: p[0],
    orgType: '零售药店',
    level: '医保定点',
    district: p[1],
    creditScore: rndInt(55, 97),
    clueCount: rndInt(1, 38),
    contact: `${pick(['张', '李', '王', '陈', '刘', '孙', '徐'])}${pick(['店长', '经理', '负责人'])}`,
    phone: `0553-${rndInt(2000000, 8999999)}`
  }))
]

export const HOSPITALS = ORGS.filter((o) => o.orgCode.startsWith('H'))
export const PHARMACIES = ORGS.filter((o) => o.orgCode.startsWith('Y'))

/* ---------------- 科室与医生（130人） ---------------- */
export const DEPTS = [
  '内分泌科',
  '心血管内科',
  '呼吸内科',
  '消化内科',
  '神经内科',
  '肾内科',
  '骨科',
  '普外科',
  '肿瘤科',
  '康复医学科',
  '中医科',
  '疼痛科',
  '眼科',
  '口腔科',
  '皮肤科',
  '妇产科',
  '儿科',
  '全科医疗科'
] as const

const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗']
const GIVEN = ['建国', '志强', '明华', '晓东', '文斌', '国庆', '海燕', '丽娟', '秀兰', '桂芳', '雅雯', '晨光', '子涵', '天宇', '嘉伦', '梦洁', '振华', '思远']

export interface MockDoctor {
  doctorId: string
  name: string
  title: string
  dept: string
  orgCode: string
  orgName: string
  multiOrg: string[]
  clueCount: number
  practiceYears: number
}

resetSeed(22002)
export const DOCTORS: MockDoctor[] = Array.from({ length: 130 }, (_, i) => {
  const org = pick(HOSPITALS)
  const multi = rnd() > 0.86 ? [org.orgName, pick(HOSPITALS).orgName] : [org.orgName]
  return {
    doctorId: `D${pad(i + 1, 4)}`,
    name: `${pick(SURNAMES)}${pick(GIVEN)}`,
    title: pick(['主任医师', '副主任医师', '主治医师', '医师', '主任药师', '副主任药师']),
    dept: pick(DEPTS),
    orgCode: org.orgCode,
    orgName: org.orgName,
    multiOrg: [...new Set(multi)],
    clueCount: rndInt(0, 12),
    practiceYears: rndInt(3, 35)
  }
})

/* ---------------- 参保人（180人） ---------------- */
export interface MockPatient {
  patientId: string
  name: string
  gender: '男' | '女'
  age: number
  insuranceType: string
  district: string
  chronicDisease: string[]
  clueCount: number
  cardNo: string
}

const CHRONIC = ['2型糖尿病', '高血压2级', '冠心病', '慢性肾病3期', '慢性阻塞性肺疾病', '脑卒中后遗症', '类风湿关节炎', '高脂血症', '甲状腺功能减退', '帕金森病']

resetSeed(33003)
export const PATIENTS: MockPatient[] = Array.from({ length: 180 }, (_, i) => {
  const gender = rnd() > 0.48 ? '男' : ('女' as const)
  const age = rndInt(6, 88)
  const birth = 2026 - age
  return {
    patientId: `P3402${birth}${pad(rndInt(1, 12), 2)}${pad(rndInt(1, 28), 2)}${pad(i + 1, 4)}`,
    name: `${pick(SURNAMES)}${pick(GIVEN)}`,
    gender: gender as '男' | '女',
    age,
    insuranceType: age >= 60 ? pick(['离退休职工', '职工医保', '居民医保']) : pick(['职工医保', '居民医保', '特殊病种']),
    district: pick(DISTRICTS),
    chronicDisease: age > 45 ? pickMany(CHRONIC, rndInt(0, 3)) : pickMany(CHRONIC, rndInt(0, 1)),
    clueCount: rndInt(0, 6),
    cardNo: `3402${rndInt(10000000, 99999999)}`
  }
})

/* ---------------- 药品 / 项目（240项） ---------------- */
export interface MockItem {
  itemCode: string
  itemName: string
  itemType: '药品' | '诊疗项目' | '检查检验' | '耗材'
  spec: string
  unitPrice: number
  category: string
  limitDays: number
  relatedClueCount: number
}

const DRUGS: Array<[string, string, number, string]> = [
  ['格列美脲片', '2mg*30片', 45.0, '降糖药'],
  ['二甲双胍片', '0.5g*20片', 30.0, '降糖药'],
  ['阿卡波糖片', '50mg*30片', 62.5, '降糖药'],
  ['西格列汀片', '100mg*7片', 128.0, '降糖药'],
  ['达格列净片', '10mg*14片', 168.0, '降糖药'],
  ['甘精胰岛素注射液', '3ml:300单位', 236.0, '降糖药'],
  ['氨氯地平片', '5mg*28片', 28.0, '降压药'],
  ['缬沙坦胶囊', '80mg*7粒', 42.6, '降压药'],
  ['沙库巴曲缬沙坦钠片', '100mg*28片', 366.0, '降压药'],
  ['美托洛尔缓释片', '47.5mg*7片', 36.4, '降压药'],
  ['阿托伐他汀钙片', '20mg*7片', 35.5, '调脂药'],
  ['瑞舒伐他汀钙片', '10mg*7片', 42.0, '调脂药'],
  ['阿司匹林肠溶片', '100mg*30片', 18.5, '抗血小板'],
  ['氯吡格雷片', '75mg*7片', 56.0, '抗血小板'],
  ['利伐沙班片', '20mg*7片', 168.0, '抗凝药'],
  ['阿莫西林胶囊', '0.25g*24粒', 15.0, '抗菌药'],
  ['头孢呋辛酯片', '0.25g*12片', 38.0, '抗菌药'],
  ['左氧氟沙星片', '0.5g*6片', 26.5, '抗菌药'],
  ['莫西沙星片', '0.4g*5片', 96.0, '抗菌药'],
  ['注射用美罗培南', '0.5g', 168.0, '抗菌药'],
  ['盐酸羟考酮缓释片', '10mg*10片', 108.0, '麻醉镇痛'],
  ['硫酸吗啡缓释片', '30mg*10片', 96.0, '麻醉镇痛'],
  ['塞来昔布胶囊', '0.2g*6粒', 68.0, '镇痛药'],
  ['艾司奥美拉唑镁肠溶片', '20mg*7片', 58.0, '抑酸药'],
  ['雷贝拉唑钠肠溶片', '10mg*14片', 62.0, '抑酸药'],
  ['孟鲁司特钠片', '10mg*7片', 46.0, '呼吸系统'],
  ['布地奈德福莫特罗吸入剂', '60吸', 246.0, '呼吸系统'],
  ['噻托溴铵粉雾剂', '18ug*10粒', 186.0, '呼吸系统'],
  ['奥美沙坦酯片', '20mg*7片', 48.0, '降压药'],
  ['左甲状腺素钠片', '50ug*100片', 36.0, '内分泌'],
  ['甲钴胺片', '0.5mg*20片', 52.0, '神经营养'],
  ['丁苯酞软胶囊', '0.1g*24粒', 468.0, '脑血管'],
  ['注射用血栓通', '0.25g', 68.0, '中成药注射剂'],
  ['丹参川芎嗪注射液', '5ml', 42.0, '中成药注射剂'],
  ['血塞通软胶囊', '0.33g*24粒', 56.0, '中成药'],
  ['复方丹参滴丸', '27mg*180丸', 32.0, '中成药'],
  ['六味地黄丸', '360丸', 26.0, '中成药'],
  ['安宫牛黄丸', '3g*1丸', 780.0, '中成药'],
  ['人血白蛋白', '10g:50ml', 428.0, '血液制品'],
  ['贝伐珠单抗注射液', '100mg/4ml', 1998.0, '抗肿瘤'],
  ['注射用曲妥珠单抗', '440mg', 5560.0, '抗肿瘤'],
  ['奥希替尼片', '80mg*30片', 5580.0, '抗肿瘤'],
  ['培美曲塞二钠', '0.5g', 1280.0, '抗肿瘤'],
  ['胸腺五肽注射液', '1mg', 88.0, '免疫调节'],
  ['骨化三醇软胶囊', '0.25ug*10粒', 46.0, '骨代谢'],
  ['碳酸钙D3片', '600mg*60片', 32.0, '钙剂'],
  ['非布司他片', '40mg*10片', 68.0, '抗痛风'],
  ['羟氯喹片', '0.1g*14片', 78.0, '免疫抑制'],
  ['他克莫司胶囊', '1mg*50粒', 986.0, '免疫抑制'],
  ['多奈哌齐片', '5mg*7片', 88.0, '神经系统']
]

const TREAT_ITEMS: Array<[string, string, number, string]> = [
  ['静脉输液（每组）', '组', 12.0, '治疗'],
  ['肌肉注射', '次', 3.0, '治疗'],
  ['心电监护', '小时', 8.0, '监护'],
  ['吸氧', '小时', 3.5, '治疗'],
  ['中医针刺', '次', 26.0, '中医治疗'],
  ['艾灸治疗', '次', 22.0, '中医治疗'],
  ['推拿治疗', '次', 38.0, '中医治疗'],
  ['拔罐治疗', '次', 18.0, '中医治疗'],
  ['中药熏蒸', '次', 46.0, '中医治疗'],
  ['运动疗法', '次', 56.0, '康复'],
  ['作业疗法', '次', 48.0, '康复'],
  ['吞咽功能训练', '次', 52.0, '康复'],
  ['言语训练', '次', 50.0, '康复'],
  ['高频电疗', '次', 26.0, '理疗'],
  ['超短波治疗', '次', 24.0, '理疗'],
  ['雾化吸入治疗', '次', 16.0, '治疗'],
  ['血液透析', '次', 420.0, '透析'],
  ['腹腔穿刺术', '次', 168.0, '手术操作'],
  ['清创缝合术', '次', 260.0, '手术操作'],
  ['一级护理', '日', 25.0, '护理'],
  ['特级护理', '日', 108.0, '护理'],
  ['床位费（三人间）', '日', 38.0, '床位'],
  ['诊查费（主任医师）', '次', 15.0, '诊查'],
  ['换药（小）', '次', 12.0, '治疗'],
  ['雷火灸', '次', 42.0, '中医治疗']
]

const EXAM_ITEMS: Array<[string, string, number, string]> = [
  ['血常规（五分类）', '项', 26.0, '检验'],
  ['尿常规', '项', 12.0, '检验'],
  ['肝功能十一项', '项', 68.0, '检验'],
  ['肾功能五项', '项', 56.0, '检验'],
  ['血脂四项', '项', 48.0, '检验'],
  ['糖化血红蛋白检测', '项', 62.0, '检验'],
  ['空腹血糖', '项', 8.0, '检验'],
  ['凝血四项', '项', 76.0, '检验'],
  ['心肌酶谱', '项', 96.0, '检验'],
  ['肌钙蛋白I定量', '项', 88.0, '检验'],
  ['甲状腺功能五项', '项', 168.0, '检验'],
  ['肿瘤标志物七项', '项', 386.0, '检验'],
  ['C反应蛋白测定', '项', 32.0, '检验'],
  ['降钙素原检测', '项', 128.0, '检验'],
  ['心电图检查', '次', 35.0, '心电'],
  ['24小时动态心电图', '次', 168.0, '心电'],
  ['心脏彩超', '次', 280.0, '超声'],
  ['颈动脉超声', '次', 180.0, '超声'],
  ['腹部超声（肝胆脾胰）', '次', 160.0, '超声'],
  ['泌尿系超声', '次', 130.0, '超声'],
  ['胸部正位X线', '次', 80.0, '放射'],
  ['腰椎正侧位X线', '次', 96.0, '放射'],
  ['胸部CT（平扫）', '次', 320.0, 'CT'],
  ['头颅CT（平扫）', '次', 280.0, 'CT'],
  ['腰椎CT（平扫）', '次', 320.0, 'CT'],
  ['腹部CT增强', '次', 680.0, 'CT'],
  ['头颅MRI（平扫）', '次', 680.0, 'MRI'],
  ['腰椎MRI（平扫）', '次', 680.0, 'MRI'],
  ['膝关节MRI', '次', 720.0, 'MRI'],
  ['PET-CT全身显像', '次', 7200.0, '核医学'],
  ['胃镜检查', '次', 380.0, '内镜'],
  ['肠镜检查', '次', 460.0, '内镜'],
  ['骨密度测定', '次', 128.0, '其他'],
  ['肺功能测定', '次', 156.0, '其他'],
  ['经颅多普勒', '次', 120.0, '超声']
]

resetSeed(44004)
export const ITEMS: MockItem[] = [
  ...DRUGS.map((x, i) => ({
    itemCode: `YP${pad(300000 + i, 6)}`,
    itemName: x[0],
    itemType: '药品' as const,
    spec: x[1],
    unitPrice: x[2],
    category: x[3],
    limitDays: x[3] === '抗菌药' ? 3 : 7,
    relatedClueCount: rndInt(0, 42)
  })),
  ...TREAT_ITEMS.map((x, i) => ({
    itemCode: `ZL${pad(i + 1, 3)}`,
    itemName: x[0],
    itemType: '诊疗项目' as const,
    spec: x[1],
    unitPrice: x[2],
    category: x[3],
    limitDays: 0,
    relatedClueCount: rndInt(0, 30)
  })),
  ...EXAM_ITEMS.map((x, i) => ({
    itemCode: `JC${pad(i + 1, 3)}`,
    itemName: x[0],
    itemType: '检查检验' as const,
    spec: x[1],
    unitPrice: x[2],
    category: x[3],
    limitDays: 0,
    relatedClueCount: rndInt(0, 36)
  }))
]

export const DRUG_ITEMS = ITEMS.filter((i) => i.itemType === '药品')
export const EXAM_LIST = ITEMS.filter((i) => i.itemType === '检查检验')
export const TREAT_LIST = ITEMS.filter((i) => i.itemType === '诊疗项目')

/* ---------------- 违规类型体系 ---------------- */
export const VIOLATION_TREE: Record<string, string[]> = {
  收费类: ['重复收费', '超标准收费', '分解收费', '虚记费用', '无指征收费', '串换项目收费'],
  用药类: ['超量开药', '重复开药', '串换药品', '超适应症用药', '虚假购药', '药品回流'],
  诊疗类: ['虚假诊疗', '过度诊疗', '套餐式检查', '做少收多', '分解住院', '挂床住院'],
  就医行为类: ['频繁就医', '重复住院', '冒名就医', '超量购药', '聚集性就医'],
  其他: ['进销存不符', '账实不符', '违规结算']
}

export const ALL_VIOLATION_TYPES = Object.values(VIOLATION_TREE).flat()

export function categoryOf(vt: string): string {
  for (const [k, v] of Object.entries(VIOLATION_TREE)) if (v.includes(vt)) return k
  return '其他'
}

/** 比对类型 → 违规类型映射（保证口径一致） */
export const COMPARE_VIOLATION_MAP: Record<string, string[]> = {
  药品进销存比对: ['虚假购药', '药品回流', '进销存不符', '账实不符', '超量开药'],
  病历结算比对: ['无指征收费', '串换项目收费', '虚记费用', '过度诊疗', '重复收费'],
  处方结算比对: ['超量开药', '重复开药', '串换药品', '超适应症用药'],
  检查检验比对: ['虚记费用', '重复收费', '套餐式检查', '做少收多'],
  就医行为比对: ['频繁就医', '重复住院', '冒名就医', '超量购药', '聚集性就医', '分解住院', '挂床住院']
}

export const COMPARE_TYPES = Object.keys(COMPARE_VIOLATION_MAP)

/** 规则库（含命中/误判统计，供误判反馈模块复用） */
export interface MockRule {
  ruleId: string
  ruleName: string
  category: string
  hitCount: number
  misjudgeCount: number
  threshold: string
  status: '启用' | '优化中' | '停用'
  version: string
}

resetSeed(55005)
export const RULES: MockRule[] = [
  ['RULE-DRUG-003', '慢性病开药不超过7日量', '用药类', '7日量'],
  ['RULE-DRUG-005', '长处方不超过12周', '用药类', '84日量'],
  ['RULE-DRUG-008', '抗菌药门诊不超过3日量', '用药类', '3日量'],
  ['RULE-DRUG-012', '同药品跨机构30日内重复开具', '用药类', '30日/2次'],
  ['RULE-DRUG-021', '药品结算量超进销存出库量5%', '其他', '差异>5%'],
  ['RULE-FEE-002', '同一项目同日重复收费', '收费类', '同日>1次'],
  ['RULE-FEE-007', '病历无记载项目收费', '收费类', '零匹配'],
  ['RULE-FEE-011', '检查项目无报告记录', '收费类', '零报告'],
  ['RULE-FEE-015', '收费项目超医保限价', '收费类', '超限价'],
  ['RULE-TRT-004', '诊断与项目适应症不符', '诊疗类', '语义不符'],
  ['RULE-TRT-009', '出院7日内同诊断再入院', '诊疗类', '<7日'],
  ['RULE-TRT-013', '住院期间无医嘱执行记录（挂床）', '诊疗类', '0记录/日'],
  ['RULE-TRT-016', '单次就诊检查项目数>8项', '诊疗类', '>8项'],
  ['RULE-BHV-002', '月门诊次数>15次', '就医行为类', '>15次/月'],
  ['RULE-BHV-005', '同时段多机构住院', '就医行为类', '时段重叠'],
  ['RULE-BHV-008', '就医记录与年龄性别不符', '就医行为类', '逻辑冲突'],
  ['RULE-BHV-011', '同机构同日聚集性就医>20人同诊断', '就医行为类', '>20人']
].map(([ruleId, ruleName, category, threshold]) => {
  const hit = rndInt(180, 2600)
  return {
    ruleId: ruleId as string,
    ruleName: ruleName as string,
    category: category as string,
    threshold: threshold as string,
    hitCount: hit,
    misjudgeCount: Math.round(hit * (rnd() * 0.09 + 0.005)),
    status: pick(['启用', '启用', '启用', '优化中']) as '启用' | '优化中' | '停用',
    version: `v2.${rndInt(1, 6)}.${rndInt(0, 9)}`
  }
})

/* ---------------- 稽核员 ---------------- */
export const AUDITORS = [
  '稽核员·王振华',
  '稽核员·李明华',
  '稽核员·陈晓东',
  '稽核员·刘丽娟',
  '稽核员·周文斌',
  '稽核员·徐海燕',
  '稽核组长·张建国',
  '稽核组长·赵桂芳'
]

export const AUDIT_GROUPS = ['稽核一组', '稽核二组', '稽核三组', '基金监管处', '飞行检查组']

/* ---------------- 专家库 ---------------- */
export interface MockExpert {
  expertId: string
  name: string
  title: string
  org: string
  specialty: string
  experience: number
  score: number
  tags: string[]
}

resetSeed(66006)
export const EXPERTS: MockExpert[] = [
  ['王振国', '主任医师/教授', '皖南医学院', '内分泌学', ['糖尿病用药', '长处方管理']],
  ['陈桂兰', '主任药师', '芜湖市中医医院', '临床药学', ['合理用药', '药占比分析']],
  ['李海峰', '主任医师', '皖南医学院弋矶山医院', '心血管内科', ['介入耗材', '冠脉诊疗规范']],
  ['刘振华', '主任医师', '芜湖市第一人民医院', '肿瘤学', ['抗肿瘤药适应症', '靶向药限定支付']],
  ['周晓明', '主任医师', '皖南医学院第二附属医院', '骨科', ['骨科耗材', '影像检查指征']],
  ['徐丽娟', '副主任医师', '芜湖市第二人民医院', '呼吸内科', ['雾化治疗', '抗菌药物管理']],
  ['赵建国', '主任医师', '芜湖市康复医院', '康复医学', ['康复项目频次', '理疗合理性']],
  ['马文斌', '主任医师', '芜湖市中医医院', '中医内科', ['中医适宜技术', '针灸推拿规范']],
  ['孙雅雯', '副主任药师', '芜湖市妇幼保健院', '临床药学', ['儿科用药剂量', '妇产用药']],
  ['胡国庆', '资深稽核专家', '芜湖市医疗保障局', '基金监管', ['进销存核查', '票据鉴证']],
  ['郭明华', '资深稽核专家', '安徽省医疗保障局', '基金监管', ['大数据比对', '飞检实务']],
  ['何秀兰', '主任医师', '芜湖市第五人民医院', '精神心理科', ['精神类住院管理', '挂床识别']]
].map((e, i) => ({
  expertId: `EXP${pad(i + 1, 3)}`,
  name: e[0] as string,
  title: e[1] as string,
  org: e[2] as string,
  specialty: e[3] as string,
  experience: rndInt(12, 32),
  score: rndInt(82, 99),
  tags: e[4] as string[]
}))
