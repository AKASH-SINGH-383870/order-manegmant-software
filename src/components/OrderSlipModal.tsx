import React, { useRef } from 'react';
import { Printer, Download, X, Building2, CheckCircle2 } from 'lucide-react';
import { Order, OrderItem } from '../types.js';

interface OrderSlipModalProps {
  order: Order;
  items: OrderItem[];
  isOpen: boolean;
  onClose: () => void;
}

export const OrderSlipModal: React.FC<OrderSlipModalProps> = ({ order, items, isOpen, onClose }) => {
  const slipRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isNonGst = order.tax_type === 'NON_GST' || (order.tax_rate === 0 && order.tax_amount === 0 && order.subtotal === order.grand_total);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
        {/* Modal Top Bar - Hidden in print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-semibold text-base tracking-wide">Official Order Slip & Confirmation</h3>
              <p className="text-xs text-slate-300">Generated for Order #{order.order_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium text-xs rounded-md shadow transition"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Order Slip Document */}
        <div ref={slipRef} className="p-4 sm:p-8 overflow-y-auto print:overflow-visible print:p-6 text-slate-900 bg-white font-sans text-sm">
          {/* Header with Company Logo & Details */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              {order.billing_company_logo ? (
                <img
                  src={order.billing_company_logo}
                  alt={order.billing_company_name}
                  className="w-14 sm:w-16 h-14 sm:h-16 rounded object-cover border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-14 sm:w-16 h-14 sm:h-16 rounded bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-lg sm:text-xl shrink-0">
                  {order.billing_company_code || 'LUBE'}
                </div>
              )}
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{order.billing_company_name}</h1>
                <p className="text-xs text-slate-600 mt-1 max-w-md">{order.billing_company_address}, {order.billing_company_city}, {order.billing_company_state} - {order.billing_company_pincode}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 mt-1">
                  <span><strong>GSTIN:</strong> {order.billing_company_gst}</span>
                  <span><strong>Mobile:</strong> {order.billing_company_mobile}</span>
                  <span><strong>Email:</strong> {order.billing_company_email}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-base text-slate-900">
                {order.order_number}
              </div>
              <p className="text-xs text-slate-500 mt-1">Order Date: <span className="font-semibold text-slate-800">{formattedDate}</span></p>
              <p className="text-xs text-slate-500">Sales Officer: <span className="font-semibold text-slate-800">{order.sales_person_name}</span></p>
            </div>
          </div>

          {/* Party and Delivery Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 my-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Party Information</p>
              <h2 className="text-sm font-bold text-slate-900">{order.vendor_name}</h2>
              <p className="text-xs text-slate-600 mt-0.5">Attn: {order.vendor_contact || 'Purchase Department'}</p>
              <p className="text-xs text-slate-600">Mobile: {order.vendor_mobile} {order.vendor_email && `| ${order.vendor_email}`}</p>
              <p className="text-xs text-slate-700 mt-1"><strong>GSTIN:</strong> {order.vendor_gstin || 'Unregistered / Exempted'}</p>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Billing Address:</strong> {order.vendor_billing_address}, {order.vendor_city}, {order.vendor_state}
              </p>
            </div>

            <div className="sm:border-l border-slate-200 sm:pl-6 pt-3 sm:pt-0 border-t sm:border-t-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Delivery Destination & Terms</p>
              <p className="text-xs text-slate-800">
                <strong>Delivery Address:</strong> {order.delivery_address || order.vendor_delivery_address || order.vendor_billing_address}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Delivery Contact:</strong> {order.delivery_contact_person || order.vendor_contact} ({order.delivery_contact_number || order.vendor_mobile})
              </p>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Required Delivery Date:</strong> {order.required_delivery_date ? new Date(order.required_delivery_date).toLocaleDateString('en-IN') : 'Standard Delivery'}
              </p>
              <p className="text-xs text-slate-700 mt-1">
                <strong>Payment Terms:</strong> <span className="font-semibold text-slate-900">{order.payment_terms}</span>
              </p>
              {order.special_instructions && (
                <p className="text-xs text-amber-900 bg-amber-50 p-1.5 rounded mt-2 border border-amber-200">
                  <strong>Special Notes:</strong> {order.special_instructions}
                </p>
              )}
            </div>
          </div>

          {/* Product Items Table */}
          <div className="my-5 overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-xs min-w-[560px]">
              <thead>
                <tr className="bg-slate-900 text-white text-left">
                  <th className="py-2.5 px-3 border border-slate-700 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-16 text-center">Product Image</th>
                  <th className="py-2.5 px-3 border border-slate-700">Product Name</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-28">SKU</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-20 text-right">Quantity</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-16">Unit</th>
                  <th className="py-2.5 px-3 border border-slate-700 w-28 text-right">
                    {isNonGst ? 'Selling Rate' : 'Selling Rate (Incl. GST)'}
                  </th>
                  <th className="py-2.5 px-3 border border-slate-700 w-32 text-right">
                    {isNonGst ? 'Amount' : 'Amount (Incl. GST)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-2 px-3 border border-slate-300 text-center font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2 border border-slate-300 text-center">
                      <div className="w-12 h-12 mx-auto rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                        <img
                          src={item.product_image || 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80'}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=120&auto=format&fit=crop&q=80';
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 border border-slate-300 font-medium text-slate-900">
                      <span className="font-bold">{item.product_name}</span> {item.unit ? <span className="text-slate-700 font-semibold">– {item.unit}</span> : ''}
                      {item.notes && <span className="block text-[11px] text-slate-500 italic mt-0.5">{item.notes}</span>}
                    </td>
                    <td className="py-2 px-3 border border-slate-300 font-mono text-slate-600">{item.sku}</td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-bold text-slate-800">{item.quantity}</td>
                    <td className="py-2 px-3 border border-slate-300 text-slate-600">{item.unit}</td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-mono">{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 border border-slate-300 text-right font-mono font-semibold text-slate-900">{item.line_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Bank Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 my-4">
            {/* Left: Bank Information */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
              <p className="font-bold text-slate-800 mb-1 text-xs uppercase tracking-wide">Remittance & Bank Details</p>
              <div className="space-y-0.5 text-slate-700">
                <p><strong>Bank Name:</strong> {order.billing_company_bank || 'HDFC Bank Ltd'}</p>
                <p><strong>Account Name:</strong> {order.billing_company_name}</p>
                <p><strong>Account Number:</strong> {order.billing_company_account || '50200045892144'}</p>
                <p><strong>IFSC Code:</strong> {order.billing_company_ifsc || 'HDFC0000240'}</p>
                <p><strong>Branch:</strong> {order.billing_company_branch || 'Industrial Area Branch'}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200">
                <p className="text-[11px] text-slate-500">
                  {order.billing_company_terms || 'Goods once dispatched are covered under standard manufacturer warranty. Subject to city jurisdiction.'}
                </p>
              </div>
            </div>

            {/* Right: Calculations */}
            <div className="border border-slate-200 rounded-lg p-3 bg-white text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>{isNonGst ? 'Subtotal:' : 'Subtotal / Taxable Value (Excl. GST):'}</span>
                  <span className="font-mono font-semibold text-slate-900">₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{isNonGst ? 'GST:' : 'GST @18% (CGST 9% + SGST 9%):'}</span>
                  <span className="font-mono">₹{order.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 font-bold text-sm text-slate-900">
                  <span>{isNonGst ? 'Grand Total:' : 'Grand Total (Incl. GST):'}</span>
                  <span className="font-mono text-base text-slate-900">₹{order.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-emerald-700 font-medium">
                  <span>Verified Amount Received:</span>
                  <span className="font-mono font-bold">₹{order.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-rose-700 font-bold bg-rose-50 p-1 rounded">
                  <span>Balance Payment:</span>
                  <span className="font-mono">₹{order.pending_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-2 gap-12 mt-10 pt-4 border-t border-slate-300 text-xs">
            <div className="text-center">
              <div className="h-12 border-b border-dashed border-slate-400"></div>
              <p className="mt-1 font-semibold text-slate-800">Customer Representative Signature & Rubber Stamp</p>
              <p className="text-[11px] text-slate-500">I hereby accept the order confirmation terms & quantities</p>
            </div>
            <div className="text-center">
              <div className="h-12 border-b border-dashed border-slate-400 flex items-center justify-center">
                <span className="text-xs text-slate-400 italic">For {order.billing_company_name}</span>
              </div>
              <p className="mt-1 font-semibold text-slate-800">Authorized Signatory / Plant Dispatch Head</p>
              <p className="text-[11px] text-slate-500">PetroFlow Operations Management System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
