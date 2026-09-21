import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorization } from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  if (!isAdminAuthorization(request.headers.get("authorization"))) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Lodestar admin", charset="UTF-8"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
