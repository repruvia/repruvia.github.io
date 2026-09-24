/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION_ID?: string;
  readonly VITE_LINEAR_CLIENT_ID?: string;
  readonly VITE_JIRA_CLIENT_ID?: string;
  /** Optional overrides of the built-in Firebase web config. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** "true" to use the local Firebase emulator suite. */
  readonly VITE_FIREBASE_EMULATORS?: string;
  /** reCAPTCHA Enterprise site key; enables App Check when set. */
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
