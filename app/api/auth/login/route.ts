import { NextRequest, NextResponse } from "next/server";
import { loginWithPassword, setSessionCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email?.trim() || !body.password) {
    return NextResponse.json(
      { error: "Ingrese correo y contrasena." },
      { status: 400 },
    );
  }

  try {
    const { session, user } = await loginWithPassword(
      body.email.trim().toLowerCase(),
      body.password,
    );
    const response = NextResponse.json({ user });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar sesion.",
      },
      { status: 401 },
    );
  }
}
