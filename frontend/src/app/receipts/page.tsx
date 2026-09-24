'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingDots } from '@/components/ui/loading_dots';
import {
  Printer,
  Search,
  RefreshCw,
  FileText,
  X,
  Receipt as ReceiptIcon,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Trash2,
  Flag,
  Plus,
} from 'lucide-react';
import { escapeHtml } from '@/lib/html';
import { getStoredUserRole, type AppRole } from '@/lib/auth';

interface ReceiptItem {
  id?: number | string;
  productId?: number;
  productName?: string;
  name?: string;
  designation?: string;
  label?: string;
  title?: string;
  sku?: string | null;
  product?: { id?: number; name?: string; title?: string; designation?: string; sku?: string | null };
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  total?: number;
  totalPrice?: number;
}

interface StoreItem {
  id: number | string;
  name?: string;
  title?: string;
  location?: string;
  address?: string;
  phone?: string;
  currency?: string;
}

interface Receipt {
  id: number | string;
  receiptNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  date?: string;
  totalAmount?: number;
  total?: number;
  amount?: number;
  paymentMethod?: string;
  customerName?: string;
  subtotal?: number;
  discount?: number;
  discountType?: 'AMOUNT' | 'PERCENT';
  discountValue?: number;
  discountAmount?: number;
  amountReceived?: number;
  changeAmount?: number;
  user?: { name?: string; username?: string; fullName?: string };
  cashier?: string | { name?: string; username?: string; fullName?: string };
  cashierName?: string;
  userName?: string;
  storeName?: string;
  store?: StoreItem | string;
  stores?: StoreItem[];
  items?: ReceiptItem[];
  saleItems?: ReceiptItem[];
  receiptItems?: ReceiptItem[];
  currency?: string;
}

interface StoreProduct {
  id: number;
  name: string;
  sku?: string | null;
  quantity: number;
  sellingPrice: number;
}

interface EditLine {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface ColleagueGroup {
  store: { id: number; name: string };
  staff: { id: number; name: string; role: AppRole }[];
}

type Period = 'week' | 'month' | 'year';

let editLineSeq = 0;
const newEditLineKey = () => `line-${++editLineSeq}`;

interface DayCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAYS_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function shiftPeriod(d: Date, period: Period, delta: number) {
  const next = new Date(d);
  if (period === 'week') next.setDate(next.getDate() + delta * 7);
  if (period === 'month') next.setMonth(next.getMonth() + delta);
  if (period === 'year') next.setFullYear(next.getFullYear() + delta);
  return next;
}
function rangeLabel(period: Period, start: Date, end: Date) {
  if (period === 'week') {
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} → ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
  }
  if (period === 'month') {
    return `${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `Année ${start.getFullYear()}`;
}
function buildMonthGrid(anchor: Date): DayCell[] {
  const today = new Date();
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      key: toDateKey(d),
      inCurrentMonth: d.getMonth() === anchor.getMonth(),
      isToday: sameDay(d, today),
    });
  }
  return cells;
}

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStoreId = searchParams.get('storeId');
  const urlSaleId = searchParams.get('saleId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Liste des magasins & Magasin sélectionné
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);

  // Reçus & Filtres
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Édition / suppression d'un reçu (réservées à l'ADMIN, motif obligatoire)
  const [role, setRole] = useState<AppRole | null>(null);
  const isAdmin = role === 'ADMIN';
  const canReport = role === 'CASHIER' || role === 'MANAGER';
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('CASH');
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editDiscountType, setEditDiscountType] = useState<'' | 'AMOUNT' | 'PERCENT'>('');
  const [editDiscountValue, setEditDiscountValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingReceipt, setDeletingReceipt] = useState<Receipt | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Signalement d'un reçu (CASHIER / MANAGER) via un ticket adressé à un ADMIN
  const [colleagues, setColleagues] = useState<ColleagueGroup[]>([]);
  const [reportingReceipt, setReportingReceipt] = useState<Receipt | null>(null);
  const [reportRecipientId, setReportRecipientId] = useState('');
  const [reportAction, setReportAction] = useState<'' | 'UPDATE' | 'DELETE'>('');
  const [reportJustification, setReportJustification] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  useEffect(() => {
    setRole(getStoredUserRole());
  }, []);

  // 1. Charger la liste des magasins au montage
  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const endpoints = [`${API}/stores`, `${API}/user/stores`, `${API}/my-stores`];
    let data = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {
        continue;
      }
    }

    if (data) {
      const list: StoreItem[] = Array.isArray(data) ? data : (data?.data ?? []);
      setStores(list);

      if (urlStoreId) {
        const found = list.find((s) => String(s.id) === String(urlStoreId));
        if (found) setSelectedStore(found);
      }
    }
    setLoadingStores(false);
  }, [API, router, urlStoreId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Calcul de la période courante
  const { start, end, label } = useMemo(() => {
    let s: Date, e: Date;
    if (period === 'week') { s = startOfWeek(anchor); e = endOfWeek(anchor); }
    else if (period === 'month') { s = startOfMonth(anchor); e = endOfMonth(anchor); }
    else { s = startOfYear(anchor); e = endOfYear(anchor); }
    return { start: s, end: e, label: rangeLabel(period, s, e) };
  }, [period, anchor]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthGrid = useMemo(() => buildMonthGrid(anchor), [anchor]);

  function goPrev() { setAnchor((d) => shiftPeriod(d, period, -1)); }
  function goNext() { setAnchor((d) => shiftPeriod(d, period, 1)); }
  function goToday() { setAnchor(new Date()); setPeriod('week'); }

  // 2. Charger les reçus du magasin sélectionné
  const fetchReceipts = useCallback(async () => {
    if (!selectedStore) return;

    setLoading(true);
    setError('');
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const currentStoreId = selectedStore.id;

    const candidateUrls = [
      `${API}/sales/store/${currentStoreId}?start=${startIso}&end=${endIso}`,
      `${API}/receipts/store/${currentStoreId}?start=${startIso}&end=${endIso}`,
      `${API}/sales?storeId=${currentStoreId}&start=${startIso}&end=${endIso}`,
      `${API}/receipts?storeId=${currentStoreId}&start=${startIso}&end=${endIso}`,
    ];

    let data = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {
        continue;
      }
    }

    if (data !== null) {
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setReceipts(rows);
    } else {
      setError('Impossible de charger les reçus pour ce magasin.');
    }
    setLoading(false);
  }, [API, router, selectedStore, start, end]);

  useEffect(() => {
    if (selectedStore) {
      fetchReceipts();
    }
  }, [selectedStore, fetchReceipts]);

  // Produits du magasin, pour l'ajout/remplacement d'articles lors de la modification
  useEffect(() => {
    if (!selectedStore || !isAdmin) return;
    const token = localStorage.getItem('access_token');
    fetch(`${API}/products/store/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStoreProducts(Array.isArray(data) ? data : []))
      .catch(() => setStoreProducts([]));
  }, [API, selectedStore, isAdmin]);

  // Administrateurs du magasin, destinataires possibles d'un signalement
  useEffect(() => {
    if (!canReport) return;
    const token = localStorage.getItem('access_token');
    fetch(`${API}/users/colleagues`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setColleagues(Array.isArray(data) ? data : []))
      .catch(() => setColleagues([]));
  }, [API, canReport]);

  // Ouverture directe d'un reçu (?saleId=), par ex. depuis la page Tickets.
  // Chargé individuellement car il peut être hors de la période affichée.
  useEffect(() => {
    if (!selectedStore || !urlSaleId) return;
    const token = localStorage.getItem('access_token');
    fetch(`${API}/sales/${urlSaleId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((sale) => {
        if (sale && String(sale.storeId) === String(selectedStore.id)) setSelectedReceipt(sale);
      })
      .catch(() => {});
  }, [API, selectedStore, urlSaleId]);

  // Utilitaires de formatage
  const getReceiptNumber = (r: Receipt) => r.invoiceNumber || r.receiptNumber || `#${r.id}`;

  const getStoreObj = (r: Receipt): StoreItem | null => {
    if (typeof r.store === 'object' && r.store !== null) return r.store;
    if (Array.isArray(r.stores) && r.stores.length > 0) return r.stores[0];
    return selectedStore;
  };

  const getStoreName = (r: Receipt) => {
    const obj = getStoreObj(r);
    if (obj?.name) return obj.name;
    if (obj?.title) return obj.title;
    if (typeof r.store === 'string') return r.store;
    return r.storeName || selectedStore?.name || 'Magasin';
  };

  const getCashierName = (r: Receipt) => {
    if (typeof r.cashier === 'string') return r.cashier;
    if (typeof r.cashier === 'object' && r.cashier) {
      const name = r.cashier.name || r.cashier.fullName || r.cashier.username;
      if (name) return name;
    }
    return (
      r.user?.name ||
      r.user?.fullName ||
      r.user?.username ||
      r.cashierName ||
      r.userName ||
      'Non renseigné'
    );
  };

  const getItemName = (it: ReceiptItem) => {
    return (
      it.product?.name ||
      it.product?.title ||
      it.product?.designation ||
      it.productName ||
      it.designation ||
      it.name ||
      it.label ||
      it.title ||
      'Article sans nom'
    );
  };

  const getItemSku = (it: ReceiptItem) => {
    return it.product?.sku || it.sku || 'N/A';
  };

  const getItemsList = (r: Receipt): ReceiptItem[] => {
    return r.items || r.saleItems || r.receiptItems || [];
  };

  const getTotalAmount = (r: Receipt) => Number(r.totalAmount ?? r.total ?? r.amount ?? 0);
  const getSubtotalAmount = (r: Receipt) => Number(r.subtotal ?? getTotalAmount(r));
  const getDiscountAmount = (r: Receipt) => Number(r.discountAmount ?? r.discount ?? 0);
  const getDiscountLabel = (r: Receipt) =>
    r.discountType === 'PERCENT' && r.discountValue ? `Remise (${Number(r.discountValue)}%)` : 'Remise';

  // Fonction d'impression identique à celle de SalesPage
  const printReceipt = (sale: Receipt | null) => {
    if (!sale) return;
    const items = getItemsList(sale);
    const storeObj = getStoreObj(sale);
    const storeName = getStoreName(sale);
    const storeLocation = storeObj?.location || storeObj?.address || '';
    const storePhone = storeObj?.phone || 'N/A';
    const formattedLocation = storeLocation;
    const currency = storeObj?.currency || sale.currency || selectedStore?.currency || 'XOF';
    const invoiceNum = getReceiptNumber(sale);
    const dateFormatted = sale.createdAt || sale.date
      ? `${new Date(sale.createdAt || sale.date!).toLocaleDateString('fr-FR')} à ${new Date(sale.createdAt || sale.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : '—';
    const cashierName = getCashierName(sale);
    const customer = sale.customerName || 'Client de passage';
    const subtotal = getSubtotalAmount(sale);
    const discount = getDiscountAmount(sale);
    const discountLabel = getDiscountLabel(sale);
    const totalPaid = getTotalAmount(sale);
    const amountReceived = Number(sale.amountReceived ?? 0);
    const changeAmount = Number(sale.changeAmount ?? 0);
    const paymentMethodLabel = sale.paymentMethod === 'CASH' ? 'Espèces' : sale.paymentMethod === 'MOBILE_MONEY' ? 'MoMo' : sale.paymentMethod === 'CARD' ? 'Carte' : sale.paymentMethod === 'CHECK' ? 'Chèque' : sale.paymentMethod || 'Espèces';

    const html = `
      <html>
        <head>
          <title>Reçu ${escapeHtml(invoiceNum)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #111; }
            h1, h2, h3 { margin: 0; }
            .invoice-header { text-align: center; margin-bottom: 12px; line-height: 1.4; }
            .invoice-header p { margin: 2px 0; }
            .divider { margin: 16px 0; border-top: 2px solid #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; text-align: left; }
            .summary { margin-top: 18px; }
            .summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .total { font-weight: bold; font-size: 1rem; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <h1>${escapeHtml(storeName)}</h1>
            ${formattedLocation ? `<p>${escapeHtml(formattedLocation)}</p>` : ''}
            <p>Tél : ${escapeHtml(storePhone)}</p>
          </div>
          <div class="divider"></div>
          <p><strong>FACTURE N° :</strong> ${escapeHtml(invoiceNum)}</p>
          <p><strong>Date :</strong> ${escapeHtml(dateFormatted)}</p>
          <p><strong>Vendeur :</strong> ${escapeHtml(cashierName)}</p>
          <p><strong>Client :</strong> ${escapeHtml(customer)}</p>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Réf.</th>
                <th>Qté</th>
                <th>PU</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((it: ReceiptItem) => {
                  const qty = Number(it.quantity ?? it.qty ?? 1);
                  const pu = Number(it.unitPrice ?? it.price ?? 0);
                  const totalLine = it.total ?? it.totalPrice ? Number(it.total ?? it.totalPrice) : pu * qty;
                  return `
                    <tr>
                      <td>${escapeHtml(getItemName(it))}</td>
                      <td>${escapeHtml(getItemSku(it))}</td>
                      <td>${escapeHtml(qty)}</td>
                      <td>${escapeHtml(pu.toFixed(2))}</td>
                      <td>${escapeHtml(totalLine.toFixed(2))}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
          <div class="summary">
            <div><span>Sous-total</span><span>${escapeHtml(subtotal.toFixed(2))} ${escapeHtml(currency)}</span></div>
            ${discount > 0 ? `<div><span>${escapeHtml(discountLabel)}</span><span>- ${escapeHtml(discount.toFixed(2))} ${escapeHtml(currency)}</span></div>` : ''}
            ${amountReceived > 0 ? `<div><span>Montant reçu</span><span>${escapeHtml(amountReceived.toFixed(2))} ${escapeHtml(currency)}</span></div>` : ''}
            <div class="total"><span>Total payé</span><span>${escapeHtml(totalPaid.toFixed(2))} ${escapeHtml(currency)}</span></div>
            ${amountReceived > 0 ? `<div><span>Rendu</span><span>${escapeHtml(changeAmount.toFixed(2))} ${escapeHtml(currency)}</span></div>` : ''}
            <div><span>Mode</span><span>${escapeHtml(paymentMethodLabel)}</span></div>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  // Impression de la liste des reçus affichés (respecte le filtre de
  // recherche courant) avec le montant total cumulé en bas de liste.
  const printReceiptsList = (list: Receipt[]) => {
    if (list.length === 0) return;
    const currency = selectedStore?.currency || list[0]?.currency || 'XOF';
    const storeLabel = getSelectedStoreLabel();
    const grandTotal = list.reduce((sum, r) => sum + getTotalAmount(r), 0);

    const html = `
      <html>
        <head>
          <title>Liste des reçus — ${escapeHtml(storeLabel)}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #111; }
            h1, h2 { margin: 0; }
            .header { text-align: center; margin-bottom: 12px; line-height: 1.4; }
            .header p { margin: 2px 0; }
            .divider { margin: 16px 0; border-top: 2px solid #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; font-size: 0.85rem; }
            th { text-align: left; }
            td.num, th.num { text-align: right; }
            tfoot td { border-top: 2px solid #111; border-bottom: none; font-weight: bold; font-size: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${escapeHtml(storeLabel)}</h1>
            <p>Liste des reçus — ${escapeHtml(label)}</p>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Facture N°</th>
                <th>Date & Heure</th>
                <th>Caissier</th>
                <th>Client</th>
                <th class="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${list
                .map((r) => {
                  const date = r.createdAt || r.date
                    ? new Date(r.createdAt || r.date!).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
                    : '—';
                  return `
                    <tr>
                      <td>${escapeHtml(getReceiptNumber(r))}</td>
                      <td>${escapeHtml(date)}</td>
                      <td>${escapeHtml(getCashierName(r))}</td>
                      <td>${escapeHtml(r.customerName || 'Client de passage')}</td>
                      <td class="num">${escapeHtml(getTotalAmount(r).toFixed(2))} ${escapeHtml(currency)}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Total (${list.length} reçu${list.length > 1 ? 's' : ''})</td>
                <td class="num">${escapeHtml(grandTotal.toFixed(2))} ${escapeHtml(currency)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const getItemProductId = (it: ReceiptItem) => it.productId ?? it.product?.id;

  const openEditReceipt = (r: Receipt) => {
    setEditError('');
    setEditReason('');
    setEditCustomerName(r.customerName || '');
    setEditPaymentMethod(r.paymentMethod || 'CASH');
    setEditLines(
      getItemsList(r).map((it) => ({
        key: newEditLineKey(),
        productId: String(getItemProductId(it) ?? ''),
        quantity: String(it.quantity ?? it.qty ?? 1),
        unitPrice: String(it.unitPrice ?? it.price ?? 0),
      })),
    );
    setEditDiscountType(r.discountType ?? '');
    setEditDiscountValue(r.discountType ? String(r.discountValue ?? 0) : '');
    setEditingReceipt(r);
  };

  // Produits proposés dans l'éditeur : ceux du magasin + ceux déjà présents
  // sur le reçu (un produit archivé depuis la vente n'est plus listé par
  // /products/store mais doit rester sélectionnable sur sa propre ligne).
  const editProductOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quantity?: number }>();
    if (editingReceipt) {
      for (const it of getItemsList(editingReceipt)) {
        const id = getItemProductId(it);
        if (id !== undefined) map.set(String(id), { id: String(id), name: getItemName(it) });
      }
    }
    for (const p of storeProducts) map.set(String(p.id), { id: String(p.id), name: p.name, quantity: p.quantity });
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingReceipt, storeProducts]);

  const updateEditLine = (key: string, patch: Partial<EditLine>) => {
    setEditLines((lines) => lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onEditLineProductChange = (key: string, productId: string) => {
    const product = storeProducts.find((p) => String(p.id) === productId);
    updateEditLine(key, product ? { productId, unitPrice: String(product.sellingPrice) } : { productId });
  };

  // Aperçu des montants — même calcul que computeDiscount côté serveur, qui
  // reste la seule source de vérité.
  const editTotals = useMemo(() => {
    const subtotal = editLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
    const raw = Number(editDiscountValue) || 0;
    const value = editDiscountType === 'PERCENT' ? Math.min(Math.max(raw, 0), 100) : Math.max(raw, 0);
    const discount = editDiscountType
      ? Math.min(editDiscountType === 'PERCENT' ? (value / 100) * subtotal : value, subtotal)
      : 0;
    return { subtotal, discount, total: subtotal - discount };
  }, [editLines, editDiscountType, editDiscountValue]);

  const saveEditReceipt = async () => {
    if (!editingReceipt) return;
    setEditError('');

    if (!editReason.trim()) {
      setEditError('Veuillez indiquer le motif de la modification.');
      return;
    }
    if (editLines.length === 0) {
      setEditError('Un reçu doit contenir au moins un article.');
      return;
    }
    const invalidLine = editLines.find(
      (l) => !l.productId || !(Number.isInteger(Number(l.quantity)) && Number(l.quantity) > 0) || l.unitPrice === '' || Number(l.unitPrice) < 0,
    );
    if (invalidLine) {
      setEditError('Chaque article doit avoir un produit, une quantité entière positive et un prix valide.');
      return;
    }

    setSavingEdit(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${API}/sales/${editingReceipt.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: editReason.trim(),
          customerName: editCustomerName.trim() || 'Client de passage',
          paymentMethod: editPaymentMethod,
          items: editLines.map((l) => ({
            productId: Number(l.productId),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
          })),
          discountType: editDiscountType || null,
          ...(editDiscountType && { discountValue: Number(editDiscountValue) || 0 }),
        }),
      });

      const updated = await res.json();
      if (!res.ok) {
        const message = Array.isArray(updated.message) ? updated.message.join(' ') : updated.message;
        throw new Error(message || updated.error || 'Échec de la modification du reçu.');
      }

      setReceipts((prev) => prev.map((r) => (String(r.id) === String(updated.id) ? updated : r)));
      setSelectedReceipt((prev) => (prev && String(prev.id) === String(updated.id) ? updated : prev));
      setEditingReceipt(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteReceipt = (r: Receipt) => {
    setDeleteError('');
    setDeleteReason('');
    setDeletingReceipt(r);
  };

  const confirmDeleteReceipt = async () => {
    if (!deletingReceipt) return;
    setDeleteError('');
    if (!deleteReason.trim()) {
      setDeleteError('Veuillez indiquer le motif de la suppression.');
      return;
    }

    setIsDeleting(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API}/sales/${deletingReceipt.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = Array.isArray(errData.message) ? errData.message.join(' ') : errData.message;
        throw new Error(message || 'Échec de la suppression du reçu.');
      }

      const deletedId = String(deletingReceipt.id);
      setReceipts((prev) => prev.filter((r) => String(r.id) !== deletedId));
      setSelectedReceipt((prev) => (prev && String(prev.id) === deletedId ? null : prev));
      setDeletingReceipt(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setIsDeleting(false);
    }
  };

  const reportRecipients = (
    colleagues.find((c) => String(c.store.id) === String(selectedStore?.id))?.staff ?? []
  ).filter((s) => s.role === 'ADMIN');

  const openReportReceipt = (r: Receipt) => {
    setReportError('');
    setReportJustification('');
    setReportAction('');
    setReportRecipientId(reportRecipients.length === 1 ? String(reportRecipients[0].id) : '');
    setReportingReceipt(r);
  };

  const submitReportReceipt = async () => {
    if (!reportingReceipt) return;
    setReportError('');
    if (!reportRecipientId) {
      setReportError('Veuillez choisir un administrateur destinataire.');
      return;
    }
    if (!reportAction) {
      setReportError('Veuillez indiquer si le reçu doit être modifié ou supprimé.');
      return;
    }
    if (!reportJustification.trim()) {
      setReportError('Veuillez décrire le problème.');
      return;
    }

    setIsReporting(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API}/tickets/receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: Number(reportingReceipt.id),
          recipientId: Number(reportRecipientId),
          requestedAction: reportAction,
          justification: reportJustification.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = Array.isArray(errData.message) ? errData.message.join(' ') : errData.message;
        throw new Error(message || "Impossible d'envoyer le signalement.");
      }

      setReportSuccess(`Signalement envoyé pour le reçu ${getReceiptNumber(reportingReceipt)}.`);
      setReportingReceipt(null);
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setIsReporting(false);
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    const query = searchQuery.toLowerCase();
    const number = getReceiptNumber(r).toLowerCase();
    const cashier = getCashierName(r).toLowerCase();
    const store = getStoreName(r).toLowerCase();
    const customer = (r.customerName || 'Client de passage').toLowerCase();
    return (
      number.includes(query) ||
      cashier.includes(query) ||
      store.includes(query) ||
      customer.includes(query)
    );
  });

  const getSelectedStoreLabel = () => {
    if (!selectedStore) return '';
    return selectedStore.name || selectedStore.title || `Magasin #${selectedStore.id}`;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {/* EN-TÊTE PRINCIPAL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Historique des Reçus</h1>
            <p className="text-sm text-slate-500">
              {selectedStore
                ? `Consultation des reçus : ${getSelectedStoreLabel()}`
                : 'Choisissez un magasin pour accéder à l\'historique des reçus.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedStore && (
              <>
                <Button variant="outline" size="sm" onClick={() => setSelectedStore(null)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Changer de magasin
                </Button>
                <Button variant="outline" size="sm" onClick={fetchReceipts} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Actualiser
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* ÉTAPE 1 : SÉLECTION DU MAGASIN                                       */}
        {/* ==================================================================== */}
        {!selectedStore ? (
          // Même présentation que la sélection de magasin sur la page de
          // vente (frontend/src/app/sales/page.tsx), pour rester cohérent
          // d'une page à l'autre.
          <div className="space-y-6">
            {loadingStores ? (
              <div className="flex py-16 justify-center items-center">
                <LoadingDots size="h-4 w-4" color="bg-blue-600" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stores.length > 0 ? (
                  stores.map((store) => {
                    const storeName = store.name || store.title || `Magasin #${store.id}`;
                    return (
                      <Card
                        key={store.id}
                        className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-shadow bg-white"
                        onClick={() => setSelectedStore(store)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>{storeName}</CardTitle>
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-200">
                              {store.currency || 'XOF'}
                            </span>
                          </div>
                          <CardDescription>{store.location || store.address || 'Localisation non renseignée'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-gray-600">
                            <p className="mt-2 text-xs text-muted-foreground">Cliquez pour ouvrir ce magasin</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-gray-600">Aucun magasin associé à votre compte.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* ÉTAPE 2 : HISTORIQUE DES REÇUS                                       */
          /* ==================================================================== */
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> Reçus enregistrés
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    Magasin actif : <strong className="text-slate-800">{getSelectedStoreLabel()}</strong> — {label}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher (N°, Caissier, Client...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    disabled={filteredReceipts.length === 0}
                    onClick={() => printReceiptsList(filteredReceipts)}
                  >
                    <Printer className="w-4 h-4" /> Imprimer la liste
                  </Button>
                </div>
              </div>

              {/* Filtre Période + Calendrier */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex bg-muted rounded-md overflow-hidden p-0.5">
                  {(['week', 'month', 'year'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                        period === p ? 'bg-white shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={goPrev} title="Précédent">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>
                  <Button variant="outline" size="icon" onClick={goNext} title="Suivant">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => setCalendarOpen((o) => !o)} aria-expanded={calendarOpen}>
                  <CalendarDays className="size-4" />
                  Calendrier
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {reportSuccess && (
                <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <span>{reportSuccess}</span>
                  <button onClick={() => setReportSuccess('')} className="text-emerald-600 hover:text-emerald-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Panneau calendrier */}
              {calendarOpen && (
                <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" onClick={goPrev} title="Précédent">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <p className="text-sm font-medium capitalize">
                      {period === 'year' ? anchor.getFullYear() : `${MONTHS_FR[anchor.getMonth()]} ${anchor.getFullYear()}`}
                    </p>
                    <Button variant="ghost" size="icon" onClick={goNext} title="Suivant">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  {period === 'week' && (
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((d) => {
                        const key = toDateKey(d);
                        const isToday = sameDay(d, new Date());
                        return (
                          <div
                            key={key}
                            className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs ${
                              isToday ? 'bg-muted font-medium ring-1 ring-primary/40' : ''
                            }`}
                          >
                            <span className="uppercase text-[10px] opacity-70">{DAYS_FR_SHORT[(d.getDay() + 6) % 7]}</span>
                            <span className="text-sm font-semibold">{d.getDate()}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {period === 'month' && (
                    <div>
                      <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted-foreground mb-1">
                        {DAYS_FR_SHORT.map((d) => <div key={d} className="py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {monthGrid.map((cell) => (
                          <div
                            key={cell.key}
                            className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs ${
                              !cell.inCurrentMonth ? 'text-muted-foreground/30'
                                : cell.isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                                : ''
                            }`}
                          >
                            <span>{cell.date.getDate()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {period === 'year' && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {MONTHS_FR.map((m, i) => (
                        <button
                          key={m}
                          onClick={() => { setAnchor(new Date(anchor.getFullYear(), i, 1)); setPeriod('month'); }}
                          className={`rounded-lg py-3 text-sm transition-colors ${
                            i === new Date().getMonth() && anchor.getFullYear() === new Date().getFullYear()
                              ? 'bg-muted font-medium ring-1 ring-primary/40'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex py-12 justify-center items-center">
                  <LoadingDots size="h-3 w-3" color="bg-blue-600" />
                </div>
              ) : error ? (
                <div className="py-12 text-center text-red-500 font-semibold">{error}</div>
              ) : filteredReceipts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Aucun reçu trouvé pour cette période.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture N°</TableHead>
                      <TableHead>Date & Heure</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Montant Total</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-bold text-slate-800">
                          {getReceiptNumber(r)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {r.createdAt || r.date
                            ? new Date(r.createdAt || r.date!).toLocaleString('fr-FR', {
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-slate-700">{getCashierName(r)}</TableCell>
                        <TableCell className="text-slate-700">{r.customerName || 'Client de passage'}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          {getTotalAmount(r).toFixed(2)} {getStoreObj(r)?.currency || r.currency || 'XOF'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedReceipt(r)}
                              className="gap-1 bg-slate-900 text-white hover:bg-slate-800"
                            >
                              <ReceiptIcon className="w-4 h-4" /> Reçu
                            </Button>
                            {canReport && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReportReceipt(r)}
                                className="gap-1"
                                title="Signaler un problème sur ce reçu (doublon, erreur…)"
                              >
                                <Flag className="w-4 h-4" /> Signaler
                              </Button>
                            )}
                            {isAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditReceipt(r)}
                                  className="gap-1"
                                >
                                  <Pencil className="w-4 h-4" /> Modifier
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDeleteReceipt(r)}
                                  className="gap-1 text-red-600 hover:text-red-700"
                                  title="Supprimer ce reçu"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* MODAL DU REÇU CLIENT (Alignée à 100% sur SalesPage) */}
      {selectedReceipt && (() => {
        const storeObj = getStoreObj(selectedReceipt);
        const storeName = getStoreName(selectedReceipt);
        const storeLocation = storeObj?.location || storeObj?.address || '';
        const storePhone = storeObj?.phone || 'N/A';
        const formattedLocation = storeLocation;
        const currency = storeObj?.currency || selectedReceipt.currency || selectedStore?.currency || 'XOF';
        const items = getItemsList(selectedReceipt);
        const subtotal = getSubtotalAmount(selectedReceipt);
        const discount = getDiscountAmount(selectedReceipt);
        const discountLabel = getDiscountLabel(selectedReceipt);
        const totalPaid = getTotalAmount(selectedReceipt);
        const amountReceived = Number(selectedReceipt.amountReceived ?? 0);
        const changeAmount = Number(selectedReceipt.changeAmount ?? 0);
        const paymentMethodLabel = selectedReceipt.paymentMethod === 'CASH' ? 'Espèces' : selectedReceipt.paymentMethod === 'MOBILE_MONEY' ? 'MoMo' : selectedReceipt.paymentMethod === 'CARD' ? 'Carte' : selectedReceipt.paymentMethod === 'CHECK' ? 'Chèque' : selectedReceipt.paymentMethod || 'Espèces';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="font-sans text-sm text-gray-900 space-y-3">
                {/* En-tête de facture */}
                <div className="text-center pb-2 border-b">
                  <h2 className="font-bold text-xl uppercase tracking-wide">{storeName}</h2>
                  {formattedLocation && <p className="text-xs text-gray-600">{formattedLocation}</p>}
                  <p className="text-xs text-gray-600">Tél : {storePhone}</p>
                </div>

                {/* Métadonnées de vente */}
                <div className="text-xs space-y-1 py-1">
                  <p><strong>FACTURE N° :</strong> {getReceiptNumber(selectedReceipt)}</p>
                  <p>
                    <strong>Date :</strong>{' '}
                    {selectedReceipt.createdAt || selectedReceipt.date
                      ? `${new Date(selectedReceipt.createdAt || selectedReceipt.date!).toLocaleDateString('fr-FR')} à ${new Date(selectedReceipt.createdAt || selectedReceipt.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : '—'}
                  </p>
                  <p><strong>Vendeur :</strong> {getCashierName(selectedReceipt)}</p>
                  <p><strong>Client :</strong> {selectedReceipt.customerName || 'Client de passage'}</p>
                </div>

                {/* Tableau des articles */}
                <div className="border-t border-b py-2 my-2">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1">Article</th>
                        <th className="py-1">Réf.</th>
                        <th className="py-1 text-center">Qté</th>
                        <th className="py-1 text-right">PU</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length > 0 ? (
                        items.map((it, idx) => {
                          const qty = Number(it.quantity ?? it.qty ?? 1);
                          const pu = Number(it.unitPrice ?? it.price ?? 0);
                          const totalLine = it.total ?? it.totalPrice ? Number(it.total ?? it.totalPrice) : pu * qty;

                          return (
                            <tr key={it.id || idx} className="border-b border-gray-100">
                              <td className="py-1.5 font-medium">{getItemName(it)}</td>
                              <td className="py-1.5 text-gray-500 font-mono text-[10px]">{getItemSku(it)}</td>
                              <td className="py-1.5 text-center">{qty}</td>
                              <td className="py-1.5 text-right font-mono">{pu.toFixed(2)}</td>
                              <td className="py-1.5 text-right font-mono">{totalLine.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-2 text-center text-xs text-gray-400">Aucun article</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Résumé des montants */}
                <div className="space-y-1 text-xs pt-1">
                  <div className="flex justify-between">
                    <span>Sous-total</span>
                    <span className="font-mono">{subtotal.toFixed(2)} {currency}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between">
                      <span>{discountLabel}</span>
                      <span className="font-mono">- {discount.toFixed(2)} {currency}</span>
                    </div>
                  )}
                  {amountReceived > 0 && (
                    <div className="flex justify-between">
                      <span>Montant reçu</span>
                      <span className="font-mono">{amountReceived.toFixed(2)} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t pt-1">
                    <span>Total payé</span>
                    <span className="font-mono">{totalPaid.toFixed(2)} {currency}</span>
                  </div>
                  {amountReceived > 0 && (
                    <div className="flex justify-between">
                      <span>Rendu</span>
                      <span className="font-mono">{changeAmount.toFixed(2)} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Mode</span>
                    <span>{paymentMethodLabel}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3 print:hidden">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedReceipt(null)}>
                  Fermer
                </Button>
                <Button className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => printReceipt(selectedReceipt)}>
                  <Printer className="w-4 h-4" /> Imprimer
                </Button>
                {canReport && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => openReportReceipt(selectedReceipt)}
                  >
                    <Flag className="w-4 h-4" /> Signaler
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => openEditReceipt(selectedReceipt)}
                    >
                      <Pencil className="w-4 h-4" /> Modifier
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-red-600 hover:text-red-700"
                      onClick={() => openDeleteReceipt(selectedReceipt)}
                      title="Supprimer ce reçu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL D'ÉDITION D'UN REÇU (ADMIN uniquement, motif obligatoire) */}
      {editingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-bold text-lg mb-1">Modifier le reçu</h2>
            <p className="text-sm text-slate-500 mb-4">
              Facture N° {getReceiptNumber(editingReceipt)} — le stock sera ajusté selon les quantités modifiées.
            </p>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="editCustomerName">Client</Label>
                  <Input
                    id="editCustomerName"
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    placeholder="Client de passage"
                  />
                </div>
                <div>
                  <Label htmlFor="editPaymentMethod">Mode de règlement</Label>
                  <select
                    id="editPaymentMethod"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border p-2 text-sm bg-white"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE_MONEY">MoMo</option>
                    <option value="CARD">Carte</option>
                    <option value="CHECK">Chèque</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Articles</Label>
                <div className="mt-1 space-y-2">
                  <div className="hidden sm:grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 text-xs text-slate-500">
                    <span>Produit</span>
                    <span>Qté</span>
                    <span>PU</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                  {editLines.map((line) => (
                    <div key={line.key} className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 items-center">
                      <select
                        value={line.productId}
                        onChange={(e) => onEditLineProductChange(line.key, e.target.value)}
                        className="w-full rounded-lg border p-2 text-sm bg-white"
                        aria-label="Produit"
                      >
                        <option value="">— Produit —</option>
                        {editProductOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.quantity !== undefined ? ` (${p.quantity} en stock)` : ''}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateEditLine(line.key, { quantity: e.target.value })}
                        aria-label="Quantité"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) => updateEditLine(line.key, { unitPrice: e.target.value })}
                        aria-label="Prix unitaire"
                      />
                      <span className="text-right font-mono text-sm">
                        {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditLines((lines) => lines.filter((l) => l.key !== line.key))}
                        className="text-slate-400 hover:text-red-600"
                        title="Retirer l'article"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setEditLines((lines) => [...lines, { key: newEditLineKey(), productId: '', quantity: '1', unitPrice: '' }])
                    }
                  >
                    <Plus className="w-4 h-4" /> Ajouter un article
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="editDiscountType">Remise</Label>
                  <select
                    id="editDiscountType"
                    value={editDiscountType}
                    onChange={(e) => setEditDiscountType(e.target.value as '' | 'AMOUNT' | 'PERCENT')}
                    className="w-full rounded-lg border p-2 text-sm bg-white"
                  >
                    <option value="">Aucune</option>
                    <option value="AMOUNT">Montant fixe</option>
                    <option value="PERCENT">Pourcentage</option>
                  </select>
                </div>
                {editDiscountType && (
                  <div>
                    <Label htmlFor="editDiscountValue">
                      Valeur {editDiscountType === 'PERCENT' ? '(%)' : `(${selectedStore?.currency || 'XOF'})`}
                    </Label>
                    <Input
                      id="editDiscountValue"
                      type="number"
                      min="0"
                      max={editDiscountType === 'PERCENT' ? 100 : undefined}
                      step="any"
                      value={editDiscountValue}
                      onChange={(e) => setEditDiscountValue(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span className="font-mono">{editTotals.subtotal.toFixed(2)} {selectedStore?.currency || 'XOF'}</span>
                </div>
                {editTotals.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span className="font-mono">- {editTotals.discount.toFixed(2)} {selectedStore?.currency || 'XOF'}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total</span>
                  <span className="font-mono">{editTotals.total.toFixed(2)} {selectedStore?.currency || 'XOF'}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="editReason">Motif de la modification *</Label>
                <textarea
                  id="editReason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-lg border bg-white p-2 text-sm"
                  placeholder="Ex : erreur de quantité à la caisse, le client a pris 2 articles et non 3."
                />
              </div>

              {editError && <p className="text-sm text-red-600">{editError}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditingReceipt(null)} disabled={savingEdit}>
                Annuler
              </Button>
              <Button
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                onClick={saveEditReceipt}
                disabled={savingEdit || !editReason.trim()}
              >
                {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SUPPRESSION D'UN REÇU (ADMIN uniquement, motif obligatoire) */}
      {deletingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setDeletingReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-bold text-lg mb-1 text-red-700">Supprimer le reçu</h2>
            <p className="text-sm text-slate-500 mb-4">
              Facture N° {getReceiptNumber(deletingReceipt)} — {getTotalAmount(deletingReceipt).toFixed(2)}{' '}
              {getStoreObj(deletingReceipt)?.currency || 'XOF'}. Cette action est définitive ; le stock des
              articles sera restauré.
            </p>

            <div className="space-y-2">
              <Label htmlFor="deleteReason">Motif de la suppression *</Label>
              <textarea
                id="deleteReason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border bg-white p-2 text-sm"
                placeholder="Ex : doublon du reçu 2026-1-0042."
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingReceipt(null)} disabled={isDeleting}>
                Annuler
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmDeleteReceipt}
                disabled={isDeleting || !deleteReason.trim()}
              >
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SIGNALEMENT D'UN REÇU (CASHIER / MANAGER → ADMIN) */}
      {reportingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setReportingReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-bold text-lg mb-1">Signaler un problème</h2>
            <p className="text-sm text-slate-500 mb-4">
              Facture N° {getReceiptNumber(reportingReceipt)} — un ticket sera adressé à un administrateur. Il sera
              validé dès que l&apos;administrateur aura effectué l&apos;action demandée.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="reportRecipient">Administrateur destinataire *</Label>
                <select
                  id="reportRecipient"
                  value={reportRecipientId}
                  onChange={(e) => setReportRecipientId(e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm bg-white"
                >
                  <option value="">— Choisir un administrateur —</option>
                  {reportRecipients.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {reportRecipients.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">Aucun administrateur trouvé pour ce magasin.</p>
                )}
              </div>
              <div>
                <Label>Action demandée *</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([
                    ['UPDATE', 'Modifier le reçu', Pencil],
                    ['DELETE', 'Supprimer le reçu', Trash2],
                  ] as const).map(([value, text, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReportAction(value)}
                      className={`flex items-center justify-center gap-2 rounded-lg border p-2 text-sm ${
                        reportAction === value
                          ? value === 'DELETE'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-slate-900 bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {text}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="reportJustification">Description du problème *</Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {['Doublon', 'Erreur de montant', "Erreur d'article", 'Mauvais mode de paiement'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReportJustification((j) => (j.trim() ? j : `${preset} : `))}
                      className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  id="reportJustification"
                  value={reportJustification}
                  onChange={(e) => setReportJustification(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-lg border bg-white p-2 text-sm"
                  placeholder="Ex : doublon du reçu 2026-1-0042, la vente a été validée deux fois."
                />
              </div>
              {reportError && <p className="text-sm text-red-600">{reportError}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setReportingReceipt(null)} disabled={isReporting}>
                Annuler
              </Button>
              <Button
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                onClick={submitReportReceipt}
                disabled={isReporting}
              >
                {isReporting ? 'Envoi…' : 'Envoyer le signalement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-gray-100">
          <LoadingDots size="h-4 w-4" color="bg-blue-600" />
        </div>
      }
    >
      <ReceiptsContent />
    </Suspense>
  );
}