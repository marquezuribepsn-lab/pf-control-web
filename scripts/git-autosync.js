#!/usr/bin/env node

const chokidar = require("chokidar");
const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

const execFileAsync = promisify(execFile);

const WATCH_DEBOUNCE_MS = Number(process.env.GIT_AUTOSYNC_DEBOUNCE_MS || 1200);
const COMMIT_PREFIX = String(process.env.GIT_AUTOSYNC_COMMIT_PREFIX || "chore(autosync): save").trim();
const MAX_PATHS_FOR_PARTIAL_ADD = Number(process.env.GIT_AUTOSYNC_MAX_PATHS || 200);
const GIT_ADD_CHUNK_SIZE = 80;

const IGNORED_GLOBS = [
  "**/.git/**",
  "**/node_modules/**",
  "**/.next/**",
  "**/out/**",
  "**/build/**",
  "**/coverage/**",
  "**/.vercel/**",
  "**/.vscode/**",
  "**/storage/**",
  "**/prisma/dev.db*",
  "**/*.log",
];

const WATCH_TARGETS = [
  "app",
  "components",
  "lib",
  "prisma",
  "scripts",
  "data",
  "public",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  ".vscode/settings.json",
  ".vscode/tasks.json",
  "README.md",
];

const IGNORED_PREFIXES = [
  ".git/",
  "node_modules/",
  ".next/",
  "out/",
  "build/",
  "coverage/",
  ".vercel/",
  ".vscode/",
  "storage/",
];

const pendingPaths = new Set();
let watcher;
let syncTimer = null;
let syncing = false;
let syncRequestedWhileRunning = false;

function log(message) {
  const stamp = new Date().toISOString().replace("T", " ").replace(/\..+$/, "");
  process.stdout.write(`[autosync ${stamp}] ${message}\n`);
}

function normalizeRepoPath(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const relative = path.relative(process.cwd(), absolute);
  if (!relative || relative.startsWith("..")) {
    return null;
  }

  return relative.split(path.sep).join("/");
}

function isIgnoredRepoPath(repoPath) {
  if (!repoPath) {
    return true;
  }

  const normalized = repoPath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("../")) {
    return true;
  }

  if (normalized === "prisma/dev.db" || normalized.startsWith("prisma/dev.db")) {
    return true;
  }

  if (normalized.endsWith(".log")) {
    return true;
  }

  return IGNORED_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isSkippableGitAddError(output) {
  const text = output.toLowerCase();
  return text.includes("ignored by one of your .gitignore") || text.includes("did not match any files");
}

async function runGit(args, options = {}) {
  const { allowFailure = false } = options;

  try {
    const { stdout, stderr } = await execFileAsync("git", args, { cwd: process.cwd() });
    return { ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") };
  } catch (error) {
    const stdout = String(error.stdout || "");
    const stderr = String(error.stderr || error.message || "");

    if (allowFailure) {
      return { ok: false, stdout, stderr };
    }

    throw new Error(`git ${args.join(" ")} failed: ${stderr || stdout}`);
  }
}

async function ensureGitReady() {
  const inside = await runGit(["rev-parse", "--is-inside-work-tree"]);
  if (!inside.stdout.trim().toLowerCase().startsWith("true")) {
    throw new Error("No active git repository in current folder.");
  }

  const remote = await runGit(["remote", "get-url", "origin"], { allowFailure: true });
  if (!remote.ok || !remote.stdout.trim()) {
    throw new Error("Remote 'origin' is not configured. Run: git remote add origin <url>");
  }

  const userName = await runGit(["config", "--get", "user.name"], { allowFailure: true });
  const userEmail = await runGit(["config", "--get", "user.email"], { allowFailure: true });
  if (!userName.ok || !userName.stdout.trim() || !userEmail.ok || !userEmail.stdout.trim()) {
    throw new Error("Git user.name/user.email are not configured.");
  }
}

async function stagePendingPaths(paths) {
  if (paths.length === 0) {
    return [];
  }

  const uniquePaths = Array.from(new Set(paths)).filter((repoPath) => !isIgnoredRepoPath(repoPath));
  if (uniquePaths.length === 0) {
    return [];
  }

  const limitedPaths = uniquePaths.slice(0, Math.max(1, MAX_PATHS_FOR_PARTIAL_ADD));
  const stagedPaths = [];
  const chunks = chunkArray(limitedPaths, GIT_ADD_CHUNK_SIZE);

  for (const chunk of chunks) {
    const addChunk = await runGit(["add", "-A", "--", ...chunk], { allowFailure: true });
    if (addChunk.ok) {
      stagedPaths.push(...chunk);
      continue;
    }

    for (const repoPath of chunk) {
      const addSingle = await runGit(["add", "-A", "--", repoPath], { allowFailure: true });
      if (addSingle.ok) {
        stagedPaths.push(repoPath);
        continue;
      }

      const output = `${addSingle.stdout}\n${addSingle.stderr}`;
      if (isSkippableGitAddError(output)) {
        continue;
      }

      throw new Error(addSingle.stderr || addSingle.stdout || `git add failed for ${repoPath}`);
    }
  }

  return stagedPaths;
}

async function commitAndPush(paths) {
  const stagedPaths = await stagePendingPaths(paths);
  if (stagedPaths.length === 0) {
    return false;
  }

  const timestamp = new Date().toISOString().replace("T", " ").replace(/\..+$/, "");
  const commitMessage = `${COMMIT_PREFIX} ${timestamp}`;

  const commitResult = await runGit(["commit", "-m", commitMessage, "--", ...stagedPaths], { allowFailure: true });
  const combinedOutput = `${commitResult.stdout}\n${commitResult.stderr}`.toLowerCase();

  if (!commitResult.ok) {
    if (combinedOutput.includes("nothing to commit") || combinedOutput.includes("no changes added to commit")) {
      return false;
    }

    throw new Error(commitResult.stderr || commitResult.stdout || "git commit failed.");
  }

  await runGit(["push", "origin", "HEAD"]);
  return true;
}

function requestSync() {
  if (syncing) {
    syncRequestedWhileRunning = true;
    return;
  }

  if (syncTimer !== null) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushSync();
  }, WATCH_DEBOUNCE_MS);
}

async function flushSync() {
  if (syncing) {
    syncRequestedWhileRunning = true;
    return;
  }

  const paths = Array.from(pendingPaths);
  if (paths.length === 0) {
    return;
  }

  pendingPaths.clear();
  syncing = true;

  try {
    const changed = await commitAndPush(paths);
    if (changed) {
      log(`commit+push OK (${paths.length} file/s event).`);
    }
  } catch (error) {
    log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);

    // Re-queue on failure so the next change or manual save retries the sync.
    for (const filePath of paths) {
      pendingPaths.add(filePath);
    }
  } finally {
    syncing = false;

    if (syncRequestedWhileRunning || pendingPaths.size > 0) {
      syncRequestedWhileRunning = false;
      requestSync();
    }
  }
}

function handleFsEvent(eventName, filePath) {
  if (eventName === "addDir" || eventName === "unlinkDir") {
    return;
  }

  const normalized = normalizeRepoPath(filePath);
  if (!normalized || isIgnoredRepoPath(normalized)) {
    return;
  }

  pendingPaths.add(normalized);
  requestSync();
}

async function main() {
  log("booting");
  await ensureGitReady();
  log("git ready");

  const watchPaths = WATCH_TARGETS.map((target) => path.join(process.cwd(), target)).filter((targetPath) =>
    fs.existsSync(targetPath)
  );
  const targets = watchPaths.length > 0 ? watchPaths : [process.cwd()];

  watcher = chokidar.watch(targets, {
    ignored: IGNORED_GLOBS,
    ignoreInitial: true,
    depth: 12,
    followSymlinks: false,
    ignorePermissionErrors: true,
    awaitWriteFinish: {
      stabilityThreshold: 700,
      pollInterval: 120,
    },
  });
  log("watcher init");

  watcher.on("all", handleFsEvent);
  watcher.on("ready", () => {
    log("started");
    log("ready");
  });
  watcher.on("error", (err) => {
    log(`watcher error: ${err instanceof Error ? err.message : String(err)}`);
  });
}

function shutdown(signalName) {
  log(`stopping (${signalName})`);

  const closeWatcher = watcher ? watcher.close() : Promise.resolve();
  Promise.resolve(closeWatcher)
    .catch(() => undefined)
    .finally(() => {
      process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((error) => {
  log(`fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});


