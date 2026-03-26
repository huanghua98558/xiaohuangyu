import { z } from 'zod'

// 用户名验证
const usernameSchema = z.string()
  .min(2, '用户名至少2个字符')
  .max(20, '用户名最多20个字符')
  .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文')

// 密码验证
const passwordSchema = z.string()
  .min(6, '密码至少6个字符')
  .max(50, '密码最多50个字符')

// 手机号验证
const phoneSchema = z.string()
  .regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号')
  .optional()
  .or(z.literal(''))

// 注册验证
export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  phone: phoneSchema,
  inviteCode: z.string().max(20, '邀请码最多20个字符').optional(),
  // 协议同意 - 使用transform确保必填且为true
  agreedToPrivacy: z.boolean({
    required_error: '请阅读并同意隐私政策',
    invalid_type_error: '请阅读并同意隐私政策'
  }).refine(val => val === true, { message: '请阅读并同意隐私政策' }),
  agreedToTerms: z.boolean({
    required_error: '请阅读并同意用户协议',
    invalid_type_error: '请阅读并同意用户协议'
  }).refine(val => val === true, { message: '请阅读并同意用户协议' })
}).strict()

// 登录验证
export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码')
})

// 任务领取验证
export const claimTaskSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  city: z.string().optional(),
  province: z.string().optional()
})

// 任务提交验证
// screenshots 存储的是对象存储的 key（如 "images/2024/03/13/xxx.jpg"）
export const submitTaskSchema = z.object({
  platformNickname: z.string().max(50, '昵称最多50个字符').optional(), // 改为可选
  screenshots: z.array(z.string().min(1, '截图不能为空')).min(2, '请至少上传2张截图').max(5, '最多上传5张截图'),
  evaluation: z.string().max(500, '评价最多500个字符').optional() // 短视频评价
})

// 积分兑换验证
export const convertPointsSchema = z.object({
  points: z.number().int('积分必须是整数').positive('兑换积分必须大于0')
})

// 提现验证
export const withdrawSchema = z.object({
  amount: z.number().positive('提现金额必须大于0')
})

// 审核验证
export const reviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'paid'], { message: '操作类型必须是approve、reject或paid' }),
  note: z.string().max(200, '备注最多200个字符').optional()
})

// 字符串数组字段验证（支持数组或JSON字符串）
const stringArraySchema = z.preprocess((val) => {
  // 如果是 undefined 或 null，返回空数组
  if (val === undefined || val === null) return []
  // 如果已经是数组，直接返回
  if (Array.isArray(val)) return val
  // 如果是字符串，尝试解析
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : [val]
    } catch {
      return val ? [val] : []
    }
  }
  return []
}, z.array(z.string()).max(10, '最多10项'))

// 创建任务验证
export const createTaskSchema = z.object({
  title: z.string().min(1, '请输入任务标题').max(100, '标题最多100个字符'),
  platform: z.enum(['抖音', '小红书', '快手', '视频号'], { message: '平台类型无效，只支持：抖音、小红书、快手、视频号' }),
  action: z.enum(['short_video_research'], { message: '行为类型无效' }),
  videoUrl: z.string().max(2000, '链接最多2000个字符').optional().or(z.literal('')),
  description: z.string().min(1, '请输入任务说明').max(2000, '说明最多2000个字符'),
  templateImages: stringArraySchema,
  requirements: stringArraySchema,
  reward: z.number().int('奖励必须是整数').positive('奖励必须大于0'),
  remain: z.number().int('名额必须是整数').nonnegative('名额不能为负').default(10),
  timeLimitMinutes: z.number().int('时效必须是整数').positive('时效必须大于0').default(15),
  cityLimit: z.number().int().positive().default(1),
  provinceLimit: z.number().int().positive().default(4)
})

// 更新任务验证
export const updateTaskSchema = createTaskSchema.partial()

// 验证中间件工厂
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body
    const result = schema.safeParse(data)
    
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message).join('; ')
      return res.status(400).json({ code: 400, message: errors, data: null })
    }
    
    req.validatedData = result.data
    next()
  }
}
