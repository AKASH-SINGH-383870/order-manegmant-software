import React, { useState, useEffect } from 'react';
import {
  X, Save, CreditCard, AlertCircle, CheckCircle2, Clock, Check,
  Upload, Eye, FileText, Ban, User, Building2, Calendar, Hash
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Payment } from '../types.js';

interface EditPaymentModalProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentUpdated?: (updatedPayment: Payment, orderSummary?: any) => void;
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  payment,
  isOpen,
  onClose,
  onPaymentUpdated
}) => {
  const { user, hasPermission } = useAuth();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role_slug || '');
  const isAccounts = user?.role_slug === 'accounts';
  const hasAccountsOrAdminPerm = isAdmin || isAccounts || hasPermission('payments:verify') || hasPermission('payments:manage');

  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [proofPreview, setProofPreview] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [zoomProof, setZoomProof] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !payment) return;
    setAmount(payment.amount?.toString() || '');
    setPaymentDate(payment.payment_date || new Date().toISOString().slice(0, 10));
    setPaymentMode(payment.payment_mode || 'Bank Transfer');
    setReferenceNumber(payment.reference_number || '');
    setProofUrl(payment.proof_url || '');
    setProofPreview(payment.proof_url || '');
    setNotes(payment.notes || '');
    setError(null);
    setSuccess(null);
  }, [isOpen, payment]);

  if (!isOpen || !payment) return null;

  const isVerified = payment.is_verified === 1;
  const isPending = payment.is_verified === 0;
  const isRejected = payment.is_verified === -1;

  // Authorization Check Rule:
  // If verified: only Admin, Super Admin, Accounts can edit.
  // If pending: submitter or Admin/Accounts can edit.
  const isSubmitter = payment.received_by_id === user?.id;
  const canEdit = isVerified
    ? hasAccountsOrAdminPerm
    : (hasAccountsOrAdminPerm || isSubmitter || hasPermission('payments:add') || hasPermission('payments:submit'));

  // Handle proof file upload as base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProofPreview(base64);
        setProofUrl(base64);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    if (!canEdit) {
      setError(
        isVerified
          ? 'Verified payments can only be edited by Admin, Super Admin, or Accounts Team.'
          : 'You do not have permission to edit this payment entry.'
      );
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('petroflow_token');
      const payload = {
        amount: numericAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_number: referenceNumber ? referenceNumber.trim() : null,
        proof_url: proofUrl ? proofUrl.trim() : null,
        notes: notes ? notes.trim() : null
      };

      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update payment');
      }

      setSuccess('Payment receipt updated successfully. Order balances & ledger recalculated.');
      if (onPaymentUpdated) {
        onPaymentUpdated(data.payment, data.order);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error updating payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden my-auto border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  Edit Payment Receipt #{payment.payment_number}
                </h2>
                {isVerified ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-700 flex items-center gap-1">
                    <Check className="w-3 h-3" /> VERIFIED
                  </span>
                ) : isPending ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900 text-amber-200 border border-amber-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> PENDING VERIFICATION
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900 text-rose-200 border border-rose-700 flex items-center gap-1">
                    <Ban className="w-3 h-3" /> REJECTED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Updates payment entry #{payment.payment_number} for Order {payment.order_number || 'N/A'}.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4 text-xs">
          {/* Status Warning / Notice */}
          {isVerified ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Payment Correction</span>
              </div>
              <p className="text-[11px] mt-0.5 text-emerald-800">
                This receipt has already been verified by Accounts. Any adjustment to the amount will automatically recalculate:
                <strong className="block mt-0.5 font-mono">Order Total → Verified Received → Balance Payment</strong>
              </p>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Pending Verification</span>
              </div>
              <p className="text-[11px] mt-0.5 text-amber-800">
                This receipt is currently awaiting Accounts audit. You can correct the transaction reference, payment proof, or amount before approval.
              </p>
            </div>
          )}

          {!canEdit && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {isVerified
                  ? 'Access Restricted: Only Admin, Super Admin, or Accounts can edit verified payments.'
                  : 'Access Restricted: You do not have permission to edit this payment entry.'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Context Details Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-slate-400 block">Party / Client</span>
              <span className="font-bold text-slate-800">{payment.vendor_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Order Reference</span>
              <span className="font-mono font-bold text-slate-800">{payment.order_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Original Submitter</span>
              <span className="font-medium text-slate-700">{payment.received_by_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Current Amount</span>
              <span className="font-mono font-bold text-emerald-700 text-xs">
                ₹{payment.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <form id="edit-payment-form" onSubmit={handleSave} className="space-y-4">
            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Payment Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    disabled={!canEdit || saving}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  disabled={!canEdit || saving}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Mode & Ref */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  disabled={!canEdit || saving}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                  <option value="IMPS">IMPS</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Demand Draft">Demand Draft (DD)</option>
                  <option value="Cash">Cash Receipt</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-600" />
                  Reference / UTR / Cheque No.
                </label>
                <input
                  type="text"
                  disabled={!canEdit || saving}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR123456789, CHQ-998877"
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Proof Attachment */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                Payment Proof / Bank Receipt
              </label>

              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div className="flex-1 w-full space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canEdit || saving}
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  <input
                    type="text"
                    disabled={!canEdit || saving}
                    value={proofUrl}
                    onChange={(e) => {
                      setProofUrl(e.target.value);
                      setProofPreview(e.target.value);
                    }}
                    placeholder="Or enter image URL (https://...)"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]"
                  />
                </div>

                {proofPreview && (
                  <div className="relative group shrink-0">
                    <img
                      src={proofPreview}
                      alt="Proof"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90"
                      onClick={() => setZoomProof(proofPreview)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setProofPreview('');
                        setProofUrl('');
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 shadow hover:bg-rose-700"
                      title="Remove proof"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Correction / Verification Notes
              </label>
              <textarea
                rows={2}
                disabled={!canEdit || saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for payment modification or bank account verification note..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400">
            {payment.updated_at && (
              <span>Last edited: {new Date(payment.updated_at).toLocaleString('en-IN')}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-payment-form"
              disabled={saving || !canEdit}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Payment Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Proof Preview Zoom */}
      {zoomProof && (
        <div
          className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomProof(null)}
        >
          <div className="max-w-2xl max-h-[85vh] bg-white p-2 rounded-xl">
            <img src={zoomProof} alt="Receipt Full" className="max-w-full max-h-[80vh] object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  );
};
