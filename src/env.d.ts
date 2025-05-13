/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPI_ASSISTANT_ID: string
  readonly VITE_VAPI_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 