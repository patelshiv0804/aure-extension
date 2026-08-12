import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
// On Windows, pathname starts with a slash, e.g., /D:/path. Remove it if it starts with slash and is followed by drive letter.
const cleanDirname = process.platform === 'win32'
  ? __dirname.replace(/^\/([a-zA-Z]:)/, '$1').replace(/\//g, '\\')
  : __dirname;

const rootDir = path.resolve(cleanDirname, '..');
const srcDir = path.join(rootDir, 'dist', 'chrome-mv3');
const destDir = path.join(rootDir, 'dist');

console.log(`[Post-Build] Copying build files from ${srcDir} to ${destDir} to flatten the directory...`);

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(srcDir)) {
    // Clean target files in destDir (except chrome-mv3 itself) to prevent old files from lingering
    if (fs.existsSync(destDir)) {
      fs.readdirSync(destDir).forEach((file) => {
        if (file !== 'chrome-mv3') {
          fs.rmSync(path.join(destDir, file), { recursive: true, force: true });
        }
      });
    }
    copyRecursiveSync(srcDir, destDir);
    console.log('[Post-Build] Successfully flattened build files into the dist/ directory!');

    // Copy/rename specific files to satisfy flat structure verification if needed
    const contentScriptSrc = path.join(destDir, 'content-scripts', 'content.js');
    const contentScriptDest = path.join(destDir, 'content.js');
    if (fs.existsSync(contentScriptSrc)) {
      fs.copyFileSync(contentScriptSrc, contentScriptDest);
      console.log('[Post-Build] Copied content.js to dist/ root');
    }

    // Find and copy popup JS chunk (scan srcDir to guarantee latest chunk)
    const srcChunksDir = path.join(srcDir, 'chunks');
    if (fs.existsSync(srcChunksDir)) {
      const files = fs.readdirSync(srcChunksDir);
      const popupChunk = files.find(f => f.startsWith('popup-') && f.endsWith('.js'));
      if (popupChunk) {
        fs.copyFileSync(path.join(srcChunksDir, popupChunk), path.join(destDir, 'popup.js'));
        console.log(`[Post-Build] Copied ${popupChunk} as popup.js to dist/ root`);
      }
    }

    // Find and copy popup CSS asset as styles.css (scan srcDir to guarantee latest asset)
    const srcAssetsDir = path.join(srcDir, 'assets');
    if (fs.existsSync(srcAssetsDir)) {
      const files = fs.readdirSync(srcAssetsDir);
      const popupCss = files.find(f => f.startsWith('popup-') && f.endsWith('.css'));
      if (popupCss) {
        fs.copyFileSync(path.join(srcAssetsDir, popupCss), path.join(destDir, 'styles.css'));
        console.log(`[Post-Build] Copied ${popupCss} as styles.css to dist/ root`);
      }
    }

    // Copy chunks and assets directories to the root folder to support root-level loading
    const chunksDest = path.join(rootDir, 'chunks');
    const assetsDest = path.join(rootDir, 'assets');
    const iconsDest = path.join(rootDir, 'icons');

    // Clean root target folders first to prevent stale chunks accumulation
    if (fs.existsSync(chunksDest)) fs.rmSync(chunksDest, { recursive: true, force: true });
    if (fs.existsSync(assetsDest)) fs.rmSync(assetsDest, { recursive: true, force: true });
    if (fs.existsSync(iconsDest)) fs.rmSync(iconsDest, { recursive: true, force: true });

    const chunksDir = path.join(destDir, 'chunks');
    if (fs.existsSync(chunksDir)) {
      copyRecursiveSync(chunksDir, chunksDest);
      console.log('[Post-Build] Copied chunks/ to root directory');
    }
    const assetsDir = path.join(destDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      copyRecursiveSync(assetsDir, assetsDest);
      console.log('[Post-Build] Copied assets/ to root directory');
    }
    if (fs.existsSync(path.join(destDir, 'icons'))) {
      copyRecursiveSync(path.join(destDir, 'icons'), iconsDest);
      console.log('[Post-Build] Copied icons/ to root directory');
    }

    // Copy logo.png to the root folder for extension-level access
    const logoFile = 'logo.png';
    const logoSrc = path.join(destDir, logoFile);
    const logoDest = path.join(rootDir, logoFile);
    if (fs.existsSync(logoSrc)) {
      fs.copyFileSync(logoSrc, logoDest);
      console.log(`[Post-Build] Copied ${logoFile} to root directory`);
    } else if (fs.existsSync(path.join(rootDir, 'public', logoFile))) {
      fs.copyFileSync(path.join(rootDir, 'public', logoFile), logoDest);
      if (fs.existsSync(destDir)) {
        fs.copyFileSync(path.join(rootDir, 'public', logoFile), logoSrc);
      }
      console.log(`[Post-Build] Copied ${logoFile} from public to root & dist`);
    }

    // Revert HTML files to use absolute paths since chunks/assets are now in the root
    const htmlFiles = ['popup.html', 'sidepanel.html', 'options.html'];
    htmlFiles.forEach(fileName => {
      const filePath = path.join(destDir, fileName);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/="chunks\//g, '="/chunks/');
        content = content.replace(/="assets\//g, '="/assets/');
        // Remove modulepreload links to prevent Chrome extension cross-world resource mismatch warning
        content = content.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Post-Build] Cleaned preloads & restored absolute paths in ${fileName}`);
      }
    });
  } else {
    console.error(`[Post-Build] Source directory ${srcDir} does not exist. Make sure you run 'wxt build' first.`);
  }
} catch (error) {
  console.error('[Post-Build] Error flattening build files:', error);
}
