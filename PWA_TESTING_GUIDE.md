# PWA Testing Guide

## Overview
The DOT Corridor Communicator now includes Progressive Web App (PWA) functionality for an enhanced mobile experience.

## What's New

### 1. **PWA Manifest** (`manifest.json`)
- App name, icons, and metadata
- Standalone display mode for app-like experience
- Theme color and background color
- App shortcuts for quick access to key features
- Support for all major icon sizes (16x16 to 512x512)

### 2. **Service Worker** (`service-worker.js`)
- **Offline Support**: Cache core assets for offline viewing
- **Network Strategies**:
  - Network-first for HTML pages
  - Cache-first for static assets
  - Always fresh for API requests
- **Background Sync**: Queue offline actions
- **Push Notifications**: Support for future alerts

### 3. **Install Prompt Component** (`PWAInstallPrompt.jsx`)
- Auto-shows install banner after 3 seconds
- Platform-specific instructions for iOS
- Dismissible for 7 days
- Beautiful gradient design matching app theme

### 4. **Mobile-Responsive Enhancements**
- Touch-friendly buttons (min 44px tap targets)
- iOS safe area support for notched devices
- Landscape orientation optimizations
- Better scrolling with `-webkit-overflow-scrolling`
- Prevents iOS zoom on input focus
- High DPI display support
- Reduced motion for accessibility

## Testing Instructions

### Desktop (Chrome/Edge)

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Open Chrome DevTools** (F12):
   - Go to **Application** tab
   - Check **Manifest** section - should show all icons and metadata
   - Check **Service Workers** - should show registered worker
   - Click "Update on reload" for development

3. **Test Install Prompt**:
   - After 3 seconds, you should see a blue install banner at the bottom
   - Click "Install" to add to desktop
   - Or dismiss it (will reappear in 7 days)

4. **Test Offline**:
   - In DevTools, go to **Network** tab
   - Check "Offline" checkbox
   - Reload the page - cached assets should still load
   - API requests will show offline message

### Mobile (iOS)

1. **Deploy to production** or use ngrok for local testing

2. **Open in Safari** (not Chrome - iOS requires Safari for PWA)

3. **Test Install Prompt**:
   - Wait 5 seconds for the install banner
   - Tap "Show Me How" for iOS-specific instructions
   - Follow the steps:
     1. Tap Share button (bottom of Safari)
     2. Scroll down and tap "Add to Home Screen"
     3. Tap "Add" to confirm

4. **Test Installed App**:
   - Open from home screen
   - Should run in standalone mode (no Safari UI)
   - Safe area insets should work on notched devices
   - Status bar should be visible

5. **Test Offline**:
   - Turn on Airplane Mode
   - Open the installed app
   - Cached content should still display
   - API requests will gracefully fail

### Mobile (Android)

1. **Open in Chrome**

2. **Test Install Prompt**:
   - After 3 seconds, see install banner
   - Tap "Install" button
   - App will be added to home screen and app drawer

3. **Test Installed App**:
   - Open from home screen or app drawer
   - Runs in standalone mode
   - Theme color applied to status bar

4. **Test Offline**:
   - Same as iOS testing

## Features to Test

### ✅ Install Functionality
- [ ] Install prompt appears after delay
- [ ] iOS shows custom instructions modal
- [ ] Android/Chrome shows native install prompt
- [ ] Dismiss button hides prompt for 7 days
- [ ] App installs successfully

### ✅ Offline Support
- [ ] Core assets cached on first visit
- [ ] App loads while offline
- [ ] API requests show appropriate error
- [ ] Network reconnection works smoothly

### ✅ Mobile Responsiveness
- [ ] All buttons are at least 44px (touch-friendly)
- [ ] Text is readable (min 16px on mobile)
- [ ] No horizontal scroll on small screens
- [ ] Safe area insets work on notched devices
- [ ] Landscape mode is optimized
- [ ] No zoom on input focus (iOS)

### ✅ App Shortcuts (Android/Windows)
- [ ] Long-press app icon shows shortcuts
- [ ] "View Map" shortcut opens to map view
- [ ] "Data Quality" shortcut opens to quality dashboard
- [ ] "Asset Health" shortcut opens to assets view

### ✅ Dark Mode
- [ ] Dark mode toggle works
- [ ] PWA respects system dark mode preference
- [ ] Install prompt looks good in dark mode
- [ ] iOS instructions modal has dark theme

### ✅ Performance
- [ ] App loads quickly on mobile network
- [ ] Smooth scrolling and animations
- [ ] No layout shift during load
- [ ] Cached assets load instantly

## Debugging

### Chrome DevTools
- **Application > Manifest**: View manifest details
- **Application > Service Workers**: Monitor SW lifecycle
- **Application > Cache Storage**: Inspect cached files
- **Console**: Check for SW registration logs
- **Network**: Verify caching strategies

### iOS Safari
- **Settings > Safari > Advanced > Web Inspector**: Enable
- **Connect iPhone to Mac**
- **Safari > Develop > [Device] > [Page]**: Open inspector
- **Console**: Check for errors
- **Storage**: View cached data

### Common Issues

**Install prompt not showing:**
- Clear browser data and reload
- Check console for errors
- Ensure HTTPS (required for PWA)
- Wait full delay time (3-5 seconds)

**Service Worker not registering:**
- Check HTTPS (localhost is OK for dev)
- Look for JavaScript errors
- Verify service-worker.js is accessible
- Check browser compatibility

**iOS not working:**
- Must use Safari (Chrome/Firefox won't work for PWA on iOS)
- Ensure manifest.json is accessible
- Check meta tags in index.html
- Verify Apple touch icons

**Offline not working:**
- Check Service Worker is active
- Verify cache storage in DevTools
- Check network strategy in service-worker.js
- Look for CORS issues with cached resources

## Production Deployment

### Railway Deployment
The PWA files are automatically included in the production build:

```bash
npm run build
```

This creates:
- `dist/manifest.json`
- `dist/service-worker.js`
- `dist/icons/*`
- Updated `dist/index.html` with PWA meta tags

### HTTPS Requirement
PWAs require HTTPS in production. Railway provides this automatically.

### Testing in Production
1. Deploy to Railway
2. Visit the production URL
3. Test install prompt
4. Install the app
5. Test offline functionality
6. Verify all features work

## Lighthouse Audit

Run Lighthouse in Chrome DevTools to check PWA compliance:

1. Open DevTools (F12)
2. Go to **Lighthouse** tab
3. Select "Progressive Web App" category
4. Click "Generate report"

**Target Score**: 90+ for PWA category

**Key Metrics to Check**:
- ✅ Installable
- ✅ Fast and reliable on slow networks
- ✅ Provides offline fallback
- ✅ Configured for custom splash screen
- ✅ Sets theme color
- ✅ Content sized correctly for viewport

## Future Enhancements

### Phase 2 Ideas
- [ ] Push notifications for traffic alerts
- [ ] Background sync for offline message posting
- [ ] Better offline UX with cached data display
- [ ] App update notifications
- [ ] Share Target API for sharing traffic events
- [ ] Contact Picker API for team collaboration
- [ ] Geolocation for "Near Me" feature
- [ ] Camera API for incident reporting

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [iOS PWA Guide](https://web.dev/apple-touch-icon/)
- [Testing PWAs](https://web.dev/pwa-checklist/)

---

**Questions or Issues?**
Check the browser console for detailed error messages and service worker logs.
