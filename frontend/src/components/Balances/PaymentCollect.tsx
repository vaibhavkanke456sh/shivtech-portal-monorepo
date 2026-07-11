import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  IndianRupee,
  User,
  Phone,
  Calendar,
  X,
  Trash2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  List,
  Users,
  Layers
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Client } from '../../types';

export interface PaymentCollectHistory {
  _id?: string;
  amount: number;
  paymentMode: 'cash' | 'shop-qr' | 'personal-qr' | 'other';
  remarks?: string;
  collectedAt: string;
}

export interface PaymentCollectEntry {
  _id: string;
  personName: string;
  phone: string;
  totalAmount: number;
  amountReceived: number;
  pendingAmount: number;
  description: string;
  paymentHistory: PaymentCollectHistory[];
  status: 'pending' | 'partial' | 'received';
  date: string;
  createdAt?: string;
}

interface PersonGroup {
  key: string;
  personName: string;
  phone: string;
  entries: PaymentCollectEntry[];
  totalAmount: number;
  amountReceived: number;
  pendingAmount: number;
  status: 'pending' | 'partial' | 'received';
  entryCount: number;
}

interface Summary {
  totalEntries: number;
  totalAmount: number;
  totalReceived: number;
  totalPending: number;
  pendingCount: number;
  partialCount: number;
  receivedCount: number;
}

interface NameSuggestion {
  name: string;
  phone: string;
  source: 'customer' | 'collect';
  existingEntryCount?: number;
  existingPending?: number;
  existingTotal?: number;
}

interface PaymentCollectProps {
  token: string;
  clients?: Client[];
  onPaymentReceived?: (amount: number, paymentMode: string) => void;
}

const emptyForm = {
  personName: '',
  phone: '',
  totalAmount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  initialReceived: '',
  paymentMode: 'cash' as 'cash' | 'shop-qr' | 'personal-qr' | 'other'
};

const emptyCollectForm = {
  amount: '',
  paymentMode: 'cash' as 'cash' | 'shop-qr' | 'personal-qr' | 'other',
  remarks: '',
  collectedAt: new Date().toISOString().split('T')[0]
};

const statusBadge = (status: PaymentCollectEntry['status']) => {
  const map = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    partial: 'bg-blue-100 text-blue-800 border-blue-200',
    received: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };
  const labels = { pending: 'Pending', partial: 'Partial', received: 'Received' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {labels[status]}
    </span>
  );
};

const modeLabel = (mode: string) => {
  switch (mode) {
    case 'cash':
      return 'Cash';
    case 'shop-qr':
      return 'Shop QR';
    case 'personal-qr':
      return 'Personal QR';
    default:
      return 'Other';
  }
};

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const groupStatus = (pending: number, received: number): PersonGroup['status'] => {
  if (pending <= 0 && received > 0) return 'received';
  if (received > 0 && pending > 0) return 'partial';
  return 'pending';
};

const PaymentCollect: React.FC<PaymentCollectProps> = ({ token, clients = [], onPaymentReceived }) => {
  const [entries, setEntries] = useState<PaymentCollectEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalEntries: 0,
    totalAmount: 0,
    totalReceived: 0,
    totalPending: 0,
    pendingCount: 0,
    partialCount: 0,
    receivedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'received'>('all');
  const [viewMode, setViewMode] = useState<'person' | 'entries'>('person');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [collectEntry, setCollectEntry] = useState<PaymentCollectEntry | null>(null);
  const [collectForm, setCollectForm] = useState(emptyCollectForm);
  const [collectError, setCollectError] = useState('');
  const [collecting, setCollecting] = useState(false);

  const [personDetail, setPersonDetail] = useState<PersonGroup | null>(null);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all entries; filter client-side for status/search so person grouping stays accurate
      const res = await apiFetch('/api/data/payment-collects', { headers: authHeaders });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to load entries');
      setEntries(json.data.entries || []);
      setSummary(
        json.data.summary || {
          totalEntries: 0,
          totalAmount: 0,
          totalReceived: 0,
          totalPending: 0,
          pendingCount: 0,
          partialCount: 0,
          receivedCount: 0
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load payment collect entries');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Keep person detail panel in sync after reloads
  useEffect(() => {
    if (!personDetail) return;
    const key = personDetail.key;
    const refreshed = entries.filter((e) => normalizeName(e.personName) === key);
    if (refreshed.length === 0) {
      setPersonDetail(null);
      return;
    }
    const totalAmount = refreshed.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const amountReceived = refreshed.reduce((s, e) => s + (e.amountReceived || 0), 0);
    const pendingAmount = refreshed.reduce((s, e) => s + (e.pendingAmount || 0), 0);
    setPersonDetail({
      key,
      personName: refreshed[0].personName,
      phone: refreshed.find((e) => e.phone)?.phone || '',
      entries: [...refreshed].sort(
        (a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
      ),
      totalAmount,
      amountReceived,
      pendingAmount,
      status: groupStatus(pendingAmount, amountReceived),
      entryCount: refreshed.length
    });
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (statusFilter !== 'all') {
      list = list.filter((e) => e.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.personName.toLowerCase().includes(q) ||
          (e.phone || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, search, statusFilter]);

  const personGroups = useMemo((): PersonGroup[] => {
    const map = new Map<string, PersonGroup>();
    for (const entry of filteredEntries) {
      const key = normalizeName(entry.personName);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          personName: entry.personName,
          phone: entry.phone || '',
          entries: [entry],
          totalAmount: entry.totalAmount || 0,
          amountReceived: entry.amountReceived || 0,
          pendingAmount: entry.pendingAmount || 0,
          status: entry.status,
          entryCount: 1
        });
      } else {
        existing.entries.push(entry);
        existing.totalAmount += entry.totalAmount || 0;
        existing.amountReceived += entry.amountReceived || 0;
        existing.pendingAmount += entry.pendingAmount || 0;
        existing.entryCount += 1;
        if (!existing.phone && entry.phone) existing.phone = entry.phone;
        existing.status = groupStatus(existing.pendingAmount, existing.amountReceived);
      }
    }
    // Sort entries inside each group oldest → newest
    for (const g of map.values()) {
      g.entries.sort(
        (a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
      );
    }
    return Array.from(map.values()).sort((a, b) => b.pendingAmount - a.pendingAmount);
  }, [filteredEntries]);

  /** Existing collect totals for the name typed in the add form */
  const existingForAddName = useMemo(() => {
    const key = normalizeName(addForm.personName);
    if (!key) return null;
    const match = entries.filter((e) => normalizeName(e.personName) === key);
    if (match.length === 0) return null;
    const totalAmount = match.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const pendingAmount = match.reduce((s, e) => s + (e.pendingAmount || 0), 0);
    const amountReceived = match.reduce((s, e) => s + (e.amountReceived || 0), 0);
    return {
      count: match.length,
      personName: match[0].personName,
      phone: match.find((e) => e.phone)?.phone || '',
      totalAmount,
      pendingAmount,
      amountReceived
    };
  }, [addForm.personName, entries]);

  const nameSuggestions = useMemo((): NameSuggestion[] => {
    const q = addForm.personName.trim().toLowerCase();
    if (q.length < 1) return [];

    const results: NameSuggestion[] = [];
    const seen = new Set<string>();

    // Customers first
    for (const c of clients) {
      const name = (c.name || '').trim();
      if (!name) continue;
      const key = normalizeName(name);
      if (!key.includes(q) && !(c.phone || '').includes(q)) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = entries.filter((e) => normalizeName(e.personName) === key);
      results.push({
        name,
        phone: c.phone || '',
        source: 'customer',
        existingEntryCount: existing.length,
        existingPending: existing.reduce((s, e) => s + (e.pendingAmount || 0), 0),
        existingTotal: existing.reduce((s, e) => s + (e.totalAmount || 0), 0)
      });
    }

    // Existing collect persons not already listed from customers
    for (const e of entries) {
      const name = (e.personName || '').trim();
      if (!name) continue;
      const key = normalizeName(name);
      if (!key.includes(q) && !(e.phone || '').includes(q)) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = entries.filter((x) => normalizeName(x.personName) === key);
      results.push({
        name,
        phone: existing.find((x) => x.phone)?.phone || e.phone || '',
        source: 'collect',
        existingEntryCount: existing.length,
        existingPending: existing.reduce((s, x) => s + (x.pendingAmount || 0), 0),
        existingTotal: existing.reduce((s, x) => s + (x.totalAmount || 0), 0)
      });
    }

    return results.slice(0, 8);
  }, [addForm.personName, clients, entries]);

  const selectSuggestion = (s: NameSuggestion) => {
    setAddForm((p) => ({
      ...p,
      personName: s.name,
      phone: s.phone || p.phone
    }));
    setShowNameSuggestions(false);
    setHighlightIndex(0);
  };

  const openPersonDetail = (group: PersonGroup) => {
    setPersonDetail(group);
  };

  const openAddForPerson = (personName: string, phone?: string) => {
    setAddForm({
      ...emptyForm,
      personName,
      phone: phone || ''
    });
    setAddError('');
    setShowNameSuggestions(false);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!addForm.personName.trim()) {
      setAddError('Person name is required');
      return;
    }
    const total = parseFloat(addForm.totalAmount);
    if (!total || total <= 0) {
      setAddError('Total amount must be greater than 0');
      return;
    }
    const initial = parseFloat(addForm.initialReceived) || 0;
    if (initial < 0 || initial > total) {
      setAddError('Initial received cannot exceed total amount');
      return;
    }

    // Prefer existing spelling + phone for same person
    const nameKey = normalizeName(addForm.personName);
    const existing = entries.find((x) => normalizeName(x.personName) === nameKey);
    const personName = existing?.personName || addForm.personName.trim();
    const phone = addForm.phone.trim() || existing?.phone || '';

    setSaving(true);
    try {
      const res = await apiFetch('/api/data/payment-collects', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          personName,
          phone,
          totalAmount: total,
          description: addForm.description.trim(),
          date: addForm.date,
          initialReceived: initial,
          paymentMode: addForm.paymentMode,
          paymentRemarks: initial > 0 ? 'Initial payment at entry creation' : ''
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to create entry');

      if (initial > 0 && onPaymentReceived) {
        onPaymentReceived(initial, addForm.paymentMode);
      }

      setShowAddModal(false);
      setAddForm(emptyForm);
      await loadEntries();

      // Open person detail so user can see old + new clearly
      // loadEntries will refresh; open after short delay via effect is hard —
      // open with known key after reload in next tick using returned data
      const created = json.data.entry as PaymentCollectEntry;
      if (created) {
        // Will refresh person detail after loadEntries updates entries
        setTimeout(() => {
          setPersonDetail({
            key: normalizeName(personName),
            personName,
            phone,
            entries: [],
            totalAmount: 0,
            amountReceived: 0,
            pendingAmount: 0,
            status: 'pending',
            entryCount: 0
          });
        }, 0);
      }
    } catch (err: any) {
      setAddError(err.message || 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  };

  const openCollectModal = (entry: PaymentCollectEntry) => {
    setCollectEntry(entry);
    setCollectForm({
      amount: String(entry.pendingAmount || ''),
      paymentMode: 'cash',
      remarks: '',
      collectedAt: new Date().toISOString().split('T')[0]
    });
    setCollectError('');
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectEntry) return;
    setCollectError('');
    const amount = parseFloat(collectForm.amount);
    if (!amount || amount <= 0) {
      setCollectError('Amount must be greater than 0');
      return;
    }
    if (amount > collectEntry.pendingAmount) {
      setCollectError(`Cannot exceed pending amount (${formatCurrency(collectEntry.pendingAmount)})`);
      return;
    }

    setCollecting(true);
    try {
      const res = await apiFetch(`/api/data/payment-collects/${collectEntry._id}/payments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          amount,
          paymentMode: collectForm.paymentMode,
          remarks: collectForm.remarks.trim(),
          collectedAt: collectForm.collectedAt
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to record payment');

      if (onPaymentReceived) {
        onPaymentReceived(amount, collectForm.paymentMode);
      }

      setCollectEntry(null);
      setCollectForm(emptyCollectForm);
      await loadEntries();
    } catch (err: any) {
      setCollectError(err.message || 'Failed to record payment');
    } finally {
      setCollecting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete entry "${label}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/data/payment-collects/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to delete');
      await loadEntries();
    } catch (err: any) {
      alert(err.message || 'Failed to delete entry');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Collect Payments</h2>
          <p className="text-gray-500 text-sm mt-1">
            Track money to collect — search customers by name, add new amounts, and view old vs new entries per person.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadEntries()}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={() => {
              setAddForm(emptyForm);
              setAddError('');
              setShowNameSuggestions(false);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
          >
            <Plus size={18} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <IndianRupee className="text-slate-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.totalPending)}</p>
              <p className="text-xs text-gray-400">{summary.pendingCount + summary.partialCount} open</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle2 className="text-emerald-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Received</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary.totalReceived)}</p>
              <p className="text-xs text-gray-400">{summary.receivedCount} fully paid</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Entries / Persons</p>
              <p className="text-xl font-bold text-blue-700">
                {summary.totalEntries}
                <span className="text-base font-medium text-gray-500">
                  {' '}
                  / {new Set(entries.map((e) => normalizeName(e.personName))).size}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + view mode */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, phone, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'partial', 'received'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t pt-3">
          <button
            onClick={() => setViewMode('person')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'person' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users size={16} />
            By Person
          </button>
          <button
            onClick={() => setViewMode('entries')}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'entries' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <List size={16} />
            All Entries
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Main table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading entries...</div>
        ) : viewMode === 'person' ? (
          personGroups.length === 0 ? (
            <div className="p-12 text-center">
              <IndianRupee className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-600 font-medium">No payment collect entries yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a person you need to collect money from.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Plus size={16} />
                Add First Entry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Person</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Entries</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Received</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Pending</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {personGroups.map((group) => (
                    <tr key={group.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{group.personName}</div>
                        {group.phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={12} />
                            {group.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                          <Layers size={12} />
                          {group.entryCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {formatCurrency(group.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {formatCurrency(group.amountReceived)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-700 font-medium">
                        {formatCurrency(group.pendingAmount)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(group.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => openPersonDetail(group)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
                            title="View old and new entries separately"
                          >
                            <Eye size={14} />
                            View Entries
                          </button>
                          <button
                            onClick={() => openAddForPerson(group.personName, group.phone)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium"
                            title="Add another amount for this person"
                          >
                            <Plus size={14} />
                            Add Amount
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No entries match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Person</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Pending</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((entry) => (
                  <React.Fragment key={entry._id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{entry.personName}</div>
                        {entry.phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={12} />
                            {entry.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {entry.date ? formatDate(entry.date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(entry.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {formatCurrency(entry.amountReceived)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-700 font-medium">
                        {formatCurrency(entry.pendingAmount)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={entry.description}>
                        {entry.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {entry.pendingAmount > 0 && (
                            <button
                              onClick={() => openCollectModal(entry)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium"
                            >
                              <DollarSign size={14} />
                              Collect
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === entry._id ? null : entry._id)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                          >
                            {expandedId === entry._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button
                            onClick={() => handleDelete(entry._id, `${entry.personName} · ${formatCurrency(entry.totalAmount)}`)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === entry._id && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment History</h4>
                          {!entry.paymentHistory?.length ? (
                            <p className="text-sm text-gray-400">No payments collected yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1 pr-4">Date</th>
                                  <th className="text-right py-1 pr-4">Amount</th>
                                  <th className="text-left py-1 pr-4">Mode</th>
                                  <th className="text-left py-1">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.paymentHistory.map((p, i) => (
                                  <tr key={p._id || i} className="border-t border-gray-200">
                                    <td className="py-1.5 pr-4">{p.collectedAt ? formatDate(p.collectedAt) : '—'}</td>
                                    <td className="py-1.5 pr-4 text-right font-medium text-emerald-700">
                                      {formatCurrency(p.amount)}
                                    </td>
                                    <td className="py-1.5 pr-4">{modeLabel(p.paymentMode)}</td>
                                    <td className="py-1.5 text-gray-500">{p.remarks || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Person Detail Modal: old + new entries clearly ─── */}
      {personDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="text-emerald-600" size={22} />
                  {personDetail.personName}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {personDetail.phone ? `${personDetail.phone} · ` : ''}
                  {personDetail.entryCount} entr{personDetail.entryCount === 1 ? 'y' : 'ies'} — old &amp; new shown separately
                </p>
              </div>
              <button onClick={() => setPersonDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Combined totals */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-gray-500">Combined Total</p>
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(personDetail.totalAmount)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-xs text-gray-500">Combined Received</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(personDetail.amountReceived)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-gray-500">Combined Pending</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(personDetail.pendingAmount)}</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-800">Individual Entries (oldest → newest)</h4>
                <button
                  onClick={() => openAddForPerson(personDetail.personName, personDetail.phone)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                >
                  <Plus size={14} />
                  Add New Amount
                </button>
              </div>

              {personDetail.entries.length === 0 ? (
                <p className="text-gray-400 text-sm">Loading entries...</p>
              ) : (
                <div className="space-y-3">
                  {personDetail.entries.map((entry, index) => {
                    const isNewest = index === personDetail.entries.length - 1;
                    const isOldest = index === 0;
                    return (
                      <div
                        key={entry._id}
                        className={`rounded-xl border p-4 ${
                          isNewest && personDetail.entries.length > 1
                            ? 'border-emerald-300 bg-emerald-50/40'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-white text-xs font-semibold">
                              Entry #{index + 1}
                            </span>
                            {isOldest && personDetail.entries.length > 1 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Old</span>
                            )}
                            {isNewest && personDetail.entries.length > 1 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                New
                              </span>
                            )}
                            {statusBadge(entry.status)}
                          </div>
                          <span className="text-xs text-gray-500">
                            {entry.date ? formatDate(entry.date) : '—'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                          <div>
                            <span className="text-gray-500">Amount:</span>{' '}
                            <strong>{formatCurrency(entry.totalAmount)}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500">Received:</span>{' '}
                            <strong className="text-emerald-700">{formatCurrency(entry.amountReceived)}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500">Pending:</span>{' '}
                            <strong className="text-amber-700">{formatCurrency(entry.pendingAmount)}</strong>
                          </div>
                        </div>

                        {entry.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="text-gray-500">Reason:</span> {entry.description}
                          </p>
                        )}

                        {entry.paymentHistory?.length > 0 && (
                          <div className="mt-2 mb-2 bg-white/80 rounded-lg border border-gray-100 p-2">
                            <p className="text-xs font-medium text-gray-600 mb-1">Collections on this entry</p>
                            <ul className="text-xs space-y-1">
                              {entry.paymentHistory.map((p, i) => (
                                <li key={p._id || i} className="flex justify-between gap-2">
                                  <span>
                                    {p.collectedAt ? formatDate(p.collectedAt) : '—'} · {modeLabel(p.paymentMode)}
                                    {p.remarks ? ` · ${p.remarks}` : ''}
                                  </span>
                                  <span className="font-medium text-emerald-700">{formatCurrency(p.amount)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex gap-2 mt-2">
                          {entry.pendingAmount > 0 && (
                            <button
                              onClick={() => openCollectModal(entry)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-medium"
                            >
                              <DollarSign size={14} />
                              Collect on this entry
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleDelete(entry._id, `Entry #${index + 1} · ${formatCurrency(entry.totalAmount)}`)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 border border-red-200 rounded-md hover:bg-red-50 text-xs"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Entry Modal with customer search ─── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="text-emerald-600" size={22} />
                Add Collect Entry
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Person Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  autoComplete="off"
                  value={addForm.personName}
                  onChange={(e) => {
                    setAddForm((p) => ({ ...p, personName: e.target.value }));
                    setShowNameSuggestions(true);
                    setHighlightIndex(0);
                  }}
                  onFocus={() => setShowNameSuggestions(true)}
                  onBlur={() => {
                    // Delay so click on suggestion still registers
                    setTimeout(() => setShowNameSuggestions(false), 180);
                  }}
                  onKeyDown={(e) => {
                    if (!showNameSuggestions || nameSuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightIndex((i) => Math.min(i + 1, nameSuggestions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && showNameSuggestions) {
                      e.preventDefault();
                      selectSuggestion(nameSuggestions[highlightIndex]);
                    } else if (e.key === 'Escape') {
                      setShowNameSuggestions(false);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Type to search customers..."
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Matches existing customers and previous collect persons for fast fill.
                </p>

                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
                  >
                    {nameSuggestions.map((s, i) => (
                      <button
                        key={`${s.source}-${s.name}-${s.phone}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(s)}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 ${
                          i === highlightIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-gray-900">{s.name}</span>
                          <span
                            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              s.source === 'customer'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-violet-100 text-violet-700'
                            }`}
                          >
                            {s.source === 'customer' ? 'Customer' : 'Collect'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                          {s.phone && <span>{s.phone}</span>}
                          {(s.existingEntryCount || 0) > 0 && (
                            <span className="text-amber-700">
                              {s.existingEntryCount} existing · pending {formatCurrency(s.existingPending || 0)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Existing person notice */}
              {existingForAddName && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 space-y-1">
                  <p className="font-medium">
                    Existing entries found for “{existingForAddName.personName}”
                  </p>
                  <p>
                    {existingForAddName.count} entr{existingForAddName.count === 1 ? 'y' : 'ies'} already · Total{' '}
                    {formatCurrency(existingForAddName.totalAmount)} · Pending{' '}
                    {formatCurrency(existingForAddName.pendingAmount)}
                  </p>
                  <p className="text-amber-800">
                    Saving will add a <strong>new amount as a separate entry</strong>. Old and new stay visible under{' '}
                    <strong>View Entries</strong>.
                  </p>
                  <button
                    type="button"
                    className="text-blue-700 underline text-xs font-medium"
                    onClick={() => {
                      const key = normalizeName(existingForAddName.personName);
                      const match = entries.filter((e) => normalizeName(e.personName) === key);
                      if (match.length) {
                        const totalAmount = match.reduce((s, e) => s + (e.totalAmount || 0), 0);
                        const amountReceived = match.reduce((s, e) => s + (e.amountReceived || 0), 0);
                        const pendingAmount = match.reduce((s, e) => s + (e.pendingAmount || 0), 0);
                        setPersonDetail({
                          key,
                          personName: existingForAddName.personName,
                          phone: existingForAddName.phone,
                          entries: [...match].sort(
                            (a, b) =>
                              new Date(a.createdAt || a.date).getTime() -
                              new Date(b.createdAt || b.date).getTime()
                          ),
                          totalAmount,
                          amountReceived,
                          pendingAmount,
                          status: groupStatus(pendingAmount, amountReceived),
                          entryCount: match.length
                        });
                      }
                    }}
                  >
                    Preview existing entries
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Auto-filled from customer when selected"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {existingForAddName ? 'New Amount' : 'Total Amount'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={addForm.totalAmount}
                    onChange={(e) => setAddForm((p) => ({ ...p, totalAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0.00"
                    required
                  />
                  {existingForAddName && addForm.totalAmount && (
                    <p className="text-xs text-gray-500 mt-1">
                      Combined total after save:{' '}
                      {formatCurrency(existingForAddName.totalAmount + (parseFloat(addForm.totalAmount) || 0))}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} /> Date
                    </span>
                  </label>
                  <input
                    type="date"
                    value={addForm.date}
                    onChange={(e) => setAddForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g. Loan, service payment, advance..."
                />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Initial payment (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Already received</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={addForm.initialReceived}
                      onChange={(e) => setAddForm((p) => ({ ...p, initialReceived: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Payment mode</label>
                    <select
                      value={addForm.paymentMode}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          paymentMode: e.target.value as typeof p.paymentMode
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="shop-qr">Shop QR</option>
                      <option value="personal-qr">Personal QR</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {addError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : existingForAddName
                      ? 'Add New Amount Entry'
                      : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {collectEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="text-emerald-600" size={22} />
                Collect Payment
              </h3>
              <button onClick={() => setCollectEntry(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleCollectSubmit} className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div>
                  <strong>Person:</strong> {collectEntry.personName}
                </div>
                {collectEntry.description && (
                  <div>
                    <strong>Entry:</strong> {collectEntry.description}
                  </div>
                )}
                <div>
                  <strong>This entry total:</strong> {formatCurrency(collectEntry.totalAmount)}
                </div>
                <div>
                  <strong>Already received:</strong> {formatCurrency(collectEntry.amountReceived)}
                </div>
                <div className="text-amber-700">
                  <strong>Pending on this entry:</strong> {formatCurrency(collectEntry.pendingAmount)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Received <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={collectEntry.pendingAmount}
                  step="0.01"
                  value={collectForm.amount}
                  onChange={(e) => setCollectForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={collectForm.paymentMode}
                  onChange={(e) =>
                    setCollectForm((p) => ({
                      ...p,
                      paymentMode: e.target.value as typeof p.paymentMode
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="cash">Cash</option>
                  <option value="shop-qr">Shop QR</option>
                  <option value="personal-qr">Personal QR</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={collectForm.collectedAt}
                  onChange={(e) => setCollectForm((p) => ({ ...p, collectedAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={collectForm.remarks}
                  onChange={(e) => setCollectForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Optional notes"
                />
              </div>
              {collectForm.amount && (
                <div className="text-sm text-gray-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  Remaining after this payment:{' '}
                  <strong>
                    {formatCurrency(
                      Math.max(collectEntry.pendingAmount - (parseFloat(collectForm.amount) || 0), 0)
                    )}
                  </strong>
                </div>
              )}
              {collectError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {collectError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectEntry(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <DollarSign size={16} />
                  {collecting ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCollect;
