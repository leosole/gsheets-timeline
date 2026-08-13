import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const distIndexFile = path.join(distDir, 'index.html');
const targetFile = path.join(projectRoot, 'google-apps-script', 'Sidebar.html');

if (!fs.existsSync(distIndexFile)) {
  throw new Error('Build output is missing dist/index.html. Run the Vite build before preparing the Apps Script sidebar.');
}

const singleFileHtml = fs.readFileSync(distIndexFile, 'utf8');
fs.writeFileSync(targetFile, singleFileHtml, 'utf8');
console.log('Updated Apps Script Sidebar.html from single-file Vite build.');
