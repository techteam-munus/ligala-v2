"use client";

import { useState, useTransition } from "react";
import {
  Languages,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { saveClientProfile } from "@/lib/actions/client";
import { cn } from "@/lib/utils";
import { AvatarUpload } from "@/app/_components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Initial = {
  displayName: string;
  phone: string;
  city: string;
  region: string;
  preferredLanguage: string;
};

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  fil: "Filipino",
  ceb: "Cebuano",
};

export function ClientProfileForm({
  initial,
  avatarUrl,
  fallbackInitial,
}: {
  initial: Initial;
  avatarUrl: string | null;
  fallbackInitial: string;
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveClientProfile({
          displayName: form.displayName || null,
          phone: form.phone || null,
          city: form.city || null,
          region: form.region || null,
          preferredLanguage: form.preferredLanguage || "en",
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  const initials = (form.displayName || "?")
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={submit}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form ============================================== */}
        <div className="space-y-4">
          {/* Identity */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <User className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Identity
              </p>
            </div>
            <CardContent className="px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  placeholder="What lawyers should call you"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown to lawyers you engage with — not displayed publicly.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact + Location + Language */}
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Phone className="size-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Contact &amp; preferences
              </p>
            </div>
            <CardContent className="space-y-4 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+63 9xx xxx xxxx"
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preferredLanguage">
                    <Languages className="mr-1 inline size-3" />
                    Preferred language
                  </Label>
                  <select
                    id="preferredLanguage"
                    value={form.preferredLanguage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        preferredLanguage: e.target.value,
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="en">English</option>
                    <option value="fil">Filipino</option>
                    <option value="ceb">Cebuano</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="city">
                    <MapPin className="mr-1 inline size-3" />
                    City
                  </Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    placeholder="Quezon City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    value={form.region}
                    onChange={(e) =>
                      setForm({ ...form, region: e.target.value })
                    }
                    placeholder="NCR"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side rail ========================================= */}
        <aside className="space-y-4 lg:self-start">
          {/* Profile photo */}
          <Card size="sm" className="gap-2">
            <CardContent className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Profile photo
              </p>
              <AvatarUpload
                currentUrl={avatarUrl}
                fallbackInitial={fallbackInitial}
              />
            </CardContent>
          </Card>

          {/* Preview avatar card */}
          <Card size="sm" className="gap-2">
            <CardContent className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Preview
              </p>
              <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-semibold">
                  {initials || "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {form.displayName || (
                      <span className="text-muted-foreground">
                        Display name
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[form.city, form.region].filter(Boolean).join(", ") ||
                      "Location"}
                    {" · "}
                    {LANGUAGE_LABEL[form.preferredLanguage] ?? "English"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is roughly how lawyers see you in their case inbox.
              </p>
            </CardContent>
          </Card>

          {/* Save action */}
          <Card size="sm" className="gap-3">
            <CardContent className="space-y-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {savedAt && !error ? (
                <Alert className="border-emerald-200/60 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                  <AlertDescription>Saved at {savedAt}.</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Saving…" : "Save profile"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Updates apply to all your active matters immediately.
              </p>
            </CardContent>
          </Card>

          {/* Privacy note */}
          <Card
            size="sm"
            className={cn(
              "gap-2 bg-muted/20",
            )}
          >
            <CardContent>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <ShieldCheck className="mr-1 inline size-3" />
                Privacy
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your profile is only visible to lawyers you&apos;ve engaged. It
                is never listed in the public directory.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}
