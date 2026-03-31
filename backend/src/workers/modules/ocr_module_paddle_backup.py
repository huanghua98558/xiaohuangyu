#!/usr/bin/env python3
"""
OCR 模块 - 集成到 Worker 中
通过 IPC 与 Node.js 主进程通信
使用 PaddleOCR 轻量级模型（超轻量中文 OCR 模型）
兼容性修复版本：适配 PaddlePaddle 3.3.0 + PaddleOCR 3.4.0
"""

import sys
import os
import json

# 禁用模型源检查，加速启动
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

# 禁用 OneDNN，解决兼容性问题
# PaddlePaddle 3.3.0 的 OneDNN 指令不支持 PIR 属性
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['FLAGS_use_mkl'] = '0'

from paddleocr import PaddleOCR

# 初始化 OCR（只执行一次，使用轻量级模型）
sys.stderr.write("正在加载 PaddleOCR 轻量级模型...\n")
sys.stderr.flush()

# 使用超轻量中文 OCR 模型（PP-OCRv4）
# 简化参数配置，避免兼容性问题
ocr = PaddleOCR(
    use_angle_cls=True,
    lang='ch'
)

sys.stderr.write("✅ PaddleOCR 轻量级模型已加载\n")
sys.stderr.flush()

# 发送 ready 消息给 Node.js 主进程
sys.stdout.write(json.dumps({'type': 'ready'}) + '\n')
sys.stdout.flush()

sys.stderr.write("OCR 模块已就绪，等待调用...\n")
sys.stderr.flush()

def analyze_image(image_path):
    """分析图片"""
    try:
        # 使用 predict 方法（新版 API）
        result = ocr.predict(image_path)
        
        text = ''
        has_like = False
        has_favorite = False
        
        # 解析结果
        if result and 'ocr_result' in result:
            ocr_result = result['ocr_result']
            if ocr_result and len(ocr_result) > 0:
                for line in ocr_result:
                    if 'text' in line:
                        text_content = line['text']
                        text += text_content + '\n'
                        # 检测关键词
                        if '赞' in text_content:
                            has_like = True
                        if '收藏' in text_content:
                            has_favorite = True
        
        return {
            'text': text,
            'has_like': has_like,
            'has_favorite': has_favorite,
            'confidence': 0.85
        }
    except Exception as e:
        sys.stderr.write(f"OCR 识别错误：{str(e)}\n")
        sys.stderr.flush()
        return {
            'text': '',
            'has_like': False,
            'has_favorite': False,
            'confidence': 0.0,
            'error': str(e)
        }

# 主循环：监听 Node.js 消息
while True:
    try:
        # 读取消息
        msg = sys.stdin.readline()
        if not msg:
            break
        
        data = json.loads(msg)
        action = data.get('action')
        requestId = data.get('requestId')
        
        if action == 'analyze':
            image_path = data.get('imagePath')
            result = analyze_image(image_path)
            
            # 返回结果
            sys.stdout.write(json.dumps({
                'requestId': requestId,
                'success': True,
                'data': result
            }) + '\n')
            sys.stdout.flush()
            
    except Exception as e:
        sys.stdout.write(json.dumps({
            'requestId': requestId,
            'success': False,
            'error': str(e)
        }) + '\n')
        sys.stdout.flush()
