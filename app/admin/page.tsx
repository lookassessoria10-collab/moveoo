import { getDb } from "@/db/client";
import { Badge, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { VerificationForm } from "@/components/platform/AdminForms";
import { listProfessionals } from "@/lib/server/services/admin";
import { requireAdmin } from "@/lib/server/session";
import { VERIFICATION_LABEL, formatDate } from "@/lib/care/labels";
import { PROFESSION_LABEL } from "@/lib/care/vocabulary";

export const metadata = { title: "Verificação profissional" };

export default async function AdminVerificationPage() {
  const admin = await requireAdmin();
  const pros = await listProfessionals(await getDb(), admin.id);
  return (
    <>
      <PageHeader title="Verificação profissional" subtitle="Conferência manual do registro no conselho, com fonte, data e responsável." />
      <div className="mb-4">
        <Notice tone="warn">
          Não há integração automática com CREFITO/CREF. Consulte a fonte oficial do conselho e registre exatamente o que
          foi conferido. Nunca marque como verificado sem consulta.
        </Notice>
      </div>
      <div className="space-y-3">
        {pros.map((p) => (
          <Panel key={p.userId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-moveo-muted">
                  {p.email} · {PROFESSION_LABEL[p.profile.profession]} · {p.profile.council}-{p.profile.councilRegion} nº{" "}
                  {p.profile.registrationNumber} · {p.profile.jurisdictionUf}
                </p>
                {p.profile.verifiedAt && (
                  <p className="mt-1 text-xs text-moveo-muted">
                    Última decisão em {formatDate(p.profile.verifiedAt)} — fonte: {p.profile.verificationSource ?? "—"}
                    {p.profile.verificationNote && ` — ${p.profile.verificationNote}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!p.emailVerified && <Badge tone="neutral">e-mail não confirmado</Badge>}
                <Badge tone={VERIFICATION_LABEL[p.profile.verificationStatus].tone}>{VERIFICATION_LABEL[p.profile.verificationStatus].label}</Badge>
              </div>
            </div>
            <div className="mt-4 border-t border-moveo-border pt-4">
              <VerificationForm userId={p.userId} />
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
