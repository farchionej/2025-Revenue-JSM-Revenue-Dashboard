# Mobile Testing Checklist

Use this checklist for every feature change or UI update to ensure mobile compatibility.

---

## Pre-Development

- [ ] Feature/change affects UI or layout
- [ ] Desktop design is finalized
- [ ] Mobile adaptation strategy is planned

---

## Desktop Testing

### Resolution Testing
- [ ] Tested at 1920x1080 (Full HD desktop)
- [ ] Tested at 1366x768 (Standard laptop)
- [ ] Tested at 1280x720 (Smaller laptop)

### Functionality
- [ ] All buttons clickable and functional
- [ ] Forms submit correctly
- [ ] Modals open/close properly
- [ ] Navigation works as expected
- [ ] Data loads and displays correctly

---

## Mobile Testing (DevTools)

### iPhone SE (375x667) - Small Screen
- [ ] No horizontal scroll
- [ ] All text readable (min 14px)
- [ ] Touch targets ≥44x44px
- [ ] Buttons accessible and tappable
- [ ] Charts fit within viewport
- [ ] Tables scroll or adapt appropriately
- [ ] Modals fit on screen
- [ ] Navigation usable

### iPhone 12/13/14 (390x844) - Standard
- [ ] Layout looks balanced
- [ ] Spacing appropriate
- [ ] No excessive whitespace
- [ ] All interactive elements work

### iPad (768x1024) - Tablet
- [ ] Uses tablet breakpoint styles
- [ ] Layout between mobile and desktop
- [ ] Touch targets still adequate

---

## Orientation Testing

### Portrait
- [ ] Primary use case works well
- [ ] Content stacks appropriately
- [ ] No layout breaks

### Landscape
- [ ] Layout adapts for wider viewport
- [ ] Charts use appropriate aspect ratio
- [ ] Navigation remains accessible

---

## Component-Specific Checks

### Buttons & Touch Targets
- [ ] Minimum 44x44px size
- [ ] Adequate spacing between buttons (≥8px)
- [ ] Full-width buttons on mobile where appropriate
- [ ] Button text doesn't overflow
- [ ] Icon buttons have clear hit areas

### Typography
- [ ] Body text ≥14px (0.875rem)
- [ ] Headers scaled appropriately
- [ ] Line height adequate for readability
- [ ] No text cutoff or overflow
- [ ] Labels visible and legible

### Forms
- [ ] Input fields ≥44px height
- [ ] Labels clearly associated with inputs
- [ ] Error messages visible
- [ ] Submit buttons full-width on mobile
- [ ] Keyboard doesn't obscure fields

### Tables
- [ ] Horizontal scroll enabled if needed
- [ ] First column sticky (if applicable)
- [ ] Font size readable (≥12px)
- [ ] Row height adequate for touch
- [ ] Alternative card view considered

### Charts
- [ ] Fit within viewport width
- [ ] Legends positioned appropriately (bottom on mobile)
- [ ] Labels readable and not overlapping
- [ ] Touch interactions work (if applicable)
- [ ] Aspect ratio maintained

### Modals
- [ ] Full-screen or near-full-screen on mobile
- [ ] Close button easily tappable
- [ ] Content doesn't overflow
- [ ] Scroll enabled if content is long
- [ ] Backdrop dismissal works

### Navigation
- [ ] Tabs accessible and tappable
- [ ] Active state clearly visible
- [ ] Hamburger menu (if used) works
- [ ] Swipe gestures (if implemented)

---

## Performance Checks

- [ ] Page loads quickly on mobile (< 3s)
- [ ] No layout shift after JavaScript loads
- [ ] Animations smooth (60fps)
- [ ] Images optimized for mobile
- [ ] No memory leaks on mobile browsers

---

## Browser Testing

### iOS Safari
- [ ] Layout correct
- [ ] Touch events work
- [ ] Form inputs functional
- [ ] No iOS-specific bugs

### Chrome Mobile
- [ ] Consistent with desktop Chrome
- [ ] DevTools match actual device
- [ ] Performance acceptable

### Other Browsers (if time permits)
- [ ] Firefox Mobile
- [ ] Samsung Internet
- [ ] Edge Mobile

---

## Actual Device Testing

### Critical Path
- [ ] Can navigate to main features
- [ ] Can complete primary tasks
- [ ] Forms can be filled and submitted
- [ ] Charts/data visible and readable
- [ ] Buttons and links work

### Edge Cases
- [ ] Works with slow network
- [ ] Works in offline mode (PWA)
- [ ] Handles errors gracefully
- [ ] Loading states clear

---

## Accessibility (Mobile-Specific)

- [ ] Touch targets meet WCAG 2.1 criteria (44x44px)
- [ ] Text scalable without breaking layout
- [ ] Color contrast adequate on mobile
- [ ] Screen reader friendly (if applicable)
- [ ] Keyboard navigation works on mobile

---

## CSS Validation

- [ ] Mobile media query applied (`@media (max-width: 767px)`)
- [ ] Uses `!important` where needed to override
- [ ] No inline styles blocking mobile CSS
- [ ] Dark mode works on mobile

---

## JavaScript Validation

- [ ] `isMobileDevice()` check used where needed
- [ ] `fixMobileGridLayouts()` called if grids exist
- [ ] `getMobileChartOptions()` used for charts
- [ ] Event listeners work on touch devices
- [ ] No console errors on mobile

---

## Pre-Deployment Checklist

- [ ] All above tests passed
- [ ] Git commit includes mobile changes
- [ ] Commit message mentions mobile updates
- [ ] Desktop functionality not broken
- [ ] Ready to deploy to Vercel

---

## Post-Deployment Verification

- [ ] Test on actual deployed URL
- [ ] Hard refresh to clear cache
- [ ] Verify PWA manifest loads
- [ ] Service worker registered
- [ ] All fixes applied correctly

---

## Known Issues Template

If issues found, document them:

**Issue**: [Description]
**Affected Devices**: [iPhone SE, Android, etc.]
**Severity**: [Critical/High/Medium/Low]
**Workaround**: [Temporary fix if available]
**Fix Planned**: [When/how to fix]

---

## Sign-Off

- [ ] Desktop version approved
- [ ] Mobile version approved
- [ ] Deployed successfully
- [ ] User notified of changes

**Tested by**: _____________
**Date**: _____________
**Deployment URL**: _____________
**Notes**: _____________
