import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { eventsTable } from "./events";
import { usersTable } from "./users";

export const attendanceSessionsTable = pgTable("attendance_sessions", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  attendanceType: text("attendance_type", { enum: ["regular_service", "discipleship"] }).notNull(),
  serviceEventId: integer("service_event_id").references(() => eventsTable.id),
  sessionName: text("session_name").notNull(),
  sessionDate: timestamp("session_date", { withTimezone: true }).notNull(),
  startTime: text("start_time"),
  location: text("location"),
  discipleshipGroup: text("discipleship_group"),
  teacherLeader: text("teacher_leader"),
  lessonTopic: text("lesson_topic"),
  qrToken: text("qr_token").notNull().unique(),
  qrEnabled: boolean("qr_enabled").notNull().default(true),
  qrExpiration: timestamp("qr_expiration", { withTimezone: true }).notNull(),
  sessionStatus: text("session_status", { enum: ["upcoming", "active", "closed"] }).notNull().default("upcoming"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const attendanceRecordsTable = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => attendanceSessionsTable.id),
    memberId: integer("member_id").notNull().references(() => usersTable.id),
    attendanceStatus: text("attendance_status", { enum: ["present", "absent", "excused", "late"] }).notNull().default("present"),
    checkinSource: text("checkin_source", { enum: ["manual_admin", "qr_self_checkin"] }).notNull().default("manual_admin"),
    checkinTime: timestamp("checkin_time", { withTimezone: true }).notNull().defaultNow(),
    checkedInByUserId: integer("checked_in_by_user_id").references(() => usersTable.id),
    notes: text("notes"),
    completionStatus: text("completion_status", { enum: ["attended", "missed", "make_up_needed"] }),
    followUpNeeded: boolean("follow_up_needed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("attendance_session_member_unique_idx").on(table.sessionId, table.memberId),
  ],
);

export const insertAttendanceSessionSchema = createInsertSchema(attendanceSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type AttendanceSession = typeof attendanceSessionsTable.$inferSelect;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
export type InsertAttendanceSession = z.infer<typeof insertAttendanceSessionSchema>;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
