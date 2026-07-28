/**
 * Public Free build entry.
 *
 * Do not import the private application, civic fixtures, private data client,
 * or local beta-admission helpers here. The completed production bundle is
 * scanned after every public build to enforce that dependency boundary.
 */

import './ui/fonts';
import { renderPublicLanding } from './ui/public-landing';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app mount');

renderPublicLanding(root);
