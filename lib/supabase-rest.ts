type SupabaseRequestInit = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export async function supabaseSelect<T>(path: string): Promise<T> {
  return supabaseRequest<T>(path, { method: "GET" });
}

export async function supabaseInsert<T>(
  table: string,
  body: unknown,
): Promise<T> {
  return supabaseRequest<T>(table, {
    body,
    method: "POST",
    prefer: "return=representation",
  });
}

export async function supabasePatch<T>(
  tableWithQuery: string,
  body: unknown,
): Promise<T> {
  return supabaseRequest<T>(tableWithQuery, {
    body,
    method: "PATCH",
    prefer: "return=representation",
  });
}

async function supabaseRequest<T>(
  path: string,
  init: SupabaseRequestInit,
): Promise<T> {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error("Supabase no esta configurado.");
  }

  const authHeaders: Record<string, string> = {
    apikey: key,
  };

  if (!isSupabaseOpaqueKey(key)) {
    authHeaders.Authorization = `Bearer ${key}`;
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    headers: {
      ...jsonHeaders,
      ...authHeaders,
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    method: init.method ?? "GET",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase respondio con estado ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseServiceKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY
  );
}

export function getSupabaseAuthKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    getSupabaseServiceKey()
  );
}

function getSupabaseKey() {
  return getSupabaseServiceKey();
}

function isSupabaseOpaqueKey(key: string) {
  return key.startsWith("sb_");
}
