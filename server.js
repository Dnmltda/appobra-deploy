#!/usr/bin/env node
'use strict';

/*
 * APP OBRA — supervisor process for Hostinger Node.js app hosting.
 *
 * Hostinger's Node.js app hosting expects a long-running Node process bound
 * to the port it assigns (process.env.PORT). PocketBase itself is a Go
 * binary, not a Node.js program, so this script's only job is to spawn the
 * PocketBase binary with that exact port and keep it alive — it is a thin
 * supervisor, not a request proxy. The OS socket PocketBase opens on PORT is
 * what Hostinger's router actually talks to.
 *
 * PocketBase serves the API AND the built React app (from ./pb_public) from
 * this same port/origin, so no separate static file server is needed.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const ROOT = __dirname;
const PB_BINARY = path.join(ROOT, 'pocketbase');

if (!fs.existsSync(PB_BINARY)) {
  console.error(`[server.js] PocketBase binary not found at ${PB_BINARY}`);
  process.exit(1);
}

try {
  fs.chmodSync(PB_BINARY, 0o755);
} catch (err) {
  console.error('[server.js] Could not chmod PocketBase binary (continuing anyway):', err.message);
}

const args = [
  'serve',
  `--http=${HOST}:${PORT}`,
  `--dir=${path.join(ROOT, 'pb_data')}`,
  `--migrationsDir=${path.join(ROOT, 'pb_migrations')}`,
  `--hooksDir=${path.join(ROOT, 'pb_hooks')}`,
  '--hooksWatch=false',
  `--publicDir=${path.join(ROOT, 'pb_public')}`,
];

let restarting = false;

function startPocketBase() {
  console.log(`[server.js] starting: ${PB_BINARY} ${args.join(' ')}`);

  const child = spawn(PB_BINARY, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    console.error(`[server.js] PocketBase exited (code=${code}, signal=${signal}).`);
    if (!restarting) {
      restarting = true;
      setTimeout(() => {
        restarting = false;
        startPocketBase();
      }, 3000);
    }
  });

  child.on('error', (err) => {
    console.error('[server.js] Failed to start PocketBase binary:', err);
  });

  return child;
}

const pbProcess = startPocketBase();

function shutdown(signal) {
  console.log(`[server.js] received ${signal}, shutting down PocketBase...`);
  restarting = true; // prevent auto-restart during intentional shutdown
  if (pbProcess && !pbProcess.killed) {
    pbProcess.kill(signal);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
