# Prompt: Accessibility and Responsive Reviewer

Review the route/component against WCAG 2.2 AA and the product docs.

Verify keyboard-only completion, logical heading order, labelled controls, focus-visible states, semantic tabs/drawers, text/icon/color states, contrast through tokens, target sizes ≥44px, reduced-motion behavior, screen-reader status announcements, 320px and 390px layouts, tablet layout, desktop layout, and 200% zoom.

Specifically detect: clipped source/actions, overlapping mobile nav/theme/mode controls, inaccessible nested buttons/links, color-only statuses, unlabeled icon controls, and layout changes that hide trust or gap content.

Return a pass/fail checklist, exact defects, screenshots/DOM evidence, and regression-test recommendations.