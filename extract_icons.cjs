const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const inputImage = fs.existsSync('logo.png') ? 'logo.png' : 'public/logo.png';
  if (!fs.existsSync(inputImage)) {
    console.error('Error: logo.png not found!');
    process.exit(1);
  }

  const outputDir = path.join('public', 'icons');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const dest = path.join(outputDir, `icon-${size}.png`);
    await sharp(inputImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(dest);
    console.log(`Generated ${dest} (${size}x${size})`);
  }
  console.log('Successfully generated PNG icons in public/icons/');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
