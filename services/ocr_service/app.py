from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import uvicorn
import httpx
import tempfile
import os
import sys
import re

sys.path.insert(0, '/home/ubuntu/.local/lib/python3.12/site-packages')

from rapidocr_onnxruntime import RapidOCR

app = FastAPI(title="OCR Service - Fixed")

print("[OCR] 正在加载 RapidOCR...")
ocr_engine = RapidOCR(use_textline_orientation=False, det_db_box_thresh=0.6)
print("[OCR] ✅ RapidOCR 已加载")

POSITIVE_KEYWORDS = ['好', '棒', '推荐', '喜欢', '赞', '可以', '不错', '值得', '爱了', '想要', '心动', '冲', '真的可以']
INPUT_HINTS = ['有什么想法', '展开说说', '说点什么', '发表评论', '写下你的']

class OCRRequest(BaseModel):
    image_url: str
    image_type: Optional[str] = None

class OCRResponse(BaseModel):
    has_comment_keyword: bool
    author: Optional[str] = None
    comment: Optional[str] = None
    ocr_text: Optional[str] = None
    is_positive: Optional[bool] = None

def is_positive_comment(text: str) -> bool:
    if not text:
        return False
    return any(kw in text for kw in POSITIVE_KEYWORDS)

def is_input_hint(text: str) -> bool:
    if not text:
        return False
    return any(hint in text for hint in INPUT_HINTS)

def extract_comment_after_author(texts: list, author_index: int) -> Optional[str]:
    """在评论人后面找评论内容"""
    for i in range(author_index + 1, len(texts)):
        t = texts[i].strip()
        # 跳过时间标记
        if re.match(r'^\d+[分钟小时天]前', t) or t in ['刚刚', '刚刚 ']:
            continue
        # 跳过功能按钮
        if '回复' in t or '去发布' in t or '展开' in t or '发作品' in t:
            continue
        # 跳过过短内容
        if len(t) < 3:
            continue
        # 跳过流量奖励提示
        if '流量奖励' in t or '分享你' in t:
            continue
        # 跳过地点标记
        if re.match(r'^\d+小时前·', t):
            continue
        return t
    return None

async def process_image(image_path: str, image_type: str = None):
    try:
        from PIL import Image
        import numpy as np
        
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        w, h = img.size
        max_dim = max(w, h)
        if max_dim > 2000:
            scale = 2000 / max_dim
            new_size = (int(w * scale), int(h * scale))
            img = img.resize(new_size, Image.LANCZOS)
            print(f"[OCR] 智能降采样: {w}x{h} -> {new_size[0]}x{new_size[1]}")
        
        img_array = np.array(img)
        result, elapse = ocr_engine(img_array)
        
        if result is None or len(result) == 0:
            return OCRResponse(has_comment_keyword=False)
        
        texts = [item[1] for item in result]
        full_text = '\n'.join(texts)
        
        print(f"[OCR] 识别到 {len(texts)} 行文本")
        for i, t in enumerate(texts):
            print(f"  [{i}] {t}")
        
        has_comment = any('评论' in t for t in texts)
        author = None
        comment = None
        is_positive = None
        author_index = -1
        
        if has_comment:
            print("[OCR] 检测到评论截图 (类型A)")
            
            # 修复：支持多种评论人格式
            for i, t in enumerate(texts):
                stripped = t.strip()
                
                # 模式1：数字ID + 我（如 135846594我）
                match = re.match(r'^(\d{6,})我$', stripped)
                if match:
                    author = match.group(1)
                    author_index = i
                    print(f"[OCR] 提取评论人(数字ID): {author}")
                    break
                
                # 模式2：中文昵称 + 我（如 柒柒爱做家常菜我）
                # 要求：包含中文，以我结尾，长度合理
                if stripped.endswith('我') and len(stripped) > 2:
                    # 检查是否包含中文
                    if re.search(r'[\u4e00-\u9fff]', stripped):
                        # 去掉我，取昵称
                        potential_author = stripped[:-1]
                        # 确保不是其他误匹配（如 我们）
                        if potential_author and not potential_author in ['我', '咱', '你']:
                            author = potential_author
                            author_index = i
                            print(f"[OCR] 提取评论人(中文昵称): {author}")
                            break
            
            # 如果找到评论人，提取评论内容
            if author_index >= 0:
                comment = extract_comment_after_author(texts, author_index)
                if comment:
                    print(f"[OCR] 提取评论内容: {comment}")
                    is_positive = is_positive_comment(comment)
            
            # 如果没找到评论内容，尝试从正向关键词中找
            if not comment:
                for t in texts:
                    if is_positive_comment(t) and not is_input_hint(t):
                        comment = t.strip()
                        is_positive = True
                        print(f"[OCR] 从正向关键词提取评论: {comment}")
                        break
        else:
            print("[OCR] 检测到达人主页 (类型B)")
            
            for t in texts:
                if t.startswith('@'):
                    author = t[1:].strip()
                    print(f"[OCR] 提取达人名字: {author}")
                    break
        
        return OCRResponse(
            has_comment_keyword=has_comment,
            author=author,
            comment=comment,
            ocr_text=full_text[:500],
            is_positive=is_positive
        )
    except Exception as e:
        print(f"[OCR] 处理错误: {e}")
        import traceback
        traceback.print_exc()
        return OCRResponse(has_comment_keyword=False)

@app.post("/ocr/analyze", response_model=OCRResponse)
async def analyze_image(request: OCRRequest):
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(request.image_url)
            response.raise_for_status()
            suffix = request.image_url.split('.')[-1].split('?')[0][:4] or 'jpg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{suffix}') as f:
                f.write(response.content)
                tmp_path = f.name
        try:
            return await process_image(tmp_path, request.image_type)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        print(f"[OCR] 处理URL错误: {e}")
        return OCRResponse(has_comment_keyword=False)

@app.post("/ocr/analyze_file", response_model=OCRResponse)
async def analyze_image_file(
    file: UploadFile = File(...),
    image_type: Optional[str] = Form(None)
):
    try:
        suffix = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{suffix}') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        print(f"[OCR] 收到文件: {file.filename}, 大小: {len(content)} bytes")
        
        try:
            return await process_image(tmp_path, image_type)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        print(f"[OCR] 处理文件错误: {e}")
        import traceback
        traceback.print_exc()
        return OCRResponse(has_comment_keyword=False)

@app.get("/")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 9001))
    print(f"[OCR] 启动服务，端口: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
