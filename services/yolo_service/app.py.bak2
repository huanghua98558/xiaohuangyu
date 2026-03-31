#!/usr/bin/env python3
"""
YOLO Service - ONNX Runtime 版本 (稳定版)
内存: ~220MB
"""

import os
import tempfile
import httpx
import numpy as np
import cv2
import gc
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import onnxruntime as ort
import time

app = FastAPI(title="YOLO Service", version="2.0.2")

# 配置
MODEL_PATH = "/home/ubuntu/models/icon_detect_best.onnx"
CLASS_NAMES = ['red_heart', 'white_heart', 'yellow_star', 'white_star', 'red_plus']
CONF_THRESHOLD = 0.3
IOU_THRESHOLD = 0.45

print("[YOLO] 加载模型...")

# ONNX Runtime 配置
sess_options = ort.SessionOptions()
sess_options.intra_op_num_threads = 2
sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

session = ort.InferenceSession(
    MODEL_PATH,
    sess_options=sess_options,
    providers=['CPUExecutionProvider']
)

print("[YOLO] ✅ 模型加载完成")

def letterbox(img, new_shape=(640, 640), color=(114, 114, 114)):
    h, w = img.shape[:2]
    r = min(new_shape[0] / h, new_shape[1] / w)
    new_unpad = int(round(w * r)), int(round(h * r))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
    dw /= 2
    dh /= 2
    
    if (w, h) != new_unpad:
        img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    
    return img, r, (dw, dh)

def nms(boxes, scores, iou_threshold=0.45):
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
    
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        
        if order.size == 1:
            break
        
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        inds = np.where(iou <= iou_threshold)[0]
        order = order[inds + 1]
    
    return keep

def postprocess(output, ratio, pad):
    detections = []
    data = output[0]
    
    for i in range(data.shape[1]):
        d = data[:, i]
        x, y, w, h = d[:4]
        scores = d[4:]
        max_score = np.max(scores)
        
        if max_score > CONF_THRESHOLD:
            cls_id = np.argmax(scores)
            if cls_id < len(CLASS_NAMES):
                x_orig = (x - pad[0]) / ratio
                y_orig = (y - pad[1]) / ratio
                w_orig = w / ratio
                h_orig = h / ratio
                
                detections.append({
                    'bbox': [float(x), float(y), float(w), float(h)],
                    'xyxy': [float(x_orig - w_orig/2), float(y_orig - h_orig/2),
                             float(x_orig + w_orig/2), float(y_orig + h_orig/2)],
                    'confidence': float(max_score),
                    'class_name': CLASS_NAMES[cls_id]
                })
    
    if not detections:
        return []
    
    boxes = np.array([d['bbox'] for d in detections])
    scores = np.array([d['confidence'] for d in detections])
    keep = nms(boxes, scores, IOU_THRESHOLD)
    
    return [{
        'class': detections[i]['class_name'],
        'confidence': round(detections[i]['confidence'], 3),
        'bbox': [round(detections[i]['xyxy'][j], 1) for j in range(4)]
    } for i in keep]

class YOLOResponse(BaseModel):
    has_like: bool = False
    has_favorite: bool = False
    has_follow: bool = False
    detections: List[dict] = []
    error: Optional[str] = None

@app.post("/yolo/detect", response_model=YOLOResponse)
async def detect_url(image_url: str):
    tmp = None
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
            r = await c.get(image_url)
            r.raise_for_status()
            ext = image_url.split('.')[-1].split('?')[0][:4] or 'jpg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{ext}') as f:
                f.write(r.content)
                tmp = f.name
        
        result = await process_image(tmp)
        return YOLOResponse(**result)
    except Exception as e:
        print(f"[YOLO] URL错误: {e}")
        return YOLOResponse(error=str(e))
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)

@app.post("/yolo/detect_file", response_model=YOLOResponse)
async def detect_file(file: UploadFile = File(...)):
    tmp = None
    try:
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{ext}') as f:
            f.write(await file.read())
            tmp = f.name
        
        print(f"[YOLO] 文件: {file.filename}")
        result = await process_image(tmp)
        return YOLOResponse(**result)
    except Exception as e:
        print(f"[YOLO] 文件错误: {e}")
        import traceback
        traceback.print_exc()
        return YOLOResponse(error=str(e))
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)

async def process_image(path):
    try:
        img = cv2.imread(path)
        if img is None:
            return {'has_like': False, 'has_favorite': False, 'has_follow': False, 
                    'detections': [], 'error': '无法读取图片'}
        
        # 预处理
        img_lb, ratio, pad = letterbox(img)
        img_rgb = img_lb[:, :, ::-1].transpose(2, 0, 1)
        img_tensor = img_rgb.astype(np.float32) / 255.0
        img_tensor = img_tensor[np.newaxis, ...]
        
        # 推理
        t0 = time.time()
        outputs = session.run(None, {"images": img_tensor})
        print(f"[YOLO] 推理: {(time.time()-t0)*1000:.0f}ms")
        
        # 后处理
        dets = postprocess(outputs[0], ratio, pad)
        print(f"[YOLO] 检测: {len(dets)} - {[d['class'] for d in dets]}")
        
        # 分析状态
        has_like = any(d['class'] == 'red_heart' for d in dets)
        has_favorite = any(d['class'] == 'yellow_star' for d in dets)
        has_follow = any(d['class'] == 'red_plus' for d in dets)
        
        return {'has_like': has_like, 'has_favorite': has_favorite, 
                'has_follow': has_follow, 'detections': dets}
    except Exception as e:
        print(f"[YOLO] 处理错误: {e}")
        import traceback
        traceback.print_exc()
        return {'has_like': False, 'has_favorite': False, 'has_follow': False,
                'detections': [], 'error': str(e)}
    finally:
        gc.collect()

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "onnx-runtime"}

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8003))
    print(f"[YOLO] 端口: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
