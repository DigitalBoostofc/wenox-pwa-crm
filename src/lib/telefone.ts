/** Só os dígitos de uma string. */
export function apenasDigitos(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Formata um telefone brasileiro como "(DD) 9XXXX-XXXX" (ou "(DD) XXXX-XXXX").
 *  Aceita entrada com/sem máscara e remove o DDI 55 se vier colado. Guarda-se
 *  só os dígitos (DDD + número); o n8n completa o 55 para a UAZAPI. */
export function mascararTelefone(v: string): string {
  let n = apenasDigitos(v);
  if (n.length > 11 && n.startsWith('55')) n = n.slice(2); // remove DDI digitado
  n = n.slice(0, 11);
  if (n.length === 0) return '';
  if (n.length <= 2) return `(${n}`;
  const ddd = n.slice(0, 2);
  const resto = n.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}
