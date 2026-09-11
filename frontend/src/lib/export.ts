// Export CSV / impression — utilitaires partagés.

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface PrintSection {
  heading?: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
  footer?: (string | number | null | undefined)[];
}

/** Impression d'un état de reporting (titre + période + tableaux). Retour DG. */
export function printReport(title: string, subtitle: string | undefined, sections: PrintSection[]) {
  const parts: string[] = [`<h1>${esc(title)}</h1>`];
  if (subtitle) parts.push(`<div style="font-size:12px;color:#555;margin:-4px 0 12px">${esc(subtitle)}</div>`);
  for (const s of sections) {
    if (s.heading) parts.push(`<h2>${esc(s.heading)}</h2>`);
    parts.push('<table><thead><tr>' + s.columns.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>');
    for (const r of s.rows) parts.push('<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>');
    parts.push('</tbody>');
    if (s.footer) parts.push('<tfoot><tr>' + s.footer.map((c) => `<td style="font-weight:700;background:#f5f5f5">${esc(c)}</td>`).join('') + '</tr></tfoot>');
    parts.push('</table>');
  }
  printHTML(title, parts.join('\n'));
}

/** Ouvre une fenêtre d'impression avec un contenu HTML autonome. */
export function printHTML(title: string, bodyHTML: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;padding:30px;color:#222}
    h1{font-size:18px;border-bottom:2px solid #333;padding-bottom:8px}
    h2{font-size:13px;margin:18px 0 6px;color:#333;background:#f0f0f0;padding:6px 10px;border-left:3px solid #2563eb}
    table{width:100%;border-collapse:collapse;margin:8px 0 16px}
    td,th{padding:6px 10px;border:1px solid #ddd;font-size:12px}
    th{background:#f0f0f0;text-align:left;font-weight:600}
    .info td:first-child{font-weight:600;background:#f5f5f5;width:35%}
    .footer{margin-top:30px;font-size:11px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:10px}
    @media print{body{padding:12px}}
  </style></head><body>${bodyHTML}
  <div class="footer">FleetPro — Amimer Logistique · imprimé le ${new Date().toLocaleString('fr-FR')}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
