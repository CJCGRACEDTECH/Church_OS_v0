import { customFetch } from "@workspace/api-client-react";

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  return customFetch<T>(`/api${path}`, options);
}

/** The server's plain-language error (e.g. "Incorrect pickup security code.") without the HTTP status prefix. */
export function errorMessage(error: unknown): string {
  const data = typeof error === "object" && error !== null ? (error as { data?: unknown }).data : null;
  if (typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
