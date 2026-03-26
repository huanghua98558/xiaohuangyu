#!/usr/bin/env python3
"""
YOLO Service - FastAPI 独立服务
端口: 8003
内存: ~242MB

功能：
检测点赞/收藏/关注图标状态
"""

import os
import tempfile
import httpx
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="YOLO Service", version="1.0.0")

# ========== YOLO 初始化 ==========
print("[YOLO] 正在加载模型...")

from ultralytics import YOLO

MODEL_PATH = "/home/ubuntu/models/icon_detect_best_openvino_model"
model = YOLO(MODEL_PATH, task='detect')

print(f"[YOLO] ✅ 模型加载完成")

# ========== 工具函数 ==========

def analyze_icon_status(detections: List[dict]) -> dict:
    """分析图标状态"""
    has_like = False
    has_favorite = False
    has_follow = False
    
    for det in detections:
        class_name = det['class']
        
        if class_name == 'red_heart':
            has_like = True
        elif class_name == 'yellow_star':
            has_favorite = True
        elif class_name == 'red_plus':
            has_follow = True
    
    return {
        'has_like': has_like,
        'has_favorite': has_favorite,
        'has_follow': has_follow
    }

# ========== 响应模型 ==========

class YOLOResponse(BaseModel):
    has_like: bool = False
    has_favorite: bool = False
    has_follow: bool = False
    detections: List[dict] = []
    error: Optional[str] = None

# ========== API 端点 ==========

async def process_image(image_path: str) -> dict:
    """处理图片"""
    try:
        # 推理
        results = model(image_path, verbose=False, conf=0.3)
        
        detections = []
        
        if results and len(results) > 0:
            r = results[0]
            if r.boxes is not None and len(r.boxes) > 0:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    cls_name = r.names[cls_id]
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    
                    detections.append({
                        'class': cls_name,
                        'confidence': round(conf, 3),
                        'bbox': [round(x, 1) for x in xyxy]
                    })
        
        print(f"[YOLO] 检测到 {len(detections)} 个图标: {[d['class'] for d in detections]}")
        
        # 分析状态
        status = analyze_icon_status(detections)
        
        return {
            **status,
            'detections': detections
        }
    except Exception as e:
        print(f"[YOLO] 处理错误: {e}")
        import traceback
        traceback.print_exc()
        return {
            'has_like': False,
            'has_favorite': False,
            'has_follow': False,
            'detections': [],
            'error': str(e)
        }

@app.post("/yolo/detect", response_model=YOLOResponse)
async def detect_from_url(image_url: str):
    """从 URL 检测"""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            
            suffix = image_url.split('.')[-1].split('?')[0][:4] or 'jpg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{suffix}') as f:
                f.write(response.content)
                tmp_path = f.name
        
        try:
            result = await process_image(tmp_path)
            return YOLOResponse(**result)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        print(f"[YOLO] URL处理错误: {e}")
        return YOLOResponse(error=str(e))

@app.post("/yolo/detect_file", response_model=YOLOResponse)
async def detect_from_file(file: UploadFile = File(...)):
    """从上传文件检测"""
    try:
        suffix = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{suffix}') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        print(f"[YOLO] 收到文件: {file.filename}, 大小: {len(content)} bytes")
        
        try:
            result = await process_image(tmp_path)
            return YOLOResponse(**result)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        print(f"[YOLO] 文件处理错误: {e}")
        import traceback
        traceback.print_exc()
        return YOLOResponse(error=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8003))
    print(f"[YOLO] 启动服务，端口: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
