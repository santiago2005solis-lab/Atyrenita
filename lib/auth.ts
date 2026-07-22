import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAuthKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  supabaseInsert,
  supabaseSelect,
} from "./supabase-rest";
import {
  appModules,
  hasPermission,
  type AppModule,
  type AppRole,
  type AppUser,
  type PermissionRole,
} from "./permissions";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./session-cookies";

type AuthUser = {
  email?: string;
  id: string;
};

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  user?: AuthUser;
};

type AppUserRow = {
  active: boolean;
  email: string;
  full_name: string | null;
  id: string;
  role: AppRole;
};

type PermissionRow = {
  access_role: PermissionRole;
  module_name: AppModule;
  user_id: string;
};

const initialDeveloperEmail = "desarrollosistema@aty.com";

export async function loginWithPassword(email: string, password: string) {
  const url = getSupabaseUrl();
  const key = getSupabaseAuthKey();

  if (!url || !key) {
    throw new Error("Supabase Auth no esta configurado.");
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Correo o contrasena incorrectos.");
  }

  const session = (await response.json()) as TokenResponse;
  if (!session.access_token || !session.user?.id) {
    throw new Error("Supabase no devolvio una sesion valida.");
  }

  const user = await getOrCreateAppUser(session.user);
  return { session, user };
}

export async function requireAppUser(
  request: NextRequest,
  moduleName?: AppModule,
  minimumRole: PermissionRole = "lector",
) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return {
      error: NextResponse.json({ error: "Sesion requerida." }, { status: 401 }),
      user: null,
    };
  }

  const user = await getOrCreateAppUser(authUser);
  if (!user.active) {
    return {
      error: NextResponse.json({ error: "Usuario inactivo." }, { status: 403 }),
      user: null,
    };
  }

  if (moduleName && !hasPermission(user, moduleName, minimumRole)) {
    return {
      error: NextResponse.json({ error: "No tiene permisos para este modulo." }, { status: 403 }),
      user: null,
    };
  }

  return { error: null, user };
}

export function setSessionCookies(response: NextResponse, session: TokenResponse) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    httpOnly: true,
    maxAge: session.expires_in ?? 60 * 60,
    path: "/",
    sameSite: "lax",
    secure,
  });

  if (session.refresh_token) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure,
    });
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function getAuthUserFromRequest(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;
  return getAuthUser(accessToken);
}

async function getAuthUser(accessToken: string): Promise<AuthUser | null> {
  const url = getSupabaseUrl();
  const key = getSupabaseAuthKey();

  if (!url || !key) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  return response.json() as Promise<AuthUser>;
}

async function getOrCreateAppUser(authUser: AuthUser): Promise<AppUser> {
  const email = authUser.email?.toLowerCase() ?? "";
  const existing = await loadAppUser(authUser.id);
  if (existing) return existing;

  if (email !== initialDeveloperEmail) {
    throw new Error("El usuario no tiene permisos asignados en el sistema.");
  }

  await ensureDeveloperProfile(authUser.id, email);
  const created = await loadAppUser(authUser.id);

  if (!created) {
    throw new Error("No se pudo preparar el usuario desarrollador.");
  }

  return created;
}

async function loadAppUser(userId: string): Promise<AppUser | null> {
  const rows = await supabaseSelect<AppUserRow[]>(
    `app_users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  const row = rows[0];
  if (!row) return null;

  const permissionRows = await supabaseSelect<PermissionRow[]>(
    `app_module_permissions?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );

  const permissions = appModules.reduce(
    (current, moduleName) => ({
      ...current,
      [moduleName]: row.role === "desarrollador" ? "desarrollador" : "sin_acceso",
    }),
    {} as Record<AppModule, PermissionRole>,
  );

  for (const permission of permissionRows) {
    permissions[permission.module_name] = permission.access_role;
  }

  return {
    active: row.active,
    email: row.email,
    fullName: row.full_name ?? row.email,
    id: row.id,
    permissions,
    role: row.role,
  };
}

async function ensureDeveloperProfile(userId: string, email: string) {
  const key = getSupabaseServiceKey();
  if (!key) {
    throw new Error("Falta la clave privada de Supabase.");
  }

  await supabaseInsert("app_users", {
    active: true,
    email,
    full_name: "Desarrollo Sistema",
    id: userId,
    role: "desarrollador",
  });

  await supabaseInsert(
    "app_module_permissions",
    appModules.map((moduleName) => ({
      access_role: "desarrollador",
      module_name: moduleName,
      user_id: userId,
    })),
  );
}
