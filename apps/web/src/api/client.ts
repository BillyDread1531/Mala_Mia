const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

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
 *
 * En produccion frontend y backend viven en el mismo dominio, por lo que
 * las llamadas usan rutas relativas.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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

  let body: unknown;
  let parseFailed = false;

  try {
    body = await response.json();
  } catch {
    parseFailed = true;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(body) ??
        'No se pudo completar la solicitud. Intenta de nuevo.',
    );
  }

  if (parseFailed) {
    throw new ApiError(
      response.status,
      'Respuesta inesperada del servidor.',
    );
  }

  return body as T;
}