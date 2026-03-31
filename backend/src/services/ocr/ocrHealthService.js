import axios from 'axios';

export function isServiceQuarantined(serviceConfig) {
  return Boolean(serviceConfig?.quarantineUntil && serviceConfig.quarantineUntil > Date.now());
}

export async function triggerLocalOcrRestart({
  serviceConfig,
  reason = 'health_failure',
  localOcrProcessByUrl,
  healthConfig,
  redisClient,
  restartLockPrefix,
  execRestart,
}) {
  if (!serviceConfig) return false;

  const processName = localOcrProcessByUrl[serviceConfig.url];
  if (!processName) return false;

  const now = Date.now();
  if (serviceConfig.restarting) return false;
  if (serviceConfig.lastRestartAt && now - serviceConfig.lastRestartAt < healthConfig.RESTART_COOLDOWN_MS) {
    return false;
  }

  serviceConfig.restarting = true;
  serviceConfig.lastRestartAt = now;
  serviceConfig.restartCount = (serviceConfig.restartCount || 0) + 1;
  serviceConfig.quarantineUntil = Math.max(serviceConfig.quarantineUntil || 0, now + healthConfig.QUARANTINE_MS);

  const lockKey = `${restartLockPrefix}${processName}`;
  try {
    const locked = await redisClient.set(
      lockKey,
      String(now),
      'PX',
      healthConfig.RESTART_COOLDOWN_MS,
      'NX'
    );
    if (locked !== 'OK') {
      serviceConfig.restarting = false;
      return false;
    }
  } catch (error) {
    console.warn(`[Health] OCR ${serviceConfig.url} 获取重启锁失败，继续尝试本地重启: ${error.message}`);
  }

  console.warn(`[Health] ♻️ OCR ${serviceConfig.url} 触发自动重启 (${reason})，进程=${processName}`);

  try {
    await execRestart(processName, healthConfig.PM2_RESTART_TIMEOUT_MS);
    console.log(`[Health] ✅ OCR ${serviceConfig.url} 自动重启命令已执行`);
    return true;
  } catch (error) {
    console.error(`[Health] OCR ${serviceConfig.url} 自动重启失败: ${error.message}`);
    return false;
  } finally {
    serviceConfig.restarting = false;
  }
}

export function markServiceUnhealthy({
  serviceConfig,
  serviceName,
  reason = 'runtime_failure',
  healthConfig,
  triggerRestart,
}) {
  if (!serviceConfig) return;

  serviceConfig.lastFailureAt = Date.now();

  if (serviceConfig.failCount >= healthConfig.FAIL_THRESHOLD) {
    if (serviceConfig.healthy) {
      console.warn(`[Health] ❌ ${serviceName} 标记为不健康 (连续失败 ${serviceConfig.failCount} 次)`);
    }
    serviceConfig.healthy = false;
    serviceConfig.quarantineUntil = Math.max(serviceConfig.quarantineUntil || 0, Date.now() + healthConfig.QUARANTINE_MS);
    void triggerRestart(serviceConfig, reason);
  }
}

export async function checkServiceHealth({
  serviceConfig,
  serviceName,
  timeoutMs,
  healthConfig,
  onFailure,
}) {
  try {
    const res = await axios.get(`${serviceConfig.url}/health`, {
      timeout: timeoutMs,
    });

    serviceConfig.lastCheck = Date.now();
    if (res.status === 200) {
      const remoteProfile = String(res.data?.profile || '').trim().toLowerCase();
      if (remoteProfile && serviceConfig.profile && remoteProfile !== serviceConfig.profile) {
        console.warn(
          `[Health] ⚠️ OCR profile 不匹配: ${serviceName}, expected=${serviceConfig.profile}, actual=${remoteProfile}`
        );
      }
      serviceConfig.failCount = 0;
      serviceConfig.lastSuccessAt = Date.now();
      serviceConfig.quarantineUntil = 0;
      if (!serviceConfig.healthy) {
        console.log(`[Health] ✅ ${serviceName} 恢复健康`);
      }
      serviceConfig.healthy = true;
      return true;
    }
  } catch (error) {
    serviceConfig.failCount++;
    serviceConfig.lastCheck = Date.now();
    onFailure(serviceConfig, serviceName, 'health_check_failed');
  }

  return serviceConfig.healthy;
}

export async function startHealthCheck({
  ocrServices,
  yoloServiceConfig,
  healthConfig,
  checkServiceHealthFn,
}) {
  const check = async () => {
    for (const service of ocrServices) {
      await checkServiceHealthFn(service, `OCR ${service.url}`);
    }

    await checkServiceHealthFn(yoloServiceConfig, 'YOLO');

    const healthyOcr = ocrServices.filter((service) => service.healthy).length;
    const yoloHealthy = yoloServiceConfig.healthy;

    console.log(`[Health] 状态: OCR ${healthyOcr}/${ocrServices.length} 健康, YOLO ${yoloHealthy ? '健康' : '不健康'}`);
  };

  await check();
  setInterval(check, healthConfig.CHECK_INTERVAL);
}

export function reportServiceSuccess(serviceConfigs, serviceUrl) {
  const service = serviceConfigs.find((item) => item.url === serviceUrl);
  if (service) {
    service.failCount = 0;
    service.healthy = true;
    service.lastSuccessAt = Date.now();
    service.quarantineUntil = 0;
  }
}

export function reportServiceFailure({
  serviceConfigs,
  serviceUrl,
  onFailure,
}) {
  const service = serviceConfigs.find((item) => item.url === serviceUrl);
  if (service) {
    service.failCount++;
    onFailure(service, `OCR ${serviceUrl}`, 'runtime_timeout');
  }
}

