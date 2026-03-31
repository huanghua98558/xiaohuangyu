import asyncio
from threading import Lock

from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import httpx
import tempfile
import os
import sys
import re
import subprocess
from starlette.concurrency import run_in_threadpool

sys.path.insert(0, '/home/ubuntu/.local/lib/python3.12/site-packages')

from rapidocr_onnxruntime import RapidOCR

app = FastAPI(title="OCR Service - Fixed")
OCR_NODE_ID = os.environ.get("OCR_NODE_ID", f"ocr-{os.environ.get('PORT', '9001')}")
OCR_MAX_CONCURRENT_REQUESTS = max(1, int(os.environ.get("OCR_MAX_CONCURRENT_REQUESTS", "1")))
OCR_PROFILE = (os.environ.get("OCR_PROFILE", "mixed") or "mixed").strip().lower()
OCR_ENFORCE_PROFILE = (os.environ.get("OCR_ENFORCE_PROFILE", "false") or "false").strip().lower() == "true"
VALID_OCR_PROFILES = {"homepage", "comment", "mixed"}
ocr_request_semaphore = asyncio.Semaphore(OCR_MAX_CONCURRENT_REQUESTS)
ocr_request_counter_lock = Lock()
ocr_in_flight_requests = 0

if OCR_PROFILE not in VALID_OCR_PROFILES:
    print(f"[OCR] 未知 OCR_PROFILE={OCR_PROFILE}，自动降级为 mixed")
    OCR_PROFILE = "mixed"

print("[OCR] 正在加载 RapidOCR...")
ocr_engine = RapidOCR(use_textline_orientation=False, det_db_box_thresh=0.6)
print(
    f"[OCR] ✅ RapidOCR 已加载, node={OCR_NODE_ID}, profile={OCR_PROFILE}, "
    f"enforce_profile={OCR_ENFORCE_PROFILE}, max_concurrency={OCR_MAX_CONCURRENT_REQUESTS}"
)

POSITIVE_KEYWORDS = ['好', '棒', '推荐', '喜欢', '赞', '可以', '不错', '值得', '爱了', '想要', '心动', '冲', '真的可以']
INPUT_HINTS = ['有什么想法', '展开说说', '说点什么', '发表评论', '写下你的']
NOISE_EXACT_MARKERS = {
    '评论', '回复', '展开', '复制', '抖音', '分享',
    '点赞', '收藏', '关注', '登录'
}

NOISE_LINE_PATTERNS = [
    r'^\d+\s*条评论$',
    r'^评论\d+$',
    r'^发布时间.*$',
    r'^打开抖音.*$',
    r'^搜索.*$',
    r'^查看更多.*$',
    r'^暂时没有更多.*$',
    r'^去发布.*$',
    r'^发布作品.*$',
    r'^发作品.*$',
    r'^流量奖励.*$',
]

class OCRRequest(BaseModel):
    image_url: str
    image_type: Optional[str] = None

class OCRResponse(BaseModel):
    has_comment_keyword: bool
    author: Optional[str] = None
    author_name: Optional[str] = None
    commenter_nickname: Optional[str] = None
    comment: Optional[str] = None
    ocr_text: Optional[str] = None
    is_positive: Optional[bool] = None
    detected_type: Optional[str] = None
    raw_blocks: Optional[List[dict]] = None
    comment_candidates: Optional[List[dict]] = None
    first_comment: Optional[dict] = None
    extraction_confidence: Optional[str] = None

def normalize_requested_image_type(image_type: Optional[str]) -> Optional[str]:
    normalized = (image_type or "").strip().lower()
    if normalized in {"homepage", "profile", "video", "video_homepage"}:
        return "homepage"
    if normalized in {"comment", "comments"}:
        return "comment"
    return None

def profile_allows_requested_type(profile: str, requested_type: Optional[str]) -> bool:
    if not requested_type or profile == "mixed":
        return True
    if profile == "homepage":
        return requested_type == "homepage"
    if profile == "comment":
        return requested_type == "comment"
    return True

def validate_profile_request(image_type: Optional[str]) -> tuple[Optional[str], bool]:
    normalized_type = normalize_requested_image_type(image_type)
    allowed = profile_allows_requested_type(OCR_PROFILE, normalized_type)
    if normalized_type and not allowed:
        print(
            f"[OCR] ⚠️ profile 与请求类型不匹配: node={OCR_NODE_ID}, "
            f"profile={OCR_PROFILE}, image_type={normalized_type}, enforce={OCR_ENFORCE_PROFILE}"
        )
    return normalized_type, allowed

def build_ocr_blocks(result: list, x_offset: int = 0, y_offset: int = 0) -> list[dict]:
    blocks = []
    for item in result or []:
        try:
            box = item[0] or []
            text = clean_text_line(item[1] if len(item) > 1 else None)
            score = float(item[2]) if len(item) > 2 and item[2] is not None else None
            if not text or not box:
                continue
            xs = [point[0] for point in box if len(point) >= 2]
            ys = [point[1] for point in box if len(point) >= 2]
            if not xs or not ys:
                continue
            blocks.append({
                "text": text,
                "x1": int(min(xs)) + x_offset,
                "y1": int(min(ys)) + y_offset,
                "x2": int(max(xs)) + x_offset,
                "y2": int(max(ys)) + y_offset,
                "cx": round((min(xs) + max(xs)) / 2 + x_offset, 2),
                "cy": round((min(ys) + max(ys)) / 2 + y_offset, 2),
                "score": score
            })
        except Exception:
            continue
    return blocks

def group_blocks_into_lines(blocks: list[dict]) -> list[dict]:
    if not blocks:
        return []

    sorted_blocks = sorted(blocks, key=lambda item: (item["cy"], item["x1"]))
    lines = []

    for block in sorted_blocks:
        block_height = max(1, block["y2"] - block["y1"])
        matched_line = None

        for line in lines:
            line_height = max(1, line["y2"] - line["y1"])
            vertical_gap = abs(block["cy"] - line["cy"])
            overlap = max(0, min(block["y2"], line["y2"]) - max(block["y1"], line["y1"]))
            overlap_ratio = overlap / min(block_height, line_height)

            if vertical_gap <= max(20, int(min(block_height, line_height) * 0.8)) or overlap_ratio >= 0.45:
                matched_line = line
                break

        if not matched_line:
            lines.append({
                "blocks": [block],
                "x1": block["x1"],
                "y1": block["y1"],
                "x2": block["x2"],
                "y2": block["y2"],
                "cy": block["cy"],
            })
            continue

        matched_line["blocks"].append(block)
        matched_line["x1"] = min(matched_line["x1"], block["x1"])
        matched_line["y1"] = min(matched_line["y1"], block["y1"])
        matched_line["x2"] = max(matched_line["x2"], block["x2"])
        matched_line["y2"] = max(matched_line["y2"], block["y2"])
        matched_line["cy"] = round((matched_line["y1"] + matched_line["y2"]) / 2, 2)

    finalized = []
    for line in sorted(lines, key=lambda item: item["y1"]):
        ordered = sorted(line["blocks"], key=lambda item: item["x1"])
        text = ' '.join(block["text"] for block in ordered if block.get("text")).strip()
        compact_text = ''.join(block["text"] for block in ordered if block.get("text")).strip()
        finalized.append({
            "text": text,
            "compact_text": compact_text,
            "blocks": ordered,
            "x1": line["x1"],
            "y1": line["y1"],
            "x2": line["x2"],
            "y2": line["y2"],
            "cy": line["cy"],
        })

    return finalized

def is_positive_comment(text: str) -> bool:
    if not text:
        return False
    return any(kw in text for kw in POSITIVE_KEYWORDS)

def is_input_hint(text: str) -> bool:
    if not text:
        return False
    return any(hint in text for hint in INPUT_HINTS)

def normalize_name(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    value = re.sub(r'\s+', ' ', str(text)).strip()
    value = re.sub(r'^[=@]+', '', value).strip()
    value = re.sub(r'[=·•｜|].*$', '', value).strip()
    return value or None

def clean_text_line(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    value = re.sub(r'\s+', ' ', str(text)).strip()
    return value or None

def looks_like_noise(text: Optional[str]) -> bool:
    if not text:
        return True
    stripped = clean_text_line(text) or ''
    if not stripped:
        return True
    if len(stripped) <= 1:
        return True
    if all(ch.isdigit() for ch in stripped):
        return True
    if stripped in NOISE_EXACT_MARKERS:
        return True
    return any(re.search(pattern, stripped) for pattern in NOISE_LINE_PATTERNS)

def looks_like_comment_content(text: Optional[str]) -> bool:
    stripped = clean_text_line(text) or ''
    if not stripped:
        return False
    if looks_like_noise(stripped):
        return False
    if len(stripped) < 2 or len(stripped) > 120:
        return False
    if re.match(r'^\d+$', stripped):
        return False
    return True

def is_valid_author_candidate(text: Optional[str]) -> bool:
    candidate = normalize_name(text)
    if not candidate:
        return False
    if len(candidate) < 2 or len(candidate) > 30:
        return False
    if looks_like_noise(candidate):
        return False
    if re.search(r'(分钟|小时|天)前|刚刚', candidate):
        return False
    return True

def normalize_author_candidate(text: Optional[str]) -> Optional[str]:
    candidate = normalize_name(text)
    if not candidate:
        return None

    candidate = re.sub(r'[（(][^）)]*(主页置顶|置顶|主页)[^）)]*[）)]', '', candidate).strip()
    candidate = re.sub(r'[（(][oO0]\s*主页置顶[）)]', '', candidate).strip()

    for suffix in ['图文', '作品', '直播']:
        if candidate.endswith(suffix) and len(candidate) - len(suffix) >= 2:
            candidate = candidate[:-len(suffix)].strip()
            break

    candidate = re.sub(r'(拍同款|听抖音|分享|收藏|关注)$', '', candidate).strip()
    candidate = re.sub(r'\d{1,8}$', '', candidate).strip()
    candidate = re.sub(r'[^\u4e00-\u9fffA-Za-z0-9_~\-]+$', '', candidate).strip()

    return candidate or None

def is_clean_author_candidate(candidate: Optional[str]) -> bool:
    value = normalize_author_candidate(candidate)
    if not value:
        return False
    if len(value) < 2 or len(value) > 24:
        return False
    if re.search(r'(分钟|小时|天)前|刚刚|回复|评论|发布', value):
        return False
    return True

def extract_author_handle_from_text(text: Optional[str]) -> Optional[str]:
    stripped = clean_text_line(text) or ''
    if '@' not in stripped:
        return None
    suffix = stripped[stripped.find('@') + 1:]
    suffix = re.split(r'[#\s]', suffix, maxsplit=1)[0]
    return normalize_author_candidate(suffix)

def score_author_candidates(lines: list[dict], image_width: int, image_height: int, lower_ratio: float = 0.62, left_ratio: float = 0.55) -> list[dict]:
    candidates = []
    for index, line in enumerate(lines):
        compact_text = clean_text_line(line.get("compact_text")) or ''
        if '@' not in compact_text:
            continue
        x1 = line.get("x1") or 0
        y1 = line.get("y1") or 0
        if image_width and x1 > image_width * left_ratio:
            continue
        if image_height and y1 < image_height * lower_ratio:
            continue
        candidate = extract_author_handle_from_text(compact_text)
        if not candidate or not is_valid_author_candidate(candidate):
            continue
        score = 0
        if compact_text.startswith('@'):
            score += 4
        if x1 <= image_width * 0.28:
            score += 4
        elif x1 <= image_width * 0.4:
            score += 2
        if y1 >= image_height * 0.78:
            score += 4
        elif y1 >= image_height * 0.68:
            score += 2
        if 2 <= len(candidate) <= 18:
            score += 1
        candidates.append({
            "candidate": candidate,
            "score": score,
            "line": line,
            "index": index,
            "text": compact_text,
        })

    candidates.sort(key=lambda item: (item["score"], item["line"].get("y1", 0)), reverse=True)
    return candidates

def rerun_author_candidates_on_crop(img, crop_box: tuple[int, int, int, int], lower_ratio: float = 0.0) -> list[dict]:
    import numpy as np
    from PIL import Image, ImageEnhance, ImageOps

    crop = img.crop(crop_box)
    variants = [(crop, "base")]
    enlarged = crop.resize((max(1, crop.width * 2), max(1, crop.height * 2)), Image.LANCZOS)
    variants.append((enlarged, "up2"))
    gray = ImageOps.grayscale(enlarged).convert('RGB')
    gray = ImageEnhance.Contrast(gray).enhance(1.8)
    variants.append((gray, "gray"))

    merged: dict[str, dict] = {}
    for variant, source in variants:
        crop_array = np.array(variant)
        crop_result, _ = ocr_engine(crop_array)
        if not crop_result:
            continue
        crop_blocks = build_ocr_blocks(crop_result)
        crop_lines = group_blocks_into_lines(crop_blocks)
        crop_width = max(1, variant.width)
        crop_height = max(1, variant.height)
        scored = score_author_candidates(crop_lines, crop_width, crop_height, lower_ratio=lower_ratio, left_ratio=1.0)
        for item in scored:
            key = item["candidate"]
            existing = merged.get(key)
            boosted_score = item["score"] + (1 if source != "base" else 0)
            if not existing:
                merged[key] = {
                    **item,
                    "score": boosted_score,
                    "hits": 1,
                    "source": source,
                }
            else:
                existing["score"] = max(existing["score"], boosted_score)
                existing["hits"] += 1

    ranked = sorted(merged.values(), key=lambda item: (item["hits"], item["score"]), reverse=True)
    return ranked

def run_tesseract_on_image(image, lang: str = 'chi_sim+eng', psm: str = '6') -> str:
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = tmp.name
    try:
        image.save(tmp_path)
        result = subprocess.run(
            ['tesseract', tmp_path, 'stdout', '-l', lang, '--psm', psm],
            capture_output=True,
            text=True,
            timeout=12
        )
        return result.stdout or ''
    except Exception:
        return ''
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

def extract_author_candidates_from_tesseract_text(text: str) -> list[str]:
    candidates = []
    for raw_line in (text or '').splitlines():
        line = clean_text_line(raw_line) or ''
        if not line:
            continue
        handle = extract_author_handle_from_text(line)
        if handle and is_valid_author_candidate(handle) and re.search(r'[\u4e00-\u9fff]', handle):
            candidates.append(handle)
    return candidates

def score_tesseract_author_candidates_on_crop(img, crop_box: tuple[int, int, int, int]) -> list[dict]:
    from PIL import Image, ImageEnhance, ImageOps

    crop = img.crop(crop_box)
    variants = [
        ('tess_base', crop),
        ('tess_up2', crop.resize((max(1, crop.width * 2), max(1, crop.height * 2)), Image.LANCZOS)),
    ]
    gray = ImageOps.grayscale(variants[-1][1]).convert('RGB')
    gray = ImageEnhance.Contrast(gray).enhance(2.0)
    variants.append(('tess_gray', gray))

    merged: dict[str, dict] = {}
    for source, image_variant in variants:
        text = run_tesseract_on_image(image_variant)
        for candidate in extract_author_candidates_from_tesseract_text(text):
            existing = merged.get(candidate)
            score = 9 if source == 'tess_base' else 10
            if not existing:
                merged[candidate] = {
                    'candidate': candidate,
                    'score': score,
                    'hits': 1,
                    'source': source,
                    'text': candidate,
                }
            else:
                existing['hits'] += 1
                existing['score'] = max(existing['score'], score)

    return sorted(merged.values(), key=lambda item: (item['hits'], item['score']), reverse=True)

def scale_crop_box(crop_box: tuple[int, int, int, int], scale_x: float, scale_y: float, max_width: int, max_height: int) -> tuple[int, int, int, int]:
    return (
        max(0, min(max_width, int(crop_box[0] * scale_x))),
        max(0, min(max_height, int(crop_box[1] * scale_y))),
        max(1, min(max_width, int(crop_box[2] * scale_x))),
        max(1, min(max_height, int(crop_box[3] * scale_y))),
    )

def extract_creator_author_from_layout(lines: list[dict], image_width: int, image_height: int, img, source_img=None) -> Optional[str]:
    crop_source = source_img or img
    source_width, source_height = crop_source.size
    scale_x = source_width / max(1, image_width)
    scale_y = source_height / max(1, image_height)

    candidates = score_author_candidates(lines, image_width, image_height)
    if not candidates:
        broad_crop_ocr = (
            0,
            int(max(0, image_height * 0.66)),
            int(max(1, image_width * 0.62)),
            int(max(1, image_height * 0.94)),
        )
        broad_crop = scale_crop_box(broad_crop_ocr, scale_x, scale_y, source_width, source_height)
        crop_candidates = rerun_author_candidates_on_crop(crop_source, broad_crop, lower_ratio=0.0)
        if crop_candidates:
            best_crop = crop_candidates[0]
            if best_crop.get("hits", 1) >= 2 or best_crop.get("score", 0) >= 11:
                return best_crop["candidate"]
        tess_candidates = score_tesseract_author_candidates_on_crop(crop_source, broad_crop) if not crop_candidates else []
        combined = crop_candidates + tess_candidates
        if not combined:
            return None
        combined.sort(key=lambda item: (item.get("hits", 1), item.get("score", 0)), reverse=True)
        return combined[0]["candidate"]

    best = candidates[0]
    if best.get("score", 0) >= 11 and is_clean_author_candidate(best.get("candidate")):
        return best["candidate"]
    best_line = best["line"]
    crop_box_ocr = (
        0,
        max(0, int((best_line.get("y1") or 0) - 48)),
        min(image_width, int(max((best_line.get("x2") or 0) + 120, image_width * 0.62))),
        min(image_height, int((best_line.get("y2") or 0) + 72)),
    )
    crop_box = scale_crop_box(crop_box_ocr, scale_x, scale_y, source_width, source_height)
    crop_candidates = rerun_author_candidates_on_crop(crop_source, crop_box, lower_ratio=0.0)
    if crop_candidates:
        best_crop = crop_candidates[0]
        if best_crop.get("hits", 1) >= 2 or best_crop.get("score", 0) >= 11:
            return best_crop["candidate"]
    tess_candidates = score_tesseract_author_candidates_on_crop(crop_source, crop_box) if not crop_candidates else []
    combined = crop_candidates + tess_candidates
    if combined:
        combined.sort(key=lambda item: (item.get("hits", 1), item.get("score", 0)), reverse=True)
        return combined[0]["candidate"]
    return best["candidate"]

def is_meta_line(text: Optional[str]) -> bool:
    stripped = clean_text_line(text) or ''
    if not stripped:
        return False
    meta_patterns = [
        r'^\d+\s*(分钟|小时|天)前',
        r'^刚刚',
        r'^回复$',
        r'.*回复.*',
        r'.*IP属地.*',
        r'.*作者赞过.*',
        r'^展开.*回复',
        r'.*去发布作品.*',
        r'.*发布作品.*',
        r'.*流量奖励.*',
    ]
    return any(re.search(pattern, stripped) for pattern in meta_patterns)

def extract_nickname_candidate_from_line(line: dict) -> tuple[Optional[str], bool]:
    blocks = line.get("blocks", [])
    compact_text = clean_text_line(line.get("compact_text")) or ''
    standalone_my = False

    for block_index, block in enumerate(blocks):
        block_text = clean_text_line(block.get("text")) or ''
        if block_text == '我':
            standalone_my = True
            left_text = ''.join(
                clean_text_line(item.get("text")) or ''
                for item in blocks[:block_index]
            ).strip()
            candidate = normalize_name(left_text)
            if candidate:
                return candidate, True

    compact_match = re.match(r'^(.{1,20}?)我$', compact_text)
    if compact_match:
        candidate = normalize_name(compact_match.group(1))
        if candidate:
            return candidate, standalone_my

    return None, standalone_my

def looks_like_nickname(candidate: Optional[str]) -> bool:
    value = normalize_name(candidate)
    if not value:
        return False
    if len(value) < 1 or len(value) > 20:
        return False
    if re.fullmatch(r'\d{1,20}', value):
        return True
    if any(token in value for token in ['我的', '我们', '回复我', '我觉得', '我要', '我来', '我在']):
        return False
    if looks_like_noise(value):
        return False
    if re.search(r'[，。！？；：,.!?;:]', value):
        return False
    return True

def is_probable_next_nickname_line(line: dict) -> bool:
    candidate, standalone_my = extract_nickname_candidate_from_line(line)
    compact_text = clean_text_line(line.get("compact_text")) or ''
    if not candidate or not looks_like_nickname(candidate):
        return False
    if len(compact_text) > 22:
        return False
    return standalone_my or compact_text.endswith('我')

def content_aligns_with_nickname(content_line: dict, nickname_line: dict) -> bool:
    if not content_line or not nickname_line:
        return False
    return abs((content_line.get("x1") or 0) - (nickname_line.get("x1") or 0)) <= 180

def candidate_confidence_from_score(score: int) -> str:
    if score >= 12:
        return 'high'
    if score >= 8:
        return 'medium'
    return 'low'

def find_comment_zone_start(texts: list) -> int:
    markers = ['条评论', '发表评论', '发条评论', '和大家一起讨论', '全部评论']
    for i, t in enumerate(texts):
        if any(marker in (t or '') for marker in markers):
            return i
    return 0

def find_comment_zone_start_line(lines: list[dict]) -> int:
    markers = ['条评论', '发表评论', '发条评论', '和大家一起讨论', '全部评论']
    for i, line in enumerate(lines):
        if any(marker in line.get("compact_text", '') for marker in markers):
            return i + 1
    return 0

def extract_first_comment_from_lines(lines: list[dict], start_index: int = 0) -> tuple[Optional[str], Optional[str], str]:
    candidates = build_comment_candidates(lines, start_index)
    if candidates:
        first = candidates[0]
        return first.get("nickname"), first.get("content"), first.get("confidence", "medium")

    return None, None, 'low'

def build_comment_candidates(lines: list[dict], start_index: int = 0) -> list[dict]:
    candidates = []
    for idx in range(max(0, start_index), len(lines)):
        line = lines[idx]
        line_text = clean_text_line(line.get("compact_text")) or ''
        if not line_text or looks_like_noise(line_text):
            continue

        nickname_candidate, standalone_my = extract_nickname_candidate_from_line(line)
        if nickname_candidate and not looks_like_nickname(nickname_candidate):
            nickname_candidate = None

        if not nickname_candidate:
            continue

        content_lines = []
        meta_lines = []
        meta_started = False
        scan_window = min(len(lines), idx + 8)
        for follow_idx in range(idx + 1, scan_window):
            follow = lines[follow_idx]
            follow_line = clean_text_line(follow.get("compact_text")) or ''
            if not follow_line:
                continue

            if is_probable_next_nickname_line(follow):
                break

            if is_meta_line(follow_line):
                meta_started = True
                meta_lines.append(follow_line)
                continue

            if meta_started:
                break

            if looks_like_comment_content(follow_line) and content_aligns_with_nickname(follow, line):
                content_lines.append(follow_line)
                continue

            if content_lines and not looks_like_comment_content(follow_line):
                break

        score = 0
        if standalone_my:
            score += 4
        elif line_text.endswith('我'):
            score += 3
        if looks_like_nickname(nickname_candidate):
            score += 3
        if idx <= max(0, start_index) + 2:
            score += 3
        if content_lines:
            score += 4
        if meta_lines:
            score += 4
        if content_lines and len(content_lines[0]) >= 3:
            score += 1
        if len(content_lines) >= 2:
            score += 1

        if content_lines or meta_lines:
            limited_content_lines = content_lines[:4]
            content = ' '.join(limited_content_lines).strip() if limited_content_lines else None
            confidence = candidate_confidence_from_score(score if content_lines else min(score, 7))
            candidates.append({
                "nickname": nickname_candidate,
                "content": content,
                "confidence": confidence,
                "score": score if content_lines else min(score, 7),
                "meta_line": meta_lines[0] if meta_lines else None,
                "meta_lines": meta_lines[:3],
                "start_line": idx,
                "end_line": min(scan_window - 1, idx + len(content_lines) + len(meta_lines)),
                "nickname_line": line_text,
                "content_lines": limited_content_lines,
                "contentMissing": not bool(content_lines)
            })

    return candidates

def extract_commenter_nickname(texts: list, start_index: int = 0) -> tuple[Optional[str], int]:
    for i in range(start_index, len(texts)):
        t = texts[i]
        stripped = t.strip()

        match = re.match(r'^(\d{6,})我$', stripped)
        if match:
            return normalize_name(match.group(1)), i

        if stripped.endswith('我') and len(stripped) > 2 and re.search(r'[\u4e00-\u9fff]', stripped) and len(stripped) <= 20:
            candidate = normalize_name(stripped[:-1])
            if candidate and candidate not in ['我', '咱', '你']:
                return candidate, i

        timed_match = re.match(r'^(.+?)(?:\s*[·•]?\s*)(?:\d+\s*(?:分钟|小时|天)前|刚刚)$', stripped)
        if timed_match:
            candidate = normalize_name(timed_match.group(1))
            if candidate and len(candidate) >= 2 and not any(marker in candidate for marker in ['评论', '回复', '条评论']):
                return candidate, i

        timed_location_match = re.match(r'^(.+?)(?:\s*[·•]?\s*)(?:\d+\s*(?:分钟|小时|天)前|刚刚)(?:\s*[·•]\s*[^\\s].*)?$', stripped)
        if timed_location_match:
            candidate = normalize_name(timed_location_match.group(1))
            if candidate and is_valid_author_candidate(candidate):
                return candidate, i

    return None, -1

def extract_creator_author(texts: list) -> Optional[str]:
    at_candidates = []
    title_candidates = []

    for t in texts:
        stripped = t.strip()
        timed_at_match = re.search(r'@(.+?)(?:图文|作品|直播)?\s*[·•]\s*(?:\d+\s*(?:分钟|小时|天)前|刚刚)', stripped)
        if timed_at_match:
            candidate = normalize_author_candidate(timed_at_match.group(1))
            if is_valid_author_candidate(candidate):
                at_candidates.append(candidate)
                continue

        match = re.search(r'@([^\s=·•｜|#]+)', stripped)
        if match:
            candidate = normalize_author_candidate(match.group(1))
            if is_valid_author_candidate(candidate):
                at_candidates.append(candidate)

    for i, t in enumerate(texts):
        stripped = clean_text_line(t) or ''
        line_match = re.match(r'^(.{2,30}?)\s*粉丝', stripped)
        if line_match:
            candidate = normalize_author_candidate(line_match.group(1))
            if is_valid_author_candidate(candidate):
                title_candidates.append(candidate)

        if ('粉丝' in stripped or '获赞' in stripped) and i > 0:
            candidate = normalize_author_candidate(texts[i - 1])
            if is_valid_author_candidate(candidate):
                title_candidates.append(candidate)

    for t in texts:
        stripped = clean_text_line(t) or ''
        work_match = re.match(r'^(.+?)(?:的图文作品|的作品)$', stripped)
        if work_match:
            candidate = normalize_author_candidate(work_match.group(1))
            if is_valid_author_candidate(candidate):
                title_candidates.append(candidate)

    for title_candidate in title_candidates:
        for at_candidate in at_candidates:
            if at_candidate.startswith(title_candidate):
                return title_candidate
            if title_candidate.startswith(at_candidate):
                return at_candidate

    if title_candidates:
        return min(title_candidates, key=len)

    if at_candidates:
        return min(at_candidates, key=len)

    return None

def has_comment_zone(texts: list) -> bool:
    markers = ['条评论', '发条评论', '发表评论', '和大家一起讨论', '回复', '首评', '刚刚']
    return any(any(marker in t for marker in markers) for t in texts)

def extract_comment_after_author(texts: list, author_index: int) -> Optional[str]:
    """在评论人后面找评论内容"""
    for i in range(author_index + 1, len(texts)):
        t = (clean_text_line(texts[i]) or '').strip()
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
        if looks_like_noise(t):
            continue
        return t
    return None

def is_time_marker_line(text: Optional[str]) -> bool:
    stripped = clean_text_line(text) or ''
    if not stripped:
        return False
    return bool(re.match(r'^(?:\d+\s*(?:分钟|小时|天)前|刚刚)(?:\s*[·•]\s*[^\\s].*)?$', stripped))

def extract_comment_pairs(texts: list, start_index: int = 0) -> list[tuple[str, str]]:
    pairs = []
    i = max(0, start_index)

    while i < len(texts):
        nickname, nickname_index = extract_commenter_nickname(texts, i)
        if not nickname or nickname_index < i:
            i += 1
            continue

        content_lines = []
        j = nickname_index + 1
        while j < len(texts):
            line = clean_text_line(texts[j]) or ''
            if not line:
                j += 1
                continue
            if is_time_marker_line(line):
                break
            if line in ['回复', '去发布作品'] or '去发布作品' in line:
                j += 1
                continue
            if '回复' in line and ('刚刚' in line or '分钟前' in line or '小时前' in line):
                j += 1
                continue
            if looks_like_noise(line):
                j += 1
                continue
            content_lines.append(line)
            j += 1

        content = clean_text_line(' '.join(content_lines))
        if nickname and content:
            pairs.append((nickname, content))

        i = max(j + 1, nickname_index + 1)

    return pairs

def process_image(image_path: str, image_type: str = None):
    try:
        from PIL import Image
        import numpy as np
        
        normalized_requested_type, request_allowed = validate_profile_request(image_type)
        if OCR_ENFORCE_PROFILE and not request_allowed:
            return OCRResponse(
                has_comment_keyword=False,
                detected_type=normalized_requested_type,
                extraction_confidence='profile_rejected'
            )
        
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        source_img = img.copy()
        
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
        
        blocks = build_ocr_blocks(result)
        lines = group_blocks_into_lines(blocks)
        texts = [block["text"] for block in blocks]
        texts = [text for text in texts if text]
        full_text = '\n'.join(texts)
        
        print(f"[OCR] 节点 {OCR_NODE_ID} 识别到 {len(texts)} 行文本, image_type={image_type or 'unknown'}")
        for i, t in enumerate(texts):
            print(f"  [{i}] {t}")
        
        comment_zone = has_comment_zone(texts)
        comment_zone_start = find_comment_zone_start(texts)
        comment_zone_start_line = find_comment_zone_start_line(lines)
        quick_author = extract_creator_author(texts)
        creator_author = None
        author = None
        author_name = None
        commenter_nickname = None
        comment = None
        is_positive = None
        author_index = -1
        comment_candidates = []
        first_comment = None
        extraction_confidence = None
        normalized_image_type = normalized_requested_type or (image_type or '').strip().lower()
        detected_type = None

        # 判型优先级：显式角色 > 主页图存在达人名 > 评论区特征
        if normalized_image_type in ['comment', 'comments']:
            creator_author = None
        elif normalized_image_type in ['homepage', 'profile']:
            creator_author = extract_creator_author_from_layout(lines, img.size[0], img.size[1], img, source_img=source_img) or quick_author
        elif quick_author and not comment_zone:
            creator_author = quick_author
        elif not comment_zone:
            creator_author = extract_creator_author_from_layout(lines, img.size[0], img.size[1], img, source_img=source_img) or quick_author
        else:
            creator_author = quick_author

        author_name = creator_author

        if normalized_image_type in ['homepage', 'profile'] and creator_author:
            detected_type = 'homepage'
        elif normalized_image_type in ['comment', 'comments']:
            detected_type = 'comment'
        elif creator_author and normalized_image_type in ['homepage', 'profile']:
            detected_type = 'homepage'
        elif commenter_nickname or (comment_zone and not creator_author):
            detected_type = 'comment'
        elif creator_author:
            detected_type = 'homepage'
        else:
            detected_type = 'comment' if comment_zone else 'homepage'

        has_comment = detected_type == 'comment'

        if detected_type == 'homepage':
            author = creator_author
            commenter_nickname = None
            comment = None
            is_positive = None
            print(f"[OCR] 检测到达人主页 (类型B)，提取达人名字: {author}")
        else:
            # 评论图优先按结构化“第一条评论块”提取
            comment_candidates = build_comment_candidates(lines, comment_zone_start_line)
            first_comment = comment_candidates[0] if comment_candidates else None
            commenter_nickname, comment, confidence = extract_first_comment_from_lines(lines, comment_zone_start_line)
            extraction_confidence = confidence
            if commenter_nickname:
                print(f"[OCR] 结构化提取评论人: {commenter_nickname}, confidence={confidence}")
            if comment:
                print(f"[OCR] 结构化提取评论内容: {comment}")
                is_positive = is_positive_comment(comment)
            elif not first_comment and not commenter_nickname:
                # 兜底：仍限制在评论区之后
                commenter_nickname, author_index = extract_commenter_nickname(texts, comment_zone_start)
                if commenter_nickname:
                    print(f"[OCR] 兜底提取评论人: {commenter_nickname}")

                if author_index >= 0:
                    comment = extract_comment_after_author(texts, author_index)
                    if comment:
                        print(f"[OCR] 兜底提取评论内容: {comment}")
                        is_positive = is_positive_comment(comment)

            author = commenter_nickname
            if not commenter_nickname:
                comment = None
            if not first_comment and commenter_nickname and comment:
                first_comment = {
                    "nickname": commenter_nickname,
                    "content": comment,
                    "confidence": extraction_confidence or 'low',
                    "meta_line": None,
                    "start_line": max(comment_zone_start_line, 0),
                    "end_line": max(comment_zone_start_line, 0),
                    "nickname_line": commenter_nickname,
                    "content_lines": [comment],
                }
            print(f"[OCR] 检测到评论截图 (类型A)，提取评论人: {author or '没有'}")
        
        return OCRResponse(
            has_comment_keyword=has_comment,
            author=author,
            author_name=author_name,
            commenter_nickname=commenter_nickname,
            comment=comment,
            ocr_text=full_text[:500],
            is_positive=is_positive,
            detected_type=detected_type,
            raw_blocks=blocks[:120],
            comment_candidates=comment_candidates[:5] if comment_candidates else None,
            first_comment=first_comment,
            extraction_confidence=extraction_confidence
        )
    except Exception as e:
        print(f"[OCR] 处理错误: {e}")
        import traceback
        traceback.print_exc()
        return OCRResponse(has_comment_keyword=False)

async def run_ocr_job(image_path: str, image_type: Optional[str] = None) -> OCRResponse:
    global ocr_in_flight_requests
    async with ocr_request_semaphore:
        with ocr_request_counter_lock:
            ocr_in_flight_requests += 1
        try:
            return await run_in_threadpool(process_image, image_path, image_type)
        finally:
            with ocr_request_counter_lock:
                ocr_in_flight_requests = max(0, ocr_in_flight_requests - 1)

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
            return await run_ocr_job(tmp_path, request.image_type)
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
            return await run_ocr_job(tmp_path, image_type)
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
    return {
        "status": "ok",
        "node": OCR_NODE_ID,
        "profile": OCR_PROFILE,
        "enforce_profile": OCR_ENFORCE_PROFILE,
        "in_flight": ocr_in_flight_requests,
        "max_concurrency": OCR_MAX_CONCURRENT_REQUESTS,
    }

@app.get("/health")
async def health_alias():
    return {
        "status": "ok",
        "node": OCR_NODE_ID,
        "profile": OCR_PROFILE,
        "enforce_profile": OCR_ENFORCE_PROFILE,
        "in_flight": ocr_in_flight_requests,
        "max_concurrency": OCR_MAX_CONCURRENT_REQUESTS,
    }

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 9001))
    print(
        f"[OCR] 启动服务，端口: {port}, node={OCR_NODE_ID}, "
        f"profile={OCR_PROFILE}, enforce_profile={OCR_ENFORCE_PROFILE}"
    )
    uvicorn.run(app, host="0.0.0.0", port=port)
