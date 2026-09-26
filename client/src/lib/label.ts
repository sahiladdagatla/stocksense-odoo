import QRCode from 'qrcode';
import { LOGO_COLORS, LOGO_FACES } from './logo';

export type LabelProduct = { sku: string; name: string; uom: string; category?: string };

/** QR code of the SKU as a PNG data URL. Scan Mode reads exactly this payload. */
export const skuQrDataUrl = (sku: string, size = 240) =>
  QRCode.toDataURL(sku, { width: size, margin: 1, errorCorrectionLevel: 'M' });

/** Renders a printable 100×60 mm-ratio label (QR + SKU + name) and returns a PNG data URL. */
export async function renderLabelPng(p: LabelProduct): Promise<string> {
  const w = 1000;
  const h = 600;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#dedede';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, p.sku, { width: 440, margin: 0, errorCorrectionLevel: 'M' });
  ctx.drawImage(qr, 60, 80, 440, 440);

  // Brand: logo mark + two-tone wordmark.
  ctx.save();
  ctx.translate(560, 64);
  ctx.scale(0.8, 0.8);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.4;
  for (const face of LOGO_FACES) {
    const path = new Path2D(face.d);
    ctx.fillStyle = ctx.strokeStyle = LOGO_COLORS[face.part];
    ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.restore();
  ctx.font = '800 34px Manrope, Inter, Arial, sans-serif';
  ctx.fillStyle = '#3c2236';
  ctx.fillText('stock', 624, 110);
  ctx.fillStyle = '#7a4a6e';
  ctx.fillText('sense', 624 + ctx.measureText('stock').width, 110);

  ctx.fillStyle = '#212529';
  ctx.font = '700 52px "JetBrains Mono", Consolas, monospace';
  ctx.fillText(p.sku, 560, 200, 400);

  ctx.font = '600 36px Inter, Arial, sans-serif';
  wrap(ctx, p.name, 560, 270, 400, 44, 3);

  ctx.fillStyle = '#6c757d';
  ctx.font = '400 28px Inter, Arial, sans-serif';
  ctx.fillText([p.uom, p.category].filter(Boolean).join(' · '), 560, 500, 400);

  return canvas.toDataURL('image/png');
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      if (++lines >= maxLines - 1) break;
    } else line = test;
  }
  ctx.fillText(line, x, y + lines * lineHeight, maxWidth);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
