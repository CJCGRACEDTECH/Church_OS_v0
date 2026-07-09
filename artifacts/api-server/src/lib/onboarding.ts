type CompletionProfile = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhoneNumber?: string | null;
};

const PROFILE_COMPLETION_FIELDS: Array<keyof CompletionProfile> = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "dateOfBirth",
  "gender",
  "streetAddress",
  "city",
  "state",
  "zipCode",
  "emergencyContactName",
  "emergencyContactPhoneNumber",
];

export function calculateProfileCompletionPercent(profile: CompletionProfile): number {
  const completed = PROFILE_COMPLETION_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  }).length;

  return Math.round((completed / PROFILE_COMPLETION_FIELDS.length) * 100);
}
