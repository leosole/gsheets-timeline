/**
 * Google Drive workspace persistence.
 *
 * In Vercel mode the workspace (tabs, column mappings, etc.) is stored as a
 * JSON file in the user's own Google Drive rather than in localStorage.
 * This gives cross-device sync for free using the user's existing Google
 * storage quota.
 *
 * File location in Drive:
 *   /Timeline/workspace.json
 */

import { getAccessToken } from "./vercel-auth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const WORKSPACE_FILENAME = "workspace.json";
const FOLDER_NAME = "Timeline";
const MIME_JSON = "application/json";

// ---------------------------------------------------------------------------
// Drive API helpers
// ---------------------------------------------------------------------------

async function driveGet(url: string): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API error (${res.status}): ${body}`);
  }
  return res.json();
}

async function driveUpload(
  url: string,
  metadata: Record<string, unknown>,
  body: string,
): Promise<any> {
  const token = await getAccessToken();
  const boundary = "----TimelineBoundary";
  const parts = [
    `--${boundary}`,
    `Content-Type: ${MIME_JSON}`,
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MIME_JSON}`,
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: parts,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload error (${res.status}): ${text}`);
  }
  return res.json();
}

async function drivePatch(
  url: string,
  metadata: Record<string, unknown>,
  body: string,
): Promise<any> {
  const token = await getAccessToken();
  const boundary = "----TimelineBoundary";
  const parts = [
    `--${boundary}`,
    `Content-Type: ${MIME_JSON}`,
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MIME_JSON}`,
    "",
    body,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: parts,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive patch error (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Folder helpers
// ---------------------------------------------------------------------------

async function findOrCreateFolder(name: string): Promise<string> {
  // Search for existing folder.
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await driveGet(`${DRIVE_API}/files?q=${q}&fields=files(id)`);

  if (list.files?.length > 0) {
    return list.files[0].id;
  }

  // Create the folder.
  const created = await driveUpload(
    `${DRIVE_API}/files?uploadType=multipart`,
    { name, mimeType: "application/vnd.google-apps.folder" },
    "",
  );
  return created.id;
}

// ---------------------------------------------------------------------------
// Workspace file helpers
// ---------------------------------------------------------------------------

async function findWorkspaceFile(folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${WORKSPACE_FILENAME}' and '${folderId}' in parents and trashed=false`,
  );
  const list = await driveGet(`${DRIVE_API}/files?q=${q}&fields=files(id)`);

  return list.files?.length > 0 ? list.files[0].id : null;
}

async function readWorkspaceFile(fileId: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive read error (${res.status}): ${body}`);
  }

  return res.text();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads the workspace JSON from the user's Google Drive.
 *
 * Returns the workspace JSON string, or an empty string if no workspace
 * file exists yet.
 */
export async function loadWorkspaceFromDrive(): Promise<string> {
  const folderId = await findOrCreateFolder(FOLDER_NAME);
  const fileId = await findWorkspaceFile(folderId);

  if (!fileId) return "";

  return readWorkspaceFile(fileId);
}

/**
 * Saves the workspace JSON to the user's Google Drive.
 *
 * Creates the file if it doesn't exist, updates it if it does.
 */
export async function saveWorkspaceToDrive(json: string): Promise<void> {
  const folderId = await findOrCreateFolder(FOLDER_NAME);
  const fileId = await findWorkspaceFile(folderId);

  const metadata = {
    name: WORKSPACE_FILENAME,
    mimeType: MIME_JSON,
    parents: [folderId],
  };

  if (fileId) {
    // Update existing file.
    await drivePatch(
      `${DRIVE_UPLOAD}/files/${fileId}?uploadType=multipart`,
      metadata,
      json,
    );
  } else {
    // Create new file.
    await driveUpload(
      `${DRIVE_API}/files?uploadType=multipart`,
      metadata,
      json,
    );
  }
}
