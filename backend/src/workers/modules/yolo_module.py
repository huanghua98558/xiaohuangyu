#!/usr/bin/env python3
"""
YOLO 模块 - OpenVINO Runtime 优化版
内存占用从 714MB 降到 243MB (节省 66%)
"""

import sys
import json
import cv2
import numpy as np
from openvino.runtime import Core

# 初始化 OpenVINO YOLO
sys.stderr.write("正在加载 YOLO 模型 (OpenVINO Runtime)...\n")
sys.stderr.flush()

# 模型路径
MODEL_XML = '/home/ubuntu/models/icon_detect_best_openvino_model/icon_detect_best.xml'

# 加载 OpenVINO 模型
core = Core()
model = core.read_model(MODEL_XML)
compiled_model = core.compile_model(model, "CPU")
input_layer = compiled_model.input(0)
output_layer = compiled_model.output(0)

sys.stderr.write("✅ YOLO 模型已加载 (OpenVINO Runtime)\n")
sys.stderr.flush()

# 类别映射
CLASS_NAMES = {
    0: 'red_heart',    # 红心 - 已点赞
    1: 'white_heart',  # 白心 - 未点赞
    2: 'yellow_star',  # 黄星 - 已收藏
    3: 'white_star',   # 白星 - 未收藏
    4: 'red_plus'      # 红加号 - 未关注
}

def preprocess_image(image_path):
    """预处理图片"""
    img = cv2.imread(image_path)
    if img is None:
        return None
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (640, 640))
    img = img.transpose(2, 0, 1)  # HWC -> CHW
    img = np.expand_dims(img, 0)  # 添加 batch 维度
    img = img.astype(np.float32) / 255.0
    return img

def postprocess_output(output, conf_threshold=0.45, iou_threshold=0.7):
    """后处理输出 - NMS"""
    detections = {
        'has_like': False,
        'has_favorite': False,
        'has_follow': True,  # 默认已关注
        'confidence': 0.0
    }
    
    # 输出形状: [1, 9, 8400]
    output = output.reshape(9, -1).T  # [8400, 9]
    
    boxes = []
    scores = []
    class_ids = []
    
    for det in output:
        x, y, w, h = det[:4]
        class_scores = det[4:]
        class_id = np.argmax(class_scores)
        confidence = class_scores[class_id]
        
        if confidence > conf_threshold:
            boxes.append([x - w/2, y - h/2, w, h])  # 转为左上角坐标
            scores.append(float(confidence))
            class_ids.append(class_id)
    
    if not boxes:
        return detections
    
    # 简单 NMS
    boxes = np.array(boxes)
    scores = np.array(scores)
    class_ids = np.array(class_ids)
    
    # 按置信度排序
    indices = np.argsort(scores)[::-1]
    
    kept = []
    for i in indices:
        if len(kept) == 0:
            kept.append(i)
            continue
        
        # 计算 IoU
        box_i = boxes[i]
        valid = True
        for j in kept:
            box_j = boxes[j]
            xi1 = max(box_i[0], box_j[0])
            yi1 = max(box_i[1], box_j[1])
            xi2 = min(box_i[0] + box_i[2], box_j[0] + box_j[2])
            yi2 = min(box_i[1] + box_i[3], box_j[1] + box_j[3])
            
            inter = max(0, xi2 - xi1) * max(0, yi2 - yi1)
            union = box_i[2] * box_i[3] + box_j[2] * box_j[3] - inter
            iou = inter / union if union > 0 else 0
            
            if iou > iou_threshold and class_ids[i] == class_ids[j]:
                valid = False
                break
        
        if valid:
            kept.append(i)
    
    # 解析检测结果
    for i in kept:
        class_name = CLASS_NAMES.get(class_ids[i], 'unknown')
        confidence = scores[i]
        
        if class_name == 'red_heart':
            detections['has_like'] = True
        elif class_name == 'white_heart':
            detections['has_like'] = False
        elif class_name == 'yellow_star':
            detections['has_favorite'] = True
        elif class_name == 'white_star':
            detections['has_favorite'] = False
        elif class_name == 'red_plus':
            detections['has_follow'] = False
        
        detections['confidence'] = max(detections['confidence'], float(confidence))
    
    return detections

def detect_icons(image_path):
    """检测图标"""
    img = preprocess_image(image_path)
    if img is None:
        return {
            'has_like': False,
            'has_favorite': False,
            'has_follow': True,
            'confidence': 0.0
        }
    
    result = compiled_model([img])
    output = result[0]
    return postprocess_output(output)

# 发送 ready 消息
sys.stdout.write(json.dumps({'type': 'ready'}) + '\n')
sys.stdout.flush()

sys.stderr.write("YOLO 模块已就绪，等待调用...\n")
sys.stderr.flush()

# 主循环
while True:
    try:
        msg = sys.stdin.readline()
        if not msg:
            break
        
        data = json.loads(msg)
        action = data.get('action')
        requestId = data.get('requestId')
        
        if action == 'detect':
            image_path = data.get('imagePath')
            result = detect_icons(image_path)
            response = {
                'type': 'result',
                'requestId': requestId,
                'data': result
            }
            sys.stdout.write(json.dumps(response) + '\n')
            sys.stdout.flush()
        
    except Exception as e:
        sys.stderr.write(f"Error: {e}\n")
        sys.stderr.flush()
        response = {
            'type': 'error',
            'requestId': requestId,
            'error': str(e)
        }
        sys.stdout.write(json.dumps(response) + '\n')
        sys.stdout.flush()

