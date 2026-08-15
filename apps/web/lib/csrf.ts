/**
 * csrf.ts — CSRF protection bằng Origin/Referer header check.
 *
 * Giống v3.6: kiểm tra Origin/Referer header có trùng Host không.
 * Nếu không có header nào (curl, Postman) → cho phép.
 * Nếu có header → phải khớp Host → nếu không → 403.
 *
 * Kết hợp với SameSite=Strict cookie → CSRF defense ở 2 lớp.
 */

/**
 * Kiểm tra request có cùng origin với server không.
 * @param host - Host header từ request (vd: "cencom.lan" hoặc "cencom.lan:3000")
 * @param origin - Origin header từ request (vd: "https://cencom.lan")
 * @param referer - Referer header từ request (vd: "https://cencom.lan/dashboard")
 * @returns true nếu an toàn (cùng origin hoặc không có header)
 */
export function sameOrigin(
  host: string | null | undefined,
  origin: string | null | undefined,
  referer: string | null | undefined,
): boolean {
  if (!host) return false;

  const reqHost = String(host).split(':')[0]!.toLowerCase();

  // Nếu không có Origin VÀ Referer → cho phép (tools, curl, same-origin AJAX)
  if (!origin && !referer) return true;

  // Kiểm tra Origin
  if (origin) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase();
      if (originHost !== reqHost) return false;
    } catch {
      // Origin header malformed → cho phép (chặn false positive)
      return true;
    }
  }

  // Kiểm tra Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname.toLowerCase();
      if (refererHost !== reqHost) return false;
    } catch {
      // Referer header malformed → cho phép
      return true;
    }
  }

  return true;
}

/**
 * CSRF guard cho Next.js Route Handler.
 * Trả về error Response nếu CSRF fail, null nếu OK.
 */
export function csrfGuard(request: Request): Response | null {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!sameOrigin(host, origin, referer)) {
    console.warn(`[CSRF] Blocked: host=${host}, origin=${origin}, referer=${referer}`);
    return new Response(
      JSON.stringify({ ok: false, error: 'CSRF: Origin không khớp' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return null; // OK
}
