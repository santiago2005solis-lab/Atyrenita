import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookies,
  refreshSession,
  setSessionCookies,
} from "@/lib/auth";
import { REFRESH_TOKEN_COOKIE } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { error: "No hay una sesion para renovar." },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }

  try {
    const { session, user } = await refreshSession(refreshToken);
    const response = NextResponse.json({ user });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo renovar la sesion.",
      },
      { status: 401 },
    );
    clearSessionCookies(response);
    return response;
  }
}
