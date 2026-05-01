const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

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
