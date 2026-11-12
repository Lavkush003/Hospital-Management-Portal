import { useState } from 'react';
import type { Invoice, Patient, PaymentMethod } from '@/types/api';
import { addDays, endOfDay, fromDateInput, toDateInput } from '@/utils/date';
import { formatMoney } from '@/utils/format';
import { paymentMethods } from '@/utils/status';
import type { InvoiceInput, InvoiceItemInput, PaymentInput } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';
import { PatientPicker } from '@/features/patients/PatientPicker';

interface ItemValues {
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
}

function emptyItem(): ItemValues {
  return { description: '', quantity: '1', unitPrice: '0', discountAmount: '0', taxAmount: '0' };
}

function itemTotal(item: ItemValues): number {
  const quantity = Number(item.quantity) || 0;
  const unit = Number(item.unitPrice) || 0;
  const discount = Number(item.discountAmount) || 0;
  const tax = Number(item.taxAmount) || 0;
  return quantity * unit - discount + tax;
}

export function InvoiceForm({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (input: InvoiceInput) => void;
  onCancel: () => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState(toDateInput(addDays(new Date(), 7)));
  const [items, setItems] = useState<ItemValues[]>([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const subtotal = items.reduce((total, item) => {
    return total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);
  const discountTotal = items.reduce((total, item) => total + (Number(item.discountAmount) || 0), 0);
  const taxTotal = items.reduce((total, item) => total + (Number(item.taxAmount) || 0), 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  function updateItem(index: number, key: keyof ItemValues, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!patient) {
      setMessage('Select a patient.');
      return;
    }
    const due = fromDateInput(dueDate);
    if (!due) {
      setMessage('Choose a valid due date.');
      return;
    }
    if (items.length === 0) {
      setMessage('Add at least one invoice item.');
      return;
    }
    if (items.some((item) => !item.description.trim() || (Number(item.quantity) || 0) < 1)) {
      setMessage('Every item needs a description and a quantity of at least one.');
      return;
    }

    const payloadItems: InvoiceItemInput[] = items.map((item) => ({
      description: item.description.trim(),
      quantity: Math.floor(Number(item.quantity) || 1),
      unitPrice: item.unitPrice || '0',
      discountAmount: item.discountAmount || '0',
      taxAmount: item.taxAmount || '0',
    }));

    onSubmit({
      patientId: patient.id,
      currency: currency.trim().toUpperCase(),
      dueAt: endOfDay(due).toISOString(),
      items: payloadItems,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Patient</h3>
        <PatientPicker selected={patient} onSelect={setPatient} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Items</h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setItems((current) => [...current, emptyItem()])}>
            Add item
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Field label="Description" required>
                    <Input
                      placeholder="Consultation, laboratory test, procedure…"
                      value={item.description}
                      onChange={(event) => updateItem(index, 'description', event.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-6 text-red-600 hover:bg-red-50"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Qty">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                  />
                </Field>
                <Field label="Unit price">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(index, 'unitPrice', event.target.value)}
                  />
                </Field>
                <Field label="Discount">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discountAmount}
                    onChange={(event) => updateItem(index, 'discountAmount', event.target.value)}
                  />
                </Field>
                <Field label="Tax">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.taxAmount}
                    onChange={(event) => updateItem(index, 'taxAmount', event.target.value)}
                  />
                </Field>
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-slate-500">
                Line total {formatMoney(itemTotal(item), currency)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Billing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" required>
            <Input
              value={currency}
              maxLength={3}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Due date" required>
            <Input
              type="date"
              min={toDateInput(new Date())}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </section>

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between text-slate-500">
          <span>Discount</span>
          <span>−{formatMoney(discountTotal, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between text-slate-500">
          <span>Tax</span>
          <span>{formatMoney(taxTotal, currency)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatMoney(grandTotal, currency)}</span>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save invoice draft
        </Button>
      </div>
    </form>
  );
}

export function PaymentForm({
  invoice,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  invoice: Invoice;
  pending: boolean;
  error: unknown;
  onSubmit: (input: PaymentInput, markSuccessful: boolean) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(invoice.balanceDue);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [markSuccessful, setMarkSuccessful] = useState(true);
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Enter a payment amount greater than zero.');
      return;
    }
    if (value > Number(invoice.balanceDue)) {
      setMessage('Payment cannot exceed the outstanding balance.');
      return;
    }
    onSubmit(
      {
        amount: value.toFixed(2),
        method,
        externalReference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      markSuccessful,
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice</span>
          <span className="font-semibold text-slate-900">{invoice.invoiceNumber}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-slate-500">Outstanding balance</span>
          <span className="font-semibold text-slate-900">
            {formatMoney(invoice.balanceDue, invoice.currency)}
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            max={invoice.balanceDue}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Method" required>
          <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {paymentMethods.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="External reference">
        <Input
          value={reference}
          placeholder="Transaction, receipt or insurance reference"
          onChange={(event) => setReference(event.target.value)}
        />
      </Field>
      <Field label="Notes">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <div>
        <Checkbox
          label="Confirm this payment as successful now"
          checked={markSuccessful}
          onChange={(event) => setMarkSuccessful(event.target.checked)}
        />
        <p className="mt-1 pl-6 text-xs text-slate-500">
          Uncheck to record a pending payment that must be reconciled later.
        </p>
      </div>
      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
