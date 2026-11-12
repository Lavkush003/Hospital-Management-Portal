import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Invoice } from '@/types/api';
import { billingApi, type InvoiceInput, type PaymentInput } from '@/services/hms';
import { errorMessage } from '@/services/api';
import { useToast } from '@/components/feedback/toast-context';
import { fromDateInput, startOfDay, endOfDay } from '@/utils/date';
import { formatDate, formatDateTime, formatMoney, humanize } from '@/utils/format';
import { invoiceStatuses, statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { DetailRow } from '@/components/feedback/FormBits';
import { InvoiceForm, PaymentForm } from './BillingForms';

export function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState<unknown>(null);

  const fromDate = from ? fromDateInput(from) : null;
  const toDate = to ? fromDateInput(to) : null;

  const query = useQuery({
    queryKey: ['billing', { status, from, to, page }],
    queryFn: () =>
      billingApi.list({
        page,
        pageSize: 20,
        status: (status || undefined) as Invoice['status'] | undefined,
        from: fromDate ? startOfDay(fromDate).toISOString() : undefined,
        to: toDate ? endOfDay(toDate).toISOString() : undefined,
      }),
  });

  const detail = useQuery({
    queryKey: ['invoice', selectedId],
    queryFn: () => billingApi.find(selectedId ?? ''),
    enabled: selectedId !== null,
  });

  const invalidate = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['billing'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['invoice', id] });
  };

  const createMutation = useMutation({
    mutationFn: (input: InvoiceInput) => billingApi.create(input),
    onSuccess: (invoice) => {
      toast({
        title: 'Invoice drafted',
        description: `${invoice.invoiceNumber} · ${formatMoney(invoice.totalAmount, invoice.currency)}. Issue it when ready.`,
      });
      setCreating(false);
      setFormError(null);
      invalidate();
      setSelectedId(invoice.id);
    },
    onError: (error) => setFormError(error),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => billingApi.setStatus(id, 'ISSUED'),
    onSuccess: (invoice) => {
      toast({ title: 'Invoice issued', description: invoice.invoiceNumber });
      invalidate(invoice.id);
    },
    onError: (error) =>
      toast({ title: 'Could not issue invoice', description: errorMessage(error), tone: 'error' }),
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      billingApi.setStatus(id, 'VOID', reason),
    onSuccess: (invoice) => {
      toast({ title: 'Invoice voided', description: invoice.invoiceNumber });
      setVoidTarget(null);
      setVoidReason('');
      invalidate(invoice.id);
    },
    onError: (error) =>
      toast({ title: 'Could not void invoice', description: errorMessage(error), tone: 'error' }),
  });

  const paymentMutation = useMutation({
    mutationFn: async ({
      invoice,
      input,
      markSuccessful,
    }: {
      invoice: Invoice;
      input: PaymentInput;
      markSuccessful: boolean;
    }) => {
      const payment = await billingApi.createPayment(invoice.id, input);
      if (markSuccessful) {
        return billingApi.setPaymentStatus(payment.id, 'SUCCESSFUL');
      }
      return payment;
    },
    onSuccess: (payment) => {
      toast({
        title: 'Payment recorded',
        description: `${payment.paymentNumber} · ${humanize(payment.status)}`,
      });
      setPaymentTarget(null);
      setFormError(null);
      invalidate(payment.invoiceId);
    },
    onError: (error) => setFormError(error),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentId: string) => billingApi.setPaymentStatus(paymentId, 'SUCCESSFUL'),
    onSuccess: () => {
      toast({ title: 'Payment confirmed' });
      if (selectedId) invalidate(selectedId);
    },
    onError: (error) =>
      toast({ title: 'Could not confirm payment', description: errorMessage(error), tone: 'error' }),
  });

  const rows = query.data?.invoices ?? [];
  const pagination = query.data?.pagination;

  const columns: Array<Column<Invoice>> = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: (invoice) => (
        <div>
          <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">
            {invoice.patient.firstName} {invoice.patient.lastName}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (invoice) => (
        <div>
          <p className="text-sm text-slate-700">{formatDate(invoice.invoiceDate)}</p>
          <p className="text-xs text-slate-500">
            Due {invoice.dueAt ? formatDate(invoice.dueAt) : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (invoice) => (
        <span className="text-sm font-medium text-slate-800">
          {formatMoney(invoice.totalAmount, invoice.currency)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (invoice) => (
        <span className="text-sm text-slate-700">
          {formatMoney(invoice.balanceDue, invoice.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <Badge tone={statusTone(invoice.status)} dot>
          {humanize(invoice.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (invoice) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(invoice.id);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  const invoice = detail.data;
  const canPay =
    invoice &&
    invoice.balanceDue !== '0' &&
    !['PAID', 'VOID', 'DRAFT'].includes(invoice.status);
  const canVoid = invoice && !['PAID', 'VOID'].includes(invoice.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue cycle"
        title="Billing"
        description="Create invoices, issue them to patients and record payments at the front desk."
        actions={<Button onClick={() => {
          setFormError(null);
          setCreating(true);
        }}>Create invoice</Button>}
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              className="sm:w-44"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {invoiceStatuses.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </Select>
            <Input
              className="sm:w-40"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              aria-label="From date"
            />
            <Input
              className="sm:w-40"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              aria-label="To date"
            />
            {status || from || to ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStatus('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} invoices` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(invoice) => invoice.id}
              loading={query.isPending}
              onRowClick={(invoice) => setSelectedId(invoice.id)}
              empty={
                <EmptyState
                  title="No invoices found"
                  description="Create an invoice to begin billing a patient."
                />
              }
            />
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => {
          setCreating(false);
          setFormError(null);
        }}
        title="Create invoice"
        description="Draft an invoice for a patient. It can be issued once the items are confirmed."
        size="xl"
      >
        {creating ? (
          <InvoiceForm
            pending={createMutation.isPending}
            error={formError}
            onSubmit={(input) => createMutation.mutate(input)}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={invoice ? invoice.invoiceNumber : 'Invoice'}
        description={
          invoice
            ? `${invoice.patient.firstName} ${invoice.patient.lastName} · ${formatMoney(invoice.totalAmount, invoice.currency)}`
            : 'Loading invoice…'
        }
        size="xl"
        footer={
          invoice ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {invoice.status === 'DRAFT' ? (
                <Button loading={issueMutation.isPending} onClick={() => issueMutation.mutate(invoice.id)}>
                  Issue invoice
                </Button>
              ) : null}
              {canPay ? (
                <Button onClick={() => {
                  setFormError(null);
                  setPaymentTarget(invoice);
                }}>
                  Record payment
                </Button>
              ) : null}
              {canVoid ? (
                <Button variant="danger" onClick={() => {
                  setVoidReason('');
                  setVoidTarget(invoice);
                }}>
                  Void
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          ) : null
        }
      >
        {detail.isError ? (
          <ErrorState
            message={detail.error instanceof Error ? detail.error.message : undefined}
            onRetry={() => void detail.refetch()}
          />
        ) : detail.isPending ? (
          <p className="text-sm text-slate-500">Loading invoice…</p>
        ) : invoice ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(invoice.status)} dot>
                {humanize(invoice.status)}
              </Badge>
              <span className="text-sm text-slate-500">{invoice.patient.patientNumber}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {formatMoney(invoice.totalAmount, invoice.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paid</p>
                <p className="mt-2 text-xl font-bold text-emerald-700">
                  {formatMoney(invoice.amountPaid, invoice.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Balance</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {formatMoney(invoice.balanceDue, invoice.currency)}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-slate-100">
              <DetailRow label="Invoice date" value={formatDate(invoice.invoiceDate)} />
              <DetailRow label="Due date" value={invoice.dueAt ? formatDate(invoice.dueAt) : '—'} />
              <DetailRow label="Issued" value={invoice.issuedAt ? formatDateTime(invoice.issuedAt) : 'Not issued'} />
              <DetailRow label="Notes" value={invoice.notes ?? '—'} />
            </dl>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Items</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 pr-3 text-right">Unit</th>
                      <th className="py-2 pr-3 text-right">Discount</th>
                      <th className="py-2 pr-3 text-right">Tax</th>
                      <th className="py-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 pr-3 text-slate-700">{item.description}</td>
                        <td className="py-2.5 pr-3 text-right text-slate-600">{item.quantity}</td>
                        <td className="py-2.5 pr-3 text-right text-slate-600">
                          {formatMoney(item.unitPrice, invoice.currency)}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-slate-600">
                          {formatMoney(item.discountAmount, invoice.currency)}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-slate-600">
                          {formatMoney(item.taxAmount, invoice.currency)}
                        </td>
                        <td className="py-2.5 text-right font-medium text-slate-800">
                          {formatMoney(item.lineTotal, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Payments</h3>
              {invoice.payments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No payments recorded.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {payment.paymentNumber} · {formatMoney(payment.amount, invoice.currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {humanize(payment.method)}
                          {payment.externalReference ? ` · ${payment.externalReference}` : ''}
                          {payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={statusTone(payment.status)}>{humanize(payment.status)}</Badge>
                        {payment.status === 'PENDING' && invoice.status !== 'VOID' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={confirmPaymentMutation.isPending}
                            onClick={() => confirmPaymentMutation.mutate(payment.id)}
                          >
                            Confirm
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={paymentTarget !== null}
        onClose={() => {
          setPaymentTarget(null);
          setFormError(null);
        }}
        title="Record payment"
        description="Record a patient payment against this invoice."
        size="lg"
      >
        {paymentTarget ? (
          <PaymentForm
            invoice={paymentTarget}
            pending={paymentMutation.isPending}
            error={formError}
            onSubmit={(input, markSuccessful) =>
              paymentMutation.mutate({ invoice: paymentTarget, input, markSuccessful })
            }
            onCancel={() => {
              setPaymentTarget(null);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={voidTarget !== null}
        title="Void invoice?"
        description={
          voidTarget
            ? `${voidTarget.invoiceNumber} for ${voidTarget.patient.firstName} ${voidTarget.patient.lastName} will be voided. This cannot be undone.`
            : ''
        }
        confirmLabel="Void invoice"
        loading={voidMutation.isPending}
        onConfirm={() => {
          if (!voidTarget) return;
          if (voidReason.trim().length < 3) {
            toast({ title: 'Please provide a void reason', tone: 'info' });
            return;
          }
          voidMutation.mutate({ id: voidTarget.id, reason: voidReason.trim() });
        }}
        onClose={() => {
          if (!voidMutation.isPending) {
            setVoidTarget(null);
            setVoidReason('');
          }
        }}
      >
        <Field label="Void reason" required>
          <Textarea
            rows={3}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="Explain why this invoice is being voided."
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
