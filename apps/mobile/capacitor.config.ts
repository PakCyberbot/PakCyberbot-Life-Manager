import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pakcyberbot.lifemanager',
  appName: 'PakCyberbot Life Manager',
  webDir: 'dist',
  plugins: {
    // Patches fetch/XMLHttpRequest to route through native networking on
    // Android/iOS instead of the WebView's own network stack — required so
    // this app's REST calls (YouTube oEmbed, Wikipedia, arbitrary web-page
    // scraping for previews, Google Drive's API) aren't blocked by WebView
    // CORS the way a plain browser page would be. See CLAUDE.md's Mobile
    // section for the full rationale.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
