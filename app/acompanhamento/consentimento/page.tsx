import { getDb } from "@/db/client";
import { PersonShell } from "@/components/care/PersonShell";
import { ConsentForm } from "@/components/care/ConsentForm";
import { consentStatus, REQUIRED_CONSENTS_FOR_CAMERA } from "@/lib/server/services/personAccess";
import { requirePersonScope } from "@/lib/server/session";

export default async function ConsentPage() {
  const scope = await requirePersonScope();
  const docs = await consentStatus(await getDb(), scope, REQUIRED_CONSENTS_FOR_CAMERA);
  return (
    <PersonShell
      workspaceName={scope.workspace.name}
      brandColor={scope.workspace.brandColor}
      logoUrl={scope.workspace.logoUrl}
      isDemo={scope.workspace.environment === "demonstracao"}
    >
      <h1 className="text-2xl font-bold">Antes de começar</h1>
      <p className="mt-1 text-sm text-moveo-muted">Leia com calma. Cada aceite fica registrado com a versão do texto e a data.</p>
      <div className="mt-6">
        <ConsentForm docs={docs.map((d) => ({ key: d.key, title: d.title, body: d.body, version: d.version, accepted: d.accepted }))} />
      </div>
    </PersonShell>
  );
}
