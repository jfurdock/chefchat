import * as https from 'https';
import { defineString } from 'firebase-functions/params';

type RequestOptions = {
  method?: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

const INWORLD_BASE64_CREDENTIAL = defineString('INWORLD_BASE64_CREDENTIAL');
const INWORLD_AUTH = defineString('INWORLD_AUTH', { default: '' });
const INWORLD_AUTHORIZATION = defineString('INWORLD_AUTHORIZATION', { default: '' });
const INWORLD_API_BASE = defineString('INWORLD_API_BASE', { default: 'https://api.inworld.ai' });
const INWORLD_LLM_MODEL = defineString('INWORLD_LLM_MODEL', { default: '' });
const INWORLD_LLM_PROVIDER = defineString('INWORLD_LLM_PROVIDER', { default: '' });
const INWORLD_TTS_MODEL = defineString('INWORLD_TTS_MODEL', { default: '' });
const INWORLD_TTS_VOICE_ID = defineString('INWORLD_TTS_VOICE_ID', { default: '' });

const PARAMS_BY_KEY: Record<string, ReturnType<typeof defineString>> = {
  base64_credential: INWORLD_BASE64_CREDENTIAL,
  auth: INWORLD_AUTH,
  authorization: INWORLD_AUTHORIZATION,
  api_base: INWORLD_API_BASE,
  llm_model: INWORLD_LLM_MODEL,
  llm_provider: INWORLD_LLM_PROVIDER,
  tts_model: INWORLD_TTS_MODEL,
  tts_voice_id: INWORLD_TTS_VOICE_ID,
};

function paramValue(key: string): string {
  const param = PARAMS_BY_KEY[key];
  if (!param) return '';

  try {
    const value = param.value();
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export function readInworldConfig(key: string, fallback = ''): string {
  const envKey = `INWORLD_${key.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (typeof envValue === 'string' && envValue.trim()) return envValue.trim();

  const valueFromParam = paramValue(key.toLowerCase());
  if (valueFromParam) return valueFromParam;

  return fallback;
}

function buildAuthHeader(): string {
  const raw =
    readInworldConfig('base64_credential') ||
    readInworldConfig('auth') ||
    readInworldConfig('authorization') ||
    '';

  if (!raw) {
    throw new Error(
      'Missing Inworld credentials. Set INWORLD_BASE64_CREDENTIAL to your base64 basic auth value.'
    );
  }

  return raw.startsWith('Basic ') ? raw : `Basic ${raw}`;
}

function buildUrl(path: string, query?: RequestOptions['query']): URL {
  const base = readInworldConfig('api_base', 'https://api.inworld.ai');
  const url = new URL(path, base);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function toErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const err = payload as any;
  if (typeof err?.error?.message === 'string' && err.error.message.trim()) return err.error.message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  if (typeof err?.detail === 'string' && err.detail.trim()) return err.detail;
  return fallback;
}

export async function inworldRequest<T>({ method = 'POST', path, query, body }: RequestOptions): Promise<T> {
  const url = buildUrl(path, query);
  const payload = body === undefined ? '' : JSON.stringify(body);

  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: buildAuthHeader(),
          Accept: 'application/json',
          ...(method === 'POST'
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let raw = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          const isJson = (res.headers['content-type'] || '').toString().includes('application/json');
          let parsed: unknown = raw ? { message: raw } : {};
          if (raw && isJson) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = { message: raw };
            }
          }

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(toErrorMessage(parsed, `Inworld API request failed with status ${statusCode}.`)));
            return;
          }

          resolve(parsed as T);
        });
      }
    );

    req.on('error', (error) => reject(error));
    if (method === 'POST' && payload) {
      req.write(payload);
    }
    req.end();
  });
}
