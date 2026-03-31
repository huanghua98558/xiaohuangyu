import {
  getScreenshotRoleLabel,
  isCommentScreenshotRole,
} from '../../utils/claimScreenshots.js';
import {
  createCombinedEvidence,
  mergeOcrEvidence,
} from './ocrResultNormalizer.js';
import { collectImageReviewTechnicalReasons } from './imageReviewDecisionService.js';

export async function processImageReviewScreenshots({
  screenshots,
  callOCR,
  callYOLO,
  urlToLocalPath,
  routePlan = null,
  onOcrJobProcessing = null,
  onOcrJobCompleted = null,
  onOcrJobFailed = null,
}) {
  const combinedEvidence = createCombinedEvidence('ocr_yolo');
  let yoloResult = null;
  const screenshotPaths = [];
  const routeByScreenshotIndex = new Map(
    (routePlan?.routes || []).map((route) => [route.screenshotIndex, route])
  );
  const hasHomepageScreenshot = screenshots.some((screenshot, index) => {
    const resolvedRole =
      screenshot?.precheckResolvedRole ||
      screenshot?.expectedRole ||
      screenshot?.role ||
      (index === 0 ? 'homepage' : 'comment');
    return !isCommentScreenshotRole(resolvedRole);
  });

  console.log(`[Worker] 共 ${screenshots.length} 张截图待处理`);

  for (let i = 0; i < screenshots.length; i++) {
    const screenshot = screenshots[i];
    const screenshotIndex = i + 1;
    const imageUrl = screenshot.url || screenshot;
    const expectedRole = screenshot.expectedRole || screenshot.role || (i === 0 ? 'homepage' : 'comment');
    const resolvedRole = screenshot.precheckResolvedRole || expectedRole;
    const route = routeByScreenshotIndex.get(screenshotIndex) || null;
    const imagePath = urlToLocalPath(imageUrl);

    if (!imagePath) {
      console.log(`[Worker] 第 ${i + 1} 张图片路径解析失败，跳过`);
      if (route?.dispatchKey && typeof onOcrJobFailed === 'function') {
        await onOcrJobFailed({
          dispatchKey: route.dispatchKey,
          error: {
            code: 'path_failed',
            message: '图片路径解析失败，未进入 OCR',
            screenshotIndex,
          },
        });
      }
      combinedEvidence.screenshots.push({
        screenshotIndex,
        source: 'ocr',
        status: 'path_failed',
        expectedRole,
      });
      continue;
    }

    screenshotPaths.push(imagePath);

    console.log(
      `[Worker] 处理第 ${screenshotIndex} 张截图 (预期=${getScreenshotRoleLabel(expectedRole)}, 预判=${getScreenshotRoleLabel(resolvedRole)})...`
    );

    // 调用 OCR；如果 OCR 服务失败，仅做技术兜底，不再进入审核级 AI 复审。
    if (route?.dispatchKey && typeof onOcrJobProcessing === 'function') {
      await onOcrJobProcessing({
        dispatchKey: route.dispatchKey,
        screenshotIndex,
      });
    }

    const ocrResult = await callOCR(imagePath, resolvedRole);
    if (!ocrResult) {
      console.log(`[Worker] 第 ${screenshotIndex} 张 OCR 失败，标记为识别失败`);
      if (route?.dispatchKey && typeof onOcrJobFailed === 'function') {
        await onOcrJobFailed({
          dispatchKey: route.dispatchKey,
          error: {
            code: 'ocr_failed',
            message: 'OCR 服务识别失败',
            screenshotIndex,
            expectedRole,
            resolvedRole,
          },
        });
      }
      combinedEvidence.screenshots.push({
        screenshotIndex,
        source: 'ocr',
        status: 'failed',
        expectedRole,
      });
      continue;
    }

    if (route?.dispatchKey && typeof onOcrJobCompleted === 'function') {
      await onOcrJobCompleted({
        dispatchKey: route.dispatchKey,
        ocrResult,
        screenshotIndex,
      });
    }

    console.log(`[Worker] 第 ${screenshotIndex} 张 OCR 结果: hasComment=${ocrResult.has_comment_keyword}, author=${ocrResult.author}, comment=${ocrResult.comment}`);

    const isCommentScreenshot = mergeOcrEvidence(combinedEvidence, ocrResult, screenshotIndex, expectedRole);
    const detectedRole = isCommentScreenshot ? 'comment' : 'homepage';
    const roleMismatch =
      expectedRole !== 'extra' &&
      ((isCommentScreenshot && !isCommentScreenshotRole(expectedRole)) ||
        (!isCommentScreenshot && isCommentScreenshotRole(expectedRole)));

    if (roleMismatch) {
      combinedEvidence.screenshots.push({
        screenshotIndex,
        source: 'routing',
        status: 'role_mismatch',
        expectedRole,
        detectedRole,
        note: '截图角色与默认顺序不一致，已按识别结果纠偏',
      });
    } else if (resolvedRole !== expectedRole) {
      combinedEvidence.screenshots.push({
        screenshotIndex,
        source: 'precheck',
        status: 'role_prechecked',
        expectedRole,
        detectedRole: resolvedRole,
        note: `预判阶段已先按 ${resolvedRole} 路由 OCR`,
      });
    }

    // 只有主页类截图才调用 YOLO，YOLO 只负责识别主页上的点赞/收藏/关注按钮状态。
    if (!isCommentScreenshot && !yoloResult) {
      console.log(`[Worker] 第 ${screenshotIndex} 张主页类截图，调用 YOLO 检测互动按钮状态...`);
      yoloResult = await callYOLO(imagePath);
      console.log(`[Worker] YOLO 结果: ${JSON.stringify(yoloResult)}`);
    }
  }

  const technicalFailureReasons = collectImageReviewTechnicalReasons(combinedEvidence.screenshots, {
    hasHomepageScreenshot,
    yoloResult,
  });

  return {
    combinedEvidence,
    yoloResult,
    screenshotPaths,
    hasHomepageScreenshot,
    technicalFailureReasons,
  };
}

export default {
  processImageReviewScreenshots,
};

