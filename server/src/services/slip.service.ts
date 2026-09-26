import PDFDocument from 'pdfkit';
import { badRequest } from '../lib/errors.js';
import { getOperation } from './operation-doc.service.js';

const PLUM = '#714B67';
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
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('StockSense', left, 30);
  doc.font('Helvetica').fontSize(11).text('Delivery Slip', left, 58);
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
