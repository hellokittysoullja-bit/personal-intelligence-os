import { NextRequest, NextResponse } from "next/server";

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Personal Intelligence OS"' },
  });
}

export function middleware(request: NextRequest): NextResponse {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const username = process.env.PIOS_WEB_USERNAME;
  const password = process.env.PIOS_WEB_PASSWORD;
  if (!username || !password) {
    return new NextResponse("Production web authentication is not configured", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    const providedUsername = decoded.slice(0, separator);
    const providedPassword = decoded.slice(separator + 1);
    if (separator < 0 || providedUsername !== username || providedPassword !== password) {
      return unauthorized();
    }
  } catch {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
