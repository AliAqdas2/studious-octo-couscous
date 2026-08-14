import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  DEFAULT_APP_PATH,
  resolvePostLoginPath,
} from "@/lib/postLoginPath";

export default function PostLoginRedirect() {
  const { user } = useAuth();
  const [path, setPath] = useState(null);

  useEffect(() => {
    let cancelled = false;
    resolvePostLoginPath(user).then((next) => {
      if (!cancelled) setPath(next || DEFAULT_APP_PATH);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!path) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to={path} replace />;
}
