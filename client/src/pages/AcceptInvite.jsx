import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PostLoginRedirect from "@/components/auth/PostLoginRedirect";

export default function AcceptInvite() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus({ valid: false, reason: "Missing invite token" });
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    base44.auth
      .inviteStatus(token)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus({
            valid: false,
            reason: err?.message || "Could not validate invite",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!isLoadingAuth && isAuthenticated) {
    return <PostLoginRedirect />;
  }

  const handleSubmit = async (event) => {
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
      await base44.auth.acceptInvite({ token, password });
      toast.success("Password set — you can sign in now");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F5] via-white to-[#F3EDE8] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!status?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F5] via-white to-[#F3EDE8] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#C84B31]">Invite unavailable</h1>
          <p className="text-gray-600 text-sm">
            {status?.reason || "This invite link is invalid or has expired."}
          </p>
          <Link to="/login" className="text-[#C84B31] text-sm font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F5] via-white to-[#F3EDE8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-[#C84B31]">Mangia</h1>
          <p className="mt-2 text-gray-600">Set your password to join the CRM</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-5"
        >
          <div>
            <Label>Email</Label>
            <Input
              readOnly
              value={status.email || ""}
              className="mt-1 bg-gray-50"
            />
          </div>

          {status.full_name ? (
            <div>
              <Label>Name</Label>
              <Input
                readOnly
                value={status.full_name}
                className="mt-1 bg-gray-50"
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="password">Password</Label>
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
              placeholder="••••••••"
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
            className="w-full bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
          >
            {submitting ? "Saving..." : "Activate account"}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-[#C84B31] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
