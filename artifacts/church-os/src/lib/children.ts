export type Guardian = {
  id: number;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  relationship: "parent" | "guardian" | "emergency_contact";
  authorizedPickup: boolean;
};

export type DocumentCategory = "medication_consent" | "photo_consent" | "event_permission" | "medical" | "other";

export type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  allergyInformation: string | null;
  medicalNotes: string | null;
  specialInstructions: string | null;
  classroom: string | null;
  isVisitor: boolean;
  hasSpecialNeeds: boolean;
  registeredAt: string;
  openIncidentCount: number;
  missingDocuments: DocumentCategory[];
  checkinStatus: "checked_in" | "checked_out";
  guardians: Guardian[];
  activeCheckIn: {
    id: number;
    checkinTime: string;
    classroom: string | null;
    checkedInByUserId: number;
  } | null;
};

export type Classroom = {
  id: number;
  name: string;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  isSpecialNeeds: boolean;
  sortOrder: number;
};

export type Incident = {
  id: number;
  childId: number;
  childName: string;
  occurredAt: string;
  classroom: string | null;
  description: string;
  actionTaken: string | null;
  status: "open" | "resolved";
  reportedByName: string;
  resolutionNotes: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
};

export type ChildDocument = {
  id: number;
  category: DocumentCategory;
  title: string;
  permissionSlipId: number | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByName: string;
};

export type PermissionSlip = {
  id: number;
  title: string;
  eventDate: string | null;
  notes: string | null;
  createdAt: string;
  returnedChildIds: number[];
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  medication_consent: "Medication consent",
  photo_consent: "Photo consent",
  event_permission: "Event permission slip",
  medical: "Medical / allergy form",
  other: "Other",
};

/** Children registered within this many days count as "new". */
export const NEW_CHILD_DAYS = 30;

export function childName(child: Pick<Child, "firstName" | "lastName">) {
  return `${child.firstName} ${child.lastName}`;
}

export function isNewChild(child: Child, now = Date.now()) {
  return now - new Date(child.registeredAt).getTime() <= NEW_CHILD_DAYS * 24 * 60 * 60 * 1000;
}

export function ageFromDateOfBirth(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/**
 * Picks the classroom a child belongs in: the special-needs room when the child
 * has special needs, otherwise the first room whose age range includes the child.
 */
export function suggestClassroom(classrooms: Classroom[], age: number | null, hasSpecialNeeds: boolean): Classroom | null {
  if (hasSpecialNeeds) {
    const specialNeedsRoom = classrooms.find((classroom) => classroom.isSpecialNeeds);
    if (specialNeedsRoom) return specialNeedsRoom;
  }
  if (age === null) return null;
  return classrooms.find((classroom) =>
    !classroom.isSpecialNeeds
    && (classroom.minAgeYears === null || age >= classroom.minAgeYears)
    && (classroom.maxAgeYears === null || age <= classroom.maxAgeYears),
  ) ?? null;
}

export function classroomAgeLabel(classroom: Classroom) {
  if (classroom.isSpecialNeeds) return "Special needs, any age";
  const { minAgeYears: min, maxAgeYears: max } = classroom;
  if (min !== null && max !== null) return `Ages ${min}–${max}`;
  if (min !== null) return `Ages ${min}+`;
  if (max !== null) return `Up to age ${max}`;
  return "Any age";
}
