/* Minimal PNG read/write, Node only, no dependencies.
 *
 * The repo has no package.json and nothing installed, and the Step 2
 * registration check has to read pixels, so this exists rather than a
 * dependency. It handles exactly what pixel/cells/ contains and nothing more:
 * 8-bit RGBA (colour type 6), non-interlaced. Every cell in the grid is that
 * format — tools/leafspace-build.js asserts it rather than trusting it.
 *
 *   var png = require('./png.js');
 *   var img = png.read('cell.png');     // {width, height, data: Uint8Array RGBA}
 *   png.write('out.png', img);
 */
'use strict';

var fs = require('fs');
var zlib = require('zlib');

var SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function read(file) {
  var buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(file + ': not a PNG');

  var width = 0, height = 0, idat = [], pos = 8;
  while (pos < buf.length) {
    var len = buf.readUInt32BE(pos);
    var type = buf.toString('ascii', pos + 4, pos + 8);
    var body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      var depth = body[8], colour = body[9], interlace = body[12];
      if (depth !== 8 || colour !== 6 || interlace !== 0) {
        throw new Error(file + ': need 8-bit RGBA non-interlaced, got depth=' +
                        depth + ' colourType=' + colour + ' interlace=' + interlace);
      }
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;                       // len + type + body + CRC
  }
  if (!width) throw new Error(file + ': no IHDR');

  return { width: width, height: height,
           data: unfilter(zlib.inflateSync(Buffer.concat(idat)), width, height) };
}

/* PNG filter types 0-4, per spec 9.2. bpp is 4 for RGBA8. */
function unfilter(raw, width, height) {
  var bpp = 4, stride = width * bpp;
  var out = new Uint8Array(stride * height);
  var pos = 0;
  for (var y = 0; y < height; y++) {
    var type = raw[pos++];
    var line = y * stride, prev = line - stride;
    for (var i = 0; i < stride; i++) {
      var x = raw[pos + i];
      var a = i >= bpp ? out[line + i - bpp] : 0;
      var b = y > 0 ? out[prev + i] : 0;
      var c = (i >= bpp && y > 0) ? out[prev + i - bpp] : 0;
      var v;
      switch (type) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error('bad filter type ' + type + ' on row ' + y);
      }
      out[line + i] = v & 0xff;
    }
    pos += stride;
  }
  return out;
}

function paeth(a, b, c) {
  var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

/* Writes filter-type 0 rows: bigger files than an optimiser would make, but
 * the only PNGs this writes are build artefacts, and zlib still does the work. */
function write(file, img) {
  var stride = img.width * 4;
  var raw = Buffer.alloc((stride + 1) * img.height);
  for (var y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

function chunk(type, body) {
  var head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  var crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  var tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(crcBuf) >>> 0, 0);
  return Buffer.concat([head, body, tail]);
}

var CRC_TABLE = (function () {
  var t = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  var c = -1;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

module.exports = { read: read, write: write };
