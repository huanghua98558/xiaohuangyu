/**
 * 本地存储服务模块
 * 用于图片上传、压缩、管理等
 * 存储路径：/data/images/uploads (200G云硬盘)
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import logger from '../utils/logger.js'

// 存储配置
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads'
const MAX_FILE_SIZE = 150 * 1024 // 150KB 压缩目标

// 存储子目录
const SUB_DIRS = {
  images: 'images',      // 普通图片
  audit: 'audit',        // 审核截图
  test: 'test',          // 测试截图
  avatars: 'avatars',    // 用户头像
  examples: 'examples'   // 系统设置示例图片
}

/**
 * 初始化存储目录
 */
export function initStorage() {
  // 创建主目录
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
    logger.info('创建存储目录', { dir: STORAGE_DIR })
  }
  
  // 创建子目录
  for (const [name, subdir] of Object.entries(SUB_DIRS)) {
    const dirPath = path.join(STORAGE_DIR, subdir)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      logger.info('创建存储子目录', { dir: dirPath })
    }
  }
  
  logger.info('本地存储初始化完成', { baseDir: STORAGE_DIR })
  return true
}

/**
 * 生成文件名
 * @param {string} originalName - 原始文件名
 * @param {string} type - 类型 (images/audit/test/avatars/examples)
 * @returns {string} 文件路径
 */
export function generateFilePath(originalName, type = 'images') {
  const ext = path.extname(originalName).toLowerCase() || '.jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `${timestamp}_${random}${ext}`
  
  // 按日期分目录
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  const dirPath = path.join(STORAGE_DIR, SUB_DIRS[type] || type, String(year), month, day)
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  
  return {
    filename,
    dirPath,
    fullPath: path.join(dirPath, filename),
    relativePath: path.join(SUB_DIRS[type] || type, String(year), month, day, filename)
  }
}

/**
 * 压缩图片到指定大小
 * @param {Buffer} buffer - 图片Buffer
 * @param {number} targetSize - 目标大小（字节），默认150KB
 * @param {string} format - 输出格式 (jpeg/webp/png)
 * @returns {Promise<{buffer: Buffer, format: string, quality: number}>}
 */
export async function compressImage(buffer, targetSize = MAX_FILE_SIZE, format = 'jpeg') {
  let quality = 85
  let compressed = buffer
  let currentFormat = format
  
  // 如果已经是目标大小以下，直接返回
  if (buffer.length <= targetSize) {
    return { buffer, format: currentFormat, quality: 100 }
  }
  
  // 尝试转换为webp（更好的压缩率）
  const webpBuffer = await sharp(buffer)
    .webp({ quality: 80 })
    .toBuffer()
  
  if (webpBuffer.length <= targetSize) {
    return { buffer: webpBuffer, format: 'webp', quality: 80 }
  }
  
  // 使用二分查找合适的质量
  let minQuality = 10
  let maxQuality = 85
  
  while (minQuality < maxQuality) {
    const midQuality = Math.floor((minQuality + maxQuality) / 2)
    
    compressed = await sharp(buffer)
      .jpeg({ quality: midQuality, mozjpeg: true })
      .toBuffer()
    
    if (compressed.length <= targetSize) {
      minQuality = midQuality + 1
    } else {
      maxQuality = midQuality
    }
  }
  
  // 最终压缩
  compressed = await sharp(buffer)
    .jpeg({ quality: minQuality - 1, mozjpeg: true })
    .toBuffer()
  
  return { 
    buffer: compressed, 
    format: 'jpeg', 
    quality: minQuality - 1,
    originalSize: buffer.length,
    compressedSize: compressed.length
  }
}

/**
 * 上传图片（支持自动压缩）
 * @param {Object} options - 上传选项
 * @param {Buffer} options.buffer - 文件Buffer
 * @param {string} options.originalName - 原始文件名
 * @param {string} options.type - 类型
 * @param {boolean} options.compress - 是否压缩，默认true
 * @param {number} options.targetSize - 目标大小
 * @returns {Promise<Object>}
 */
export async function uploadImage(options) {
  const { buffer, originalName, type = 'images', compress = true, targetSize = MAX_FILE_SIZE } = options
  
  try {
    let fileBuffer = buffer
    let format = path.extname(originalName).toLowerCase().slice(1) || 'jpeg'
    let compressionInfo = null
    
    // 压缩图片
    if (compress) {
      const result = await compressImage(buffer, targetSize)
      fileBuffer = result.buffer
      format = result.format
      compressionInfo = {
        originalSize: buffer.length,
        compressedSize: result.buffer.length,
        quality: result.quality
      }
    }
    
    // 生成文件路径
    const filePath = generateFilePath(originalName.replace(/\.[^.]+$/, `.${format}`), type)
    
    // 写入文件
    fs.writeFileSync(filePath.fullPath, fileBuffer)
    
    logger.info('图片上传成功', {
      path: filePath.relativePath,
      type,
      compression: compressionInfo
    })
    
    return {
      success: true,
      filename: filePath.filename,
      path: filePath.fullPath,
      relativePath: filePath.relativePath,
      url: `/uploads/${filePath.relativePath}`,
      size: fileBuffer.length,
      compression: compressionInfo
    }
  } catch (err) {
    logger.error('图片上传失败', { error: err.message })
    throw err
  }
}

/**
 * 删除文件
 * @param {string} relativePath - 相对路径
 * @returns {boolean}
 */
export function deleteFile(relativePath) {
  try {
    const fullPath = path.join(STORAGE_DIR, '..', relativePath.replace(/^\/uploads\//, ''))
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info('文件删除成功', { path: relativePath })
      return true
    }
    
    return false
  } catch (err) {
    logger.error('文件删除失败', { error: err.message })
    return false
  }
}

/**
 * 获取存储统计
 * @returns {Object}
 */
export function getStorageStats() {
  try {
    const stats = {
      totalSize: 0,
      fileCount: 0,
      directories: {}
    }
    
    for (const [name, subdir] of Object.entries(SUB_DIRS)) {
      const dirPath = path.join(STORAGE_DIR, subdir)
      if (fs.existsSync(dirPath)) {
        const dirStats = getDirStats(dirPath)
        stats.directories[name] = dirStats
        stats.totalSize += dirStats.size
        stats.fileCount += dirStats.count
      }
    }
    
    // 获取磁盘信息
    const diskUsage = getDiskUsage(STORAGE_DIR)
    stats.diskUsage = diskUsage
    
    return stats
  } catch (err) {
    logger.error('获取存储统计失败', { error: err.message })
    return null
  }
}

/**
 * 获取目录统计
 */
function getDirStats(dirPath) {
  let size = 0
  let count = 0
  
  function traverse(dir) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        traverse(fullPath)
      } else {
        size += stat.size
        count++
      }
    }
  }
  
  traverse(dirPath)
  return { size, count }
}

/**
 * 获取磁盘使用情况
 */
function getDiskUsage(dirPath) {
  try {
    const { execSync } = require('child_process')
    const output = execSync(`df -h ${dirPath} | tail -1`).toString()
    const parts = output.trim().split(/\s+/)
    
    return {
      filesystem: parts[0],
      size: parts[1],
      used: parts[2],
      available: parts[3],
      usePercent: parts[4]
    }
  } catch (err) {
    return null
  }
}

/**
 * 清理过期文件
 * @param {number} days - 保留天数
 * @param {string} type - 类型
 * @returns {Object}
 */
export function cleanOldFiles(days = 30, type = null) {
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
  const result = { deleted: 0, size: 0 }
  
  const dirs = type ? [SUB_DIRS[type]] : Object.values(SUB_DIRS)
  
  for (const subdir of dirs) {
    const dirPath = path.join(STORAGE_DIR, subdir)
    if (!fs.existsSync(dirPath)) continue
    
    cleanDir(dirPath, cutoffTime, result)
  }
  
  logger.info('清理过期文件完成', result)
  return result
}

function cleanDir(dirPath, cutoffTime, result) {
  const files = fs.readdirSync(dirPath)
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      cleanDir(fullPath, cutoffTime, result)
      // 删除空目录
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath)
      }
    } else if (stat.mtimeMs < cutoffTime) {
      result.size += stat.size
      result.deleted++
      fs.unlinkSync(fullPath)
    }
  }
}

// 模块加载时初始化
initStorage()

export default {
  initStorage,
  generateFilePath,
  compressImage,
  uploadImage,
  deleteFile,
  getStorageStats,
  cleanOldFiles,
  STORAGE_DIR,
  SUB_DIRS,
  MAX_FILE_SIZE
}
