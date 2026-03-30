import { z } from 'zod'
import { buildSubmissionScreenshotEntries } from './claimScreenshots.js'

// 用户名验证
const usernameSchema = z.string()
  .min(2, '用户名至少2个字符')
  .max(20, '用户名最多20个字符')
  .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文')

const PASSWORD_BLOCKLIST = new Set([
  'password',
  'password123',
  'admin123',
  'reviewer123',
  'test123',
  'client123',
  '12345678',
  'qwerty123',
  'xiaohuangyu',
  'xiaohuangyu123'
])

// 用户注册 / 修改密码 / 管理端重置密码
export const strongPasswordSchema = z.string()
  .min(8, '密码至少8个字符')
  .max(50, '密码最多50个字符')
  .regex(/[a-z]/, '密码需包含小写字母')
  .regex(/[A-Z]/, '密码需包含大写字母')
  .regex(/\d/, '密码需包含数字')
  .refine((pwd) => !PASSWORD_BLOCKLIST.has(String(pwd).toLowerCase()), {
    message: '密码过于简单，请更换为更复杂的组合'
  })

const passwordSchema = strongPasswordSchema

// 手机号验证（注册必填）
const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的11位手机号')

// 注册验证
export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  phone: phoneSchema,
  inviteCode: z.string().max(20, '邀请码最多20个字符').optional().or(z.literal('')),
  registrationCode: z.string().max(32, '注册码最多32个字符').optional().or(z.literal('')),
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

// 登录验证（账号框可填用户名或手机号）+ 数字验证码（自动化测试可设 SKIP_USER_LOGIN_CAPTCHA=1 跳过）
const skipUserLoginCaptcha = process.env.SKIP_USER_LOGIN_CAPTCHA === '1'

export const loginSchema = skipUserLoginCaptcha
  ? z.object({
      username: z.string().min(1, '请输入用户名或手机号'),
      password: z.string().min(1, '请输入密码')
    })
  : z.object({
      username: z.string().min(1, '请输入用户名或手机号'),
      password: z.string().min(1, '请输入密码'),
      captchaId: z.string().uuid('请刷新验证码后重试'),
      captchaCode: z.string().min(1, '请输入4位数字验证码')
    })

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: passwordSchema
})

// 任务领取验证
export const claimTaskSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  city: z.string().optional(),
  province: z.string().optional()
})

// 任务提交验证
const screenshotItemSchema = z.union([
  z.string().min(1, '截图不能为空'),
  z.object({
    url: z.string().min(1, '截图不能为空'),
    role: z.string().optional(),
    sortOrder: z.number().optional()
  }).passthrough()
])

export const submitTaskSchema = z.object({
  platformNickname: z.string().max(50, '昵称最多50个字符').optional(), // 改为可选
  screenshots: z.array(screenshotItemSchema)
    .min(2, '请至少上传2张截图')
    .max(5, '最多上传5张截图')
    .transform((items) => buildSubmissionScreenshotEntries(items)),
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
