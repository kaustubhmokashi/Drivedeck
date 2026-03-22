const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const API_KEY =
  process.env.GOOGLE_DRIVE_API_KEY || "AIzaSyCPrDluLv5ryZ2f-5WRiSGokJHRVeuGqe8";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const REMOTE_CODES_FILE = path.join(DATA_DIR, "remote-links.txt");
const CODE_EXPIRY_MS = 2 * 24 * 60 * 60 * 1000;

const IMAGE_MIME_PREFIX = "image/";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(REMOTE_CODES_FILE)) {
    fs.writeFileSync(REMOTE_CODES_FILE, "", "utf8");
  }
}

function readRemoteMappings() {
  ensureDataStore();
  const content = fs.readFileSync(REMOTE_CODES_FILE, "utf8");

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, url, createdAt] = line.split("\t");
      return { code, url, createdAt };
    });
}

function writeRemoteMappings(mappings) {
  ensureDataStore();
  const body = mappings
    .map((entry) => [entry.code, entry.url || "", entry.createdAt || ""].join("\t"))
    .join("\n");
  fs.writeFileSync(REMOTE_CODES_FILE, body ? `${body}\n` : "", "utf8");
}

function generateRemoteCode() {
  const mappings = readRemoteMappings();
  let code = "";

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (mappings.some((entry) => entry.code === code));

  return code;
}

function isExpired(createdAt) {
  const timestamp = Date.parse(createdAt || "");
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return Date.now() - timestamp > CODE_EXPIRY_MS;
}

function pruneExpiredMappings() {
  const mappings = readRemoteMappings();
  const activeMappings = mappings.filter((entry) => !isExpired(entry.createdAt));

  if (activeMappings.length !== mappings.length) {
    writeRemoteMappings(activeMappings);
  }

  return activeMappings;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function getPreferredLanIp() {
  const networks = os.networkInterfaces();
  for (const addresses of Object.values(networks)) {
    for (const address of addresses || []) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        (
          address.address.startsWith("192.168.") ||
          address.address.startsWith("10.") ||
          address.address.startsWith("172.")
        )
      ) {
        return address.address;
      }
    }
  }

  return null;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function proxyDriveImage(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const fileId = requestUrl.searchParams.get("id");

  if (!API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing GOOGLE_DRIVE_API_KEY environment variable. Add it before starting the server.",
    });
    return;
  }

  if (!fileId) {
    sendJson(res, 400, { error: "Missing image file id." });
    return;
  }

  try {
    const candidates = [
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${encodeURIComponent(API_KEY)}`,
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    ];

    let lastError = "Unable to fetch image from Google Drive.";

    for (const candidate of candidates) {
      const response = await fetch(candidate, { redirect: "follow" });
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        lastError = `Image request failed (${response.status}) for ${candidate}`;
        continue;
      }

      if (!response.body || !contentType.startsWith("image/")) {
        lastError = `Non-image response returned for ${candidate}`;
        continue;
      }

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      });

      for await (const chunk of response.body) {
        res.write(chunk);
      }
      res.end();
      return;
    }

    sendJson(res, 502, { error: lastError });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "File not found." });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
      }[extension] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function sanitizePathname(pathname) {
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return resolvedPath;
}

function extractFolderId(input) {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsedUrl = new URL(trimmed);

    const folderMatch = parsedUrl.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      return folderMatch[1];
    }

    const idParam = parsedUrl.searchParams.get("id");
    if (idParam) {
      return idParam;
    }
  } catch (error) {
    return null;
  }

  return null;
}

async function driveListFiles(parentId, pageToken) {
  const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
  driveUrl.searchParams.set("key", API_KEY);
  driveUrl.searchParams.set(
    "q",
    `'${parentId}' in parents and trashed = false`
  );
  driveUrl.searchParams.set(
    "fields",
    "nextPageToken, files(id, name, mimeType, webViewLink, thumbnailLink, imageMediaMetadata)"
  );
  driveUrl.searchParams.set("pageSize", "1000");
  driveUrl.searchParams.set("orderBy", "folder,name_natural");
  driveUrl.searchParams.set("supportsAllDrives", "true");
  driveUrl.searchParams.set("includeItemsFromAllDrives", "true");
  if (pageToken) {
    driveUrl.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(driveUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive API request failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function driveGetFile(fileId) {
  const driveUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  driveUrl.searchParams.set("key", API_KEY);
  driveUrl.searchParams.set("fields", "id,name,mimeType");
  driveUrl.searchParams.set("supportsAllDrives", "true");

  const response = await fetch(driveUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive metadata request failed (${response.status}): ${text}`);
  }

  return response.json();
}

function createImageUrl(fileId) {
  return `/api/image?id=${encodeURIComponent(fileId)}`;
}

async function readFolderTree(folderId, rootName = "Root Folder") {
  const queue = [{ id: folderId, node: null, path: "" }];
  const images = [];
  let root = null;

  while (queue.length > 0) {
    const current = queue.shift();
    const node = {
      id: current.id,
      name: current.node ? current.node.name : rootName,
      folders: [],
      images: [],
    };

    if (!root) {
      root = node;
    } else if (current.node) {
      current.node.target.folders.push(node);
    }

    let pageToken = undefined;
    do {
      const data = await driveListFiles(current.id, pageToken);
      const files = data.files || [];

      for (const file of files) {
        if (file.mimeType === FOLDER_MIME_TYPE) {
          queue.push({
            id: file.id,
            path: current.path ? `${current.path}/${file.name}` : file.name,
            node: {
              name: file.name,
              target: node,
            },
          });
          continue;
        }

        if (!file.mimeType || !file.mimeType.startsWith(IMAGE_MIME_PREFIX)) {
          continue;
        }

        const image = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          path: current.path || "",
          url: createImageUrl(file.id),
          thumbnailUrl: createImageUrl(file.id),
          webViewLink: file.webViewLink || "",
        };

        node.images.push(image);
        images.push(image);
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return {
    folderId,
    tree: root,
    images,
  };
}

async function handleApiFolder(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing GOOGLE_DRIVE_API_KEY environment variable. Add it before starting the server.",
    });
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const input = requestUrl.searchParams.get("url") || "";
  const folderId = extractFolderId(input);

  if (!folderId) {
    sendJson(res, 400, {
      error:
        "Could not extract a Google Drive folder ID from the provided input.",
    });
    return;
  }

  try {
    const folderMeta = await driveGetFile(folderId);
    if (folderMeta.mimeType !== FOLDER_MIME_TYPE) {
      sendJson(res, 400, { error: "The provided link does not point to a Google Drive folder." });
      return;
    }

    const result = await readFolderTree(folderId, folderMeta.name || "Root Folder");
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 500, {
      error: error.message,
    });
  }
}

async function handleApiFolderMeta(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing GOOGLE_DRIVE_API_KEY environment variable. Add it before starting the server.",
    });
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const input = requestUrl.searchParams.get("url") || "";
  const folderId = extractFolderId(input);

  if (!folderId) {
    sendJson(res, 400, {
      error:
        "Could not extract a Google Drive folder ID from the provided input.",
    });
    return;
  }

  try {
    const folderMeta = await driveGetFile(folderId);
    if (folderMeta.mimeType !== FOLDER_MIME_TYPE) {
      sendJson(res, 400, { error: "The provided link does not point to a Google Drive folder." });
      return;
    }

    sendJson(res, 200, {
      id: folderMeta.id,
      name: folderMeta.name,
    });
  } catch (error) {
    sendJson(res, 500, {
      error: error.message,
    });
  }
}

async function handleSaveRemoteLink(req, res) {
  try {
    const body = await readRequestBody(req);
    const url = String(body.url || "").trim();

    if (!url) {
      sendJson(res, 400, { error: "A Google Drive URL is required." });
      return;
    }

    const mappings = pruneExpiredMappings();
    const code = generateRemoteCode();
    mappings.push({
      code,
      url,
      createdAt: new Date().toISOString(),
    });
    writeRemoteMappings(mappings);
    sendJson(res, 200, { success: true, code });
  } catch (error) {
    sendJson(res, 400, { error: "Invalid request body." });
  }
}

async function handleResolveRemoteCode(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const code = String(requestUrl.searchParams.get("code") || "").trim();

  if (!/^\d{6}$/.test(code)) {
    sendJson(res, 400, { error: "Code must be a 6 digit number." });
    return;
  }

  const entry = pruneExpiredMappings().find((item) => item.code === code);
  if (!entry) {
    sendJson(res, 404, { error: "Code not found or it has expired. Generate a new code." });
    return;
  }

  sendJson(res, 200, {
    code: entry.code,
    url: entry.url || "",
    ready: Boolean(entry.url),
  });
}

async function handlePairingOrigin(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const hostHeader = req.headers.host || "";
  const protocol = requestUrl.protocol;
  const hostName = hostHeader.split(":")[0];
  const port = hostHeader.includes(":") ? hostHeader.split(":")[1] : String(PORT);

  let origin = `${protocol}//${hostHeader}`;
  if (!hostName || hostName === "localhost" || hostName === "127.0.0.1") {
    const lanIp = getPreferredLanIp();
    if (lanIp) {
      origin = `${protocol}//${lanIp}:${port}`;
    }
  }

  sendJson(res, 200, { origin });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/folder") {
    await handleApiFolder(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/folder-meta") {
    await handleApiFolderMeta(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/image") {
    await proxyDriveImage(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/remote/link" && req.method === "POST") {
    await handleSaveRemoteLink(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/remote/resolve") {
    await handleResolveRemoteCode(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/pairing-origin") {
    await handlePairingOrigin(req, res);
    return;
  }

  const pathname =
    requestUrl.pathname === "/"
      ? "/index.html"
      : requestUrl.pathname === "/remote"
        ? "/remote.html"
        : requestUrl.pathname;
  const filePath = sanitizePathname(pathname);
  if (!filePath) {
    sendJson(res, 400, { error: "Invalid path." });
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`DriveDeck running at http://${HOST}:${PORT}`);
});
