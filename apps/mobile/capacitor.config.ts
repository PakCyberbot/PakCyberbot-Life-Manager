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
    // @capacitor-community/sqlite defaults androidIsEncryption to true at the plugin's own
    // top level (SqliteConfig.java) — separate from, and evaluated before, the per-connection
    // 'no-encryption' mode capacitorDriver.ts already requests. Left at its default, the
    // plugin's constructor unconditionally builds/retrieves an AndroidKeyStore-backed MasterKey
    // (androidx.security.crypto) on every single app boot, regardless of what any connection
    // asks for. Confirmed live as a real, current failure on a real device (Realme RMX3933,
    // Android 16): that MasterKey creation call failed with a native
    // `Error::Km(VERIFICATION_FAILED)` from the OS's own keystore2 service — a device/chipset-
    // level Keystore/TEE fault, not a bug in this app's own logic — which the plugin surfaces as
    // an opaque "CapacitorSQLitePlugin: null" thrown before createConnection()/open() ever runs,
    // blocking every boot with no relation to the database file itself. This app never uses the
    // plugin's own encryption feature (every connection is opened 'no-encryption'; secret
    // settings go through this app's own independent secretCryptoWeb.ts AES-256-GCM layer
    // instead) — explicitly declaring it off here skips that whole keystore/MasterKey code path
    // entirely, removing a fragile, unnecessary dependency for every device, not just this one.
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
