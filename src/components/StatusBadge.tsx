import React from 'react';
import {
  OrderStatus, ProductionStatus, DispatchStatus, DeliveryStatus, PaymentStatus
} from '../types.js';

export const OrderStatusBadge: React.FC<{ status: OrderStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  const config: Record<OrderStatus, { bg: string; text: string; label: string; dot: string }> = {
    NEW: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'New', dot: 'bg-blue-500' },
    ACCEPTED: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', label: 'Approved', dot: 'bg-indigo-500' },
    APPROVED: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', label: 'Approved', dot: 'bg-indigo-500' },
    PROCESSING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Packing', dot: 'bg-amber-500' },
    PACKING: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Packing', dot: 'bg-amber-500' },
    READY_FOR_DISPATCH: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Packing', dot: 'bg-amber-500' },
    OUT_FOR_DELIVERY: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Delivered', dot: 'bg-emerald-500' },
    DELIVERED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Delivered', dot: 'bg-emerald-500' },
    COMPLETED: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Delivered', dot: 'bg-emerald-500' },
    CANCELLED: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Cancelled', dot: 'bg-rose-500' },
  };

  const item = config[status] || { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-700', label: status, dot: 'bg-gray-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${item.bg} ${item.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
      {item.label}
    </span>
  );
};

export const ProductionStatusBadge: React.FC<{ status: ProductionStatus }> = ({ status }) => {
  const config: Record<ProductionStatus, { bg: string; text: string; label: string }> = {
    NOT_ASSIGNED: { bg: 'bg-gray-100 text-gray-700 border-gray-200', text: 'text-gray-600', label: 'Not Assigned' },
    ASSIGNED: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', label: 'Assigned' },
    IN_PRODUCTION: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', label: 'In Production' },
    PARTIALLY_PRODUCED: { bg: 'bg-orange-50 text-orange-700 border-orange-200', text: 'text-orange-700', label: 'Partially Produced' },
    PRODUCTION_COMPLETED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', label: 'Prod. Completed' },
  };

  const item = config[status] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', text: 'text-gray-600', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg}`}>
      {item.label}
    </span>
  );
};

export const DispatchStatusBadge: React.FC<{ status: DispatchStatus }> = ({ status }) => {
  const config: Record<DispatchStatus, { bg: string; label: string }> = {
    NOT_DISPATCHED: { bg: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Not Dispatched' },
    PARTIALLY_DISPATCHED: { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', label: 'Partially Dispatched' },
    FULLY_DISPATCHED: { bg: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Fully Dispatched' },
  };

  const item = config[status] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg}`}>
      {item.label}
    </span>
  );
};

export const DeliveryStatusBadge: React.FC<{ status: DeliveryStatus }> = ({ status }) => {
  const config: Record<DeliveryStatus, { bg: string; label: string }> = {
    PENDING: { bg: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Pending' },
    OUT_FOR_DELIVERY: { bg: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Out for Delivery' },
    PARTIALLY_DELIVERED: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Partially Delivered' },
    DELIVERED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Delivered' },
  };

  const item = config[status] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg}`}>
      {item.label}
    </span>
  );
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const config: Record<PaymentStatus, { bg: string; label: string }> = {
    UNPAID: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Unpaid' },
    ADVANCE_RECEIVED: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Advance Received' },
    PARTIALLY_PAID: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Partially Paid' },
    FULLY_PAID: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Fully Paid' },
  };

  const item = config[status] || { bg: 'bg-gray-100 text-gray-600 border-gray-200', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg}`}>
      {item.label}
    </span>
  );
};
