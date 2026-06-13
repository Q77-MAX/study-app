// 生成 PWA 所需的 PNG 图标（192x192 + 512x512 + maskable）
const sharp = require('sharp');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');

// maskable 图标需要内边距（安全区），在原始 512 基础上缩小苹果，加白边
async function generate() {
  const svg = await sharp(path.join(PUBLIC, 'apple-icon.svg'))
    .resize(512, 512)
    .png()
    .toBuffer();

  // 512x512 普通图标
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC, 'icon-512.png'));

  // 192x192 普通图标
  await sharp(svg)
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC, 'icon-192.png'));

  // 512x512 maskable (缩小苹果到 80%，周围留白作为安全区)
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#5cb818' }
  })
    .composite([{
      input: await sharp(svg).resize(410, 410).png().toBuffer(),
      top: 51,
      left: 51,
    }])
    .png()
    .toFile(path.join(PUBLIC, 'icon-512-maskable.png'));

  // 192x192 maskable
  await sharp({
    create: { width: 192, height: 192, channels: 4, background: '#5cb818' }
  })
    .composite([{
      input: await sharp(svg).resize(154, 154).png().toBuffer(),
      top: 19,
      left: 19,
    }])
    .png()
    .toFile(path.join(PUBLIC, 'icon-192-maskable.png'));

  console.log('✅ Icons generated: icon-192.png, icon-512.png, icon-192-maskable.png, icon-512-maskable.png');
}

generate().catch(console.error);
