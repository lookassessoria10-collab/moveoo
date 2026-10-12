import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { CareAssessmentRunner } from "@/components/care/CareAssessmentRunner";
import { PersonShell } from "@/components/care/PersonShell";
import { consentStatus, REQUIRED_CONSENTS_FOR_CAMERA } from "@/lib/server/services/personAccess";
import { assertProtocolExecutable } from "@/lib/server/services/core";
import { isDomainError } from "@/lib/server/errors";
import { requirePersonScope } from "@/lib/server/session";
import { getProtocol } from "@/lib/care/protocols";

// Telas de câmera dependem de a página não ser ampliada durante o teste.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RunAssessmentPage({ params }: { params: { requestId: string } }) {
  const scope = await requirePersonScope();
  if (scope.request.id !== params.requestId) notFound();
  const { request, workspace } = scope;
  if (request.status !== "pendente" && request.status !== "em_andamento") redirect("/acompanhamento");
  const protocol = getProtocol(request.protocolId);
  if (!protocol?.region) notFound();

  const db = await getDb();
  const consents = await consentStatus(db, scope, REQUIRED_CONSENTS_FOR_CAMERA);
  if (consents.some((c) => !c.accepted)) redirect("/acompanhamento/consentimento");

  let blocked = false;
  try {
    await assertProtocolExecutable(db, workspace, protocol.id);
  } catch (e) {
    if (!isDomainError(e)) throw e;
    blocked = true;
  }
  if (blocked) {
    return (
      <PersonShell workspaceName={workspace.name} brandColor={workspace.brandColor} logoUrl={workspace.logoUrl}>
        <h1 className="text-xl font-bold">Atividade indisponível</h1>
        <p className="mt-2 text-sm text-moveo-muted">Esta atividade está temporariamente indisponível. Avise o profissional.</p>
      </PersonShell>
    );
  }

  return (
    <CareAssessmentRunner
      requestId={request.id}
      region={protocol.region}
      brandName={workspace.name}
      logo={workspace.logoUrl}
      allowDemo={workspace.environment === "demonstracao"}
      professionalName={scope.professionalName}
    />
  );
}
