# Development Guidelines - Desktop-First, Mobile-Aware

## Core Philosophy

**Desktop First (Priority 1)**: All features are designed and implemented for desktop screens (≥1024px) first.

**Mobile Aware (Priority 2)**: Every visual change or UI component must be evaluated for mobile compatibility and adapted accordingly.

---

## Responsive Breakpoints

```css
/* Desktop (default): ≥1024px */
/* Tablet: 768px - 1023px */
/* Mobile: 375px - 767px */
/* Extra Small: <375px */
```

---

## Development Workflow

### Step 1: Desktop Implementation
1. Design and code for desktop first
2. Test at common resolutions:
   - 1920x1080 (Full HD)
   - 1366x768 (Laptop)
   - 1280x720 (Smaller laptop)

### Step 2: Mobile Evaluation
Ask these questions:
- Does this change layout, spacing, or typography?
- Does this add new buttons, forms, or interactive elements?
- Does this use grid, flexbox, or absolute positioning?
- Does this include tables, charts, or data visualization?

**If YES to any**: Mobile adaptation required.

### Step 3: Mobile Adaptation
1. Write mobile CSS in the `@media (max-width: 767px)` section
2. Consider: stacking, touch targets (44x44px min), font sizes, spacing
3. Test on mobile viewport (375x667 minimum)
4. Add JavaScript mobile fixes if needed (`fixMobileGridLayouts()`, etc.)

### Step 4: Verification
- Use browser dev tools responsive mode
- Test on actual mobile device when possible
- Check horizontal scroll (should be none)
- Verify touch targets meet minimum size

---

## CSS Development Pattern

### Adding New Component Styles

**Desktop CSS** (top of file, before media queries):
```css
/* ========================================
   COMPONENT NAME (Desktop ≥1024px)
   Mobile adaptation: See line XXXX
   ======================================== */

.my-component {
    /* Desktop styles */
    display: flex;
    padding: 32px;
    gap: 24px;
}
```

**Mobile CSS** (in `@media (max-width: 767px)` section):
```css
/* [COMPONENT NAME] - Mobile (<768px) */
.my-component {
    display: block !important;
    padding: 16px !important;
    gap: 12px !important;
}
```

### Common Mobile Adaptations

| Desktop Pattern | Mobile Adaptation |
|----------------|-------------------|
| `display: flex` with horizontal items | `flex-direction: column` or `display: grid; grid-template-columns: 1fr 1fr` |
| `padding: 32px` | `padding: 12px` or `16px` |
| `gap: 24px` | `gap: 8px` or `12px` |
| `grid-template-columns: 1fr 1fr 1fr` | `grid-template-columns: 1fr` |
| `font-size: 1.2rem` | `font-size: 1rem` |
| `width: 480px` | `width: 100%; max-width: 100vw` |

---

## JavaScript Development Pattern

### Adding New UI Components

```javascript
renderMyNewComponent() {
    // Desktop implementation (priority 1)
    const html = `
        <div class="my-component">
            <!-- Desktop-optimized structure -->
        </div>
    `;

    // Mobile adaptation (priority 2)
    // Call fixMobileGridLayouts() if needed
    // Or add specific mobile fixes:
    if (this.isMobileDevice()) {
        this.applyMobileAdaptation('.my-component', {
            display: 'block',
            padding: '12px'
        });
    }

    return html;
}
```

### Available Helper Functions

- `isMobileDevice()` - Returns true if viewport ≤767px
- `fixMobileGridLayouts()` - Converts grid layouts to single column
- `applyMobileAdaptation(selector, styles)` - Apply inline styles on mobile
- `getMobileChartOptions(baseOptions)` - Adapts Chart.js options for mobile

---

## Mobile Checklist (Every UI Change)

Use this checklist for every feature or visual change:

- [ ] Desktop layout tested at 1920x1080
- [ ] Desktop layout tested at 1366x768
- [ ] Mobile layout tested at 375x667 (iPhone SE)
- [ ] Mobile layout tested at 390x844 (iPhone 12/13/14)
- [ ] Touch targets minimum 44x44px
- [ ] No horizontal scroll on mobile
- [ ] Text readable on mobile (minimum 14px for body text)
- [ ] Buttons either stack vertically or use 2-column grid
- [ ] Charts fit within viewport with proper legends
- [ ] Tables either scroll horizontally or use card layout
- [ ] Forms have adequate spacing and touch targets
- [ ] Modals are full-screen or near-full-screen on mobile

---

## Common Gotchas

### 1. Inline Styles Override CSS
**Problem**: Inline `style=""` attributes have higher specificity than CSS.

**Solution**: Use `!important` in mobile CSS or JavaScript to override.

### 2. Chart.js Canvas Sizing
**Problem**: Charts render at fixed pixel widths.

**Solution**: Always use `getMobileChartOptions()` wrapper and set `responsive: true`.

### 3. Grid Layouts with minmax()
**Problem**: `minmax(400px, 1fr)` creates 400px minimum on 375px screens.

**Solution**: Override with `grid-template-columns: 1fr !important` on mobile.

### 4. Flexbox wrap Issues
**Problem**: Flex items wrap unpredictably on small screens.

**Solution**: Use `flex-direction: column` or convert to grid on mobile.

---

## Testing Protocol

### Browser DevTools
1. Open Chrome DevTools (F12)
2. Click device toolbar (Ctrl+Shift+M)
3. Test these viewports:
   - iPhone SE (375x667)
   - iPhone 12/13/14 (390x844)
   - iPad (768x1024)

### Actual Device Testing
1. Deploy to Vercel
2. Test on actual iPhone/Android
3. Check in both portrait and landscape
4. Test all interactive elements

### Performance
- Mobile should load quickly (check Network tab)
- No layout shift after JavaScript loads
- Smooth scrolling and animations

---

## When to Skip Mobile Adaptation

Mobile adaptation can be skipped ONLY for:
- Internal debugging tools
- Developer console logs
- Backend data processing
- Database queries
- Non-visual logic

Everything user-facing requires mobile consideration.

---

## File Structure

```
/css/styles.css          # Desktop styles first, then media queries
/index.html              # HTML + JavaScript with mobile helpers
/manifest.json           # PWA config for mobile home screen
/sw.js                   # Service worker for mobile caching
```

---

## Quick Reference

### CSS
- Desktop: Write normally at top of file
- Mobile: Add in `@media (max-width: 767px)` section (line ~2512)
- Use `!important` if desktop styles persist

### JavaScript
- Check `isMobileDevice()` before mobile-specific logic
- Call `fixMobileGridLayouts()` after rendering grids
- Use `getMobileChartOptions()` for all Chart.js charts

### Testing
- Desktop: Browser at 1366x768+
- Mobile: DevTools + actual device
- Always check horizontal scroll (should be NONE)

---

## Future Improvements

Ideas for enhancing mobile experience:
- [ ] Swipe gestures for tab navigation
- [ ] Pull-to-refresh for data sync
- [ ] Offline mode with service worker
- [ ] Mobile-specific compact table views
- [ ] Bottom navigation bar for mobile
- [ ] Haptic feedback for actions
