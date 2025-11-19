const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

// Copy workers
const workersSrc = path.join(__dirname, '../src/main/workers');
const workersDest = path.join(__dirname, '../dist/main/workers');

if (fs.existsSync(workersSrc)) {
    console.log('Copying workers...');
    copyDir(workersSrc, workersDest);
}

// Copy assets
const iconSrc = path.join(__dirname, '../src/assets/icon.png');
const iconDest = path.join(__dirname, '../dist/assets/icon.png');

if (fs.existsSync(iconSrc)) {
    console.log('Copying assets...');
    copyFile(iconSrc, iconDest);
}

console.log('Copy complete.');
