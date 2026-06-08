import { and, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export function isDiscipleMember(smallGroup: string | null, ministryDepartment: string | null) {
  const smallGroupText = smallGroup?.toLowerCase() ?? "";
  return smallGroupText.includes("[disciple]") || smallGroupText.trim() === "friday discipleship";
}

export async function getDiscipleMembers(churchId: number) {
  const members = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    smallGroup: usersTable.smallGroup,
    ministryDepartment: usersTable.ministryDepartment,
  }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member")));

  return members.filter((member) => isDiscipleMember(member.smallGroup, member.ministryDepartment));
}
