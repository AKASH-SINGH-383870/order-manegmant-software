export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  role_slug: string;
  mobile?: string;
  employee_id?: string;
  avatar_url?: string;
  status: 'active' | 'inactive';
  permissions: string[];
  created_at?: string;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  logo_url: string;
  gst_number: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string;
  email: string;
  bank_name: string;
  account_no: string;
  ifsc_code: string;
  branch: string;
  terms?: string;
  status?: string;
}

export interface Brand {
  id: number;
  name: string;
  description?: string;
  status: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  status: string;
}

export interface Product {
  id: number;
  name: string;
  brand_id: number;
  brand_name?: string;
  category_id: number;
  category_name?: string;
  sku: string;
  unit: string;
  min_order_qty: number;
  standard_rate: number;
  description?: string;
  image_url?: string;
  status: string;
  item_colour?: string;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  company_name: string;
  contact_person: string;
  mobile: string;
  alt_mobile?: string;
  email?: string;
  gstin?: string;
  billing_address: string;
  delivery_address?: string;
  city: string;
  state: string;
  pincode?: string;
  assigned_sales_person_id: number;
  sales_person_name?: string;
  sales_person_mobile?: string;
  status: string;
  notes?: string;
  created_by_id?: number;
  created_by_name?: string;
  created_at?: string;
  updated_by_id?: number;
  updated_by_name?: string;
  updated_at?: string;
  total_orders?: number;
  total_order_value?: number;
  amount_received?: number;
  pending_amount?: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  quantity: number;
  produced_quantity: number;
  dispatched_quantity: number;
  delivered_quantity: number;
  rate: number;
  line_amount: number;
  notes?: string;
  brand_name?: string;
  category_name?: string;
  product_image?: string;
  item_colour?: string;
  item_availability?: string;
}

export interface ProductionRecord {
  id: number;
  order_id: number;
  order_item_id: number;
  product_name?: string;
  sku?: string;
  batch_number: string;
  produced_quantity: number;
  production_date: string;
  operator_name?: string;
  logged_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface Dispatch {
  id: number;
  dispatch_number: string;
  order_id: number;
  dispatch_date: string;
  transport_name: string;
  transport_contact?: string;
  vehicle_number: string;
  lr_number?: string;
  tracking_number?: string;
  driver_name?: string;
  driver_mobile?: string;
  dispatch_quantity: number;
  dispatched_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface Delivery {
  id: number;
  order_id: number;
  dispatch_id?: number;
  delivery_date: string;
  delivered_quantity: number;
  received_by: string;
  receiver_mobile?: string;
  pod_url?: string;
  logged_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  payment_number: string;
  order_id: number;
  order_number?: string;
  vendor_name?: string;
  company_name?: string;
  billing_company_name?: string;
  sales_person_name?: string;
  total_order_amount?: number;
  pending_amount?: number;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string;
  proof_url?: string;
  status?: string;
  rejection_reason?: string;
  notes?: string;
  is_verified: number;
  received_by_id: number;
  received_by_name?: string;
  verified_by_id?: number;
  verified_by_name?: string;
  verified_at?: string;
  updated_by_id?: number;
  updated_by_name?: string;
  updated_at?: string;
  created_at: string;
}

export interface OrderStatusHistoryItem {
  id: number;
  order_id: number;
  stage_name: string;
  previous_status?: string;
  new_status: string;
  notes?: string;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  role_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id?: number;
  role_slug?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  order_id?: number;
  is_read: number;
  created_at: string;
}

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PACKING'
  | 'READY_FOR_DISPATCH'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProductionStatus =
  | 'NOT_ASSIGNED'
  | 'ASSIGNED'
  | 'IN_PRODUCTION'
  | 'PARTIALLY_PRODUCED'
  | 'PRODUCTION_COMPLETED';

export type DispatchStatus =
  | 'NOT_DISPATCHED'
  | 'PARTIALLY_DISPATCHED'
  | 'FULLY_DISPATCHED';

export type DeliveryStatus =
  | 'PENDING'
  | 'OUT_FOR_DELIVERY'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED';

export type PaymentStatus =
  | 'UNPAID'
  | 'ADVANCE_RECEIVED'
  | 'PARTIALLY_PAID'
  | 'FULLY_PAID';

export interface Order {
  id: number;
  order_number: string;
  company_id: number;
  billing_company_name?: string;
  billing_company_code?: string;
  billing_company_logo?: string;
  billing_company_gst?: string;
  billing_company_address?: string;
  billing_company_city?: string;
  billing_company_state?: string;
  billing_company_pincode?: string;
  billing_company_mobile?: string;
  billing_company_email?: string;
  billing_company_bank?: string;
  billing_company_account?: string;
  billing_company_ifsc?: string;
  billing_company_branch?: string;
  billing_company_terms?: string;

  vendor_id: number;
  vendor_name: string;
  vendor_contact?: string;
  vendor_mobile?: string;
  vendor_email?: string;
  vendor_gstin?: string;
  vendor_billing_address?: string;
  vendor_delivery_address?: string;
  vendor_city?: string;
  vendor_state?: string;
  vendor_pincode?: string;

  sales_person_id: number;
  sales_person_name: string;
  sales_person_email?: string;
  sales_person_mobile?: string;

  order_status: OrderStatus;
  packing_status?: string;
  delivered_by_name?: string;
  production_status: ProductionStatus;
  dispatch_status: DispatchStatus;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;

  payment_terms: string;
  tax_type?: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  amount_received: number;
  pending_amount: number;

  required_delivery_date?: string;
  delivery_address?: string;
  delivery_contact_person?: string;
  delivery_contact_number?: string;
  special_instructions?: string;
  notes?: string;

  cancellation_reason?: string;
  cancelled_by_id?: number;
  cancelled_at?: string;

  assigned_to_production_at?: string;
  production_completed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  completed_at?: string;
  completed_by_id?: number;

  created_by_id: number;
  created_at: string;
  updated_at: string;
  updated_by_id?: number;
  updated_by_name?: string;

  // Aggregate fields
  item_count?: number;
  total_quantity?: number;
  total_produced?: number;
  total_dispatched?: number;
  total_delivered?: number;
  products_summary?: string;
  items?: OrderItem[];
}

export interface Bill {
  id: number;
  order_id: number;
  order_number: string;
  invoice_number: string;
  order_date: string;
  invoice_date: string;
  party_id: number;
  party_name: string;
  party_contact?: string;
  party_city?: string;
  party_state?: string;
  party_address?: string;
  party_gstin?: string;
  party_mobile?: string;
  party_email?: string;
  company_id: number;
  company_name: string;
  company_code?: string;
  company_gstin?: string;
  company_pan?: string;
  company_address?: string;
  company_city?: string;
  company_state?: string;
  company_pincode?: string;
  company_mobile?: string;
  company_email?: string;
  company_bank?: string;
  company_account?: string;
  company_ifsc?: string;
  company_branch?: string;
  company_terms?: string;
  sales_person_id: number;
  sales_person_name: string;
  sales_person_mobile?: string;
  sales_person_email?: string;
  tax_type: 'GST_18' | 'NON_GST' | string;
  bill_amount: number;
  taxable_amount: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  tax_rate: number;
  received_amount: number;
  balance_payment: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID' | string;
  order_status: string;
  payment_terms?: string;
  notes?: string;
  created_at: string;
  item_count?: number;
  total_quantity?: number;
  products_summary?: string;
  items?: OrderItem[];
  payments?: Payment[];
}

