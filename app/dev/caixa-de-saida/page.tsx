import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { outboxMessages } from "@/db/schema";
import { MoveoLogo, Notice } from "@/components/platform/ui";
import { formatDate } from "@/lib/care/labels";
import { isLocalMode } from "@/lib/server/environment";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caixa de saída (desenvolvimento)", robots: { index: false } };

/**
 * Somente hospedagem local (lib/server/environment.ts): mostra os e-mails/SMS que seriam enviados
 * (links de convite, códigos, confirmação de e-mail). Em produção a rota
 * não existe. Nenhuma mensagem contém dados clínicos.
 */
export default async function DevOutboxPage() {
  if (!isLocalMode()) notFound();
  const messages = await (await getDb()).select().from(outboxMessages).orderBy(desc(outboxMessages.createdAt)).limit(50);
  const linkify = (text: string) =>
    text.split(/(https?:\/\/\S+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a key={i} href={part} className="break-all text-moveo-primary underline">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <MoveoLogo />
      <h1 className="mt-6 text-2xl font-bold">Caixa de saída (desenvolvimento)</h1>
      <div className="mt-3">
        <Notice tone="demo">Nada é enviado de verdade no ambiente local. Use esta página para abrir links e ler códigos.</Notice>
      </div>
      <ul className="mt-6 space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl border border-moveo-border bg-white p-4 text-sm">
            <p className="text-xs text-moveo-muted">
              {m.channel.toUpperCase()} para {m.recipient} · {formatDate(m.createdAt)}
            </p>
            <p className="mt-1 font-semibold">{m.subject}</p>
            <p className="mt-2 whitespace-pre-wrap">{linkify(m.body)}</p>
          </li>
        ))}
        {messages.length === 0 && <p className="text-sm text-moveo-muted">Nenhuma mensagem.</p>}
      </ul>
    </main>
  );
}
