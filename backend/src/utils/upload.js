import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
  logger.info(`创建上传目录: ${uploadDir}`)
}

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 按日期创建子目录
    const dateDir = new Date().toISOString().split('T')[0]
    const fullDir = path.join(uploadDir, dateDir)
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true })
    }
    cb(null, fullDir)
  },
  filename: (req, file, cb) => {
    // 使用UUID作为文件名
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

// 文件过滤
const fileFilter = (req, file, cb) => {
  // 允许的图片类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'), false)
  }
}

// 创建multer实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 默认5MB
    files: 5 // 最多5个文件
  }
})

/**
 * 单文件上传中间件
 */
export const uploadSingle = upload.single('file')

/**
 * 多文件上传中间件
 */
export const uploadMultiple = upload.array('files', 5)

/**
 * 上传处理函数
 */
export function handleUpload(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          code: 400,
          message: '文件大小超出限制（最大5MB）',
          data: null
        })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          code: 400,
          message: '最多上传5个文件',
          data: null
        })
      }
      return res.status(400).json({
        code: 400,
        message: `上传失败: ${err.message}`,
        data: null
      })
    } else if (err) {
      return res.status(400).json({
        code: 400,
        message: err.message,
        data: null
      })
    }
    next()
  })
}

/**
 * 多文件上传处理函数
 */
export function handleMultipleUpload(req, res, next) {
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          code: 400,
          message: '文件大小超出限制（最大5MB）',
          data: null
        })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          code: 400,
          message: '最多上传5个文件',
          data: null
        })
      }
      return res.status(400).json({
        code: 400,
        message: `上传失败: ${err.message}`,
        data: null
      })
    } else if (err) {
      return res.status(400).json({
        code: 400,
        message: err.message,
        data: null
      })
    }
    next()
  })
}

/**
 * 获取文件的访问URL
 */
export function getFileUrl(req, filePath) {
  const relativePath = path.relative(uploadDir, filePath)
  return `/uploads/${relativePath.replace(/\\/g, '/')}`
}

export default upload
