import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Eye, Plus, ReceiptText, Search, Trash2, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';
import { INVOICE_STATUSES, LINE_ITEM_CATEGORIES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../lib/constants';
import { formatCurrency, formatDate, formatDateTime, fullName, titleCase } from '../lib/utils';

function emptyLineItem() {
  return { description: '', category: 'CONSULTATION', quantity: 1, unitPrice: '' };
}

function calculateTotals(lineItems, taxRate, discount) {
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  return { subtotal, tax, total: taxable + tax };
}

export default function BillingPage() {
  const [tab, setTab] = useState('invoices');
  const [patients, setPatients] = useState([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get('/patients', { params: { limit: 100, status: 'ACTIVE' } })
      .then((response) => setPatients(response.data.data || []))
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Billing & payments"
        description="Generate invoices, collect payments and reconcile balances."
        actions={tab === 'invoices' ? <Button onClick={() => setInvoiceModalOpen(true)}><Plus size={16} /> Create invoice</Button> : null}
      />

      <Tabs
        tabs={[{ value: 'invoices', label: 'Invoices' }, { value: 'payments', label: 'Payments' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'invoices' ? (
        <InvoicesPanel
          patients={patients}
          refreshKey={refreshKey}
          onView={setDetailTarget}
          onPay={setPaymentTarget}
        />
      ) : (
        <PaymentsPanel />
      )}

      <InvoiceFormModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        patients={patients}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />
      <InvoiceDetailModal
        invoice={detailTarget}
        onClose={() => setDetailTarget(null)}
        onPay={(invoice) => { setDetailTarget(null); setPaymentTarget(invoice); }}
      />
      <PaymentModal
        open={Boolean(paymentTarget)}
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSaved={() => setRefreshKey((value) => value + 1)}
      />
    </div>
  );
}

function InvoicesPanel({ patients, refreshKey, onView, onPay }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/invoices', { params: { page, limit: 10, search, status } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const canPay = (invoice) => Number(invoice.balanceDue) > 0 && !['CANCELLED', 'REFUNDED'].includes(invoice.status);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search invoice number or patient…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No invoices found" description={patients.length === 0 ? 'Register a patient before creating an invoice.' : 'Create an invoice to begin billing.'} icon={ReceiptText} />
      ) : (
        <Table>
          <thead><tr><Th>Invoice</Th><Th>Patient</Th><Th>Invoice date</Th><Th>Due date</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {items.map((invoice) => (
              <Tr key={invoice._id}>
                <Td><Badge tone="neutral">{invoice.invoiceNumber}</Badge></Td>
                <Td>
                  <p className="font-semibold text-slate-800">{fullName(invoice.patient)}</p>
                  <p className="text-[11px] text-slate-400">{invoice.patient?.patientId}</p>
                </Td>
                <Td>{formatDate(invoice.invoiceDate)}</Td>
                <Td>{formatDate(invoice.dueDate)}</Td>
                <Td className="font-semibold text-slate-800">{formatCurrency(invoice.totalAmount)}</Td>
                <Td>{formatCurrency(invoice.amountPaid)}</Td>
                <Td className={Number(invoice.balanceDue) > 0 ? 'font-semibold text-rose-600' : 'text-emerald-600'}>{formatCurrency(invoice.balanceDue)}</Td>
                <Td><StatusBadge status={invoice.status} /></Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label="View invoice" onClick={() => onView(invoice)}><Eye size={15} /></IconButton>
                    {canPay(invoice) ? <IconButton label="Record payment" className="text-teal-600 hover:bg-teal-50" onClick={() => onPay(invoice)}><CreditCard size={15} /></IconButton> : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}
    </div>
  );
}

function PaymentsPanel() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/payments', { params: { page, limit: 10, search, method, status } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, method, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search payment or transaction reference…" className="pl-9" />
        </div>
        <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No payments found" icon={WalletCards} />
      ) : (
        <Table>
          <thead><tr><Th>Payment</Th><Th>Invoice</Th><Th>Patient</Th><Th>Amount</Th><Th>Method</Th><Th>Reference</Th><Th>Received by</Th><Th>Paid at</Th><Th>Status</Th></tr></thead>
          <tbody>
            {items.map((payment) => (
              <Tr key={payment._id}>
                <Td><Badge tone="neutral">{payment.paymentNumber}</Badge></Td>
                <Td>{payment.invoice?.invoiceNumber || '—'}</Td>
                <Td>
                  <p className="font-semibold text-slate-800">{fullName(payment.invoice?.patient)}</p>
                  <p className="text-[11px] text-slate-400">{payment.invoice?.patient?.patientId}</p>
                </Td>
                <Td className="font-semibold text-slate-800">{formatCurrency(payment.amount)}</Td>
                <Td><Badge tone="info">{titleCase(payment.method)}</Badge></Td>
                <Td><span className="font-mono text-xs">{payment.transactionRef || '—'}</span></Td>
                <Td>{fullName(payment.receivedBy)}</Td>
                <Td>{formatDateTime(payment.paidAt)}</Td>
                <Td><StatusBadge status={payment.status} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}
    </div>
  );
}

function InvoiceFormModal({ open, onClose, patients, onSaved }) {
  const [form, setForm] = useState({ patient: '', dueDate: '', taxRate: 0, discount: 0, notes: '' });
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = calculateTotals(lineItems, form.taxRate, form.discount);

  useEffect(() => {
    if (!open) return;
    setForm({ patient: '', dueDate: '', taxRate: 0, discount: 0, notes: '' });
    setLineItems([emptyLineItem()]);
    setError('');
  }, [open]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setLine = (index, key, value) => setLineItems((current) => current.map((item, itemIndex) => (
    itemIndex === index ? { ...item, [key]: value } : item
  )));
  const addLine = () => setLineItems((current) => [...current, emptyLineItem()]);
  const removeLine = (index) => setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/invoices', {
        patient: form.patient,
        dueDate: form.dueDate || undefined,
        lineItems,
        taxRate: form.taxRate,
        discount: form.discount,
        notes: form.notes,
      });
      toast.success('Invoice created');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create invoice"
      description="All totals are recalculated and verified by the server."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="invoice-form" loading={saving}>Create invoice</Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Patient" required>
            <Select required value={form.patient} onChange={(e) => set('patient', e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{fullName(patient)} · {patient.patientId}</option>)}
            </Select>
          </Field>
          <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</p>
            <Button type="button" size="sm" variant="secondary" onClick={addLine}><Plus size={14} /> Add line</Button>
          </div>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_160px_90px_120px_32px] sm:items-end">
                <Field label="Description" required><Input required value={item.description} onChange={(e) => setLine(index, 'description', e.target.value)} /></Field>
                <Field label="Category">
                  <Select value={item.category} onChange={(e) => setLine(index, 'category', e.target.value)}>
                    {LINE_ITEM_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
                  </Select>
                </Field>
                <Field label="Qty" required><Input type="number" min="1" required value={item.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} /></Field>
                <Field label="Unit price" required><Input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(e) => setLine(index, 'unitPrice', e.target.value)} /></Field>
                {lineItems.length > 1 ? <IconButton label="Remove line" className="mb-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeLine(index)}><Trash2 size={15} /></IconButton> : <span />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax rate (%)"><Input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} /></Field>
          <Field label="Discount"><Input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between py-1 text-slate-500"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between py-1 text-slate-500"><span>Tax</span><span>{formatCurrency(totals.tax)}</span></div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
        </div>

        <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

function InvoiceDetailModal({ invoice, onClose, onPay }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoice) { setDetail(null); return; }
    setDetail(invoice);
    setLoading(true);
    setError('');
    api.get(`/invoices/${invoice._id}`)
      .then((response) => setDetail(response.data.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [invoice]);

  const data = detail || invoice;
  if (!data) return null;
  const canPay = Number(data.balanceDue) > 0 && !['CANCELLED', 'REFUNDED'].includes(data.status);

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title={`Invoice ${data.invoiceNumber}`}
      description={data.patient ? `${fullName(data.patient)} · ${data.patient.patientId} · ${formatDate(data.invoiceDate)}` : ''}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canPay ? <Button onClick={() => onPay(data)}><CreditCard size={16} /> Record payment</Button> : null}
        </>
      }
    >
      {loading ? <Spinner label="Loading invoice…" /> : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <Badge tone="neutral">Due {formatDate(data.dueDate)}</Badge>
            <Badge tone="info">{formatCurrency(data.totalAmount)} total</Badge>
            <Badge tone={Number(data.balanceDue) > 0 ? 'danger' : 'success'}>{formatCurrency(data.balanceDue)} balance</Badge>
          </div>

          <Table>
            <thead><tr><Th>Description</Th><Th>Category</Th><Th>Qty</Th><Th>Unit price</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {(data.lineItems || []).map((item, index) => (
                <Tr key={index}>
                  <Td className="whitespace-normal font-medium text-slate-700">{item.description}</Td>
                  <Td><Badge tone="info">{titleCase(item.category)}</Badge></Td>
                  <Td>{item.quantity}</Td>
                  <Td>{formatCurrency(item.unitPrice)}</Td>
                  <Td className="text-right font-semibold text-slate-800">{formatCurrency(item.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between py-1 text-slate-500"><span>Subtotal</span><span>{formatCurrency(data.subtotal)}</span></div>
            <div className="flex justify-between py-1 text-slate-500"><span>Discount</span><span>−{formatCurrency(data.discount)}</span></div>
            <div className="flex justify-between py-1 text-slate-500"><span>Tax ({data.taxRate}%)</span><span>{formatCurrency(data.tax)}</span></div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>Total</span><span>{formatCurrency(data.totalAmount)}</span></div>
            <div className="flex justify-between py-1 text-slate-500"><span>Paid</span><span>{formatCurrency(data.amountPaid)}</span></div>
            <div className="flex justify-between py-1 font-semibold text-rose-600"><span>Balance due</span><span>{formatCurrency(data.balanceDue)}</span></div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</p>
            {data.payments?.length ? (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {data.payments.map((payment) => (
                  <div key={payment._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{payment.paymentNumber} · {titleCase(payment.method)}</p>
                      <p className="text-[11px] text-slate-400">{formatDateTime(payment.paidAt)} · {payment.transactionRef}</p>
                    </div>
                    <span className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No payments recorded yet.</p>}
          </div>

          {data.notes ? <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p><p className="text-sm text-slate-600">{data.notes}</p></div> : null}
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({ open, invoice, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', method: 'CASH', transactionRef: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !invoice) return;
    setForm({ amount: String(invoice.balanceDue ?? ''), method: 'CASH', transactionRef: '', notes: '' });
    setError('');
  }, [open, invoice]);

  if (!invoice) return null;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const amount = Number(form.amount) || 0;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/invoices/${invoice._id}/payments`, {
        amount: form.amount,
        method: form.method,
        transactionRef: form.transactionRef || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Payment recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${invoice.invoiceNumber} · ${formatCurrency(invoice.balanceDue)} outstanding`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="payment-form" loading={saving} disabled={amount <= 0 || amount > Number(invoice.balanceDue)}>Record payment</Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <Field label="Amount" required hint={`Cannot exceed the ${formatCurrency(invoice.balanceDue)} balance.`}>
          <Input type="number" required min="0.01" max={invoice.balanceDue} step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Payment method" required>
          <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{titleCase(method)}</option>)}
          </Select>
        </Field>
        <Field label="Transaction reference"><Input value={form.transactionRef} onChange={(e) => set('transactionRef', e.target.value)} placeholder="Optional receipt or transaction ID" /></Field>
        <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
