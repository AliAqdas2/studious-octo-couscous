import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl("Dashboard"), { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting…</p>
      </div>
    </div>
  );
}
