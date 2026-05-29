import sharp from 'sharp';

const images = ['portrait', 'basketball', 'golf'];

await Promise.all(
  images.map((name) =>
    sharp(`public/${name}.jpg`)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(`public/${name}-1200.webp`)
  )
);
