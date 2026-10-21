/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the deployed SearchLab execution engine. */
  readonly VITE_ENGINE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
