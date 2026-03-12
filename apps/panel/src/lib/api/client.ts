const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sb_token");
}

// Erros tipados
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
  serverId?: string,
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token)    headers["Authorization"] = `Bearer ${token}`;
  if (serverId) headers["X-Server-Id"]   = serverId;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError("Tempo de resposta esgotado. Tente novamente.", 408);
    }
    throw new ApiError("Sem conexão com o servidor.", 0);
  }

  // 401 → logout automático
  if (res.status === 401) {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_token_ts");
    window.location.href = "/?error=session_expired";
    throw new ApiError("Sessão expirada.", 401);
  }

  if (!res.ok) {
    let detail = `Erro ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return null as T;

  try {
    return await res.json() as T;
  } catch {
    throw new ApiError("Resposta inválida do servidor.", 500);
  }
}

export const api = {
  get:    <T = unknown>(url: string, serverId?: string)                  => request<T>("GET",    url, undefined, serverId),
  post:   <T = unknown>(url: string, data: unknown, serverId?: string)   => request<T>("POST",   url, data,      serverId),
  put:    <T = unknown>(url: string, data: unknown, serverId?: string)   => request<T>("PUT",    url, data,      serverId),
  patch:  <T = unknown>(url: string, data: unknown, serverId?: string)   => request<T>("PATCH",  url, data,      serverId),
  delete: <T = unknown>(url: string, serverId?: string)                  => request<T>("DELETE", url, undefined, serverId),
};
