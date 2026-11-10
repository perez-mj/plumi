import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.plumi.lms',
  appName: 'plumi-lms',
  webDir: 'dist',
  server: {
    // Allow the OS to open our own scheme for auth callbacks.
    allowNavigation: ['io.plumi.lms'],
  },
  ios: {
    // Add the custom scheme so iOS routes io.plumi.lms:// back into the app.
    scheme: 'io.plumi.lms',
    contentInset: 'always',
  },
  android: {
    // Android manifest intent-filter uses this scheme — set via
    // `npx cap sync android` after this change.
    allowMixedContent: false,
  },
  plugins: {
    App: {
      // ensures appUrlOpen fires for custom schemes on both platforms
    },
  },
};

export default config;