/**
 * 图片压缩工具 - 目标压缩到500KB以下
 */

/**
 * 压缩图片到目标大小
 * @param {File} file - 要压缩的图片文件
 * @param {Object} options - 压缩选项
 * @param {number} options.targetSize - 目标大小（字节），默认 500KB
 * @param {number} options.maxWidth - 最大宽度，默认 1920
 * @param {number} options.maxHeight - 最大高度，默认 1920
 * @param {number} options.minQuality - 最低质量，默认 0.3
 * @returns {Promise<File>} - 压缩后的文件
 */
export async function compressImage(file, options = {}) {
  const {
    targetSize = 500 * 1024, // 目标 500KB
    maxWidth = 1920,
    maxHeight = 1920,
    minQuality = 0.3
  } = options
  
  // 非图片文件直接返回
  if (!file.type.startsWith('image/')) {
    return file
  }
  
  console.log('[compressImage] 开始压缩:', {
    文件名: file.name,
    原始大小: (file.size / 1024).toFixed(1) + 'KB',
    目标大小: (targetSize / 1024).toFixed(0) + 'KB'
  })
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = async () => {
      try {
        // 计算缩放后的尺寸
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        
        // 创建canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        // 初始质量
        let quality = 0.9
        let blob = null
        
        // 循环压缩直到达到目标大小
        while (quality >= minQuality) {
          blob = await new Promise((res) => {
            canvas.toBlob(res, 'image/jpeg', quality)
          })
          
          if (blob && blob.size <= targetSize) {
            break
          }
          
          quality -= 0.1
        }
        
        // 如果还是太大，缩小尺寸再试
        if (blob && blob.size > targetSize && width > 800) {
          width = Math.round(width * 0.7)
          height = Math.round(height * 0.7)
          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)
          
          quality = 0.8
          while (quality >= minQuality) {
            blob = await new Promise((res) => {
              canvas.toBlob(res, 'image/jpeg', quality)
            })
            
            if (blob && blob.size <= targetSize) {
              break
            }
            
            quality -= 0.1
          }
        }
        
        // 创建压缩后的File对象
        const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        })
        
        console.log('[compressImage] 压缩完成:', {
          原始大小: (file.size / 1024).toFixed(1) + 'KB',
          压缩后: (compressedFile.size / 1024).toFixed(1) + 'KB',
          质量: quality.toFixed(1),
          尺寸: width + 'x' + height,
          压缩比: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%'
        })
        
        URL.revokeObjectURL(img.src)
        resolve(compressedFile)
        
      } catch (error) {
        console.error('[compressImage] 压缩失败:', error)
        URL.revokeObjectURL(img.src)
        resolve(file) // 失败返回原文件
      }
    }
    
    img.onerror = () => {
      console.error('[compressImage] 图片加载失败')
      resolve(file)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

export default compressImage
