import {
  LoginResponse,
  Measurement,
  User,
  WaterBody,
  WaterBodyPassport,
} from '@/types';
import { authStorage } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lake-backend-2yts.onrender.com/';

type RequestOptions = RequestInit & {
  token?: string;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken();

  if (!refreshToken) {
    authStorage.clear();
    return null;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    authStorage.clear();
    return null;
  }

  const accessToken = data?.accessToken;
  const newRefreshToken = data?.refreshToken;

  if (!accessToken || !newRefreshToken) {
    authStorage.clear();
    return null;
  }

  authStorage.setAccessToken(accessToken);
  authStorage.setRefreshToken(newRefreshToken);

  return accessToken;
}

async function request<T = unknown>(
  path: string,
  init: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  const shouldAttachAuth = !init.skipAuth;
  const token = init.token || (shouldAttachAuth ? authStorage.getAccessToken() : null);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const canRetry =
      response.status === 401 &&
      shouldAttachAuth &&
      init.retryOnUnauthorized !== false;

    if (canRetry) {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        return request<T>(path, {
          ...init,
          token: newAccessToken,
          retryOnUnauthorized: false,
        });
      }

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    if (response.status === 401) {
      authStorage.clear();

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    const message =
      typeof data === 'string'
        ? data
        : data?.message || `Request failed: ${response.status}`;

    throw new Error(
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  return data as T;
}

export const api = {
  // AUTH

  login: async (email: string, password: string): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      retryOnUnauthorized: false,
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (
    login: string,
    email: string,
    password: string,
    role: 'ADMIN' | 'CLIENT' = 'CLIENT',
  ) => {
    return request('/auth/register', {
      method: 'POST',
      skipAuth: true,
      retryOnUnauthorized: false,
      body: JSON.stringify({ login, email, password, role }),
    });
  },

  // USERS

  getUsers: async (): Promise<User[]> => {
    return request<User[]>('/users', {
      method: 'GET',
    });
  },

  getUserById: async (id: string): Promise<User> => {
    return request<User>(`/users/${id}`, {
      method: 'GET',
    });
  },

  createUser: async (body: {
    login: string;
    email: string;
    password: string;
    avatarUrl?: string;
    role?: 'ADMIN' | 'CLIENT';
  }): Promise<User> => {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateUser: async (
    id: string,
    body: {
      login?: string;
      email?: string;
      password?: string;
      avatarUrl?: string;
      role?: 'ADMIN' | 'CLIENT';
    },
  ): Promise<User> => {
    return request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteUser: async (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // WATER BODIES

  getWaterBodies: async (): Promise<WaterBody[]> => {
    return request<WaterBody[]>('/water-bodies', {
      method: 'GET',
    });
  },

  getWaterBodyById: async (id: string): Promise<WaterBody> => {
    return request<WaterBody>(`/water-bodies/${id}`, {
      method: 'GET',
    });
  },

  createWaterBody: async (body: {
    name: string;
    district?: string;
    locationDesc?: string;
    latitude?: number;
    longitude?: number;
    boundaries?: unknown;
    cadastralNumber?: string;
    passport?: WaterBodyPassport;
  }): Promise<WaterBody> => {
    return request<WaterBody>('/water-bodies', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateWaterBody: async (
    id: string,
    body: {
      name?: string;
      district?: string;
      locationDesc?: string;
      latitude?: number;
      longitude?: number;
      boundaries?: unknown;
      cadastralNumber?: string;
      passport?: WaterBodyPassport;
    },
  ): Promise<WaterBody> => {
    return request<WaterBody>(`/water-bodies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  deleteWaterBody: async (id: string): Promise<{ id: string }> => {
    return request<{ id: string }>(`/water-bodies/${id}`, {
      method: 'DELETE',
    });
  },

  // MEASUREMENTS

  getWaterBodyMeasurements: async (id: string): Promise<Measurement[]> => {
    return request<Measurement[]>(`/water-bodies/${id}/measurements`, {
      method: 'GET',
    });
  },

  createWaterBodyMeasurement: async (
    id: string,
    body: {
      recordDate?: string;
      ph?: number;
      dissolvedGases?: string;
      biogenicCompounds?: string;
      permanganateOxid?: number;
      mineralization?: number;
      salinity?: number;
      hardness?: number;
      calcium?: number;
      magnesium?: number;
      chlorides?: number;
      sulfates?: number;
      hydrocarbonates?: number;
      potassiumSodium?: number;
      overgrowthPercent?: number;
      overgrowthDegree?: string;
      phytoplanktonDev?: string;
      zooplanktonTaxa?: string;
      zooplanktonGroups?: string;
      zoobenthosTaxa?: string;
      zoobenthosGroups?: string;
      trophicStatus?: string;
    },
  ): Promise<Measurement> => {
    return request<Measurement>(`/water-bodies/${id}/measurements`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateWaterBodyMeasurement: async (
    waterBodyId: string,
    measurementId: string,
    body: Partial<Measurement>,
  ): Promise<Measurement> => {
    return request<Measurement>(
      `/water-bodies/${waterBodyId}/measurements/${measurementId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  },

  deleteWaterBodyMeasurement: async (
    waterBodyId: string,
    measurementId: string,
  ): Promise<{ id?: string; message?: string }> => {
    return request<{ id?: string; message?: string }>(
      `/water-bodies/${waterBodyId}/measurements/${measurementId}`,
      {
        method: 'DELETE',
      },
    );
  },
};