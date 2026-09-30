const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface BackendErrorBody {
  message?: string | string[];
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { message } = body as BackendErrorBody;
  if (Array.isArray(message)) return message[0];
  return message;
}

/**
 * Envia siempre `credentials: 'include'` para que el navegador adjunte
 * la cookie de sesion HttpOnly. El frontend nunca lee ni guarda el token.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(body) ?? 'No se pudo completar la solicitud. Intenta de nuevo.',
    );
  }

  return body as T;
}
