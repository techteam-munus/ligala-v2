import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { UserActions } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "lawyer" | "admin";
  status: "active" | "paused" | "banned";
  createdAt: string;
};

type LawyerProfile = {
  slug: string;
  bio: string | null;
  ibpChapterId: string | null;
  probonoAvailable: boolean;
} | null;

type Kyc = { id: string; status: string; createdAt: string }[];

type Audit = {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  reason: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}[];

type Resp = {
  user: User;
  lawyerProfile: LawyerProfile;
  clientProfile: unknown;
  kycSubmissions: Kyc;
  auditLog: Audit;
};

async function load(id: string): Promise<Resp | null> {
  try {
    return await api<Resp>(`/admin/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { user, lawyerProfile, kycSubmissions, auditLog } = data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Created {new Date(user.createdAt).toLocaleString()}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">role: {user.role}</Badge>
        <Badge
          variant="outline"
          className={
            user.status === "active"
              ? "border-green-600 text-green-700"
              : "border-amber-600 text-amber-700"
          }
        >
          status: {user.status}
        </Badge>
      </div>

      <UserActions userId={user.id} currentRole={user.role} currentStatus={user.status} />

      {lawyerProfile ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Lawyer profile
          </h2>
          <p className="mt-2 text-sm">slug: <code>{lawyerProfile.slug}</code></p>
          {lawyerProfile.bio ? (
            <p className="mt-1 text-sm">{lawyerProfile.bio}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Pro bono: {lawyerProfile.probonoAvailable ? "yes" : "no"}
          </p>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          KYC submissions ({kycSubmissions.length})
        </h2>
        {kycSubmissions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <Card className="mt-2 gap-0 py-0">
            <CardContent className="px-0">
              <ul className="divide-y text-sm">
                {kycSubmissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2">
                    <span className="font-mono text-xs">{s.id.slice(0, 8)}</span>
                    <span>{s.status}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Audit log on this user ({auditLog.length})
        </h2>
        {auditLog.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No admin actions yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {auditLog.map((a) => (
              <li key={a.id}>
                <Card className="gap-1 py-3">
                  <CardContent className="px-4">
                    <p className="text-sm font-medium">{a.action}</p>
                    {a.reason ? (
                      <p className="mt-1 text-xs">{a.reason}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
