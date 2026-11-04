/**
 * End-to-end test of Children Ministry against a running API server.
 *
 * Signs in as the seeded demo accounts (dev only) and walks every flow:
 * permissions per role, classrooms, registration, check-in/out with pickup
 * codes, labels, incidents, documents, and permission slips. Everything it
 * creates is tagged with the last name "E2E-Test" and removed at the end.
 *
 * Requires: dev seed loaded, API running with NODE_ENV=development and no
 * Clerk keys (demo sign-in).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run test:e2e:children
 *   API_URL=http://localhost:8080 pnpm --filter @workspace/scripts run test:e2e:children
 */
import { eq, inArray } from "drizzle-orm";
import {
  checkinRecordsTable,
  childDocumentsTable,
  childGuardianRelationshipsTable,
  childIncidentsTable,
  childPermissionSlipsTable,
  childrenClassroomsTable,
  childrenTable,
  db,
  parentGuardiansTable,
  pool,
} from "@workspace/db";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run end-to-end tests against production.");
  process.exit(1);
}

const API = `${process.env.API_URL ?? "http://localhost:8080"}/api`;
const TEST_LAST_NAME = "E2E-Test";
const TEST_CLASSROOM = "E2E Room";
const TEST_SLIP = "E2E Field Trip";

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

type Response<T = any> = { status: number; body: T; headers: Headers; raw?: ArrayBuffer };

async function call<T = any>(token: string | null, method: string, path: string, body?: unknown, init?: { contentType?: string; raw?: boolean }): Promise<Response<T>> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: Uint8Array | string | undefined;
  if (body instanceof Uint8Array) {
    headers["content-type"] = init?.contentType ?? "application/octet-stream";
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  if (init?.raw) {
    const raw = await response.arrayBuffer();
    return { status: response.status, body: null as T, headers: response.headers, raw };
  }
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: response.status, body: parsed as T, headers: response.headers };
}

async function signIn(email: string): Promise<string> {
  const response = await call<{ token: string }>(null, "POST", "/auth/demo-login", { email });
  if (response.status !== 200) throw new Error(`Demo sign-in failed for ${email} (${response.status}). Is the API running in development without Clerk keys?`);
  return response.body.token;
}

async function cleanup() {
  const children = await db.select({ id: childrenTable.id }).from(childrenTable).where(eq(childrenTable.lastName, TEST_LAST_NAME));
  const childIds = children.map((child) => child.id);
  if (childIds.length > 0) {
    await db.delete(childDocumentsTable).where(inArray(childDocumentsTable.childId, childIds));
    await db.delete(childIncidentsTable).where(inArray(childIncidentsTable.childId, childIds));
    await db.delete(checkinRecordsTable).where(inArray(checkinRecordsTable.childId, childIds));
    const relationships = await db
      .select({ guardianId: childGuardianRelationshipsTable.guardianId })
      .from(childGuardianRelationshipsTable)
      .where(inArray(childGuardianRelationshipsTable.childId, childIds));
    await db.delete(childGuardianRelationshipsTable).where(inArray(childGuardianRelationshipsTable.childId, childIds));
    const guardianIds = relationships.map((row) => row.guardianId);
    if (guardianIds.length > 0) await db.delete(parentGuardiansTable).where(inArray(parentGuardiansTable.id, guardianIds));
    await db.delete(childrenTable).where(inArray(childrenTable.id, childIds));
  }
  const slips = await db.select({ id: childPermissionSlipsTable.id }).from(childPermissionSlipsTable).where(eq(childPermissionSlipsTable.title, TEST_SLIP));
  if (slips.length > 0) {
    const slipIds = slips.map((slip) => slip.id);
    await db.delete(childDocumentsTable).where(inArray(childDocumentsTable.permissionSlipId, slipIds));
    await db.delete(childPermissionSlipsTable).where(inArray(childPermissionSlipsTable.id, slipIds));
  }
  for (const name of [TEST_CLASSROOM, `${TEST_CLASSROOM} Renamed`]) {
    await db.delete(childrenClassroomsTable).where(eq(childrenClassroomsTable.name, name));
  }
}

async function run() {
  await cleanup();

  const leader = await signIn("admin2@churchos.test");
  const helper = await signIn("helper@churchos.test");
  const member = await signIn("member@churchos.test");
  const givingAdmin = await signIn("admin3@churchos.test");

  section("Access: people without Children Ministry permissions");
  check("signed-out request is rejected (401)", (await call(null, "GET", "/admin/checkin/children")).status === 401);
  check("member cannot open children list (403)", (await call(member, "GET", "/admin/checkin/children")).status === 403);
  check("giving-only admin cannot open children list (403)", (await call(givingAdmin, "GET", "/admin/checkin/children")).status === 403);

  section("Classrooms");
  const createdRoom = await call(leader, "POST", "/admin/children/classrooms", { name: TEST_CLASSROOM, minAgeYears: 7, maxAgeYears: 8 });
  check("leader creates a classroom", createdRoom.status === 201, createdRoom.body);
  const roomId: number = createdRoom.body?.classroom?.id;
  check("duplicate classroom name is refused (409)", (await call(leader, "POST", "/admin/children/classrooms", { name: TEST_CLASSROOM })).status === 409);
  check("min age above max age is refused (400)", (await call(leader, "POST", "/admin/children/classrooms", { name: "Bad Range", minAgeYears: 9, maxAgeYears: 4 })).status === 400);
  check("helper can read classrooms", (await call(helper, "GET", "/admin/children/classrooms")).status === 200);
  check("helper cannot create classrooms (403)", (await call(helper, "POST", "/admin/children/classrooms", { name: "Helper Room" })).status === 403);

  section("Registration");
  check("helper cannot register a child (403)", (await call(helper, "POST", "/admin/checkin/children", { firstName: "Nope", lastName: TEST_LAST_NAME, guardianName: "X" })).status === 403);
  check("registration without a guardian is refused (400)", (await call(leader, "POST", "/admin/checkin/children", { firstName: "Solo", lastName: TEST_LAST_NAME })).status === 400);
  check("registration without a name is refused (400)", (await call(leader, "POST", "/admin/checkin/children", { firstName: "", lastName: TEST_LAST_NAME, guardianName: "X" })).status === 400);

  const registered = await call(leader, "POST", "/admin/checkin/children", {
    firstName: "Abel",
    lastName: TEST_LAST_NAME,
    dateOfBirth: "2018-06-01",
    classroom: TEST_CLASSROOM,
    allergyInformation: "Peanuts",
    isVisitor: true,
    hasSpecialNeeds: "on",
    guardians: [
      { name: "Marta E2E-Test", phoneNumber: "555-0100", email: "marta@example.test", relationship: "parent", authorizedPickup: true },
      { name: "Not Allowed E2E-Test", phoneNumber: "555-0101", relationship: "emergency_contact", authorizedPickup: false },
    ],
  });
  check("leader registers a visiting child with two contacts", registered.status === 201, registered.body);
  const child = registered.body?.child;
  const childId: number = child?.id;
  check("child is flagged as visitor", child?.isVisitor === true);
  check("child is flagged as special needs", child?.hasSpecialNeeds === true);
  check("child with allergies is missing medication consent", JSON.stringify(child?.missingDocuments) === JSON.stringify(["medication_consent"]), child?.missingDocuments);
  const parent = child?.guardians?.find((guardian: any) => guardian.authorizedPickup);
  const notAllowed = child?.guardians?.find((guardian: any) => !guardian.authorizedPickup);
  check("both contacts saved, one authorized for pickup", Boolean(parent && notAllowed));

  const listed = await call(helper, "GET", "/admin/checkin/children");
  const listedChild = listed.body?.children?.find((row: any) => row.id === childId);
  check("helper sees the new child in the list with flags", listedChild?.isVisitor === true && listedChild?.hasSpecialNeeds === true);

  check("helper cannot edit a child (403)", (await call(helper, "PATCH", `/admin/checkin/children/${childId}`, { firstName: "Abel", lastName: TEST_LAST_NAME })).status === 403);
  const edited = await call(leader, "PATCH", `/admin/checkin/children/${childId}`, {
    firstName: "Abel",
    lastName: TEST_LAST_NAME,
    dateOfBirth: "2018-06-01",
    classroom: TEST_CLASSROOM,
    allergyInformation: "Peanuts",
    hasSpecialNeeds: true,
  });
  check("leader edits the child; unticked visitor box clears the flag", edited.status === 200 && edited.body?.child?.isVisitor === false, edited.body?.child);

  section("Classroom rename keeps children assigned");
  const renamed = await call(leader, "PATCH", `/admin/children/classrooms/${roomId}`, { name: `${TEST_CLASSROOM} Renamed`, minAgeYears: 7, maxAgeYears: 8 });
  check("leader renames the classroom", renamed.status === 200);
  const afterRename = (await call(leader, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("child moved to the renamed classroom", afterRename?.classroom === `${TEST_CLASSROOM} Renamed`, afterRename?.classroom);

  section("Move up");
  const yearsAgo = (years: number) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  };
  const guardian = [{ name: "Parent E2E-Test", phoneNumber: "555-0102", relationship: "parent", authorizedPickup: true }];
  const outgrew = await call(leader, "POST", "/admin/checkin/children", { firstName: "Bina", lastName: TEST_LAST_NAME, dateOfBirth: yearsAgo(9), classroom: "Toddlers", guardians: guardian });
  const placedEarly = await call(leader, "POST", "/admin/checkin/children", { firstName: "Caleb", lastName: TEST_LAST_NAME, dateOfBirth: yearsAgo(5), classroom: "Elementary", guardians: guardian });
  const outgrewId: number = outgrew.body?.child?.id;
  const placedEarlyId: number = placedEarly.body?.child?.id;
  check("9-year-old in Toddlers is suggested Elementary", outgrew.body?.child?.suggestedClassroom === "Elementary", outgrew.body?.child?.suggestedClassroom);
  check("5-year-old placed early in Elementary is left alone", placedEarly.body?.child?.suggestedClassroom === null, placedEarly.body?.child?.suggestedClassroom);
  const specialNeedsChild = (await call(leader, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("special-needs child outside the special needs room is suggested that room", specialNeedsChild?.suggestedClassroom === "Special Needs", specialNeedsChild?.suggestedClassroom);
  check("helper cannot move children up (403)", (await call(helper, "POST", "/admin/children/move-up", { childIds: [outgrewId] })).status === 403);
  check("move up with no children is refused (400)", (await call(leader, "POST", "/admin/children/move-up", { childIds: [] })).status === 400);
  const movedUp = await call(leader, "POST", "/admin/children/move-up", { childIds: [outgrewId, placedEarlyId] });
  check("leader moves up only the child who outgrew their room", movedUp.status === 200
    && movedUp.body?.moved?.length === 1
    && movedUp.body.moved[0].childId === outgrewId
    && movedUp.body.moved[0].from === "Toddlers"
    && movedUp.body.moved[0].to === "Elementary", movedUp.body);
  const afterMove = (await call(leader, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === outgrewId);
  check("moved child is in Elementary with no further suggestion", afterMove?.classroom === "Elementary" && afterMove?.suggestedClassroom === null, afterMove);

  section("Check-in and check-out");
  const checkIn = await call(helper, "POST", `/admin/checkin/children/${childId}/check-in`, {});
  const pickupCode: string = checkIn.body?.pickupCode;
  check("helper checks the child in and gets a 6-character pickup code", checkIn.status === 200 && /^[0-9A-F]{6}$/.test(pickupCode ?? ""), checkIn.body);
  check("checking in twice is refused (409)", (await call(helper, "POST", `/admin/checkin/children/${childId}/check-in`, {})).status === 409);

  const label = await call(helper, "GET", `/admin/checkin/children/${childId}/label`);
  check("label has the same pickup code, classroom and allergy", label.body?.label?.pickupCode === pickupCode
    && label.body?.label?.classroom === `${TEST_CLASSROOM} Renamed`
    && label.body?.label?.allergyInformation === "Peanuts", label.body);

  check("wrong pickup code is refused (403)", (await call(helper, "POST", `/admin/checkin/children/${childId}/check-out`, { guardianId: parent?.id, pickupCode: "000000" })).status === 403);
  check("contact not authorized for pickup is refused (403)", (await call(helper, "POST", `/admin/checkin/children/${childId}/check-out`, { guardianId: notAllowed?.id, pickupCode })).status === 403);
  check("missing pickup code is refused (400)", (await call(helper, "POST", `/admin/checkin/children/${childId}/check-out`, { guardianId: parent?.id })).status === 400);
  const checkOut = await call(helper, "POST", `/admin/checkin/children/${childId}/check-out`, { guardianId: parent?.id, pickupCode: pickupCode.toLowerCase() });
  check("authorized parent with the code checks the child out (code not case-sensitive)", checkOut.status === 200 && checkOut.body?.child?.checkinStatus === "checked_out", checkOut.body);
  check("label after check-out is refused (409)", (await call(helper, "GET", `/admin/checkin/children/${childId}/label`)).status === 409);

  check("helper cannot see check-in history (403)", (await call(helper, "GET", "/admin/checkin/history")).status === 403);
  const history = await call(leader, "GET", "/admin/checkin/history");
  const historyRow = history.body?.history?.find((row: any) => row.childId === childId);
  check("leader sees the visit in history with who picked up", historyRow?.status === "checked_out" && historyRow?.pickedUpByName === "Marta E2E-Test", historyRow);

  section("Accidental check-in correction");
  await call(helper, "POST", `/admin/checkin/children/${childId}/check-in`, {});
  check("helper cannot remove an accidental check-in (403)", (await call(helper, "DELETE", `/admin/checkin/children/${childId}/active-check-in`)).status === 403);
  const removed = await call(leader, "DELETE", `/admin/checkin/children/${childId}/active-check-in`);
  check("leader removes the accidental check-in", removed.status === 200 && removed.body?.child?.checkinStatus === "checked_out");

  section("Incidents");
  check("empty incident report is refused (400)", (await call(helper, "POST", `/admin/children/${childId}/incidents`, { description: " " })).status === 400);
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  check("incident time in the future is refused (400)", (await call(helper, "POST", `/admin/children/${childId}/incidents`, { description: "x", occurredAt: future })).status === 400);
  const reported = await call(helper, "POST", `/admin/children/${childId}/incidents`, { description: "Bumped head on a table corner.", actionTaken: "Ice pack." });
  check("helper reports an incident", reported.status === 201, reported.body);
  const incidentId: number = reported.body?.incidentId;
  const withIncident = (await call(helper, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("child now shows one open incident", withIncident?.openIncidentCount === 1, withIncident?.openIncidentCount);
  check("helper cannot read incident details (403)", (await call(helper, "GET", `/admin/children/incidents?childId=${childId}`)).status === 403);
  check("helper cannot close incidents (403)", (await call(helper, "POST", `/admin/children/incidents/${incidentId}/resolve`, { resolutionNotes: "x" })).status === 403);
  const leaderIncidents = await call(leader, "GET", `/admin/children/incidents?childId=${childId}`);
  check("leader reads the report, including who reported it", leaderIncidents.body?.incidents?.[0]?.reportedByName === "Teen Helper", leaderIncidents.body);
  check("closing without follow-up notes is refused (400)", (await call(leader, "POST", `/admin/children/incidents/${incidentId}/resolve`, { resolutionNotes: "" })).status === 400);
  const resolved = await call(leader, "POST", `/admin/children/incidents/${incidentId}/resolve`, { resolutionNotes: "Called Marta; she will watch for symptoms." });
  check("leader closes the incident with notes", resolved.status === 200);
  check("closing twice is refused (404)", (await call(leader, "POST", `/admin/children/incidents/${incidentId}/resolve`, { resolutionNotes: "again" })).status === 404);
  const cleared = (await call(helper, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("alert cleared after closing", cleared?.openIncidentCount === 0);

  section("Documents");
  const pdf = new TextEncoder().encode("%PDF-1.4\n% E2E consent form\n%%EOF\n");
  check("helper cannot upload documents (403)", (await call(helper, "POST", `/admin/children/${childId}/documents?category=medication_consent`, pdf, { contentType: "application/pdf" })).status === 403);
  check("unsupported file type is refused (415)", (await call(leader, "POST", `/admin/children/${childId}/documents?category=other`, new TextEncoder().encode("hi"), { contentType: "text/html" })).status === 415);
  check("missing category is refused (400)", (await call(leader, "POST", `/admin/children/${childId}/documents`, pdf, { contentType: "application/pdf" })).status === 400);
  check("empty file is refused (400)", (await call(leader, "POST", `/admin/children/${childId}/documents?category=other`, new Uint8Array(0), { contentType: "application/pdf" })).status === 400);
  const tooBig = new Uint8Array(10 * 1024 * 1024 + 1);
  check("file over 10 MB is refused (413)", (await call(leader, "POST", `/admin/children/${childId}/documents?category=other`, tooBig, { contentType: "application/pdf" })).status === 413);

  const uploaded = await call(leader, "POST", `/admin/children/${childId}/documents?category=medication_consent&title=${encodeURIComponent("Medication consent 2026")}&fileName=consent.pdf`, pdf, { contentType: "application/pdf" });
  check("leader uploads a medication consent", uploaded.status === 201, uploaded.body);
  const documentId: number = uploaded.body?.documentId;
  const consented = (await call(leader, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("missing medication consent flag is cleared", consented?.missingDocuments?.length === 0, consented?.missingDocuments);
  const file = await call(leader, "GET", `/admin/children/documents/${documentId}/file`, undefined, { raw: true });
  check("downloaded file matches what was uploaded", file.status === 200
    && file.headers.get("content-type") === "application/pdf"
    && Buffer.from(file.raw!).equals(Buffer.from(pdf)));
  check("helper cannot download documents (403)", (await call(helper, "GET", `/admin/children/documents/${documentId}/file`, undefined, { raw: true })).status === 403);

  section("Permission slips");
  check("slip without a title is refused (400)", (await call(leader, "POST", "/admin/children/permission-slips", { title: "" })).status === 400);
  const slip = await call(leader, "POST", "/admin/children/permission-slips", { title: TEST_SLIP, eventDate: "2026-12-12" });
  check("leader creates a permission slip", slip.status === 201);
  const slipId: number = slip.body?.permissionSlipId;
  check("event permission without a slip is refused (400)", (await call(leader, "POST", `/admin/children/${childId}/documents?category=event_permission`, pdf, { contentType: "application/pdf" })).status === 400);
  const beforeReturn = (await call(leader, "GET", "/admin/children/permission-slips")).body?.permissionSlips?.find((row: any) => row.id === slipId);
  check("child is not yet counted as returned", beforeReturn && !beforeReturn.returnedChildIds.includes(childId));
  const signedSlip = await call(leader, "POST", `/admin/children/${childId}/documents?category=event_permission&permissionSlipId=${slipId}&fileName=slip.pdf`, pdf, { contentType: "application/pdf" });
  check("leader uploads the signed slip", signedSlip.status === 201);
  const afterReturn = (await call(leader, "GET", "/admin/children/permission-slips")).body?.permissionSlips?.find((row: any) => row.id === slipId);
  check("child is now counted as returned", afterReturn?.returnedChildIds?.includes(childId), afterReturn);

  const deleted = await call(leader, "DELETE", `/admin/children/documents/${documentId}`);
  check("leader deletes the consent document", deleted.status === 200);
  const missingAgain = (await call(leader, "GET", "/admin/checkin/children")).body?.children?.find((row: any) => row.id === childId);
  check("missing medication consent flag returns", missingAgain?.missingDocuments?.includes("medication_consent"));

  section("Dashboard access");
  check("check-in helper is kept out of the main dashboard (403)", (await call(helper, "GET", "/admin/dashboard/summary")).status === 403);
  check("leader with directory access can open the dashboard", (await call(leader, "GET", "/admin/dashboard/summary")).status === 200);

  section("Cleanup");
  check("leader deletes the test classroom", (await call(leader, "DELETE", `/admin/children/classrooms/${roomId}`)).status === 200);
  await cleanup();
  const leftover = await db.select({ id: childrenTable.id }).from(childrenTable).where(eq(childrenTable.lastName, TEST_LAST_NAME));
  check("test data removed", leftover.length === 0);
}

run()
  .catch((error) => {
    failures.push(`crashed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
  })
  .finally(async () => {
    await cleanup().catch(() => undefined);
    await pool.end();
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length > 0) {
      for (const failure of failures) console.log(`  - ${failure}`);
      process.exit(1);
    }
  });
