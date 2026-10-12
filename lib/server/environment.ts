/**
 * Hospedagem local: `npm run dev` ou `npm run local` (build otimizado
 * rodando nesta máquina, com MOVEO_AMBIENTE=local no .env.local).
 *
 * No modo local:
 * - a caixa de saída guarda links e códigos em texto e fica visível em
 *   /dev/caixa-de-saida (não há provedor de e-mail/SMS);
 * - os cookies não exigem HTTPS, para funcionar pelo IP da rede local
 *   (ex.: http://192.168.x.x:3000 no celular).
 *
 * NUNCA definir MOVEO_AMBIENTE=local num servidor acessível pela internet.
 */
export function isLocalMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.MOVEO_AMBIENTE === "local";
}
