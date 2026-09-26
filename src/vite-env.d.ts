/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public origin baked into QR codes on printed reports.
   * Set this in .env so a report generated on localhost still prints a QR that
   * resolves to the deployed site. No trailing slash.
   */
  readonly VITE_REPORT_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
