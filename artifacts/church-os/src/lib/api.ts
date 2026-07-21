import { customFetch } from "@workspace/api-client-react";

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  return customFetch<T>(`/api${path}`, options);
}
