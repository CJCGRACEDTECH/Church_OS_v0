export type AttendanceType = "regular_service" | "discipleship";
export type SessionStatus = "upcoming" | "active" | "closed";
export type AttendanceStatus = "present" | "absent" | "excused" | "late";
export type CompletionStatus = "attended" | "missed";

export type AttendanceSession = {
  id: number;
  attendanceType: AttendanceType;
  serviceEventId: number | null;
  sessionName: string;
  sessionDate: string;
  startTime: string | null;
  location: string | null;
  discipleshipGroup: string | null;
  teacherLeader: string | null;
  lessonTopic: string | null;
  qrToken: string;
  qrEnabled: boolean;
  qrExpiration: string;
  sessionStatus: SessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: number;
  sessionId: number;
  memberId: number;
  memberName: string | null;
  memberEmail: string | null;
  attendanceStatus: AttendanceStatus;
  checkinSource: "manual_admin" | "qr_self_checkin";
  checkinTime: string;
  checkedInByUserId: number | null;
  notes: string | null;
  completionStatus: CompletionStatus | null;
  followUpNeeded: boolean;
};

export type AttendanceMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
};

export { apiJson } from "@/lib/api";

export function labelize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
