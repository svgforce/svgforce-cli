#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// src/commands/login.ts
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import chalk3 from "chalk";
import ora from "ora";

// src/lib/config.ts
import Conf from "conf";
var CONFIG_DEFAULTS = {
  apiUrl: "https://api.svgforce.dev"
};
var config = new Conf({
  projectName: "svgforce",
  projectVersion: "1.0.0",
  defaults: CONFIG_DEFAULTS,
  schema: {
    apiKey: { type: "string" },
    jwtToken: { type: "string" },
    apiUrl: { type: "string", default: "https://api.svgforce.dev" },
    userEmail: { type: "string" }
  }
});
function getAuthCredential() {
  const envKey = process.env.SVGFORCE_API_KEY;
  if (envKey) return { type: "api_key", value: envKey };
  const storedKey = config.get("apiKey");
  if (storedKey) return { type: "api_key", value: storedKey };
  const jwt = config.get("jwtToken");
  if (jwt) return { type: "jwt", value: jwt };
  return null;
}
function getApiUrl() {
  return process.env.SVGFORCE_API_URL ?? config.get("apiUrl") ?? "https://api.svgforce.dev";
}

// src/lib/auth.ts
function storeApiKey(key) {
  config.set("apiKey", key);
  config.delete("jwtToken");
}
function storeJwt(token, email) {
  config.set("jwtToken", token);
  if (email) config.set("userEmail", email);
  config.delete("apiKey");
}
function clearCredentials() {
  config.delete("apiKey");
  config.delete("jwtToken");
  config.delete("userEmail");
}

// src/lib/logger.ts
import chalk from "chalk";
var log = {
  info: (msg) => console.log(chalk.blue("\u2139"), msg),
  success: (msg) => console.log(chalk.green("\u2713"), msg),
  warn: (msg) => console.log(chalk.yellow("\u26A0"), msg),
  error: (msg) => console.error(chalk.red("\u2717"), msg),
  dim: (msg) => console.log(chalk.dim(msg)),
  blank: () => console.log()
};
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// src/lib/errors.ts
import chalk2 from "chalk";
var CliError = class extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
    this.name = "CliError";
  }
};
var AuthError = class extends CliError {
  constructor(message = "Not authenticated. Run `svgforce login` first.") {
    super(message, "svgforce login");
    this.name = "AuthError";
  }
};
var PlanError = class extends CliError {
  constructor() {
    super(
      "CLI access is available only for the Team plan.",
      "Upgrade at https://svgforce.dev/pricing"
    );
    this.name = "PlanError";
  }
};
function handleError(err) {
  if (err instanceof CliError) {
    console.error(chalk2.red(`Error: ${err.message}`));
    if (err.hint) {
      console.error(chalk2.dim(`  Hint: ${err.hint}`));
    }
    process.exit(1);
  }
  if (err instanceof Error) {
    console.error(chalk2.red(`Unexpected error: ${err.message}`));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
  console.error(chalk2.red("An unknown error occurred"));
  process.exit(1);
}

// src/commands/login.ts
async function loginCommand(opts) {
  if (opts.apiKey) {
    return loginWithApiKey(opts.apiKey);
  }
  return loginInteractive();
}
async function loginWithApiKey(key) {
  if (!key.startsWith("sf_live_")) {
    throw new CliError(
      'Invalid API key format. Keys start with "sf_live_".',
      "Generate a key at https://svgforce.dev/profile"
    );
  }
  const spinner = ora("Verifying API key...").start();
  try {
    const baseUrl = getApiUrl().replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        "X-Api-Key": key,
        "User-Agent": "svgforce-cli/1.0.0"
      }
    });
    if (!res.ok) {
      spinner.fail("Invalid API key.");
      throw new CliError("API key verification failed. Make sure the key is correct and not revoked.");
    }
    const data = await res.json();
    storeApiKey(key);
    spinner.succeed(`Authenticated as ${chalk3.bold(data.email ?? data.name ?? "user")}`);
  } catch (err) {
    if (err instanceof CliError) {
      spinner.fail(err.message);
      throw err;
    }
    spinner.fail("Connection failed.");
    throw new CliError("Could not reach the SvgForce API.", `Check your connection or set SVGFORCE_API_URL`);
  }
}
async function loginInteractive() {
  log.info(`Log in to ${chalk3.bold("SvgForce")} with your email and password.`);
  log.dim("Your credentials are sent directly to the API and are never stored locally.");
  log.blank();
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const email = await rl.question(chalk3.cyan("  Email: "));
    if (!email.includes("@")) {
      throw new CliError("Invalid email address.");
    }
    const password = await new Promise((resolve) => {
      stdout.write(chalk3.cyan("  Password: "));
      const originalRawMode = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let buf = "";
      const onData = (ch) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          if (stdin.isTTY) stdin.setRawMode(originalRawMode ?? false);
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(buf);
        } else if (c === "\x7F" || c === "\b") {
          buf = buf.slice(0, -1);
        } else if (c === "") {
          if (stdin.isTTY) stdin.setRawMode(originalRawMode ?? false);
          stdin.removeListener("data", onData);
          process.exit(130);
        } else {
          buf += c;
        }
      };
      stdin.on("data", onData);
    });
    if (!password) {
      throw new CliError("Password cannot be empty.");
    }
    const spinner = ora("Logging in...").start();
    const baseUrl = getApiUrl().replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "svgforce-cli/1.0.0"
      },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data2 = await res.json().catch(() => ({}));
      spinner.fail("Login failed.");
      if (data2.requires2FA) {
        throw new CliError(
          "2FA is enabled on this account. Use an API key instead.",
          "Generate a key at https://svgforce.dev/profile, then run: svgforce login --api-key <key>"
        );
      }
      throw new CliError(data2.message ?? "Invalid email or password.");
    }
    const data = await res.json();
    if (!data.token) {
      spinner.fail("Login failed.");
      throw new CliError("Server did not return an authentication token.");
    }
    storeJwt(data.token, email);
    spinner.succeed(`Logged in as ${chalk3.bold(data.user?.email ?? email)}`);
  } finally {
    rl.close();
  }
}

// src/commands/logout.ts
async function logoutCommand() {
  clearCredentials();
  log.success("Logged out. All stored credentials have been removed.");
}

// src/commands/whoami.ts
import chalk4 from "chalk";
import ora2 from "ora";

// src/lib/api.ts
async function apiRequest(path6, opts = {}) {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();
  const baseUrl = getApiUrl().replace(/\/+$/, "");
  const url = `${baseUrl}/api${path6}`;
  const headers = {
    "User-Agent": "svgforce-cli/1.0.0",
    ...opts.headers
  };
  if (cred.type === "api_key") {
    headers["X-Api-Key"] = cred.value;
  } else {
    headers["Authorization"] = `Bearer ${cred.value}`;
  }
  if (opts.body && !opts.raw) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : void 0
  });
  if (res.status === 401) {
    throw new AuthError("Session expired or invalid credentials. Run `svgforce login` again.");
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error === "CLI_NOT_AVAILABLE") {
      throw new PlanError();
    }
    throw new CliError(
      data.message ?? `Forbidden (${res.status})`,
      typeof data.error === "string" ? data.error : void 0
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new CliError(
      data.message ?? `Request failed with status ${res.status}`,
      typeof data.error === "string" ? data.error : void 0
    );
  }
  return res.json();
}
async function apiRequestBinary(path6, opts = {}) {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();
  const baseUrl = getApiUrl().replace(/\/+$/, "");
  const url = `${baseUrl}/api${path6}`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "svgforce-cli/1.0.0",
    ...opts.headers
  };
  if (cred.type === "api_key") {
    headers["X-Api-Key"] = cred.value;
  } else {
    headers["Authorization"] = `Bearer ${cred.value}`;
  }
  const res = await fetch(url, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : void 0
  });
  if (res.status === 401) {
    throw new AuthError("Session expired or invalid credentials. Run `svgforce login` again.");
  }
  if (res.status === 403) {
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
    }
    if (data.error === "CLI_NOT_AVAILABLE") throw new PlanError();
    throw new CliError(
      data.message ?? `Forbidden (${res.status})`
    );
  }
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
    }
    throw new CliError(
      data.message ?? `Request failed with status ${res.status}`
    );
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch?.[1] ?? "output";
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuf = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuf),
    filename,
    contentType,
    headers: res.headers
  };
}

// src/commands/whoami.ts
async function whoamiCommand() {
  const cred = getAuthCredential();
  if (!cred) throw new AuthError();
  const spinner = ora2("Fetching account info...").start();
  const profile = await apiRequest("/profile");
  spinner.stop();
  const plan = profile.subscription.plan.toUpperCase();
  const used = profile.subscription.iconsTotal - profile.subscription.iconsRemaining;
  log.blank();
  console.log(`  ${chalk4.dim("User:")}     ${chalk4.bold(profile.name)} ${chalk4.dim(`<${profile.email}>`)}`);
  console.log(`  ${chalk4.dim("Plan:")}     ${chalk4.bold(plan)}`);
  console.log(`  ${chalk4.dim("Usage:")}    ${used}/${profile.subscription.iconsTotal} icons this month`);
  if (profile.subscription.teamName) {
    console.log(`  ${chalk4.dim("Team:")}     ${profile.subscription.teamName}${profile.subscription.teamRole ? ` (${profile.subscription.teamRole})` : ""}`);
  }
  console.log(`  ${chalk4.dim("Auth:")}     ${cred.type === "api_key" ? "API Key" : "JWT Token"}`);
  log.blank();
}

// src/commands/optimize.ts
import path2 from "path";
import chalk5 from "chalk";
import ora3 from "ora";

// src/lib/files.ts
import fs from "fs";
import path from "path";
import { glob } from "glob";
async function resolveSvgFiles(patterns) {
  const files = [];
  const seen = /* @__PURE__ */ new Set();
  for (const pattern of patterns) {
    const stat = fs.existsSync(pattern) ? fs.statSync(pattern) : null;
    if (stat?.isDirectory()) {
      const matches = await glob("**/*.svg", { cwd: pattern, absolute: true });
      for (const match of matches) {
        if (!seen.has(match)) {
          seen.add(match);
          files.push(readSvgFile(match));
        }
      }
    } else {
      const matches = await glob(pattern, { absolute: true });
      for (const match of matches) {
        if (match.endsWith(".svg") && !seen.has(match)) {
          seen.add(match);
          files.push(readSvgFile(match));
        }
      }
    }
  }
  if (files.length === 0) {
    throw new CliError(
      "No SVG files found matching the provided pattern(s).",
      "Provide file paths, glob patterns (icons/*.svg), or directories."
    );
  }
  return files;
}
function readSvgFile(filePath) {
  const svg = fs.readFileSync(filePath, "utf-8");
  const baseName = path.basename(filePath, ".svg");
  const name = toPascalCase(baseName);
  return { name, svg, absolutePath: filePath };
}
function toPascalCase(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}
function ensureOutputDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function writeOutput(filePath, content) {
  const dir = path.dirname(filePath);
  ensureOutputDir(dir);
  fs.writeFileSync(filePath, content);
}

// src/commands/optimize.ts
async function optimizeCommand(patterns, opts) {
  const files = await resolveSvgFiles(patterns);
  if (opts.dryRun) {
    log.info(`Would optimize ${chalk5.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.absolutePath}`);
    }
    return;
  }
  const spinner = ora3(`Optimizing ${files.length} SVG file(s)...`).start();
  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));
  const { buffer, filename, headers } = await apiRequestBinary("/convert/html", {
    method: "POST",
    body: { icons }
  });
  spinner.stop();
  const savedBytes = headers.get("x-optimization-saved-bytes");
  const savedPercent = headers.get("x-optimization-saved-percent");
  const totalIcons = headers.get("x-optimization-total");
  const outputDir = opts.output;
  ensureOutputDir(outputDir);
  const outputPath = path2.join(outputDir, filename);
  writeOutput(outputPath, buffer);
  if (opts.json) {
    console.log(JSON.stringify({
      output: outputPath,
      icons: Number(totalIcons ?? files.length),
      savedBytes: Number(savedBytes ?? 0),
      savedPercent: Number(savedPercent ?? 0),
      size: buffer.length
    }));
    return;
  }
  log.success(`Optimized ${chalk5.bold(totalIcons ?? files.length)} icon(s)`);
  if (savedBytes && savedPercent) {
    log.info(`Saved ${chalk5.bold(formatBytes(Number(savedBytes)))} (${savedPercent}%)`);
  }
  log.info(`Output: ${chalk5.underline(outputPath)}`);
}

// src/commands/react.ts
import path3 from "path";
import chalk6 from "chalk";
import ora4 from "ora";
async function reactCommand(patterns, opts) {
  const files = await resolveSvgFiles(patterns);
  if (opts.dryRun) {
    log.info(`Would generate React component from ${chalk6.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.name} <- ${f.absolutePath}`);
    }
    return;
  }
  const spinner = ora4(`Generating React component from ${files.length} SVG(s)...`).start();
  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));
  const result = await apiRequest("/convert/react-component", {
    method: "POST",
    body: {
      componentName: opts.name,
      icons,
      withOpacityProp: opts.opacity,
      confirmLoseTrial: false
    }
  });
  spinner.stop();
  const outputFile = path3.join(opts.output, `${opts.name}.tsx`);
  writeOutput(outputFile, result.code);
  if (opts.json) {
    console.log(JSON.stringify({
      output: outputFile,
      icons: result.meta.generated,
      billed: result.meta.billed,
      usage: result.usage
    }));
    return;
  }
  log.success(`Generated ${chalk6.bold(result.meta.generated)} icon(s) -> ${chalk6.underline(outputFile)}`);
  if (result.meta.billed > 0) {
    log.dim(`  Billed: ${result.meta.billed} | Remaining: ${result.usage.remaining}/${result.usage.limit}`);
  }
}

// src/commands/reactNative.ts
import path4 from "path";
import chalk7 from "chalk";
import ora5 from "ora";
async function reactNativeCommand(patterns, opts) {
  const files = await resolveSvgFiles(patterns);
  if (opts.dryRun) {
    log.info(`Would generate React Native component from ${chalk7.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.name} <- ${f.absolutePath}`);
    }
    return;
  }
  const spinner = ora5(`Generating React Native component from ${files.length} SVG(s)...`).start();
  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));
  const result = await apiRequest("/convert/react-native-component", {
    method: "POST",
    body: {
      componentName: opts.name,
      icons,
      withOpacityProp: opts.opacity,
      confirmLoseTrial: false
    }
  });
  spinner.stop();
  const outputFile = path4.join(opts.output, `${opts.name}.tsx`);
  writeOutput(outputFile, result.code);
  if (opts.json) {
    console.log(JSON.stringify({
      output: outputFile,
      icons: result.meta.generated,
      billed: result.meta.billed,
      usage: result.usage
    }));
    return;
  }
  log.success(`Generated ${chalk7.bold(result.meta.generated)} icon(s) -> ${chalk7.underline(outputFile)}`);
  if (result.meta.billed > 0) {
    log.dim(`  Billed: ${result.meta.billed} | Remaining: ${result.usage.remaining}/${result.usage.limit}`);
  }
}

// src/commands/angular.ts
import path5 from "path";
import chalk8 from "chalk";
import ora6 from "ora";
async function angularCommand(patterns, opts) {
  const files = await resolveSvgFiles(patterns);
  if (opts.dryRun) {
    log.info(`Would generate Angular component from ${chalk8.bold(files.length)} SVG file(s):`);
    for (const f of files) {
      log.dim(`  ${f.name} <- ${f.absolutePath}`);
    }
    return;
  }
  const spinner = ora6(`Generating Angular component from ${files.length} SVG(s)...`).start();
  const icons = files.map((f) => ({ name: f.name, svg: f.svg }));
  const result = await apiRequest("/convert/angular-component", {
    method: "POST",
    body: {
      componentName: opts.name,
      selector: opts.selector,
      icons,
      withOpacityProp: opts.opacity,
      confirmLoseTrial: false
    }
  });
  spinner.stop();
  const outputFile = path5.join(opts.output, `${opts.name.toLowerCase()}.component.ts`);
  writeOutput(outputFile, result.code);
  if (opts.json) {
    console.log(JSON.stringify({
      output: outputFile,
      icons: result.meta.generated,
      billed: result.meta.billed,
      usage: result.usage
    }));
    return;
  }
  log.success(`Generated ${chalk8.bold(result.meta.generated)} icon(s) -> ${chalk8.underline(outputFile)}`);
  if (result.meta.billed > 0) {
    log.dim(`  Billed: ${result.meta.billed} | Remaining: ${result.usage.remaining}/${result.usage.limit}`);
  }
}

// src/cli.ts
var DEFAULT_OUTPUT = "./svgforce-output";
function createCli() {
  const program2 = new Command();
  program2.name("svgforce").description("SvgForce CLI \u2014 optimize SVGs and generate icon components").version("1.0.0");
  program2.command("login").description("Authenticate with SvgForce (interactive or API key)").option("--api-key <key>", "Use an API key instead of email/password").action(async (opts) => {
    try {
      await loginCommand({ apiKey: opts.apiKey });
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("logout").description("Remove stored credentials").action(async () => {
    try {
      await logoutCommand();
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("whoami").description("Show current user, plan, and usage").action(async () => {
    try {
      await whoamiCommand();
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("optimize").description("Optimize SVG files (remove metadata, minify)").argument("<files...>", "SVG files, globs, or directories").option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT).option("--dry-run", "Preview without writing files", false).option("--json", "Output result as JSON", false).action(async (files, opts) => {
    try {
      await optimizeCommand(files, opts);
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("react").description("Generate React icon component from SVGs").argument("<files...>", "SVG files, globs, or directories").option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT).option("-n, --name <name>", "Component name", "Icon").option("--opacity", "Add opacity prop support", false).option("--dry-run", "Preview without writing files", false).option("--json", "Output result as JSON", false).action(async (files, opts) => {
    try {
      await reactCommand(files, opts);
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("react-native").description("Generate React Native icon component from SVGs").argument("<files...>", "SVG files, globs, or directories").option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT).option("-n, --name <name>", "Component name", "Icon").option("--opacity", "Add opacity prop support", false).option("--dry-run", "Preview without writing files", false).option("--json", "Output result as JSON", false).action(async (files, opts) => {
    try {
      await reactNativeCommand(files, opts);
    } catch (err) {
      handleError(err);
    }
  });
  program2.command("angular").description("Generate Angular icon component from SVGs").argument("<files...>", "SVG files, globs, or directories").option("-o, --output <dir>", "Output directory", DEFAULT_OUTPUT).option("-n, --name <name>", "Component name", "Icon").option("-s, --selector <selector>", "Angular component selector").option("--opacity", "Add opacity prop support", false).option("--dry-run", "Preview without writing files", false).option("--json", "Output result as JSON", false).action(async (files, opts) => {
    try {
      await angularCommand(files, opts);
    } catch (err) {
      handleError(err);
    }
  });
  return program2;
}

// src/bin.ts
var program = createCli();
program.parseAsync(process.argv);
//# sourceMappingURL=bin.js.map