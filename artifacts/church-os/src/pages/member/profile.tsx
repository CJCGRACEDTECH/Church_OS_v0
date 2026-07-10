import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  getGetMeQueryKey,
  useChangePassword,
  useUpdateProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isProfilePhotoValue, readProfilePhotoFile } from "@/lib/profile-photo";
import {
  BriefcaseBusiness,
  CalendarDays,
  Church,
  Contact,
  Globe2,
  HeartHandshake,
  KeyRound,
  Languages,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  preferredName: z.string().trim().optional(),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().trim().optional(),
  profilePhotoUrl: z.string().trim().refine(isProfilePhotoValue, "Use a valid image URL or image file").optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().trim().optional(),
  maritalStatus: z.string().trim().optional(),
  occupation: z.string().trim().optional(),
  preferredLanguage: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhoneNumber: z.string().trim().optional(),
  streetAddress: z.string().trim().optional(),
  apartmentUnit: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Use at least 8 characters"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return new Date(normalized).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function valueOrFallback(value?: string | null, fallback = "Not provided") {
  return value?.trim() || fallback;
}

export default function MemberProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const [editOpen, setEditOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      preferredName: user?.preferredName ?? "",
      email: user?.email ?? "",
      phoneNumber: user?.phoneNumber ?? "",
      profilePhotoUrl: user?.profilePhotoUrl ?? "",
      dateOfBirth: user?.dateOfBirth ?? "",
      gender: user?.gender ?? "",
      maritalStatus: user?.maritalStatus ?? "",
      occupation: user?.occupation ?? "",
      preferredLanguage: user?.preferredLanguage ?? "",
      emergencyContactName: user?.emergencyContactName ?? "",
      emergencyContactPhoneNumber: user?.emergencyContactPhoneNumber ?? "",
      streetAddress: user?.streetAddress ?? "",
      apartmentUnit: user?.apartmentUnit ?? "",
      city: user?.city ?? "",
      state: user?.state ?? "",
      zipCode: user?.zipCode ?? "",
      country: user?.country ?? "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const submitProfile = (values: ProfileFormValues) => {
    setProfileError(null);
    updateProfile.mutate(
      {
        data: {
          ...values,
          preferredName: values.preferredName || null,
          phoneNumber: values.phoneNumber || null,
          profilePhotoUrl: values.profilePhotoUrl || null,
          dateOfBirth: values.dateOfBirth || null,
          gender: values.gender || null,
          maritalStatus: values.maritalStatus || null,
          occupation: values.occupation || null,
          preferredLanguage: values.preferredLanguage || null,
          emergencyContactName: values.emergencyContactName || null,
          emergencyContactPhoneNumber: values.emergencyContactPhoneNumber || null,
          streetAddress: values.streetAddress || null,
          apartmentUnit: values.apartmentUnit || null,
          city: values.city || null,
          state: values.state || null,
          zipCode: values.zipCode || null,
          country: values.country || null,
        },
      },
      {
        onSuccess: (updatedUser) => {
          queryClient.setQueryData(getGetMeQueryKey(), updatedUser);
          setEditOpen(false);
        },
        onError: (err) => {
          setProfileError(err.data?.error || "Profile update failed.");
        },
      },
    );
  };

  const handleProfilePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProfileError(null);
      const dataUrl = await readProfilePhotoFile(file);
      profileForm.setValue("profilePhotoUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not use that image.");
    } finally {
      event.target.value = "";
    }
  };

  const submitPassword = (values: PasswordFormValues) => {
    setPasswordError(null);
    setPasswordSuccess(null);
    changePassword.mutate(
      { data: values },
      {
        onSuccess: () => {
          passwordForm.reset();
          setPasswordSuccess("Password updated successfully.");
        },
        onError: (err) => {
          setPasswordError(err.data?.error || "Password update failed.");
        },
      },
    );
  };

  const providerLabels = user?.authProviders?.length
    ? user.authProviders.map((provider) => provider[0]?.toUpperCase() + provider.slice(1))
    : ["Unknown"];

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Member Profile"
          title={`${user?.preferredName || user?.firstName || ""} ${user?.lastName || ""}`}
          description={user?.email}
          icon={
            <Avatar className="h-12 w-12 shrink-0 border border-blue-200 bg-white">
              {user?.profilePhotoUrl && (
                <AvatarImage src={user.profilePhotoUrl} alt={`${user.firstName} ${user.lastName}`} />
              )}
              <AvatarFallback className="bg-transparent text-sm font-semibold text-primary">
                {user?.preferredName?.[0] || user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          }
          actions={
            <>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PencilLine />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Member Profile</DialogTitle>
                    <DialogDescription>
                      Update your account, personal, emergency contact, and address information.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(submitProfile)} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <ProfileField form={profileForm} name="firstName" label="First Name" />
                        <ProfileField form={profileForm} name="lastName" label="Last Name" />
                        <ProfileField form={profileForm} name="preferredName" label="Preferred Name / Nickname" />
                        <ProfileField form={profileForm} name="email" label="Email Address" type="email" />
                        <ProfileField form={profileForm} name="phoneNumber" label="Phone Number" />
                        <FormField control={profileForm.control} name="profilePhotoUrl" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profile Photo</FormLabel>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 border border-blue-200 bg-white">
                                {field.value && <AvatarImage src={field.value} alt="Profile preview" />}
                                <AvatarFallback className="bg-transparent text-sm text-primary">
                                  {profileForm.watch("firstName")?.[0]}
                                  {profileForm.watch("lastName")?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <FormControl>
                                <Input type="file" accept="image/*" capture="user" onChange={handleProfilePhotoFile} />
                              </FormControl>
                            </div>
                            <Input placeholder="https://..." {...field} />
                            <FormMessage />
                          </FormItem>
                        )} />
                        <ProfileField form={profileForm} name="dateOfBirth" label="Date of Birth" type="date" />
                        <ProfileField form={profileForm} name="gender" label="Gender" />
                        <ProfileField form={profileForm} name="maritalStatus" label="Marital Status" />
                        <ProfileField form={profileForm} name="occupation" label="Occupation" />
                        <ProfileField form={profileForm} name="preferredLanguage" label="Preferred Language" />
                        <ProfileField form={profileForm} name="emergencyContactName" label="Emergency Contact Name" />
                        <ProfileField form={profileForm} name="emergencyContactPhoneNumber" label="Emergency Contact Phone" />
                        <ProfileField form={profileForm} name="streetAddress" label="Street Address" />
                        <ProfileField form={profileForm} name="apartmentUnit" label="Apartment / Unit" />
                        <ProfileField form={profileForm} name="city" label="City" />
                        <ProfileField form={profileForm} name="state" label="State" />
                        <ProfileField form={profileForm} name="zipCode" label="Zip Code" />
                        <ProfileField form={profileForm} name="country" label="Country" />
                      </div>

                      {profileError && (
                        <Alert variant="destructive">
                          <AlertDescription>{profileError}</AlertDescription>
                        </Alert>
                      )}

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={updateProfile.isPending}>
                          {updateProfile.isPending ? "Saving..." : "Save Profile"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!user?.hasPassword}>
                    <KeyRound />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Password changes are available for accounts that use email/password sign-in.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(submitPassword)} className="space-y-4">
                      <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl><Input type="password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl><Input type="password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {passwordError && (
                        <Alert variant="destructive">
                          <AlertDescription>{passwordError}</AlertDescription>
                        </Alert>
                      )}
                      {passwordSuccess && (
                        <Alert>
                          <AlertDescription>{passwordSuccess}</AlertDescription>
                        </Alert>
                      )}

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
                          Close
                        </Button>
                        <Button type="submit" disabled={changePassword.isPending}>
                          {changePassword.isPending ? "Updating..." : "Update Password"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Button asChild variant="outline">
                <a href="#account-info">
                  <ShieldCheck />
                  View Account Info
                </a>
              </Button>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
              <div className="h-1 bg-blue-500" />
              <CardHeader>
                <CardTitle>Basic Account Information</CardTitle>
                <CardDescription>Identity, sign-in context, member account, and day-to-day contact details.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow icon={UserRound} label="First Name" value={user?.firstName} />
                <InfoRow icon={UserRound} label="Last Name" value={user?.lastName} />
                <InfoRow icon={Contact} label="Preferred Name / Nickname" value={user?.preferredName} />
                <InfoRow icon={Mail} label="Email Address" value={user?.email} />
                <InfoRow icon={Phone} label="Phone Number" value={user?.phoneNumber} />
                <InfoRow icon={Church} label="Church" value={user?.churchName} />
                <InfoRow icon={CalendarDays} label="Account Created" value={formatDate(user?.createdAt)} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
              <div className="h-1 bg-amber-400" />
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Helpful CRM details for care, communication, and personal context.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow icon={CalendarDays} label="Date of Birth" value={formatDate(user?.dateOfBirth)} />
                <InfoRow icon={UserRound} label="Gender" value={user?.gender} />
                <InfoRow icon={HeartHandshake} label="Marital Status" value={user?.maritalStatus} />
                <InfoRow icon={BriefcaseBusiness} label="Occupation" value={user?.occupation} />
                <InfoRow icon={Languages} label="Preferred Language" value={user?.preferredLanguage} />
                <InfoRow icon={Phone} label="Emergency Contact Phone" value={user?.emergencyContactPhoneNumber} />
                <InfoRow icon={Contact} label="Emergency Contact Name" value={user?.emergencyContactName} className="md:col-span-2" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
              <div className="h-1 bg-amber-400" />
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
                <CardDescription>Member mailing and household location context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={MapPin} label="Street Address" value={user?.streetAddress} />
                <InfoRow icon={MapPin} label="Apartment / Unit" value={user?.apartmentUnit} />
                <InfoRow icon={MapPin} label="City" value={user?.city} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoRow icon={MapPin} label="State" value={user?.state} />
                  <InfoRow icon={MapPin} label="Zip Code" value={user?.zipCode} />
                </div>
                <InfoRow icon={Globe2} label="Country" value={user?.country} />
              </CardContent>
            </Card>

            <Card id="account-info" className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
              <div className="h-1 bg-blue-500" />
              <CardHeader>
                <CardTitle>Account Info</CardTitle>
                <CardDescription>Security-facing context visible to the member.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={CalendarDays} label="Last Login" value={formatDate(user?.lastLoginAt)} />
                <InfoRow icon={ShieldCheck} label="Account Type" value="Member" />
                <InfoRow icon={ShieldCheck} label="Account Status" value={user?.accountStatus} />
                <InfoRow icon={UserRound} label="User ID" value={user?.id ? String(user.id) : null} />
                <div className="rounded-lg border border-blue-100 bg-white/75 p-4">
                  <div className="text-sm font-medium">Authentication Provider</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {providerLabels.map((provider) => (
                      <Badge key={provider} variant="secondary">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-white/75 p-4 text-sm text-muted-foreground">
                  Admin access cannot be selected or upgraded from this profile. All self-service accounts remain members unless backend or database administration changes the role.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}

function ProfileField({
  form,
  name,
  label,
  type = "text",
  placeholder,
}: {
  form: ReturnType<typeof useForm<ProfileFormValues>>;
  name: keyof ProfileFormValues;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input type={type} placeholder={placeholder} {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-blue-100 bg-white/75 p-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{valueOrFallback(value)}</p>
    </div>
  );
}
