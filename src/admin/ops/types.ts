// Shapes returned by /api/admin/bookings, /enquiries and /payments.
import type { BookingStatus, PayStatus, Stage } from "./status";

export type BookingRow = {
  id: string; ref: string; product_type: string; product_id: string | null; product_name: string; status: BookingStatus; payment_status: PayStatus;
  start_date: string; end_date: string | null; adults: number; children: number; infants: number; lead_name: string; lead_phone: string; lead_email: string | null;
  total_amount: number; paid_amount: number; currency_code: string; channel: string; payment_method: string | null; supplier_ref: string | null; created_at: string; image: string | null;
};

export type Traveller = {
  id: string; position: number; title: string | null; full_name: string; kind: "adult" | "child" | "infant"; date_of_birth: string | null;
  nationality: string | null; nationality_name: string | null; passport_no: string | null; passport_expiry: string | null; passport_status: "missing" | "received" | "verified";
};

export type Payment = {
  id: string; kind: "payment" | "refund"; method: string; provider: string | null; amount: number; currency_code: string; status: "pending" | "verified" | "rejected" | "failed";
  reference: string | null; slip_url: string | null; note: string | null; received_at: string; verified_at: string | null; paid_at: string | null; verified_by_name: string | null; created_by_name: string | null;
};

export type BookingEvent = { id: number; kind: string; message: string; created_at: string; user_name: string | null };

export type Booking = BookingRow & {
  product_snapshot: Record<string, unknown>; lead_cnic: string | null; lead_nationality: string | null; nationality_name: string | null;
  base_amount: number; tax_amount: number; fee_amount: number; discount_amount: number; supplier_cost?: number | null; supplier_name?: string | null; margin?: number | null;
  assigned_to: string | null; assigned_name: string | null; created_by_name: string | null; special_requests: string | null; internal_notes: string | null;
  cancellation_policy: string | null; cancel_reason: string | null; payment_due_at: string | null; cancelled_at: string | null; enquiry_id: string | null;
  product: { id: string; name: string; address: string | null; phone?: string | null; email?: string | null; check_in?: string | null; check_out?: string | null; destination: string | null; country: string | null } | null;
  travellers: Traveller[]; payments: Payment[]; events: BookingEvent[]; enquiry: { id: string; name: string; service: string; status: string } | null;
  can: { edit: boolean; verify: boolean; record: boolean; refund: boolean; voucher: boolean; invoice: boolean; seeCosts: boolean };
};

export type Enquiry = {
  id: string; service: string; ref_type: string | null; ref_id: string | null; name: string; email: string | null; phone: string; travel_date: string | null; travellers: number | null;
  message: string | null; status: Stage; channel: string; quote_amount: number | null; close_reason: string | null; assigned_to: string | null; booking_id: string | null;
  budget: number | null; follow_up_at: string | null; created_at: string; updated_at: string; assigned_name: string | null; booking_ref: string | null;
};
export type EnquiryDetail = Enquiry & {
  product: string | null; notes: { id: number; kind: string; body: string; created_at: string; user_name: string | null }[];
  can: { edit: boolean; convert: boolean };
};
