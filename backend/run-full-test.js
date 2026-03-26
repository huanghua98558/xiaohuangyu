#!/usr/bin/env node

/**
 * 完整审核流程自动化测试脚本
 * 
 * 使用方法：
 * 1. 将两张截图保存到：/tmp/xiaohuangyu-test/screenshot1.jpg 和 screenshot2.jpg
 * 2. 运行：node run-full-test.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import FormData from 'form-data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_URL = 'http://localhost:8080/api/upload/test-screenshot'
const TEST_DIR = '/tmp/xiaohuangyu-test'

async function runFullTest() {
  console.log('='.repeat(70))
  console.log('🎯 审核系统完整功能测试')
  console.log('='.repeat(70))
  
  // 步骤 1: 检查截图文件
  console.log('\n📸 步骤 1: 检查截图文件...')
  const screenshot1Path = path.join(TEST_DIR, 'screenshot1.jpg')
  const screenshot2Path = path.join(TEST_DIR, 'screenshot2.jpg')
  
  const files = []
  if (fs.existsSync(screenshot1Path)) {
    files.push(screenshot1Path)
    console.log(`   ✅ 找到截图 1: ${screenshot1Path}`)
  } else {
    console.log(`   ❌ 截图 1 不存在：${screenshot1Path}`)
  }
  
  if (fs.existsSync(screenshot2Path)) {
    files.push(screenshot2Path)
    console.log(`   ✅ 找到截图 2: ${screenshot2Path}`)
  } else {
    console.log(`   ❌ 截图 2 不存在：${screenshot2Path}`)
  }
  
  if (files.length === 0) {
    console.log('\n⚠️  请先将截图保存到以下位置:')
    console.log(`   1. ${screenshot1Path}`)
    console.log(`   2. ${screenshot2Path}`)
    console.log('\n💡 提示：您可以从对话中下载图片并保存到这些位置')
    process.exit(1)
  }
  
  // 步骤 2: 上传截图
  console.log('\n📤 步骤 2: 上传截图到服务器...')
  
  try {
    const formData = new FormData()
    for (const filePath of files) {
      const fileStream = fs.createReadStream(filePath)
      formData.append('screenshots', fileStream, path.basename(filePath))
    }
    
    const response = await axios.post(UPLOAD_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 30000
    })
    
    if (response.data && response.data.success) {
      console.log('   ✅ 上传成功！')
      const data = response.data.data
      console.log(`   上传数量：${data.count}`)
      
      // 获取上传后的文件路径
      const uploadedPaths = data.files.map(f => f.fullUrl)
      console.log('\n   文件路径:')
      uploadedPaths.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p}`)
      })
      
      // 步骤 3: 修改测试脚本
      console.log('\n📝 步骤 3: 修改测试脚本配置...')
      const testScriptPath = path.join(__dirname, 'test-full-audit-flow.js')
      
      if (fs.existsSync(testScriptPath)) {
        let testScript = fs.readFileSync(testScriptPath, 'utf8')
        
        // 替换截图路径
        const newScreenshotsConfig = `  screenshots: [
    '${uploadedPaths[0]}',
    ${uploadedPaths[1] ? `'${uploadedPaths[1]}',` : ''}
  ]`
        
        // 使用正则表达式替换
        const oldConfig = /screenshots:\s*\[[\s\S]*?\]/
        testScript = testScript.replace(oldConfig, newScreenshotsConfig)
        
        fs.writeFileSync(testScriptPath, testScript)
        console.log('   ✅ 测试脚本已更新')
        console.log(`   新配置:`)
        console.log(`   ${newScreenshotsConfig.replace(/\n/g, '\n   ')}`)
      }
      
      // 步骤 4: 运行完整测试
      console.log('\n🚀 步骤 4: 运行完整审核流程测试...')
      console.log('   这可能需要几分钟时间...')
      
      const { exec } = await import('child_process')
      const testCmd = 'cd ' + __dirname + ' && NODE_TLS_REJECT_UNAUTHORIZED=0 node test-full-audit-flow.js'
      
      await new Promise((resolve, reject) => {
        const child = exec(testCmd, { env: process.env })
        
        child.stdout.on('data', (data) => {
          process.stdout.write(data)
        })
        
        child.stderr.on('data', (data) => {
          process.stderr.write(data)
        })
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`测试退出码：${code}`))
          }
        })
      })
      
      console.log('\n' + '='.repeat(70))
      console.log('✅ 完整测试完成！')
      console.log('='.repeat(70))
      
    } else {
      console.log('   ❌ 上传失败:', response.data?.message)
      process.exit(1)
    }
    
  } catch (error) {
    console.log('   ❌ 错误:', error.message)
    if (error.response) {
      console.log('   响应:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

runFullTest().catch(console.error)
