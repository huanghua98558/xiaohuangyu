import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createImageReviewOcrConsumer } from '../services/ocr/imageReviewOcrConsumerService.js';

const CURRENT_FILE = fileURLToPath(import.meta.url);

function shouldAutoStartWorker() {
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  const pm2ExecPath = process.env.pm_exec_path ? path.resolve(process.env.pm_exec_path) : null;
  const runningUnderPm2 = process.env.pm_id !== undefined;
  return runningUnderPm2 || argvPath === CURRENT_FILE || pm2ExecPath === CURRENT_FILE;
}

export class CommentOcrWorker {
  constructor() {
    this.running = false;
    this.consumer = createImageReviewOcrConsumer({
      ocrProfile: 'comment',
      workerName: 'commentOcrWorker',
    });
  }

  async start() {
    console.log('[CommentOcrWorker] 骨架模式启动');
    console.log('[CommentOcrWorker] 当前支持常驻轮询 pending comment OCR job，并在处理后刷新 merge 状态');
    this.running = true;
    this.poll();
  }

  stop() {
    this.running = false;
  }

  async processNextJob() {
    return this.consumer.processNextJob();
  }

  async poll() {
    while (this.running) {
      try {
        const result = await this.processNextJob();
        if (!result) {
          await this.consumer.waitForNextPoll('idle');
          continue;
        }

        console.log('[CommentOcrWorker] OCR job 已处理:', JSON.stringify({
          dispatchKey: result.job?.dispatch_key,
          status: result.status,
          mergeReady: result.mergeState?.mergePayload?.readiness?.ready || false,
        }));
      } catch (error) {
        console.error(`[CommentOcrWorker] 轮询处理失败: ${error.message}`);
        await this.consumer.waitForNextPoll('error');
      }
    }
  }
}

export default {
  CommentOcrWorker,
};

if (shouldAutoStartWorker()) {
  const worker = new CommentOcrWorker();
  worker.start().catch(console.error);
}

