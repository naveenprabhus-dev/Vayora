import { Router } from 'express';
import type { HealthStatusPayload } from '@uaqa/contracts';
import type { AppConfig } from '../../config/env.ts';
import { getGeminiStatus } from '../../services/ai/geminiClient.ts';
import { sendSuccess } from '../../utils/response.ts';

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

  router.get('/health', (req, res) => {
    const payload: HealthStatusPayload = {
      status: 'ok',
      service: 'urban-air-quality-api',
      version: '0.1.0',
      environment: config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
    };
    sendSuccess(res, payload, 200, req.context?.requestId);
  });

  router.get('/health/ready', (req, res) => {
    const gemini = getGeminiStatus(config);
    const authConfigured =
      config.firebaseProjectId.trim().length > 0 &&
      !config.firebaseProjectId.startsWith('REPLACE_WITH');

    const payload = {
      status: gemini.configured && authConfigured ? 'ready' : 'foundation_only',
      checks: {
        authVerifierConfigured: authConfigured,
        aiOrchestratorConfigured: gemini.configured,
      },
    };
    sendSuccess(res, payload, 200, req.context?.requestId);
  });

  return router;
}
