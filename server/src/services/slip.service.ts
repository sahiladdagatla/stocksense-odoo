import PDFDocument from 'pdfkit';
import { badRequest } from '../lib/errors.js';
import { getOperation } from './operation-doc.service.js';

const PLUM = '#714B67';

/** StockSense logo mark (64×64 SVG paths), light palette for the plum header band. */
const LOGO_FACES: [string, string][] = [
  ['M11.22 37.27 L39.39 51.35 L39.39 61.0 L11.22 46.92Z', '#b58aa9'],
  ['M52.78 44.65 L39.39 51.35 L39.39 61.0 L52.78 54.3Z', '#8d6683'],
  ['M24.61 30.57 L52.78 44.65 L39.39 51.35 L11.22 37.27Z', '#6b4a62'],
  ['M36.14 28.75 L52.78 44.65 L39.39 51.35 L22.74 35.45Z', '#5c3f55'],
  ['M11.22 17.28 L22.74 23.04 L22.74 35.45 L11.22 29.69Z', '#c9a3bd'],
  ['M36.14 16.34 L22.74 23.04 L22.74 35.45 L36.14 28.75Z', '#8d6683'],
  ['M11.22 9.7 L39.39 23.78 L39.39 31.36 L11.22 17.28Z', '#b58aa9'],
  ['M52.78 17.08 L39.39 23.78 L39.39 31.36 L52.78 24.66Z', '#b58aa9'],
  ['M24.61 3.0 L52.78 17.08 L39.39 23.78 L11.22 9.7Z', '#f1e4ec'],
];
const MUTED = '#6C757D';
const TEXT = '#212529';

const fmtDate = (d: Date) =>
  d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const fmtQty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

/** Renders an A4 delivery slip and resolves with the PDF bytes. */
export async function deliverySlip(id: number): Promise<{ reference: string; pdf: Buffer }> {
  const op = await getOperation(id);
  if (op.type !== 'DELIVERY') {
    throw badRequest('Slips are only available for deliveries', 'NOT_A_DELIVERY');
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: { Title: `Delivery ${op.reference}` },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const left = 48;
  const width = doc.page.width - 96;

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fill(PLUM);
  doc.save().translate(left, 22).scale(0.72).lineJoin('round').lineWidth(1.4);
  for (const [d, color] of LOGO_FACES) doc.path(d).fillAndStroke(color, color);
  doc.restore();
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('stock', left + 54, 30, { continued: true })
    .fillColor('#E2BBD5')
    .text('sense');
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica')
    .fontSize(11)
    .text('Delivery Slip', left + 54, 58);
  doc.font('Helvetica-Bold').fontSize(16).text(op.reference, left, 34, { width, align: 'right' });
  doc.font('Helvetica').fontSize(10).text(op.status, left, 58, { width, align: 'right' });

  const field = (label: string, value: string, x: number, y: number) => {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y);
    doc
      .fontSize(11)
      .fillColor(TEXT)
      .text(value, x, y + 12, { width: width / 2 - 12 });
  };
  field('Customer', op.partner ?? '-', left, 116);
  field('Ship from', op.sourceLoc.fullName, left + width / 2, 116);
  field('Scheduled', fmtDate(op.scheduledDate), left, 160);
  field(
    'Validated',
    op.validatedAt ? fmtDate(op.validatedAt) : 'Not yet validated',
    left + width / 2,
    160,
  );

  // Lines
  const cols = [left, left + 110, left + 330, left + 420];
  let y = 214;
  doc.rect(left, y, width, 22).fill('#F8F9FA');
  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9);
  ['SKU', 'PRODUCT', 'ORDERED', 'DELIVERED'].forEach((h, i) => doc.text(h, cols[i]! + 6, y + 7));
  y += 22;
  doc.font('Helvetica').fontSize(10).fillColor(TEXT);
  for (const l of op.lines) {
    if (y > doc.page.height - 170) {
      doc.addPage();
      y = 48;
    }
    const delivered = op.status === 'DONE' ? l.doneQty.toNumber() : 0;
    doc.text(l.product.sku, cols[0]! + 6, y + 8, { width: 100 });
    doc.text(l.product.name, cols[1]! + 6, y + 8, { width: 210 });
    doc.text(`${fmtQty(l.demandQty.toNumber())} ${l.product.uom}`, cols[2]! + 6, y + 8);
    doc.text(`${fmtQty(delivered)} ${l.product.uom}`, cols[3]! + 6, y + 8);
    y += 28;
    doc
      .moveTo(left, y)
      .lineTo(left + width, y)
      .strokeColor('#DEDEDE')
      .lineWidth(1)
      .stroke();
  }

  if (op.notes) {
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text('NOTES', left, y + 20);
    doc
      .fontSize(10)
      .fillColor(TEXT)
      .text(op.notes, left, y + 32, { width });
  }

  // Signatures and footer
  const sigY = doc.page.height - 120;
  doc.strokeColor(TEXT).lineWidth(0.5);
  doc
    .moveTo(left, sigY)
    .lineTo(left + 200, sigY)
    .stroke();
  doc
    .moveTo(left + width - 200, sigY)
    .lineTo(left + width, sigY)
    .stroke();
  doc.fontSize(9).fillColor(MUTED);
  doc.text(`Dispatched by (${op.createdBy.name})`, left, sigY + 6);
  doc.text('Received by (name & signature)', left + width - 200, sigY + 6);
  doc
    .fontSize(8)
    .text(`Generated ${fmtDate(new Date())} by StockSense`, left, doc.page.height - 60, {
      width,
      align: 'center',
    });

  doc.end();
  return { reference: op.reference, pdf: await finished };
}
