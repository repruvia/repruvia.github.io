import { initializeApp } from "firebase/app";

/**
 * Firebase web config. These values identify the project; they are not secrets
 * (access is enforced by Auth, the Firestore security rules, and App Check).
 * Each can be overridden per environment with a `VITE_FIREBASE_*` variable.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAcleGoWtsgZXl7ckxGQ-El8Vd4rnxX3s4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "repruvia.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "repruvia",
  storageBucket: "repruvia.firebasestorage.app",
  messagingSenderId: "160389905037",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:160389905037:web:03aa0bb0ff57a39e0e00c4",
};

// No Analytics: Repruvia keeps its no-telemetry promise.
export const firebaseApp = initializeApp(firebaseConfig);

/** Route Auth / Firestore to the local emulator suite (`firebase emulators:start`). */
export const useFirebaseEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === "true";

// App Check keeps calls that don't come from this app off the project's
// Firestore quota. Opt-in until a reCAPTCHA Enterprise key is configured.
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    // Prints a debug token to the console; register it under App Check → Apps.
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  // Loaded on demand so deployments without App Check don't ship it. It's
  // ready long before the first sync needs a token.
  void import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    }),
  );
}
