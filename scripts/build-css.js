import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import fs from 'fs';
import path from 'path';

const inputFile = './ui/styles.css';
const outputFile = './ui/dist/styles.css';

const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const inputCss = fs.readFileSync(inputFile, 'utf-8');

postcss([tailwindcss, autoprefixer])
  .process(inputCss, { from: inputFile, to: outputFile })
  .then((result) => {
    fs.writeFileSync(outputFile, result.css);
    console.log(`✓ CSS built successfully to ${outputFile}`);
    if (result.map) {
      fs.writeFileSync(`${outputFile}.map`, result.map.toString());
    }
  })
  .catch((err) => {
    console.error('Error building CSS:', err);
    process.exit(1);
  });
