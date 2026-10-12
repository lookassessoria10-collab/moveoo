import { MoveoLogo } from "@/components/platform/ui";

export default function NoAccessPage({ searchParams }: { searchParams: { saiu?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <MoveoLogo />
      <h1 className="mt-8 text-xl font-bold">{searchParams.saiu ? "Você saiu" : "Acesso encerrado"}</h1>
      <p className="mt-2 text-sm text-moveo-muted">
        {searchParams.saiu
          ? "Para voltar, abra novamente o link do convite. Vamos pedir um novo código."
          : "Sua sessão expirou ou o convite não é mais válido. Abra o link do convite de novo ou peça um novo ao profissional."}
      </p>
    </main>
  );
}
