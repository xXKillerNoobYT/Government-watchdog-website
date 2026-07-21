/**
 * Browser-side acknowledgement of a server-approved Sites request.
 *
 * This marker is intentionally only a UI signal. The Sites worker is the
 * security boundary: it checks the authenticated-user header and refuses to
 * serve HTML or JavaScript before this module can run. The worker injects only
 * the boolean marker below; it never exposes the authenticated email address.
 */
export const SITES_ACCESS_META = 'gw-sites-access';

export function hostedReviewerAccessActive(root: ParentNode = document): boolean {
  return root
    .querySelector<HTMLMetaElement>(`meta[name="${SITES_ACCESS_META}"]`)
    ?.getAttribute('content') === 'approved';
}
