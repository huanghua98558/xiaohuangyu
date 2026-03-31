import { isCommentScreenshotRole } from '../../utils/claimScreenshots.js';
import { OCR_PROFILE } from '../../utils/ocrServicePools.js';

export function getOcrPoolByRole(role, servicePools) {
  return isCommentScreenshotRole(role) ? servicePools.comment : servicePools.homepage;
}

export function getOcrProfileByRole(role) {
  return isCommentScreenshotRole(role) ? OCR_PROFILE.COMMENT : OCR_PROFILE.HOMEPAGE;
}

export function getOcrRedisKeyByRole(role, redisKeys) {
  return isCommentScreenshotRole(role)
    ? redisKeys.OCR_INDEX_COMMENT
    : redisKeys.OCR_INDEX_HOMEPAGE;
}

export async function getNextOcrService({
  role = 'homepage',
  servicePools,
  serviceConfigs,
  redisClient,
  redisKeys,
  isServiceQuarantined,
}) {
  const pool = getOcrPoolByRole(role, servicePools);
  const servicePool = pool.length > 0 ? pool : servicePools.all;
  if (servicePool.length === 0) {
    return null;
  }

  const healthyServices = serviceConfigs.filter(
    (service) => servicePool.includes(service.url) && service.healthy && !isServiceQuarantined(service)
  );
  if (healthyServices.length === 0) {
    return null;
  }

  try {
    const key = getOcrRedisKeyByRole(role, redisKeys);
    const index = await redisClient.incr(key);
    const healthyIndex = (index - 1) % healthyServices.length;
    return healthyServices[healthyIndex]?.url || null;
  } catch {
    return healthyServices[Math.floor(Math.random() * healthyServices.length)]?.url || null;
  }
}

export function buildOcrServicesToTry({
  role = 'homepage',
  preferredUrl,
  servicePools,
  serviceConfigs,
  allowCrossProfileFallback = false,
  isServiceQuarantined,
}) {
  const poolUrls = getOcrPoolByRole(role, servicePools);
  const poolServices = serviceConfigs.filter((service) => poolUrls.includes(service.url));
  const healthyServices = poolServices.filter(
    (service) => service.healthy && !isServiceQuarantined(service)
  );
  const fallbackServices = allowCrossProfileFallback
    ? serviceConfigs.filter(
        (service) => !poolUrls.includes(service.url) && service.healthy && !isServiceQuarantined(service)
      )
    : [];

  const orderedServices = [];
  const pushService = (service) => {
    if (!service || orderedServices.find((item) => item.url === service.url)) {
      return;
    }
    orderedServices.push(service);
  };

  pushService(serviceConfigs.find((service) => service.url === preferredUrl));
  healthyServices.forEach(pushService);
  fallbackServices.forEach(pushService);

  return orderedServices;
}
