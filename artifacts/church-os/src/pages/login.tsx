import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-context";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Building } from "lucide-react";

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

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  React.useEffect(() => {
    if (user && !authLoading) {
      setLocation(user.role === "admin" ? "/admin" : "/member");
    }
  }, [user, authLoading, setLocation]);

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    loginMutation.mutate(
      { data },
      {
        onSuccess: (loggedInUser) => {
          // Update the cached /auth/me result immediately so AuthProvider
          // and ProtectedRoute see the authenticated user without an extra
          // network round-trip.
          queryClient.setQueryData(getGetMeQueryKey(), loggedInUser);
          setLocation(loggedInUser.role === "admin" ? "/admin" : "/member");
        },
        onError: (err) => {
          setError(err.data?.error || "Invalid credentials. Please try again.");
        },
      }
    );
  };

  const setDemoAdmin = () => {
    form.setValue("email", "admin@churchos.test");
    form.setValue("password", "Admin123!");
  };

  const setDemoMember = () => {
    form.setValue("email", "member@churchos.test");
    form.setValue("password", "Member123!");
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground mb-4">
            <Building size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to Church OS
          </h1>
          <p className="text-muted-foreground">
            {user?.churchName || "CJC International"}
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="you@example.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          data-testid="input-password"
                        />
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

            <div className="mt-8 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Demo Accounts
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={setDemoAdmin}
                  data-testid="button-demo-admin"
                  className="w-full"
                >
                  Use Admin
                </Button>
                <Button
                  variant="outline"
                  onClick={setDemoMember}
                  data-testid="button-demo-member"
                  className="w-full"
                >
                  Use Member
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
