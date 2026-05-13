import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  getGetMeQueryKey,
  useGetOAuthConfig,
  useLogin,
  useSignup,
} from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-context";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Building, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().trim().optional(),
  password: z.string().min(8, "Use at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

export default function Login() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const { data: oauthConfig } = useGetOAuthConfig();
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [error, setError] = React.useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (user && !authLoading) {
      setLocation(user.role === "admin" ? "/admin" : "/member");
    }
  }, [user, authLoading, setLocation]);

  const finishAuth = (loggedInUser: {
    role: string;
  }) => {
    queryClient.setQueryData(getGetMeQueryKey(), loggedInUser);
    setLocation(loggedInUser.role === "admin" ? "/admin" : "/member");
  };

  const onLogin = (data: LoginFormValues) => {
    setError(null);
    loginMutation.mutate(
      { data },
      {
        onSuccess: finishAuth,
        onError: (err) => {
          setError(err.data?.error || "Invalid credentials. Please try again.");
        },
      },
    );
  };

  const onSignup = (data: SignupFormValues) => {
    setError(null);
    signupMutation.mutate(
      {
        data: {
          ...data,
          phoneNumber: data.phoneNumber || undefined,
        },
      },
      {
        onSuccess: finishAuth,
        onError: (err) => {
          setError(err.data?.error || "We could not create that account.");
        },
      },
    );
  };

  const beginOAuth = (provider: "google" | "apple") => {
    window.location.assign(`/api/auth/oauth/${provider}/start`);
  };

  const setDemoAdmin = () => {
    setMode("login");
    loginForm.setValue("email", "admin@churchos.test");
    loginForm.setValue("password", "Admin123!");
  };

  const setDemoMember = () => {
    setMode("login");
    loginForm.setValue("email", "member@churchos.test");
    loginForm.setValue("password", "Member123!");
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen w-full bg-background p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
        <div className="grid w-full items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building size={24} />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Church OS</h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Secure account access for members and administrators, with protected dashboards and profile foundations.
              </p>
            </div>
          </div>

          <Card className="border-0 shadow-xl shadow-primary/5">
            <CardHeader className="space-y-4">
              <div className="inline-flex w-fit rounded-md border bg-muted/40 p-1">
                <Button
                  type="button"
                  variant={mode === "login" ? "default" : "ghost"}
                  className="gap-2"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  <LogIn size={16} />
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={mode === "signup" ? "default" : "ghost"}
                  className="gap-2"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  <UserPlus size={16} />
                  Create account
                </Button>
              </div>
              <div>
                <CardTitle>{mode === "login" ? "Welcome back" : "Create your member account"}</CardTitle>
                <CardDescription>
                  {mode === "login"
                    ? "Sign in with your credentials or a configured provider."
                    : "New self-service accounts are created with member access."}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {mode === "login" ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {error && (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription data-testid="text-error">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={signupForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signupForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                              placeholder="you@example.com"
                              {...field}
                              data-testid="input-signup-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} data-testid="input-phone-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-signup-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {error && (
                      <Alert variant="destructive" className="py-2">
                        <AlertDescription data-testid="text-error">{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupMutation.isPending}
                      data-testid="button-signup"
                    >
                      {signupMutation.isPending ? "Creating account..." : "Create member account"}
                    </Button>
                  </form>
                </Form>
              )}

              {(oauthConfig?.google || oauthConfig?.apple) && (
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or continue with</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {oauthConfig.google && (
                      <Button type="button" variant="outline" onClick={() => beginOAuth("google")}>
                        Google
                      </Button>
                    )}
                    {oauthConfig.apple && (
                      <Button type="button" variant="outline" onClick={() => beginOAuth("apple")}>
                        Apple
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Demo accounts</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={setDemoAdmin} data-testid="button-demo-admin">
                    Use Admin
                  </Button>
                  <Button variant="outline" onClick={setDemoMember} data-testid="button-demo-member">
                    Use Member
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
