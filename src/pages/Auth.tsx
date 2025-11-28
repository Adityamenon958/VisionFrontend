import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

// ---------------- PHONE RULES (length + label) ----------------

const phoneRules: Record<string, { length: number; label: string }> = {
  "+1": { length: 10, label: "US" },
  "+44": { length: 10, label: "UK" },
  "+91": { length: 10, label: "India" },
  "+61": { length: 9, label: "Australia" },
  "+49": { length: 10, label: "Germany" },
  "+33": { length: 9, label: "France" },
};

// ---------------- SIGNUP VALIDATION SCHEMA ----------------

const signupSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(40, "Name must be at most 40 characters")
    .regex(/^[A-Za-z\s]+$/, "Name must contain only letters and spaces"),
  phone: z.string().min(10, "Phone number is too short"),
  email: z
    .string()
    .email("Invalid email address")
    .refine((email) => {
      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain) return false;

      // Allow Gmail + company domains, block some common free ones
      if (domain === "gmail.com") return true;
      const blockedFreeDomains = ["yahoo.com", "hotmail.com", "outlook.com"];
      return !blockedFreeDomains.includes(domain);
    }, "Please use Gmail or a company email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    (searchParams.get("mode") as "signin" | "signup" | "forgot") || "signin",
  );

  // ---------------- SIGNUP STATE ----------------
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91"); // default India
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [signupTouched, setSignupTouched] = useState<SignupErrors>({});

  // ---------------- SIGNIN STATE ----------------
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // ---------------- FORGOT PASSWORD STATE ----------------
  const [resetEmail, setResetEmail] = useState("");

  // ---------------- PASSWORD STRENGTH ----------------
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    calculatePasswordStrength(password);
  }, [password]);

  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength += 25;
    if (/\d/.test(pwd)) strength += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 10;
    setPasswordStrength(Math.min(strength, 100));
  };

  const getPasswordColor = () => {
    if (passwordStrength < 30) return "bg-destructive";
    if (passwordStrength < 60) return "bg-warning";
    return "bg-success";
  };

  // ---------------- LIVE SIGNUP VALIDATION ----------------
  useEffect(() => {
    const fullPhone = countryCode + phone;

    const result = signupSchema.safeParse({
      name,
      phone: fullPhone,
      email,
      password,
    });

    const fieldErrors: SignupErrors = {};

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof SignupErrors;
        fieldErrors[field] = issue.message;
      }
    }

    // extra phone length validation per country
    const digits = phone.replace(/\D/g, "");
    const rule = phoneRules[countryCode];

    if (rule) {
      if (digits.length !== rule.length) {
        fieldErrors.phone = `Phone number must be ${rule.length} digits for ${rule.label}`;
      }
    }

    setSignupErrors(fieldErrors);
  }, [name, email, phone, password, countryCode]);

  const isSignupValid =
    name &&
    email &&
    phone &&
    password &&
    Object.keys(signupErrors).length === 0;

  // ---------------- HANDLERS ----------------

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    setSignupTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
    });

    if (!isSignupValid) {
      toast({
      title: "Please check your details",
      description: "Fix the highlighted errors before signing up.",
      variant: "destructive",
    });
      return;
    }

    setLoading(true);

    try {
      const fullPhone = countryCode + phone;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone: fullPhone,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      console.log("signUp response:", { data, error });

      if (error) {
        throw error;
      }

      if (
      data?.user &&
      Array.isArray((data.user as any).identities) &&
      (data.user as any).identities.length === 0
    ) {
      toast({
        title: "Account already exists",
        description:
          "An account with this email already exists. Please sign in instead.",
        variant: "destructive",
      });
      return;
    }

      toast({
        title: "verification email sent",
        description:
          "Please check your email inbox and confirm your email to sign in.",
      });
    } catch (error: any) {
      let message = error.message;
      
      if (message?.includes("User already")) {
        message = "An account with this email already exists. Please sign in instead.";
  }
      toast({
        title: "signup failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signinEmail,
        password: signinPassword,
      });

      console.log("signIn response:", { data, error });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error("Login failed. Please check your credentials.");
      }

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Sign in failed",
        description:
          error?.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for the reset link.",
      });

      setMode("signin");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- HEADER TEXT ----------------

  const headerTitle =
    mode === "signup"
      ? "Create an account"
      : mode === "signin"
      ? "Welcome back"
      : "Forgot password?";

  const headerDescription =
    mode === "signup"
      ? "Enter your details to get started."
      : mode === "signin"
      ? "Sign in to your account to continue."
      : "Enter your email to receive a password reset link";

  // ---------------- RENDER ----------------

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <Card className="w-full max-w-lg shadow-lg border border-border/70">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-3xl font-bold">{headerTitle}</CardTitle>
          <CardDescription>{headerDescription}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* SIGN UP */}
          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() =>
                    setSignupTouched((prev) => ({ ...prev, name: true }))
                  }
                  placeholder="Your full name"
                />
                {signupTouched.name && signupErrors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() =>
                    setSignupTouched((prev) => ({ ...prev, email: true }))
                  }
                  placeholder="you@company.com"
                />
                {signupTouched.email && signupErrors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.email}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <Select
                    value={countryCode}
                    onValueChange={(value) => setCountryCode(value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+1">US +1</SelectItem>
                      <SelectItem value="+44">UK +44</SelectItem>
                      <SelectItem value="+91">IN +91</SelectItem>
                      <SelectItem value="+61">AU +61</SelectItem>
                      <SelectItem value="+49">DE +49</SelectItem>
                      <SelectItem value="+33">FR +33</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() =>
                      setSignupTouched((prev) => ({ ...prev, phone: true }))
                    }
                    placeholder=""
                  />
                </div>
                {signupTouched.phone && signupErrors.phone && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.phone}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() =>
                    setSignupTouched((prev) => ({ ...prev, password: true }))
                  }
                />
                {signupTouched.password && signupErrors.password && (
                  <p className="mt-1 text-xs text-destructive">
                    {signupErrors.password}
                  </p>
                )}
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                    <div
                      className={getPasswordColor()}
                      style={{ width: `${passwordStrength}%` }}
                    />
                    <div
                      className="bg-muted"
                      style={{ width: `${100 - passwordStrength}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password strength:{" "}
                    {passwordStrength < 30
                      ? "Weak"
                      : passwordStrength < 60
                      ? "Medium"
                      : "Strong"}
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isSignupValid}
              >
                {loading ? "Signing up..." : "Sign Up"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* SIGN IN */}
          {mode === "signin" && (
            <form onSubmit={handleSignin} className="space-y-5">
              <div>
                <Label>Business Email</Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  required
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <Label>Business Email</Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>

              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline"
                >
                  ← Back to Sign In
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
