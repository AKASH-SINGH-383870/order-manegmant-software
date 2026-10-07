import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Printer, Filter, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const isSalesPerson = user?.role_slug === 'sales_person';
  const [reportType, setReportType] = useState<string>('orders');
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportTitle, setReportTitle] = useState<string>('Order Master Report');
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [companyId, setCompanyId] = useState<string>('');
  const [salesPersonId, setSalesPersonId] = useState<string>('');
  const [status, setStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);

  useEffect(() => {
    const fetchPrereqs = async () => {
      try {
        const token = localStorage.getItem('petroflow_token');
        const [cRes, sRes] = await Promise.all([
          fetch('/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/sales-persons', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (cRes.ok) {
          const j = await cRes.json();
          setCompanies(j.companies || []);
        }
        if (sRes.ok) {
          const j = await sRes.json();
          setSalesPersons(j.salesPersons || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPrereqs();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('petroflow_token');
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      if (salesPersonId) params.append('sales_person_id', salesPersonId);
      if (status && status !== 'ALL') params.append('status', status);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await fetch(`/api/reports/${reportType}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setReportData(json.data || []);
        setReportTitle(json.report || 'Operational Report');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, companyId, salesPersonId, status, dateFrom, dateTo]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const rows = reportData.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportTypes = [
    { id: 'orders', label: 'Order Master' },
    { id: 'sales-person', label: 'Sales Performance' },
    { id: 'vendor', label: 'Party Sales' },
    { id: 'product', label: 'Product Volume' },
    { id: 'outstanding', label: 'Balance Payment Ledger' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            Executive Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Exportable business audits, order summaries, client revenue share, and outstanding ledger reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Types Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto print:hidden">
        <div className="flex space-x-1 pb-1 min-w-max">
          {reportTypes.map(t => (
            <button
              key={t.id}
              onClick={() => setReportType(t.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                reportType === t.id
                  ? 'border-amber-500 text-amber-600 bg-amber-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Billing Entity</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">All Companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Sales Officer</label>
            {isSalesPerson ? (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-semibold text-xs">
                Viewing: My Records ({user?.name})
              </div>
            ) : (
              <select
                value={salesPersonId}
                onChange={(e) => setSalesPersonId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="">All Sales Officers</option>
                {salesPersons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="APPROVED">Approved</option>
              <option value="PACKING">Packing</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:p-0 print:border-none print:shadow-none">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{reportTitle}</h2>
            <p className="text-xs text-slate-500">
              Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • PetroFlow Enterprise Lubricant ERP
            </p>
          </div>
          <span className="font-mono text-xs font-bold bg-slate-100 px-3 py-1 rounded">
            {reportData.length} records
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading analytics...</div>
        ) : reportData.length === 0 ? (
          <div className="py-12 text-center text-slate-400">No records found for current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  {Object.keys(reportData[0]).map((col, idx) => (
                    <th key={idx} className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-semibold border-r border-slate-800 last:border-0">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    {Object.keys(row).map((col, cIdx) => {
                      const val = row[col];
                      const isNumeric = typeof val === 'number' && (col.includes('total') || col.includes('amount') || col.includes('rate') || col.includes('sales') || col.includes('pending'));
                      return (
                        <td key={cIdx} className={`py-2 px-3 border-r border-slate-100 last:border-0 ${isNumeric ? 'text-right font-mono font-semibold' : ''}`}>
                          {isNumeric ? `₹${val.toLocaleString('en-IN')}` : (val !== null && val !== undefined ? val.toString() : '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
