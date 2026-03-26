/**
 * 本地文件存储模块
 * 图片存储在 /data/images/uploads 目录
 * 支持分阶段压缩和自动清理
 */

import fs from 'fs/promises'
import path from 'path'
import logger from './logger.js'

// 存储配置
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads'
const BASE_URL = process.env.BASE_URL || 'https://gczp.xyz'

// 动态加载 sharp（图片压缩）
let sharp = null
let sharpAvailable = false

import('sharp')
  .then((module) => {
    sharp = module.default || module
    sharpAvailable = true
    logger.info('sharp 模块加载成功，图片压缩功能可用')
  })
  .catch((e) => {
    logger.warn('sharp 模块加载失败，图片压缩功能不可用:', e.message)
  })

/**
 * 图片压缩配置
 */
const IMAGE_CONFIG = {
  // 上传时压缩（活跃期）
  upload: {
    quality: 70,
    maxWidth: 1920,
    maxHeight: 1080,
    targetSizeKB: 150
  },
  // 归档压缩（15天后）
  archive: {
    quality: 40,
    maxWidth: 960,
    maxHeight: 540,
    targetSizeKB: 50
  }
}

/**
 * 压缩图片
 * @param {Buffer} imageBuffer - 原始图片
 * @param {string} mode - 'upload' 或 'archive'
 * @returns {Promise<Buffer>}
 */
async function compressImage(imageBuffer, mode = 'upload') {
  if (!sharpAvailable) {
    logger.debug('sharp 不可用，跳过压缩')
    return imageBuffer
  }
  
  const config = IMAGE_CONFIG[mode]
  
  try {
    let image = sharp(imageBuffer)
    const metadata = await image.metadata()
    
    // 调整尺寸
    if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
      image = image.resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
    }
    
    // 压缩
    image = image.jpeg({ quality: config.quality, mozjpeg: true })
    
    let compressedBuffer = await image.toBuffer()
    
    // 如果仍过大，继续降低质量
    let quality = config.quality
    while (compressedBuffer.length > config.targetSizeKB * 1024 && quality > 10) {
      quality -= 10
      image = sharp(imageBuffer)
      if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
        image = image.resize(config.maxWidth, config.maxHeight, { fit: 'inside', withoutEnlargement: true })
      }
      image = image.jpeg({ quality, mozjpeg: true })
      compressedBuffer = await image.toBuffer()
    }
    
    logger.debug('图片压缩完成', {
      mode,
      original: Math.round(imageBuffer.length / 1024) + 'KB',
      compressed: Math.round(compressedBuffer.length / 1024) + 'KB',
      quality
    })
    
    return compressedBuffer
  } catch (error) {
    logger.error('图片压缩失败:', error.message)
    return imageBuffer
  }
}

/**
 * 确保目录存在
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
  }
}

/**
 * 上传图片到本地存储
 * @param {Object} options
 * @param {Buffer} options.fileContent - 文件内容
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.contentType - MIME类型
 * @param {boolean} options.compress - 是否压缩（默认true）
 * @returns {Promise<{key: string}>}
 */
export async function uploadImage(options) {
  const { fileContent, fileName, contentType = 'image/jpeg', compress = true } = options
  
  logger.info('开始上传图片', { 
    fileName, 
    size: Math.round(fileContent.length / 1024) + 'KB', 
    type: contentType 
  })
  
  // 生成存储路径: images/2026/03/18/xxx_timestamp.jpg
  const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const ext = fileName.split('.').pop() || 'jpg'
  const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const storageName = 'images/' + datePrefix + '/' + baseName + '_' + Date.now() + '.' + ext
  
  let bufferToUpload = fileContent
  
  // 压缩图片（上传时使用活跃期配置）
  if (compress && contentType.startsWith('image/')) {
    try {
      bufferToUpload = await compressImage(fileContent, 'upload')
    } catch (error) {
      logger.warn('图片压缩失败，使用原图:', error.message)
    }
  }
  
  // 写入本地文件
  const filePath = path.join(STORAGE_DIR, storageName)
  const fileDir = path.dirname(filePath)
  
  await ensureDir(fileDir)
  await fs.writeFile(filePath, bufferToUpload)
  
  logger.info('本地存储上传成功', { 
    key: storageName, 
    originalSize: Math.round(fileContent.length / 1024) + 'KB',
    storedSize: Math.round(bufferToUpload.length / 1024) + 'KB'
  })
  
  return { key: storageName }
}

/**
 * 获取图片访问URL
 * @param {string} key - 文件key
 * @param {number} expires - 有效期（秒），本地存储忽略
 * @returns {Promise<string>}
 */
export async function getImageUrl(key, expires = 86400) {
  return BASE_URL + '/uploads/' + key
}

/**
 * 批量获取图片URL
 * @param {string[]} keys - 文件key数组
 * @param {number} expires - 有效期
 * @returns {Promise<Object<string, string>>}
 */
export async function getImageUrls(keys, expires = 86400) {
  const result = {}
  for (const key of keys) {
    result[key] = BASE_URL + '/uploads/' + key
  }
  return result
}

/**
 * 删除图片
 * @param {string} key - 文件key
 * @returns {Promise<boolean>}
 */
export async function deleteImage(key) {
  try {
    const filePath = path.join(STORAGE_DIR, key)
    await fs.unlink(filePath)
    logger.info('本地存储删除成功', { key })
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return true
    logger.error('删除图片失败:', e.message)
    throw e
  }
}

/**
 * 检查图片是否存在
 * @param {string} key - 文件key
 * @returns {Promise<boolean>}
 */
export async function imageExists(key) {
  try {
    const filePath = path.join(STORAGE_DIR, key)
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 归档压缩图片（15天后调用）
 * @param {string} key - 文件key
 * @returns {Promise<boolean>}
 */
export async function archiveImage(key) {
  try {
    const filePath = path.join(STORAGE_DIR, key)
    const fileContent = await fs.readFile(filePath)
    
    // 深度压缩
    const compressedBuffer = await compressImage(fileContent, 'archive')
    
    // 覆盖原文件
    await fs.writeFile(filePath, compressedBuffer)
    
    logger.info('图片归档压缩完成', {
      key,
      original: Math.round(fileContent.length / 1024) + 'KB',
      compressed: Math.round(compressedBuffer.length / 1024) + 'KB'
    })
    
    return true
  } catch (error) {
    logger.error('图片归档压缩失败:', error.message)
    return false
  }
}

/**
 * 获取存储配置
 */
export function getStorageConfig() {
  return {
    provider: 'local',
    storageDir: STORAGE_DIR,
    baseUrl: BASE_URL
  }
}

export default {
  uploadImage,
  getImageUrl,
  getImageUrls,
  deleteImage,
  imageExists,
  archiveImage,
  compressImage,
  getStorageConfig
}
