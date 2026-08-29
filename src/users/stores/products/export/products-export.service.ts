import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

type ExportableProduct = {
  id: number;
  name: string;
  sku: string | null;
  quantity: number;
  initialStock: number;
  minimumStock: number;
  sellingPrice: number;
  purchasePrice: number;
  createdAt: Date;
};

@Injectable()
export class ProductsExportService {
  /**
   * Génère un classeur Excel (.xlsx) listant les produits d'un magasin.
   */
  async generateProductsExcel(products: ExportableProduct[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestion de Stock';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Produits');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Nom', key: 'name', width: 28 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Stock actuel', key: 'quantity', width: 14 },
      { header: 'Stock initial', key: 'initialStock', width: 14 },
      { header: 'Seuil minimum', key: 'minimumStock', width: 14 },
      { header: 'Statut', key: 'status', width: 12 },
      { header: 'Prix de vente', key: 'sellingPrice', width: 14 },
      { header: "Prix d'achat", key: 'purchasePrice', width: 14 },
      { header: 'Valeur du stock', key: 'stockValue', width: 16 },
      { header: 'Créé le', key: 'createdAt', width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' },
    };

    for (const p of products) {
      sheet.addRow({
        id: p.id,
        name: p.name,
        sku: p.sku ?? '—',
        quantity: p.quantity,
        initialStock: p.initialStock,
        minimumStock: p.minimumStock,
        status: p.quantity <= 0 ? 'Rupture' : p.quantity <= p.minimumStock ? 'Faible' : 'Normal',
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        stockValue: p.quantity * p.sellingPrice,
        createdAt: p.createdAt.toISOString().slice(0, 10),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Génère un PDF listant les produits d'un magasin (tableau simple).
   */
  async generateProductsPdf(products: ExportableProduct[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Liste des produits', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666').text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
        align: 'center',
      });
      doc.moveDown(1);
      doc.fillColor('#000000');

      const columns = [
        { key: 'name', label: 'Nom', width: 160 },
        { key: 'sku', label: 'SKU', width: 90 },
        { key: 'quantity', label: 'Stock', width: 60 },
        { key: 'minimumStock', label: 'Seuil', width: 60 },
        { key: 'status', label: 'Statut', width: 70 },
        { key: 'sellingPrice', label: 'Prix', width: 70 },
        { key: 'stockValue', label: 'Valeur stock', width: 90 },
      ];

      const startX = doc.page.margins.left;
      let y = doc.y;
      const rowHeight = 20;

      const drawRow = (values: string[], isHeader = false) => {
        let x = startX;
        doc.fontSize(9).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
        columns.forEach((col, i) => {
          doc.text(values[i], x, y, { width: col.width, ellipsis: true });
          x += col.width;
        });
        y += rowHeight;
      };

      drawRow(columns.map((c) => c.label), true);
      doc
        .moveTo(startX, y)
        .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y)
        .stroke();
      y += 4;

      for (const p of products) {
        if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
          doc.addPage();
          y = doc.page.margins.top;
        }

        const status = p.quantity <= 0 ? 'Rupture' : p.quantity <= p.minimumStock ? 'Faible' : 'Normal';
        drawRow([
          p.name,
          p.sku ?? '—',
          String(p.quantity),
          String(p.minimumStock),
          status,
          p.sellingPrice.toFixed(2),
          (p.quantity * p.sellingPrice).toFixed(2),
        ]);
      }

      doc.end();
    });
  }
}
