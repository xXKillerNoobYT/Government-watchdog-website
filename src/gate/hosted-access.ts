/**
 * Browser-side acknowledgement of an owner-only Sites request.
 *
 * This function is intentionally only a UI signal. Sites custom access is the
 * authentication/security boundary for the static root and assets. The exact
 * production host plus the committed private-beta marker lets that already-
 * admitted owner skip the obsolete duplicate login panel. Requests dispatched
 * through the server worker may alternatively carry its approved marker.
 * Neither path exposes the authenticated email address to browser code.
 */
export const SITES_ACCESS_META = 'gw-sites-access';
export const SITES_PRIVATE_BETA_META = 'gw-sites-private-beta';
export const SITES_PRIVATE_BETA_VALUE = 'owner-only';
export const SITES_PRODUCTION_HOST = 'alpine-government-watchdog-beta.weirdtoocompany.chatgpt.site';

interface LocationHostname {
  hostname: string;
}

export function hostedReviewerAccessActive(
  root: ParentNode = document,
  location: LocationHostname = window.location,
): boolean {
  const workerApproved = root
    .querySelector<HTMLMetaElement>(`meta[name="${SITES_ACCESS_META}"]`)
    ?.getAttribute('content') === 'approved';
  if (workerApproved) return true;

  const privateBetaBuild = root
    .querySelector<HTMLMetaElement>(`meta[name="${SITES_PRIVATE_BETA_META}"]`)
    ?.getAttribute('content') === SITES_PRIVATE_BETA_VALUE;
  return privateBetaBuild && location.hostname.toLowerCase() === SITES_PRODUCTION_HOST;
}
