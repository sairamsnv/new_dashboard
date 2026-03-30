import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Email is required", { description: "Please enter your email address." });
      return;
    }
    setIsLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      if (result.success) {
        setEmailSent(true);
        toast.success("Email sent!", { description: "Check your inbox for reset instructions." });
      } else {
        toast.error("Failed to send email", { description: result.error || "Please try again." });
      }
    } catch {
      toast.error("Error", { description: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative">
      {/* Logo */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C63FF] to-indigo-700 shadow-lg">
          <LayoutDashboard className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-gray-800">Analytics Dashboard</span>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <Link
            to="/login"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Link>

          <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-[#8b5cf6] to-indigo-600 bg-clip-text text-transparent">
            Forgot Password?
          </h1>
          <p className="text-gray-600 text-sm mb-8">
            {emailSent
              ? "We've sent you a password reset link. Please check your email."
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>

          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg border-gray-300 focus:border-[#8b5cf6] focus:ring-[#8b5cf6] pl-10"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-[#8b5cf6] to-indigo-600 hover:opacity-90 text-white font-medium rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="text-gray-700 font-medium">Check your email</p>
                <p className="text-sm text-gray-600">
                  We sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  Didn't receive it? Check your spam folder or try again.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setEmailSent(false); setEmail(""); }}
                >
                  Try Another Email
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-gradient-to-r from-[#8b5cf6] to-indigo-600 hover:opacity-90"
                  onClick={() => navigate("/login")}
                >
                  Back to Login
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{" "}
              <Link to="/login" className="text-[#8b5cf6] hover:underline font-medium">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
