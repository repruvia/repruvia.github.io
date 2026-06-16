/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION_ID?: string;
  readonly VITE_LINEAR_CLIENT_ID?: string;
  readonly VITE_JIRA_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
