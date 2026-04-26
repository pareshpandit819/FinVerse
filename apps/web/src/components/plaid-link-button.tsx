"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

interface PlaidLinkButtonProps {
  orgId: string;
}

export function PlaidLinkButton({ orgId }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plaid/link-token?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to create link token");
      const data = await res.json() as { link_token: string };
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { institution_id: string; name: string } | null }) => {
      setLoading(true);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            orgId,
            institutionId: metadata.institution?.institution_id ?? "unknown",
            institutionName: metadata.institution?.name ?? "Unknown",
          }),
        });
        if (!res.ok) throw new Error("Failed to connect account");
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [orgId]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
    onExit: () => {
      setLinkToken(null);
      setLoading(false);
    },
  });

  const handleClick = async () => {
    if (linkToken && ready) {
      open();
    } else {
      await fetchLinkToken();
    }
  };

  // Auto-open Link once we have a token
  if (linkToken && ready) {
    open();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Account"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
