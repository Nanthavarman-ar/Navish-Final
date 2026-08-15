import { useState, useEffect, useCallback } from "react";
import { supabase, projectId } from "../supabase/client";

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;
const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";
let authSessionInvalid = false;

const isRefreshTokenError = (message: string): boolean =>
  /invalid refresh token|refresh token not found/i.test(message);

const safelySignOut = async () => {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out failures. We still prevent protected calls when auth is invalid.
  }
};

const getAccessToken = async (): Promise<string | null> => {
  if (authSessionInvalid) return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? null;

    if (accessToken) {
      authSessionInvalid = false;
    }

    return accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isRefreshTokenError(message)) {
      authSessionInvalid = true;
      await safelySignOut();
      return null;
    }
    throw error;
  }
};

export function useApi<T>(endpoint: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error(AUTH_REQUIRED_ERROR);
      }

      const response = await fetch(
        `${functionsBaseUrl}${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 401) {
        authSessionInvalid = true;
        await safelySignOut();
        throw new Error(AUTH_REQUIRED_ERROR);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      if (message === AUTH_REQUIRED_ERROR) {
        setData(null);
        setError("Session expired. Please log in again.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [endpoint, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error(AUTH_REQUIRED_ERROR);
  }

  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  let headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  };

  if (hasBody && !isFormDataBody && method !== "GET" && method !== "HEAD") {
    headers = {
      ...headers,
      "Content-Type": "application/json",
    };
  }

  const response = await fetch(
    `${functionsBaseUrl}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  if (response.status === 401) {
    authSessionInvalid = true;
    await safelySignOut();
    throw new Error(AUTH_REQUIRED_ERROR);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}
