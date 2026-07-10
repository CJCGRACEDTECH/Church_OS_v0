import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiJson, labelize } from "@/lib/events";
import { AlertCircle, Inbox, Mail, MapPin, Phone, UserRound } from "lucide-react";

type HouseholdMember = {
  id: number;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  phoneNumber: string | null;
  profilePhotoUrl: string | null;
  relationship: string;
  memberStatus: string;
};

type HouseholdChild = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  classroom: string | null;
  checkinStatus: string;
  guardianName: string;
  guardianEmail: string | null;
  guardianPhoneNumber: string | null;
  relationship: "parent" | "guardian" | "emergency_contact";
  authorizedPickup: boolean;
};

type HouseholdResponse = {
  household: {
    primaryMember: {
      id: number;
      firstName: string;
      lastName: string;
      preferredName: string | null;
      email: string;
      phoneNumber: string | null;
      profilePhotoUrl: string | null;
    };
    address: {
      streetAddress: string | null;
      apartmentUnit: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
    };
    emergencyContact: {
      name: string | null;
      phoneNumber: string | null;
      relationship: string | null;
    };
    members: HouseholdMember[];
    children: HouseholdChild[];
  };
};

function fullName(person: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${person.preferredName || person.firstName} ${person.lastName}`;
}

function initials(person: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${person.preferredName?.[0] || person.firstName[0] || ""}${person.lastName[0] || ""}`;
}

function addressLine(address: HouseholdResponse["household"]["address"]) {
  const line1 = [address.streetAddress, address.apartmentUnit].filter(Boolean).join(", ");
  const line2 = [address.city, address.state, address.zipCode].filter(Boolean).join(", ");
  return [line1, line2, address.country].filter(Boolean).join("\n") || "No address on file";
}

export default function MemberHousehold() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestType, setRequestType] = React.useState("family_change");
  const [message, setMessage] = React.useState("");

  const householdQuery = useQuery({
    queryKey: ["member-household"],
    queryFn: () => apiJson<HouseholdResponse>("/member/household"),
  });

  const requestUpdate = useMutation({
    mutationFn: () => apiJson<{ request: { status: string } }>("/member/household/update-request", {
      method: "POST",
      body: JSON.stringify({ requestType, message }),
    }),
    onSuccess: () => {
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["member-household"] });
      toast({
        title: "Request submitted",
        description: "An admin can review the household update before changing official records.",
      });
    },
    onError: (error) => {
      toast({
        title: "Request not submitted",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const household = householdQuery.data?.household;

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
                <Inbox className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Member Request Center</p>
                <h1 className="truncate text-2xl font-semibold tracking-tight">Request Center</h1>
                <p className="truncate text-sm text-muted-foreground">Household info, children ministry links, and submit requests to the church office.</p>
              </div>
            </div>
          </div>
        </section>

        {householdQuery.isLoading ? (
          <Card className="border-blue-100 bg-blue-50/45 shadow-sm">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading household information...</CardContent>
          </Card>
        ) : household ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
                  <div className="h-1 bg-amber-400" />
                  <CardHeader>
                    <CardTitle>Household Members</CardTitle>
                    <CardDescription>Family connections currently visible to your member account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PersonRow
                      person={household.primaryMember}
                      label="You"
                      meta={household.primaryMember.email}
                    />
                    {household.members.map((member) => (
                      <PersonRow
                        key={member.id}
                        person={member}
                        label={member.relationship || "Household"}
                        meta={member.email}
                        secondary={member.phoneNumber}
                      />
                    ))}
                    {!household.members.length && (
                      <div className="rounded-lg border border-blue-100 bg-white/75 p-4 text-sm text-muted-foreground">
                        No other member records are currently linked to your household.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
                  <div className="h-1 bg-blue-500" />
                  <CardHeader>
                    <CardTitle>Children Ministry</CardTitle>
                    <CardDescription>Linked children and pickup authorization status.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {household.children.map((child) => (
                      <div key={child.id} className="rounded-lg border border-blue-100 bg-white/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="h-11 w-11 border border-blue-200 bg-white">
                              {child.profilePhotoUrl && <AvatarImage src={child.profilePhotoUrl} alt={`${child.firstName} ${child.lastName}`} />}
                              <AvatarFallback className="bg-transparent text-primary">{initials(child)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{child.firstName} {child.lastName}</p>
                              <p className="text-sm text-muted-foreground">{child.classroom ?? "No classroom"} · {labelize(child.relationship)}</p>
                            </div>
                          </div>
                          <Badge variant={child.authorizedPickup ? "secondary" : "outline"}>
                            {child.authorizedPickup ? "Pickup OK" : "No pickup"}
                          </Badge>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                          <p>Guardian: <span className="text-foreground">{child.guardianName}</span></p>
                          <p>Status: <span className="text-foreground">{labelize(child.checkinStatus)}</span></p>
                        </div>
                      </div>
                    ))}
                    {!household.children.length && (
                      <div className="rounded-lg border border-blue-100 bg-white/75 p-4 text-sm text-muted-foreground md:col-span-2">
                        No children ministry records are linked to this account yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
                  <div className="h-1 bg-blue-500" />
                  <CardHeader>
                    <CardTitle>Household Contact</CardTitle>
                    <CardDescription>Primary address and emergency contact on your member profile.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InfoBox icon={MapPin} label="Address" value={addressLine(household.address)} multiline />
                    <InfoBox icon={UserRound} label="Emergency Contact" value={household.emergencyContact.name ?? "Not provided"} />
                    <InfoBox icon={Phone} label="Emergency Phone" value={household.emergencyContact.phoneNumber ?? "Not provided"} />
                    <InfoBox icon={Mail} label="Relationship" value={household.emergencyContact.relationship ?? "Not provided"} />
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
                  <div className="h-1 bg-amber-400" />
                  <CardHeader>
                    <CardTitle>Submit a Request</CardTitle>
                    <CardDescription>Prayer, meeting, family, or pickup requests go straight to the church office.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Request Type</Label>
                      <select
                        value={requestType}
                        onChange={(event) => setRequestType(event.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="prayer_request">Prayer request</option>
                        <option value="meeting_request">Meeting request</option>
                        <option value="family_change">Family / household change</option>
                        <option value="pickup_authorization">Pickup authorization</option>
                        <option value="contact_update">Contact information</option>
                        <option value="child_link">Link or unlink child</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Details</Label>
                      <Textarea
                        rows={5}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Tell the church office what needs to be updated."
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={requestUpdate.isPending || !message.trim()}
                      onClick={() => requestUpdate.mutate()}
                    >
                      {requestUpdate.isPending ? "Submitting..." : "Submit Update Request"}
                    </Button>
                    <div className="flex gap-2 rounded-lg border border-amber-100 bg-white/75 p-3 text-sm text-muted-foreground">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>Admins manage official family relationships and child pickup permissions for safety.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card className="border-blue-100 bg-blue-50/45 shadow-sm">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">Household information could not be loaded.</CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}

function PersonRow({
  person,
  label,
  meta,
  secondary,
}: {
  person: { firstName: string; lastName: string; preferredName?: string | null; profilePhotoUrl?: string | null };
  label: string;
  meta: string;
  secondary?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-100 bg-white/75 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-11 w-11 border border-blue-200 bg-white">
          {person.profilePhotoUrl && <AvatarImage src={person.profilePhotoUrl} alt={fullName(person)} />}
          <AvatarFallback className="bg-transparent text-primary">{initials(person)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{fullName(person)}</p>
          <p className="truncate text-sm text-muted-foreground">{meta}</p>
          {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
        </div>
      </div>
      <Badge variant="outline" className="shrink-0 border-amber-200 bg-white text-amber-800">{label}</Badge>
    </div>
  );
}

function InfoBox({
  icon: Icon,
  label,
  value,
  multiline = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white/75 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className={`mt-2 text-sm text-muted-foreground ${multiline ? "whitespace-pre-line" : ""}`}>{value}</p>
    </div>
  );
}
