import globals from "globals";

// Project-specific globals used across script tags
const projectGlobals = {
  // Kiosk app globals
  State: "writable",
  Router: "writable",
  Views: "writable",
  UI: "writable",
  Sync: "writable",
  I18n: "writable",
  WebAuthn: "writable",

  // Web app globals
  Api: "writable",
  API: "writable",  // Alias used in some files
  Components: "writable",
  SuperAdminAPI: "writable",
  QREnrollment: "writable",
  NFCEnrollment: "writable",

  // Teacher PWA globals
  IDB: "writable",

  // Shared lib globals
  createApiClient: "readonly",

  // External libraries
  QRCode: "readonly",
  qrcode: "readonly",
  jsQR: "readonly",

  // Web APIs
  NDEFReader: "readonly",

  // Node.js module system (for hybrid browser/node files)
  module: "readonly",
};

export default [
  {
    ignores: ["src/web-app/js/lib/**", "node_modules/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...projectGlobals,
      }
    },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^(State|Router|Views|UI|Sync|I18n|WebAuthn|Api|API|Components|SuperAdminAPI|QREnrollment|NFCEnrollment|IDB)$" }],
      "no-undef": "error",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",
      "valid-typeof": "error",
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      "no-redeclare": ["error", { "builtinGlobals": false }],
      "no-self-assign": "error",
      "semi": ["error", "always"],
    }
  },
  {
    files: ["src/**/tests/**/*.js", "src/**/*.spec.js", "src/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...projectGlobals,
        test: "writable",
        expect: "writable",
        describe: "writable",
        it: "writable",
        beforeEach: "writable",
        afterEach: "writable",
        beforeAll: "writable",
        afterAll: "writable",
        jest: "writable",
        page: "writable",
        browser: "writable",
        context: "writable",
      }
    },
    rules: {
      "no-redeclare": ["error", { "builtinGlobals": false }],
    }
  },
  {
    files: ["src/**/service-worker.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
        ...projectGlobals,
      }
    }
  }
];
