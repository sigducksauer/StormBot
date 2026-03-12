import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    const redirectUrl = new URL("/?error=auth_failed", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  // Valida formato do code (segurança básica — apenas alphanumeric)
  if (!/^[a-zA-Z0-9\-_.~]+$/.test(code)) {
    return NextResponse.redirect(new URL("/?error=invalid_code", request.url));
  }

  const params = new URLSearchParams({ code });
  if (state) params.set("state", state);

  return NextResponse.redirect(`${API_URL}/auth/discord/callback?${params.toString()}`);
}
