import { useCallback, useEffect, useState } from 'react';
import { Eye, ScrollText, Search } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import {
  Badge,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { formatDateTime, fullName, summarizeMetadata, titleCase } from '../lib/utils';

export default function AuditLogsPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/audit-logs', { params: { page, limit: 20, search, outcome, dateFrom, dateTo } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, outcome, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Audit logs" description="Immutable record of authentication, clinical and billing activity." />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search action, resource or resource ID…" className="pl-9" />
        </div>
        <Select value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
          <option value="">All outcomes</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="From date" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="To date" />
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No audit logs found" icon={ScrollText} />
      ) : (
        <Table>
          <thead><tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Resource</Th><Th>Resource ID</Th><Th>Outcome</Th><Th>IP</Th><Th className="text-right">Details</Th></tr></thead>
          <tbody>
            {items.map((log) => (
              <Tr key={log._id}>
                <Td>{formatDateTime(log.createdAt)}</Td>
                <Td>
                  <p className="font-semibold text-slate-800">{log.actor ? fullName(log.actor) : 'System'}</p>
                  <p className="text-[11px] text-slate-400">{log.actor?.email || log.actorRole || '—'}</p>
                </Td>
                <Td><Badge tone="info">{log.action}</Badge></Td>
                <Td>{log.resourceType}</Td>
                <Td><span className="font-mono text-xs">{log.resourceId || '—'}</span></Td>
                <Td><Badge tone={log.outcome === 'SUCCESS' ? 'success' : 'danger'}>{log.outcome}</Badge></Td>
                <Td>{log.ipAddress || '—'}</Td>
                <Td className="text-right">
                  <IconButton label="View audit details" onClick={() => setSelected(log)}><Eye size={15} /></IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.action || 'Audit log'}
        description={selected ? `${formatDateTime(selected.createdAt)} · ${selected.outcome}` : ''}
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Actor"><p className="font-medium text-slate-800">{selected.actor ? `${fullName(selected.actor)} (${selected.actor.email})` : 'System'}</p></Field>
              <Field label="Role"><p className="font-medium text-slate-800">{titleCase(selected.actorRole || selected.actor?.role || '—')}</p></Field>
              <Field label="Resource"><p className="font-medium text-slate-800">{selected.resourceType} · {selected.resourceId || '—'}</p></Field>
              <Field label="Request ID"><p className="font-mono text-xs text-slate-600">{selected.requestId || '—'}</p></Field>
            </div>
            <Field label="Metadata">
              <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(selected.metadata || {}, null, 2)}</pre>
            </Field>
            <Field label="User agent"><p className="break-all text-xs text-slate-500">{selected.userAgent || '—'}</p></Field>
            <p className="text-xs text-slate-400">Summary: {summarizeMetadata(selected.metadata)}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
