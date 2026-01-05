# Glass Shadow - Emergency Patch

## What This Fixes

1. **Color Scheme**: Converts green terminal aesthetic to silver/chrome
2. **Instant Fail Bug**: Adds grace period before NPC detection activates
3. **iOS Viewport**: Fixes text/UI bleeding off screen on mobile

## How to Apply

### Option A: Replace Files Directly

1. Replace `styles.css` with the new one
2. Replace `index.html` with the new one
3. Apply the changes from `main-patch.js` to your `main.js`

### Option B: Quick Test (styles only)

Just replace `styles.css` to see the silver aesthetic. The game will still have the detection bug but will look correct.

## Files Included

| File | Purpose |
|------|---------|
| `styles.css` | Complete replacement - silver palette + iOS fixes |
| `index.html` | Complete replacement - iOS viewport meta tags |
| `main-patch.js` | Instructions + code snippets for fixing detection |

## Key Changes in styles.css

```css
/* OLD (Green) */
--color-primary: #00ff88;

/* NEW (Silver) */
--color-primary: #c0c5ce;
--color-gold: #c9a227;  /* Accent for Sloane */
```

## Key Changes in index.html

```html
<!-- Added iOS viewport fixes -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
```

## Key Changes in main.js

1. Add `DETECTION_GRACE_PERIOD = 3000` constant
2. Add `detectionEnabled` flag, set false on room entry
3. Enable detection after 3 second delay
4. Make detection incremental (not instant fail)
5. Only fail mission at 100% detection, not on first spot

## Deployment

After applying patches:

```powershell
cd D:\gs_pwa_projects\glassshadow
git add .
git commit -m "Apply silver theme and iOS fixes"
git push origin main
```

Vercel will auto-deploy.

## Testing on iOS

1. Open Safari on iPhone
2. Navigate to your Vercel URL
3. Tap Share → Add to Home Screen
4. Open from home screen for full-screen PWA experience
