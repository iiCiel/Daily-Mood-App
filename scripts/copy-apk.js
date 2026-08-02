const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outDir = path.join(__dirname, '..', 'builds');

if (!fs.existsSync(src)) {
  console.error(`Built APK not found at ${src}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const dest = path.join(outDir, `daily-mood-${stamp}.apk`);
fs.copyFileSync(src, dest);
fs.copyFileSync(src, path.join(outDir, 'daily-mood-latest.apk'));

console.log(`Copied APK to ${dest}`);
console.log(`Also updated ${path.join(outDir, 'daily-mood-latest.apk')}`);
console.log(`Run "npm run serve-apk" and open http://<your-laptop-ip>:8080/daily-mood-latest.apk on your phone.`);
