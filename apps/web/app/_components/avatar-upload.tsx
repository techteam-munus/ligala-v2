"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { removeAvatar, saveAvatar } from "@/lib/actions/account";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Matches the presign route's byteSize cap (10 MB) so we fail fast client-side
// rather than after the upload round trip.
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Profile-picture uploader. Reuses the existing presign → direct-PUT flow
 * (see lawyer/kyc/form.tsx): presign with kind "avatar" → PUT the file to S3 →
 * persist the s3Key on `user.image`. Shows an optimistic local preview while
 * the round trips run, then router.refresh() so the sidebar (rendered in the
 * layout) and this card pick up the resolved presigned URL.
 */
export function AvatarUpload({
  currentUrl,
  fallbackInitial,
}: {
  currentUrl: string | null;
  fallbackInitial: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Local optimistic preview (object URL). When null, we show currentUrl.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Release the last object URL when it's replaced or on unmount.
  function setPreview(url: string | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setLocalPreview(url);
  }
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 10 MB or smaller.");
      return;
    }

    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const res = await fetch("/api/files/presign-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "avatar",
          contentType: file.type,
          byteSize: file.size,
        }),
      });
      if (!res.ok) throw new Error(`Could not start upload (${res.status}).`);
      const { uploadUrl, s3Key } = (await res.json()) as {
        uploadUrl: string;
        s3Key: string;
      };

      const put = await fetch(uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);

      await saveAvatar(s3Key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null); // roll back to the server's currentUrl
    } finally {
      setBusy(false);
    }
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeAvatar();
        setPreview(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove photo.");
      }
    });
  }

  const working = busy || isPending;
  const shown = localPreview ?? currentUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {shown ? <AvatarImage src={shown} alt="Profile photo" /> : null}
          <AvatarFallback className="text-lg font-medium">
            {fallbackInitial}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {shown ? "Replace" : "Upload photo"}
            </Button>
            {shown ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={onRemove}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG, or WebP · up to 10 MB.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
