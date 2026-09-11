import { Experiment, FailureType } from '../types/experiment';
import { ExperimentMetrics, MetricSnapshot } from '../types/metrics';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Expire 30 seconds before official exp to prevent boundary race conditions
    return Math.floor(Date.now() / 1000) >= (payload.exp - 30);
  } catch {
    return true;
  }
}

export function getTokenDetails(token: string): { email?: string; exp?: number; isExpired: boolean } | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      email: payload.email,
      exp: payload.exp,
      isExpired: payload.exp ? Math.floor(Date.now() / 1000) >= (payload.exp - 30) : false
    };
  } catch {
    return null;
  }
}

function initAuthToken(): string {
  if (typeof window === 'undefined') return import.meta.env.VITE_AUTH_TOKEN || '';
  const stored = localStorage.getItem('sdrs_auth_token');
  if (stored && !isTokenExpired(stored)) {
    return stored;
  }
  if (stored && isTokenExpired(stored)) {
    localStorage.removeItem('sdrs_auth_token');
  }
  const envToken = import.meta.env.VITE_AUTH_TOKEN || '';
  if (envToken && !isTokenExpired(envToken)) {
    return envToken;
  }
  return '';
}

// Token state (SEC-01 JWT Authentication)
let authToken: string = initAuthToken();

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
  if (authToken && isTokenExpired(authToken)) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sdrs_auth_token');
    }
    const envToken = import.meta.env.VITE_AUTH_TOKEN || '';
    if (envToken && !isTokenExpired(envToken)) {
      authToken = envToken;
    } else {
      authToken = '';
    }
  }
  return authToken;
}

/**
 * Directly authenticate against Cognito User Pool via InitiateAuth API.
 */
export async function loginWithCognito(
  username: string,
  password: string
): Promise<string> {
  if (!username || !password) {
    throw new Error('Username and password are required for authentication.');
  }

  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_COGNITO_CLIENT_ID is not configured in environment variables.');
  }
  const region = (import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1').split('_')[0] || 'us-east-1';

  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username.trim(),
        PASSWORD: password
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Cognito authentication failed');
  }

  const idToken = data.AuthenticationResult?.IdToken;
  if (!idToken) throw new Error('No IdToken returned from Cognito');

  setAuthToken(idToken);
  return idToken;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sdrs_auth_token');
      }
      authToken = '';
      throw new Error(`[401 Unauthorized] Authentication token is expired or invalid. Please click the Key icon in the header to re-authenticate. (${errorMessage})`);
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
