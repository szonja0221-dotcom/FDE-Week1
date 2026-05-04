const parseNum = (v: unknown): number | undefined => {
  if (typeof v !== 'string' || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export type FnolConfig = {
  SLA_WINDOW_SECONDS: number
  HIGH_SEVERITY_THRESHOLD: number
  HIGH_VALUE_THRESHOLD_USD: number
  MAX_SOAP_RETRIES: number
  SOAP_RETRY_BACKOFF_SECONDS: number
  EXTRACTION_CONFIDENCE_THRESHOLD: number
}

// In the production system these must be environment-variable-driven.
// In the browser, we read Vite env vars with documented defaults.
export function getFnolConfig(): FnolConfig {
  const env = import.meta.env

  return {
    SLA_WINDOW_SECONDS: parseNum(env.VITE_SLA_WINDOW_SECONDS) ?? 7200,
    HIGH_SEVERITY_THRESHOLD: parseNum(env.VITE_HIGH_SEVERITY_THRESHOLD) ?? 7,
    HIGH_VALUE_THRESHOLD_USD: parseNum(env.VITE_HIGH_VALUE_THRESHOLD_USD) ?? 10000,
    MAX_SOAP_RETRIES: parseNum(env.VITE_MAX_SOAP_RETRIES) ?? 3,
    SOAP_RETRY_BACKOFF_SECONDS: parseNum(env.VITE_SOAP_RETRY_BACKOFF_SECONDS) ?? 2,
    EXTRACTION_CONFIDENCE_THRESHOLD:
      parseNum(env.VITE_EXTRACTION_CONFIDENCE_THRESHOLD) ?? 0.75,
  }
}

