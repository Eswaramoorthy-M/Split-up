export type SplitType = 'equal' | 'unequal' | 'percentage'
export type MemberRole = 'admin' | 'member'
export type CycleStatus = 'open' | 'closed'
export type SettlementStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled' | 'rejected'
export type PaymentMethod = 'manual' | 'upi'

export interface Profile {
  id: string
  name: string
  email: string
  mobile: string | null
  upi_id: string | null
  profile_image: string | null
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  group_code: string
  group_name: string
  description: string | null
  currency: string
  default_split_method: SplitType
  created_by: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  is_active: boolean
  profile?: Profile
}

export interface Category {
  id: string
  group_id: string | null
  name: string
  icon: string
  is_default: boolean
  is_active: boolean
}

export interface MonthlyCycle {
  id: string
  group_id: string
  year: number
  month: number
  status: CycleStatus
  closed_at: string | null
  created_at: string
}

export interface Expense {
  id: string
  group_id: string
  monthly_cycle_id: string
  description: string
  amount: number
  category_id: string | null
  paid_by_user_id: string
  expense_date: string
  notes: string | null
  receipt_path: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_deleted: boolean
  category?: Category
  paid_by?: Profile
  creator?: Profile
  cycle?: Pick<MonthlyCycle, 'id' | 'status'>
  participants?: ExpenseParticipant[]
}

export interface ExpenseParticipant {
  id: string
  expense_id: string
  user_id: string
  split_type: SplitType
  amount: number
  percentage: number | null
  profile?: Profile
}

export interface Settlement {
  id: string
  group_id: string
  monthly_cycle_id: string | null
  from_user_id: string
  to_user_id: string
  amount: number
  status: SettlementStatus
  payment_method: PaymentMethod
  upi_id_used: string | null
  created_at: string
  paid_at: string | null
  confirmed_at: string | null
  rejected_at: string | null
  from_profile?: Profile
  to_profile?: Profile
}

export interface AppNotification {
  id: string
  user_id: string
  group_id: string | null
  type: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export interface GroupBalance {
  user_id: string
  name: string
  profile_image: string | null
  total_paid: number
  total_share: number
  net_balance: number
}

export interface SettlementSuggestion {
  from_user: string
  from_name: string
  to_user: string
  to_name: string
  amount: number
}

export interface CycleInfo {
  id: string
  year: number
  month: number
  status: CycleStatus
  label: string
}
