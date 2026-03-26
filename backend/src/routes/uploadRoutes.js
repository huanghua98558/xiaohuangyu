/**
 * 图片上传路由 - 支持自动压缩到150KB
 */

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { success, error } from '../utils/response.js'
import logger from '../utils/logger.js'
import localStorage from '../services/localStorageService.js'

const router = Router()

// 内存存储（用于压缩处理）
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  // 只允许图片
  if (file.mimetype.startsWith('image/')) {
    cb(null, true)
  } else {
    cb(new Error('只允许上传图片文件'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB（压缩前）
  }
})

/**
 * POST /api/admin/upload/audit-images
 * 上传审核截图（自动压缩到150KB）
 */
router.post('/audit-images', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return error(res, '请至少上传一张图片', 400)
    }
    
    const files = []
    
    for (const file of req.files) {
      // 上传并压缩
      const result = await localStorage.uploadImage({
        buffer: file.buffer,
        originalName: file.originalname,
        type: 'audit',
        compress: true,
        targetSize: 150 * 1024 // 150KB
      })
      
      files.push({
        originalName: file.originalname,
        filename: result.filename,
        path: result.path,
        url: result.url,
        size: result.size,
        compression: result.compression
      })
    }
    
    logger.info(`上传了 ${files.length} 张审核图片`, {
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    })
    
    success(res, {
      message: '上传成功',
      count: files.length,
      files
    })
    
  } catch (err) {
    logger.error('上传失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})

/**
 * POST /api/admin/upload/test-screenshot
 * 上传测试截图（自动压缩到150KB）
 */
router.post('/test-screenshot', upload.array('screenshots', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return error(res, '请至少上传一张截图', 400)
    }
    
    const files = []
    
    for (const file of req.files) {
      const result = await localStorage.uploadImage({
        buffer: file.buffer,
        originalName: file.originalname,
        type: 'test',
        compress: true,
        targetSize: 150 * 1024
      })
      
      files.push({
        originalName: file.originalname,
        filename: result.filename,
        path: result.path,
        url: result.url,
        size: result.size
      })
    }
    
    logger.info(`上传了 ${files.length} 张测试截图`)
    
    success(res, {
      message: '上传成功',
      count: files.length,
      files
    })
    
  } catch (err) {
    logger.error('上传失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})

/**
 * POST /api/admin/upload/example-image
 * 上传系统设置示例图片（自动压缩到150KB）
 * 用于系统配置中的示例图片上传
 */
router.post('/example-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传图片', 400)
    }
    
    // 上传并压缩
    const result = await localStorage.uploadImage({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      type: 'examples',
      compress: true,
      targetSize: 150 * 1024
    })
    
    logger.info('上传示例图片成功', {
      url: result.url,
      size: result.size,
      compression: result.compression
    })
    
    success(res, {
      message: '上传成功',
      filename: result.filename,
      url: result.url,
      size: result.size,
      compression: result.compression
    })
    
  } catch (err) {
    logger.error('上传示例图片失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})

/**
 * POST /api/admin/upload/avatar
 * 上传用户头像（自动压缩到150KB）
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传头像', 400)
    }
    
    const result = await localStorage.uploadImage({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      type: 'avatars',
      compress: true,
      targetSize: 150 * 1024
    })
    
    logger.info('上传头像成功', {
      url: result.url,
      size: result.size
    })
    
    success(res, {
      message: '上传成功',
      url: result.url,
      size: result.size
    })
    
  } catch (err) {
    logger.error('上传头像失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})

/**
 * POST /api/admin/upload/image
 * 通用图片上传（自动压缩到150KB）
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传图片', 400)
    }
    
    const result = await localStorage.uploadImage({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      type: 'images',
      compress: true,
      targetSize: 150 * 1024
    })
    
    logger.info('上传图片成功', {
      url: result.url,
      size: result.size,
      compression: result.compression
    })
    
    success(res, {
      message: '上传成功',
      url: result.url,
      size: result.size,
      compression: result.compression
    })
    
  } catch (err) {
    logger.error('上传图片失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})

/**
 * GET /api/admin/upload/stats
 * 获取存储统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const stats = localStorage.getStorageStats()
    
    success(res, {
      message: '获取成功',
      stats
    })
    
  } catch (err) {
    logger.error('获取存储统计失败:', err)
    error(res, `获取失败：${err.message}`, 500)
  }
})

/**
 * POST /api/admin/upload/cleanup
 * 清理过期文件
 */
router.post('/cleanup', (req, res) => {
  try {
    const { days = 30, type } = req.body
    
    const result = localStorage.cleanOldFiles(days, type)
    
    logger.info('清理过期文件完成', result)
    
    success(res, {
      message: '清理完成',
      ...result
    })
    
  } catch (err) {
    logger.error('清理文件失败:', err)
    error(res, `清理失败：${err.message}`, 500)
  }
})

/**
 * DELETE /api/admin/upload/file
 * 删除指定文件
 */
router.delete('/file', (req, res) => {
  try {
    const { path: filePath } = req.body
    
    if (!filePath) {
      return error(res, '请提供文件路径', 400)
    }
    
    const deleted = localStorage.deleteFile(filePath)
    
    if (deleted) {
      success(res, { message: '删除成功' })
    } else {
      error(res, '文件不存在', 404)
    }
    
  } catch (err) {
    logger.error('删除文件失败:', err)
    error(res, `删除失败：${err.message}`, 500)
  }
})

export default router

/**
 * POST /api/upload/single
 * 单图片上传（兼容旧接口）
 */
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传图片', 400)
    }
    
    // 上传并压缩
    const result = await localStorage.uploadImage({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      type: 'images',
      compress: true,
      targetSize: 150 * 1024
    })
    
    logger.info('单图片上传成功', {
      url: result.url,
      size: result.size
    })
    
    success(res, {
      key: result.relativePath,
      url: result.url
    })
    
  } catch (err) {
    logger.error('上传失败:', err)
    error(res, `上传失败：${err.message}`, 500)
  }
})
