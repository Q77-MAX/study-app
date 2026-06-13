const sharp = require('sharp');
const path = require('path');

const PUBLIC = path.join(__dirname, 'public');
const SOURCE = 'C:\\Users\\74476\\OneDrive\\桌面\\绿苹果图标.jpg';

async function generate() {
  // 用用户的参考图片做图标
  const img = sharp(SOURCE).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });

  await img.clone().png().toFile(path.join(PUBLIC, 'icon-512.png'));
  await img.clone().resize(192, 192).png().toFile(path.join(PUBLIC, 'icon-192.png'));

  // maskable
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#5cb818' } })
    .composite([{ input: await img.clone().resize(410, 410).png().toBuffer(), top: 51, left: 51 }])
    .png().toFile(path.join(PUBLIC, 'icon-512-maskable.png'));

  await sharp({ create: { width: 192, height: 192, channels: 4, background: '#5cb818' } })
    .composite([{ input: await img.clone().resize(154, 154).png().toBuffer(), top: 19, left: 19 }])
    .png().toFile(path.join(PUBLIC, 'icon-192-maskable.png'));

  console.log('✅ Icons generated from user reference image');
}

generate().catch(console.error);
