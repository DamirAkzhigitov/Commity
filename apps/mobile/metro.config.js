const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** CI writes this before `eas build` so EXPO_PUBLIC_* reach Metro on EAS (runner env does not). */
const easPreviewEnvPath = path.join(projectRoot, 'eas-build-preview.env');
if (fs.existsSync(easPreviewEnvPath)) {
  for (const line of fs.readFileSync(easPreviewEnvPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) process.env[key] = value;
  }
}

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders || []), monorepoRoot]));
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

/**
 * TypeScript NodeNext source uses `.js` import specifiers for `.ts` files. Metro
 * resolves paths literally, so map missing `./*.js` to `./*.ts` (or `.tsx`).
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (moduleName.startsWith('./') || moduleName.startsWith('../')) &&
    moduleName.endsWith('.js') &&
    context.originModulePath
  ) {
    const parentDir = path.dirname(context.originModulePath);
    const jsPath = path.normalize(path.resolve(parentDir, moduleName));
    if (!fs.existsSync(jsPath)) {
      const base = jsPath.slice(0, -3);
      for (const ext of ['.ts', '.tsx']) {
        const candidate = base + ext;
        if (fs.existsSync(candidate)) {
          return { type: 'sourceFile', filePath: candidate };
        }
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
