import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export default function ForgotPassword() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.auth.passwordReset
      .status()
      .then((data) => {
        if (!cancelled) setAvailable(!!data?.available);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/Dashboard" replace />;
  }

  if (available === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F5] via-white to-[#F3EDE8] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#C84B31]">Password reset unavailable</h1>
          <p className="text-gray-600 text-sm">
            Gmail is not connected, so reset codes cannot be sent. Contact an admin.
          </p>
          <Link to="/login" className="text-[#C84B31] text-sm font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleRequest = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await base44.auth.passwordReset.request({ email: email.trim() });
      toast.success("If that email exists, a reset code was sent.");
      setStep(2);
    } catch (err) {
      setError(err?.message || "Failed to send reset code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.passwordReset.verify({
        email: email.trim(),
        code,
      });
      setStep(3);
    } catch (err) {
      setError(err?.message || "Invalid or expired code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.passwordReset.confirm({
        email: email.trim(),
        code,
        newPassword: password,
      });
      toast.success("Password updated. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F5] via-white to-[#F3EDE8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[#C84B31]">Mangia</h1>
          <p className="mt-2 text-gray-600">Reset your password</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-5">
          <p className="text-xs text-gray-500 text-center">
            Step {step} of 3
          </p>

          {step === 1 && (
            <form onSubmit={handleRequest} className="space-y-5">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="you@mangiadc.com"
                  disabled={available === null}
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || available !== true}
                className="w-full bg-[#C84B31] hover:bg-[#A03A23] text-white"
              >
                {submitting ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerify} className="space-y-5">
              <p className="text-sm text-gray-600">
                Enter the 6-digit code sent to <strong>{email}</strong>.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full bg-[#C84B31] hover:bg-[#A03A23] text-white"
              >
                {submitting ? "Verifying…" : "Verify code"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-gray-500 hover:text-[#C84B31]"
                onClick={() => {
                  setStep(1);
                  setCode("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleConfirm} className="space-y-5">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1"
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#C84B31] hover:bg-[#A03A23] text-white"
              >
                {submitting ? "Saving…" : "Set new password"}
              </Button>
            </form>
          )}

          <div className="text-center">
            <Link to="/login" className="text-sm text-[#C84B31] hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
