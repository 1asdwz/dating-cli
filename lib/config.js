const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".dating-cli");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "config.json");

function resolveConfigPath() {
  return process.env.DATING_API_CONFIG || DEFAULT_CONFIG_PATH;
}

function ensureDirForFile(filePath) {
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
}

function readConfig() {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse config file: ${configPath}`);
  }
}

function writeConfig(nextConfig) {
  const configPath = resolveConfigPath();
  ensureDirForFile(configPath);
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return configPath;
}

function mergeConfig(partial) {
  const current = readConfig();
  const next = { ...current, ...partial };
  const configPath = writeConfig(next);
  return { configPath, config: next };
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  resolveConfigPath,
  readConfig,
  writeConfig,
  mergeConfig
};
