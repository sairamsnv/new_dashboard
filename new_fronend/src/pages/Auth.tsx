import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  HeadphonesIcon,
  Shield,
  ArrowRight,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import "./Auth.css";

type UserRole = "agent" | "client" | "admin";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (identical to medha_project)
// ─────────────────────────────────────────────────────────────────────────────

interface HeroProps {
  type: "signin" | "signup";
  active: boolean;
  title: string;
  text: string;
  buttonText: string;
  onClick: () => void;
}

const Hero = ({ type, active, title, text, buttonText, onClick }: HeroProps) => {
  const isWelcomePanel = type === "signin";
  return (
    <div className={`hero ${type} ${active ? "active" : ""}`}>
      {!isWelcomePanel && (
        <div className="hero-graphic">
          <UserPlus className="h-10 w-10 text-white" />
        </div>
      )}
      <h2>{title}</h2>
      <p>{text}</p>
      <button type="button" onClick={onClick} className="hero-button-with-icon">
        {buttonText}
        <ArrowRight className="h-4 w-4 ml-2" />
      </button>
    </div>
  );
};

interface AuthFormProps {
  type: "signin" | "signup";
  active: boolean;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}

const AuthForm = ({ type, active, title, onSubmit, children }: AuthFormProps) => (
  <div className={`form ${type} ${active ? "active" : ""}`}>
    <h2>{title}</h2>
    <form onSubmit={onSubmit}>{children}</form>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Auth Component
// ─────────────────────────────────────────────────────────────────────────────

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated } = useAuth();
  const [view, setView] = useState<"signin" | "signup">("signin");
  const isSignup = view === "signup";

  // Redirect already-authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Honour ?view=signup
  useEffect(() => {
    if (searchParams.get("view") === "signup") setView("signup");
  }, [searchParams]);

  // Session-expired banner
  useEffect(() => {
    if (searchParams.get("session_expired") === "1") {
      toast.info("Session expired", {
        description: "Your session has expired. Please log in again.",
        duration: 5000,
      });
    }
  }, [searchParams]);

  // ── Login state ──
  const [loginRole, setLoginRole] = useState<UserRole>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // ── Register state ──
  const [registerRole, setRegisterRole] = useState<"agent" | "client">("client");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  const toggleView = () => setView(isSignup ? "signin" : "signup");

  // ── Login submit ──
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("All fields are required", { description: "Please fill in both fields." });
      return;
    }
    setIsLoginLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        toast.success("Welcome back!", { description: "You have successfully logged in." });
        setTimeout(() => navigate("/"), 600);
      } else {
        toast.error("Login failed", { description: result.error || "Invalid credentials." });
      }
    } catch {
      toast.error("Login failed", { description: "Network error. Please try again." });
    } finally {
      setIsLoginLoading(false);
    }
  };

  // ── Register submit ──
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email: regEmail, password: regPass, confirmPassword } = formData;

    if (!name || !regEmail || !regPass || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }
    if (!regEmail.includes("@")) {
      toast.error("Invalid email address");
      return;
    }
    if (regPass.length < 6) {
      toast.error("Password too short", { description: "Must be at least 6 characters." });
      return;
    }
    if (regPass !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsRegisterLoading(true);
    try {
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const username = regEmail.split("@")[0];

      const result = await register({
        username,
        email: regEmail,
        password: regPass,
        confirmPassword,
        firstName,
        lastName,
        role: registerRole,
      });

      if (result.success) {
        toast.success("Account created!", {
          description: result.message || "Please verify your email before logging in.",
        });
        setTimeout(() => {
          setView("signin");
          setFormData({ name: "", email: "", password: "", confirmPassword: "" });
        }, 1500);
      } else {
        toast.error("Registration failed", { description: result.error || "Please try again." });
      }
    } catch {
      toast.error("Registration failed", { description: "Network error. Please try again." });
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 relative">
      {/* Logo */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C63FF] to-indigo-700 shadow-lg">
          <LayoutDashboard className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-gray-800">Analytics Dashboard</span>
      </div>

      <div className="card" data-view={isSignup ? "signup" : "signin"}>
        {/* Sliding background */}
        <div className={`card-bg ${isSignup ? "signup" : "signin"}`} />

        {/* ── Sign Up Hero ── */}
        <Hero
          type="signup"
          active={isSignup}
          title="Join Analytics"
          text="Create an account to upload data, explore insights, and build dashboards."
          buttonText="SIGN IN"
          onClick={toggleView}
        />

        {/* ── Sign Up Form ── */}
        <AuthForm type="signup" active={isSignup} title="Sign Up" onSubmit={handleRegisterSubmit}>
          <div className="role-selector">
            {([
              { value: "agent" as const, label: "Agent", icon: HeadphonesIcon },
              { value: "client" as const, label: "Client", icon: User },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRegisterRole(value)}
                className={`role-tab ${registerRole === value ? "active" : ""}`}
              >
                <Icon className="role-tab-icon" />
                {label}
              </button>
            ))}
          </div>

          <div className="input-with-icon">
            <User className="input-icon" />
            <Input id="name" type="text" placeholder="Full name" value={formData.name} onChange={handleRegisterChange} className="auth-input" required />
          </div>
          <div className="input-with-icon">
            <Mail className="input-icon" />
            <Input id="email" type="email" placeholder="Email" value={formData.email} onChange={handleRegisterChange} className="auth-input" required />
          </div>
          <div className="input-with-icon">
            <Lock className="input-icon" />
            <div className="relative">
              <Input id="password" type={showRegisterPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={handleRegisterChange} className="auth-input" required />
              <button type="button" onClick={() => setShowRegisterPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="input-with-icon">
            <Lock className="input-icon" />
            <div className="relative">
              <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleRegisterChange} className="auth-input" required />
              <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isRegisterLoading} className="auth-button">
            {isRegisterLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" />SIGN UP</>
            )}
          </button>
        </AuthForm>

        {/* ── Sign In Hero ── */}
        <Hero
          type="signin"
          active={!isSignup}
          title="Welcome Back"
          text="Sign in to access your dashboards, data, and AI insights."
          buttonText="SIGN UP"
          onClick={toggleView}
        />

        {/* ── Sign In Form ── */}
        <AuthForm type="signin" active={!isSignup} title="Sign In" onSubmit={handleLoginSubmit}>
          {searchParams.get("session_expired") === "1" && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              Your session has expired. Please log in again.
            </div>
          )}

          <div className="role-selector">
            {([
              { value: "agent" as const, label: "Agent", icon: HeadphonesIcon },
              { value: "client" as const, label: "Client", icon: User },
              { value: "admin" as const, label: "Admin", icon: Shield },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLoginRole(value)}
                className={`role-tab ${loginRole === value ? "active" : ""}`}
              >
                <Icon className="role-tab-icon" />
                {label}
              </button>
            ))}
          </div>

          <div className="input-with-icon">
            <Mail className="input-icon" />
            <Input id="login-email" type="text" placeholder="Email / Username" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" required />
          </div>
          <div className="input-with-icon">
            <Lock className="input-icon" />
            <div className="relative">
              <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" required />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="forgot-password-link">
            <Link to="/auth/forgot-password">Forgot password?</Link>
          </div>

          <button type="submit" disabled={isLoginLoading} className="auth-button">
            {isLoginLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Logging in…</>
            ) : (
              <><LogIn className="h-4 w-4 mr-2" />SIGN IN</>
            )}
          </button>
        </AuthForm>
      </div>
    </div>
  );
};

export default Auth;
