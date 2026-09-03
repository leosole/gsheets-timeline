/**
 * Google OAuth token management for the Vercel deployment.
 *
 * The user authenticates with their own Google account via Google Identity
 * Services (GIS). The resulting access token lets the app read their
 * spreadsheets directly — the same way Apps Script uses the user's own
 * credentials via google.script.run.
 *
 * Required Vite env vars (set in .env or Vercel dashboard):
 *   VITE_GOOGLE_OAUTH_CLIENT_ID  – OAuth 2.0 client ID (Web application type)
 *   VITE_GOOGLE_API_KEY          – Google API key (for the Picker)
 *   VITE_GOOGLE_PROJECT_NUMBER   – Google Cloud project number (for Picker appId)
 *   VITE_ALLOWED_EMAILS          – Comma-separated list of allowed Google emails
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const TOKEN_KEY = "timeline-google-access-token";
const TOKEN_EXPIRY_KEY = "timeline-google-token-expiry";
const EMAIL_KEY = "timeline-google-email";

/**
 * Scopes required so the token can:
 * - Read spreadsheet data (Sheets API)
 * - List/search spreadsheets in Drive (for the Picker)
 * - Access files the user opens via the Picker (Drive)
 * - Store workspace in the user's Drive
 */
const OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

let gisPromise: Promise<any> | null = null;

// ---------------------------------------------------------------------------
// GIS script loading
// ---------------------------------------------------------------------------

const loadGis = (): Promise<any> => {
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<any>((resolve, reject) => {
    const existing = (window as any).google?.accounts?.id;
    if (existing) {
      resolve((window as any).google);
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return gisPromise;
};

// ---------------------------------------------------------------------------
// Token / email storage (sessionStorage — cleared when the tab closes)
// ---------------------------------------------------------------------------

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

function storeToken(
  token: string,
  expiresIn: number,
  email: string | null,
) {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(
      TOKEN_EXPIRY_KEY,
      String(Date.now() + expiresIn * 1000),
    );
    if (email) sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Storage failure is non-fatal.
  }
}

function getStoredToken(): string | null {
  if (!canUseSessionStorage()) return null;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    // Consider expired if within 5 minutes of expiry.
    if (Date.now() > Number(expiry) - 5 * 60 * 1000) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
      sessionStorage.removeItem(EMAIL_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ID token decoding (extracts email from the JWT payload)
// ---------------------------------------------------------------------------

function decodeIdTokenEmail(idToken: string): string | null {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email allowlist
// ---------------------------------------------------------------------------

let cachedAllowlist: string[] | null = null;

async function getAllowedEmails(): Promise<string[]> {
  if (cachedAllowlist) return cachedAllowlist;

  try {
    const res = await fetch("/allowlist.json");
    if (!res.ok) {
      cachedAllowlist = [];
      return [];
    }
    const data = await res.json();
    cachedAllowlist = (data.emails || [])
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
    return cachedAllowlist!;
  } catch {
    cachedAllowlist = [];
    return [];
  }
}

/**
 * Checks whether the given email is in the allowlist.
 * Returns true if no allowlist is configured (open access).
 */
export async function isEmailAllowed(
  email: string | null,
): Promise<boolean> {
  if (!email) return false;
  const allowed = await getAllowedEmails();
  if (allowed.length === 0) return true; // No list = open access
  return allowed.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

export function getOAuthClientId(): string {
  return (
    (import.meta as any).env?.VITE_GOOGLE_OAUTH_CLIENT_ID ||
    (window as any).__GOOGLE_OAUTH_CLIENT_ID__ ||
    ""
  );
}

export function getApiKey(): string {
  return (
    (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
    (window as any).__GOOGLE_API_KEY__ ||
    ""
  );
}

export function getProjectNumber(): string {
  return (
    (import.meta as any).env?.VITE_GOOGLE_PROJECT_NUMBER ||
    (window as any).__GOOGLE_PROJECT_NUMBER__ ||
    ""
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the app is running in Vercel mode (not Apps Script,
 * not localhost dev).
 */
export function isVercelMode(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as any).__TIMELINE_VERCEL__ === true
  );
}

/**
 * Returns the current user's Google email if stored from a previous auth.
 */
export function getCachedEmail(): string | null {
  if (!canUseSessionStorage()) return null;
  try {
    return sessionStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns the current user's Google OAuth access token if one is cached
 * and not expired. Returns null otherwise.
 */
export function getCachedAccessToken(): string | null {
  return getStoredToken();
}

/**
 * Returns true if the user has a valid cached access token.
 */
export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}

/**
 * Shows the Google OAuth consent screen so the user can grant access to
 * their spreadsheets. Returns the access token on success.
 *
 * The ID token returned by GIS contains the user's email, which is extracted
 * and stored for the allowlist check.
 */
export async function requestAccessToken(): Promise<string> {
  const google = await loadGis();
  const clientId = getOAuthClientId();

  if (!clientId) {
    throw new Error(
      "Google OAuth client ID is not configured. Set VITE_GOOGLE_OAUTH_CLIENT_ID in your environment.",
    );
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: OAUTH_SCOPES,
      callback: (tokenResponse: {
        access_token: string;
        expires_in: number;
        id_token?: string;
        error?: string;
      }) => {
        if (tokenResponse.error) {
          reject(new Error(`OAuth error: ${tokenResponse.error}`));
          return;
        }

        // Extract email from the ID token (a JWT in the token response).
        let email: string | null = null;
        if (tokenResponse.id_token) {
          email = decodeIdTokenEmail(tokenResponse.id_token);
        }

        storeToken(
          tokenResponse.access_token,
          tokenResponse.expires_in,
          email,
        );
        resolve(tokenResponse.access_token);
      },
      error_callback: (err: any) => {
        reject(
          new Error(
            err?.message || "Google sign-in was cancelled or failed.",
          ),
        );
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Returns a valid Google access token. Uses the cached token if available,
 * otherwise prompts the user to sign in.
 */
export async function getAccessToken(): Promise<string> {
  const cached = getStoredToken();
  if (cached) return cached;
  return requestAccessToken();
}

/**
 * Signs the user out by clearing all stored tokens and email.
 */
export function signOut(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  } catch {
    // Ignore.
  }

  const google = (window as any).google;
  if (google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
}
