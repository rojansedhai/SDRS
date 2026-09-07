import { Experiment, FailureType } from '../types/experiment';
import { ExperimentMetrics, MetricSnapshot } from '../types/metrics';

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Token state (SEC-01 JWT Authentication)
let authToken: string = (typeof window !== 'undefined' && localStorage.getItem('sdrs_auth_token')) || import.meta.env.VITE_AUTH_TOKEN || '';

export function setAuthToken(token: string) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('sdrs_auth_token', token);
    } else {
      localStorage.removeItem('sdrs_auth_token');
    }
  }
}

export function getAuthToken(): string {
  return authToken;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errJson = await res.json();
      errorMessage = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      const text = await res.text();
      if (text) errorMessage = text;
    }

    if (res.status === 401) {
      throw new Error(`[401 Unauthorized] ${errorMessage}`);
    }
    if (res.status === 403) {
      throw new Error(`[403 Forbidden] ${errorMessage}`);
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export interface StartExperimentOptions {
  regionMode?: 'single-region' | 'multi-region';
  primaryRegion?: string;
  secondaryRegion?: string;
  targetRtoSeconds?: number;
  targetRpoEvents?: number;
}

export async function startExperiment(
  name: string,
  scenario: string,
  options: StartExperimentOptions = {}
): Promise<Experiment> {
  const res = await fetch(`${BASE_URL}/experiments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, scenario, ...options })
  });
  return handleResponse<Experiment>(res);
}

export async function generateEvents(
  id: string,
  count: number = 10,
  options: { duplicateCount?: number; region?: string } = {}
): Promise<{ experimentId: string; generatedCount: number; status: string }> {
  const res = await fetch(`${BASE_URL}/experiments/${id}/events`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ count, ...options })
  });
  return handleResponse<{ experimentId: string; generatedCount: number; status: string }>(res);
}

export async function stopExperiment(id: string): Promise<Experiment> {
  const res = await fetch(`${BASE_URL}/experiments/${id}/stop`, {
    method: 'POST',
    headers: getHeaders()
  });
  return handleResponse<Experiment>(res);
}

export async function injectFailure(id: string, failureType: FailureType): Promise<void> {
  const res = await fetch(`${BASE_URL}/experiments/${id}/failures`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ failureType })
  });
  return handleResponse<void>(res);
}

export async function restoreService(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/experiments/${id}/restore`, {
    method: 'POST',
    headers: getHeaders()
  });
  return handleResponse<void>(res);
}

export async function getExperiment(id: string): Promise<Experiment> {
  const res = await fetch(`${BASE_URL}/experiments/${id}`, {
    headers: getHeaders()
  });
  return handleResponse<Experiment>(res);
}

export async function listExperiments(): Promise<Experiment[]> {
  const res = await fetch(`${BASE_URL}/experiments`, {
    headers: getHeaders()
  });
  return handleResponse<Experiment[]>(res);
}

export interface MetricsResponse {
  current: ExperimentMetrics;
  history: MetricSnapshot[];
}

export async function getMetrics(id: string): Promise<MetricsResponse> {
  const res = await fetch(`${BASE_URL}/experiments/${id}/metrics`, {
    headers: getHeaders()
  });
  return handleResponse<MetricsResponse>(res);
}
