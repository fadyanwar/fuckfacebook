#!/usr/bin/env node
// Builds the extension into dist/<browser>/ and dist/fuckfacebook-<browser>-<version>.zip.
// No dependencies: files are copied as-is and zipped with a minimal deterministic writer.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

// Files shipped in every build. Keep this list in sync with the manifest and HTML pages.
const FILES = [
  'background.js', 'settings.js', 'timer-debug.js',
  'block.html', 'block.js', 'options.html', 'options.js',
];

const TARGETS = {
  firefox: () => JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')),
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Writes a ZIP with fixed timestamps (1980-01-01) so identical input gives identical output.
export function zip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);          // version needed
    header.writeUInt16LE(0x0800, 6);      // UTF-8 names
    header.writeUInt16LE(8, 8);           // deflate
    header.writeUInt16LE(0, 10);          // time
    header.writeUInt16LE(0x21, 12);       // date 1980-01-01
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + compressed.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

export function build(target) {
  const manifest = TARGETS[target]();
  const out = path.join(dist, target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const entries = [{ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') }];
  for (const file of FILES) entries.push({ name: file, data: fs.readFileSync(path.join(root, file)) });
  for (const { name, data } of entries) fs.writeFileSync(path.join(out, name), data);
  const archive = path.join(dist, `fuckfacebook-${target}-${manifest.version}.zip`);
  fs.writeFileSync(archive, zip(entries));
  return { dir: out, archive };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requested = process.argv.slice(2);
  const targets = requested.length ? requested : Object.keys(TARGETS);
  for (const target of targets) {
    if (!TARGETS[target]) {
      console.error(`Unknown target "${target}". Choose from: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(1);
    }
    const { dir, archive } = build(target);
    console.log(`Built ${path.relative(root, dir)} and ${path.relative(root, archive)}`);
  }
}
