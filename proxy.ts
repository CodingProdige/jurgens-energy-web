import { NextResponse, type NextRequest } from "next/server";

const LOCAL_ADMIN_HOSTS = new Set(["admin.localhost", "admin.127.0.0.1"]);
const LOCAL_SELLER_HOSTS = new Set(["seller.localhost", "seller.127.0.0.1"]);
const ROOT_STATIC_ASSET_PATHS = new Set([
  "/apple-icon.png",
  "/favicon.ico",
  "/icon0.svg",
  "/icon1.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
]);
const ROOT_STATIC_ASSET_PREFIXES = ["/brand/", "/media/"];

function getHostname(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? "";

  return host.split(":")[0]?.toLowerCase() ?? "";
}

function startsWithSurfacePath(pathname: string, surfacePath: string) {
  return pathname === surfacePath || pathname.startsWith(`${surfacePath}/`);
}

function stripSurfacePath(pathname: string, surfacePath: string) {
  if (pathname === surfacePath) {
    return "/";
  }

  return pathname.replace(surfacePath, "");
}

function getConfiguredAdminHosts() {
  return [
    process.env.ADMIN_HOSTNAME,
    process.env.DOMAIN ? `admin.${process.env.DOMAIN}` : undefined,
  ]
    .filter(Boolean)
    .map((host) => host!.toLowerCase());
}

function getConfiguredSellerHosts() {
  return [
    process.env.SELLER_HOSTNAME,
    process.env.DOMAIN ? `seller.${process.env.DOMAIN}` : undefined,
  ]
    .filter(Boolean)
    .map((host) => host!.toLowerCase());
}

function isAdminHost(hostname: string) {
  return (
    LOCAL_ADMIN_HOSTS.has(hostname) ||
    getConfiguredAdminHosts().includes(hostname)
  );
}

function isSellerHost(hostname: string) {
  return (
    LOCAL_SELLER_HOSTS.has(hostname) ||
    getConfiguredSellerHosts().includes(hostname)
  );
}

function getCanonicalAdminHost() {
  return (
    process.env.ADMIN_HOSTNAME ??
    (process.env.DOMAIN ? `admin.${process.env.DOMAIN}` : "admin.localhost")
  ).toLowerCase();
}

function getCanonicalSellerHost() {
  return (
    process.env.SELLER_HOSTNAME ??
    (process.env.DOMAIN ? `seller.${process.env.DOMAIN}` : "seller.localhost")
  ).toLowerCase();
}

function redirectToHost(
  request: NextRequest,
  hostname: string,
  pathname?: string,
) {
  const url = request.nextUrl.clone();
  url.hostname = hostname;

  if (pathname) {
    url.pathname = pathname;
  }

  return NextResponse.redirect(url);
}

function redirectToSurfaceHost(
  request: NextRequest,
  hostname: string,
  surfacePath: string,
) {
  return redirectToHost(
    request,
    hostname,
    stripSurfacePath(request.nextUrl.pathname, surfacePath),
  );
}

function redirectToStrippedSurfacePath(
  request: NextRequest,
  surfacePath: string,
) {
  const url = request.nextUrl.clone();

  url.pathname = stripSurfacePath(url.pathname, surfacePath);

  return NextResponse.redirect(url);
}

function rewriteSurface(request: NextRequest, surfacePath: string) {
  const url = request.nextUrl.clone();

  if (
    ROOT_STATIC_ASSET_PATHS.has(url.pathname) ||
    ROOT_STATIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  if (url.pathname === "/") {
    url.pathname = surfacePath;
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/sign-in") {
    url.pathname = `${surfacePath}/sign-in`;
    return NextResponse.rewrite(url);
  }

  if (
    url.pathname.startsWith(surfacePath) ||
    url.pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  url.pathname = `${surfacePath}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export function proxy(request: NextRequest) {
  const hostname = getHostname(request);
  const pathname = request.nextUrl.pathname;
  const isNavigationMethod =
    request.method === "GET" || request.method === "HEAD";

  if (
    !isAdminHost(hostname) &&
    startsWithSurfacePath(pathname, "/admin")
  ) {
    return redirectToSurfaceHost(request, getCanonicalAdminHost(), "/admin");
  }

  if (
    !isSellerHost(hostname) &&
    startsWithSurfacePath(pathname, "/seller")
  ) {
    return redirectToSurfaceHost(request, getCanonicalSellerHost(), "/seller");
  }

  if (
    isNavigationMethod &&
    isAdminHost(hostname) &&
    startsWithSurfacePath(pathname, "/admin")
  ) {
    return redirectToStrippedSurfacePath(request, "/admin");
  }

  if (
    isNavigationMethod &&
    isSellerHost(hostname) &&
    startsWithSurfacePath(pathname, "/seller")
  ) {
    return redirectToStrippedSurfacePath(request, "/seller");
  }

  if (isAdminHost(hostname)) {
    return rewriteSurface(request, "/admin");
  }

  if (isSellerHost(hostname)) {
    return rewriteSurface(request, "/seller");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
