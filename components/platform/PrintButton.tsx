"use client";

import { buttonClass } from "./ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      Imprimir / salvar em PDF
    </button>
  );
}
