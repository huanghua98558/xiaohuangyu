import logger from "../../utils/logger.js"
import {
  getConfigValue,
  getConfigValues,
  setConfigValue,
} from "../systemConfigService.js"

const configCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

export async function getConfig(key) {
  try {
    const cached = configCache.get(key)
    if (cached && cached.time && Date.now() - cached.time < CACHE_TTL) {
      return cached.value
    }
    
    const value = await getConfigValue(key, null)
    
    configCache.set(key, { value, time: Date.now() })
    return value
  } catch (err) {
    logger.error("获取配置失败:", err.message)
    return null
  }
}

export async function getPublisherConfig() {
  const configs = await getConfigs(["publisher_api_provider", "publisher_api_base_url", "publisher_api_key", "publisher_model", "publisher_system_prompt"])
  return {
    provider: configs.publisher_api_provider || "doubao",
    baseUrl: configs.publisher_api_base_url || "",
    apiKey: configs.publisher_api_key || "",
    model: configs.publisher_api_model || "doubao-seed-1-8-251228",
    systemPrompt: configs.publisher_system_prompt || ""
  }
}

export async function getReviewerConfig() {
  const configs = await getConfigs(["reviewer_api_provider", "reviewer_api_base_url", "reviewer_api_key", "reviewer_model", "reviewer_system_prompt"])
  return {
    provider: configs.reviewer_api_provider || "doubao",
    baseUrl: configs.reviewer_api_base_url || "",
    apiKey: configs.reviewer_api_key || "",
    model: configs.reviewer_model || "Qwen/Qwen2-VL-72B-Instruct",
    systemPrompt: configs.reviewer_system_prompt || ""
  }
}

export async function getConfigs(keys) {
  try {
    return await getConfigValues(keys)
  } catch (err) {
    logger.error("批量获取配置失败:", err.message)
    return {}
  }
}

export async function setConfig(key, value) {
  try {
    await setConfigValue(key, value)
    configCache.set(key, { value, time: Date.now() })
    return true
  } catch (err) {
    logger.error("设置配置失败:", err.message)
    return false
  }
}

export async function getAllConfigs(category = null) {
  try {
    const configs = await prisma.configs.findMany()
    const list = configs.map((c) => ({
      key: c.key,
      value: c.value || "",
      category: CONFIG_CATEGORIES[c.key] || "other",
      type: typeof c.value === "string" && (c.value === "true" || c.value === "false") ? "boolean" : "string",
      isEnabled: true
    }))

    if (category) {
      return list.filter((item) => item.category === category)
    }

    return list
  } catch (err) {
    logger.error("获取所有配置失败:", err.message)
    return []
  }
}

// 配置分类映射
const CONFIG_CATEGORIES = {
  defaultTimeLimitMinutes: "basic",
  maxConcurrentPerUser: "basic",
  cityLimitPerTask: "basic",
  provinceLimitPerTask: "basic",
  taskPoolEnabled: "basic",
  taskPoolRefreshInterval: "basic",
  taskPoolSize: "basic",
  publisher_api_provider: "publisher",
  publisher_api_provider_name: "publisher",
  publisher_api_base_url: "publisher",
  publisher_api_key: "publisher",
  publisher_model: "publisher",
  publisher_system_prompt: "publisher",
  publisher_temperature: "publisher",
  default_task_reward: "task",
  default_task_remain: "task",
  default_task_time_limit: "task",
  reviewer_api_provider: "reviewer",
  reviewer_api_provider_name: "reviewer",
  reviewer_api_base_url: "reviewer",
  reviewer_api_key: "reviewer",
  reviewer_model: "reviewer",
  reviewer_system_prompt: "reviewer",
  reviewer_temperature: "reviewer",
  ai_review_enabled: "ai_review",
  ai_review_mode: "ai_review",
  ai_approve_threshold: "ai_review",
  ai_reject_threshold: "ai_review",
  random_check_rate: "ai_review",
  fingerprint_check_enabled: "ai_review",
  credit_check_enabled: "ai_review",
  llm_model: "llm",
  llm_temperature: "llm",
  user_assistant_system_prompt: "llm",
  max_conversation_history: "llm",
  queue_batch_size: "queue",
  queue_poll_interval: "queue",
  ai_review_trigger_mode: "trigger",
  ai_review_schedule_interval: "trigger",
  ai_review_callback_enabled: "trigger",
  ai_review_callback_url: "trigger",
  ai_review_notify_user: "trigger",
  ai_review_auto_approve: "trigger",
  ai_review_auto_reject: "trigger",
  ai_review_manual_fallback: "trigger",
  ai_review_max_retry: "trigger",
  ai_review_timeout: "trigger",
  browser_automation_enabled: "browser",
  browser_automation_timeout: "browser",
  image_review_enabled: "image_review",
  image_review_fallback_enabled: "image_review",
  image_review_primary_model: "image_review",
  image_review_fallback_model: "image_review",
  image_review_compression_threshold: "image_review",
  image_review_max_retry: "image_review",
  image_review_api_timeout: "image_review",
  ocr_confidence_threshold: "image_review",
  ocr_use_gpu: "image_review",
  ocr_language: "image_review",
  yolo_confidence_threshold: "image_review",
  yolo_model_path: "image_review",
  image_ai_provider: "image_review",
  image_ai_model: "image_review",
  image_ai_api_key: "image_review",
  image_ai_base_url: "image_review",
  semantic_ai_provider: "semantic",
  semantic_ai_model: "semantic",
  semantic_ai_api_key: "semantic",
  semantic_ai_base_url: "semantic",
  semantic_ai_temperature: "semantic",
  semantic_ai_max_tokens: "semantic",
  user_assistant_api_provider: "assistant",
  user_assistant_api_base_url: "assistant",
  user_assistant_api_key: "assistant",
  user_assistant_model: "assistant",
  user_assistant_system_prompt: "assistant",
  task_default_description: "assistant",
  task_default_steps: "assistant",
  task_xiaohongshu_description: "assistant",
  task_xiaohongshu_steps: "assistant",
  task_douyin_description: "assistant",
  task_douyin_steps: "assistant",
  task_weibo_description: "assistant",
  task_weibo_steps: "assistant"
}

// 获取所有配置为数组格式（用于前端AI管理中心）
export async function getAllConfigsAsArray() {
  try {
    return await getAllConfigs()
  } catch (err) {
    logger.error("获取配置数组失败:", err.message)
    return []
  }
}

// 默认配置
const DEFAULT_CONFIGS = {
  publisher_api_provider: "doubao",
  publisher_api_base_url: "",
  publisher_api_key: "",
  publisher_model: "doubao-seed-1-8-251228",
  publisher_system_prompt: "",
  reviewer_api_provider: "doubao",
  reviewer_api_base_url: "",
  reviewer_api_key: "",
  reviewer_model: "Qwen/Qwen2-VL-72B-Instruct",
  reviewer_system_prompt: ""
}

export async function initDefaultConfigs() {
  try {
    for (const [key, value] of Object.entries(DEFAULT_CONFIGS)) {
      const existing = await getConfigValue(key, null)
      if (!existing) {
        await setConfigValue(key, value)
        logger.info("初始化配置: " + key)
      }
    }
    return true
  } catch (err) {
    logger.error("初始化默认配置失败:", err.message)
    return false
  }
}

export async function getUserAssistantConfig() {
  const configs = await getConfigs(["user_assistant_api_provider", "user_assistant_api_base_url", "user_assistant_api_key", "user_assistant_model", "user_assistant_system_prompt"])
  return {
    provider: configs.user_assistant_api_provider || "doubao",
    baseUrl: configs.user_assistant_api_base_url || "",
    apiKey: configs.user_assistant_api_key || "",
    model: configs.user_assistant_model || "doubao-seed-1-8-251228",
    systemPrompt: configs.user_assistant_system_prompt || ""
  }
}

export async function getQueueConfig() {
  const configs = await getConfigs(["queue_max_size", "queue_process_interval", "queue_retry_count"])
  return {
    maxSize: parseInt(configs.queue_max_size) || 100,
    processInterval: parseInt(configs.queue_process_interval) || 5000,
    retryCount: parseInt(configs.queue_retry_count) || 3
  }
}

export function clearCache() {
  configCache.clear()
}

export default { 
  getConfig, 
  getPublisherConfig, 
  getReviewerConfig, 
  getConfigs, 
  setConfig, 
  getAllConfigs,
  getAllConfigsAsArray,
  initDefaultConfigs,
  getUserAssistantConfig,
  getQueueConfig,
  clearCache
}
