#!/usr/bin/env node

/**
 * 命令行图片上传工具
 * 
 * 使用方法：
 * node upload-screenshots.js /path/to/screenshot1.jpg /path/to/screenshot2.jpg
 */

import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'

const UPLOAD_URL = 'http://localhost:8080/api/upload/test-screenshot'

async function uploadScreenshots(imagePaths) {
  console.log('='.repeat(60))
  console.log('📤 开始上传截图...')
  console.log('='.repeat(60))
  
  if (!imagePaths || imagePaths.length === 0) {
    console.log('❌ 请提供图片路径')
    console.log('用法：node upload-screenshots.js /path/to/image1.jpg /path/to/image2.jpg')
    process.exit(1)
  }
  
  // 检查文件是否存在
  const validPaths = []
  for (const imagePath of imagePaths) {
    const absolutePath = path.resolve(imagePath)
    if (fs.existsSync(absolutePath)) {
      validPaths.push(absolutePath)
      console.log(`✅ 找到图片：${absolutePath}`)
    } else {
      console.log(`❌ 图片不存在：${absolutePath}`)
    }
  }
  
  if (validPaths.length === 0) {
    console.log('❌ 没有有效的图片路径')
    process.exit(1)
  }
  
  // 创建 FormData
  const formData = new FormData()
  for (const imagePath of validPaths) {
    const fileStream = fs.createReadStream(imagePath)
    formData.append('screenshots', fileStream, path.basename(imagePath))
  }
  
  try {
    console.log(`\n上传 ${validPaths.length} 张图片到 ${UPLOAD_URL}...`)
    
    const response = await axios.post(UPLOAD_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    })
    
    if (response.data && response.data.success) {
      console.log('\n' + '='.repeat(60))
      console.log('✅ 上传成功！')
      console.log('='.repeat(60))
      
      const data = response.data.data
      console.log(`上传数量：${data.count}`)
      console.log('\n文件信息:')
      
      data.files.forEach((file, index) => {
        console.log(`\n${index + 1}. ${file.originalName}`)
        console.log(`   文件名：${file.filename}`)
        console.log(`   路径：${file.fullUrl}`)
        console.log(`   大小：${(file.size / 1024).toFixed(2)} KB`)
        console.log(`   URL: ${file.url}`)
      })
      
      if (data.testScript) {
        console.log('\n' + '='.repeat(60))
        console.log('📝 测试脚本配置:')
        console.log('='.repeat(60))
        console.log(data.testScript)
      }
      
    } else {
      console.log('\n❌ 上传失败:', response.data?.message || '未知错误')
      process.exit(1)
    }
    
  } catch (error) {
    console.log('\n❌ 上传失败:', error.message)
    if (error.response) {
      console.log('错误响应:', error.response.data)
    }
    process.exit(1)
  }
}

// 从命令行参数获取图片路径
const args = process.argv.slice(2)
uploadScreenshots(args)
