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
      { header: 'Référence', key: 'sku', width: 16 },
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
   * Génère un PDF listant les produits d'un magasin. Les colonnes et le
   * titre reproduisent volontairement exactement la vue "Imprimer" du
   * frontend (frontend/src/app/products/page.tsx, handlePrintList) pour que
   * la fiche imprimée et le PDF téléchargé soient identiques.
   */
  async generateProductsPdf(
    products: ExportableProduct[],
    storeName: string,
    storeCurrency: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const title = `Liste des produits — ${storeName}`;
      doc.fontSize(16).text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666').text(
        `Imprimé le ${new Date().toLocaleString('fr-FR')} — ${products.length} produit(s)`,
        { align: 'center' },
      );
      doc.moveDown(1);
      doc.fillColor('#000000');

      const columns = [
        { key: 'name', label: 'Désignation', width: 340, align: 'left' as const },
        { key: 'quantity', label: 'Stock Actuel', width: 150, align: 'center' as const },
        { key: 'sellingPrice', label: 'Prix Unitaire', width: 150, align: 'right' as const },
      ];

      const startX = doc.page.margins.left;
      let y = doc.y;
      const rowHeight = 20;

      const drawRow = (values: string[], isHeader = false) => {
        let x = startX;
        doc.fontSize(9).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
        columns.forEach((col, i) => {
          doc.text(values[i], x, y, { width: col.width, align: col.align, ellipsis: true });
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

        drawRow([p.name, String(p.quantity), `${p.sellingPrice.toFixed(2)} ${storeCurrency}`]);
      }

      if (products.length === 0) {
        doc.fontSize(9).font('Helvetica').text('Aucun produit', startX, y);
      }

      doc.end();
    });
  }
}
