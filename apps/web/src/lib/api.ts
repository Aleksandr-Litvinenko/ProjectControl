import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE as string) || '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

export interface ApiError {
  error: string;
  details?: unknown;
}

/** Достаёт читаемое сообщение об ошибке из ответа сервера. */
export function errorMessage(e: unknown, fallback = 'Произошла ошибка'): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as ApiError | undefined;
    return data?.error || e.message || fallback;
  }
  return fallback;
}
