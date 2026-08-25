// ---------- Auth ----------
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; login: string; mustChangePassword: boolean };
}

export interface AuthUser {
  id: string;
  login: string;
  mustChangePassword: boolean;
}

export interface ChangePasswordResponse {
  success: boolean;
  reloginRequired: boolean;
}

// ---------- Settings ----------
export type IntegrationVerifyStatus = 'unverified' | 'success' | 'failed';

export interface SettingsData {
  id: string;
  domain: string;
  host: string;
  tokenLast4: string | null;
  verifyStatus: IntegrationVerifyStatus;
  verifyMessage: string | null;
  verifiedAccountId: string | null;
  verifiedAccountName: string | null;
  verifiedRegions: string[] | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyResult {
  verified: boolean;
  message: string;
  code?: string;
  details?: unknown;
  account?: {
    id: number | null;
    name: string | null;
    mediaserverRegions: string[] | null;
  };
  settings?: SettingsData;
}

// ---------- Campaigns ----------
export interface Campaign {
  id: number;
  title: string;
  status: string;
}

// ---------- Schedules ----------
export interface WeekdayEntry {
  id: string;
  weekday: number;
  isActive: boolean;
}

export interface WorkInterval {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface BreakInterval {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string | null;
}

export interface ScheduleException {
  id: string;
  startDate: string;
  endDate: string;
  type: 'day_off' | 'custom_working_hours';
  customStartTime: string | null;
  customEndTime: string | null;
  title: string | null;
  isRecurringYearly: boolean;
}

export interface RuntimeStateEntry {
  currentState: 'paused' | 'resumed' | 'unknown';
  lastDecisionReason: string | null;
  lastTransitionAt: string | null;
  lastCheckAt: string | null;
}

export interface Schedule {
  id: string;
  name: string;
  campaignId: string;
  campaignTitle: string;
  campaign_actual_status: 'draft' | 'scheduled' | 'paused' | 'ongoing' | 'completed' | null;
  campaignTimezone: string;
  isEnabled: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  purgeAt: string | null;
  remainingSeconds: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  weekdays: WeekdayEntry[];
  workIntervals: WorkInterval[];
  breakIntervals: BreakInterval[];
  exceptions: ScheduleException[];
  runtimeState: RuntimeStateEntry | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Create DTO ----------
export interface TimeIntervalPayload {
  weekday: number;
  startTime: string;
  endTime: string;
  label?: string;
}

export interface ExceptionPayload {
  startDate: string;
  endDate: string;
  type: 'day_off' | 'custom_working_hours';
  customStartTime?: string;
  customEndTime?: string;
  title?: string;
  isRecurringYearly?: boolean;
}

export interface CreateSchedulePayload {
  name: string;
  campaignId: number;
  campaignTitle: string;
  campaignTimezone?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isEnabled?: boolean;
  weekdays: number[];
  workIntervals: TimeIntervalPayload[];
  breakIntervals?: TimeIntervalPayload[];
  exceptions?: ExceptionPayload[];
}

export interface UpdateScheduleResponse {
  schedule: Schedule;
  scheduler: {
    resynced: boolean;
    result: {
      changed: boolean;
      state: 'paused' | 'resumed' | 'unknown';
      reason: string;
    };
  };
}

// ---------- Logs ----------
export type LogSource = 'manual' | 'scheduler' | 'system';
export type LogAction =
  | 'pause'
  | 'resume'
  | 'verify_integration'
  | 'edit_schedule'
  | 'activate_schedule'
  | 'deactivate_schedule'
  | 'delete_schedule'
  | 'restore_schedule'
  | 'auto_delete_schedule';
export type LogStatus = 'success' | 'error';

export interface LogEntry {
  id: string;
  source: LogSource;
  action: LogAction;
  status: LogStatus;
  campaignId: string;
  campaignTitle: string | null;
  httpStatus: number | null;
  requestId: string | null;
  errorMessage: string | null;
  responsePayload: unknown;
  createdAt: string;
}
