// Builds the proposal email. Plain TypeScript with no framework, so the same file runs on Supabase and in a local preview.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (n: unknown) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');

export function render(view: any, token: string, kind: 'link' | 'signed', owner?: { email?: string; phone?: string; technician?: string }) {
  const s = view.snapshot || {}, b = view.brand || {};
  const accent = b.color || '#1f72d6', dark = b.dark || '#0b2a5c';
  const base = String(s.appUrl || '').replace(/\/$/, '');
  const url = `${base}/p/${token}`;
  const logo = b.logo ? (String(b.logo).startsWith('http') ? b.logo : base + b.logo) : '';
  const phone = b.phone || s.company?.phone || '', web = b.web || s.company?.web || '';
  const signed = kind === 'signed';
  const cap = (t: string) => `<div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:${accent};margin:0 0 6px">${t}</div>`;
  const row = (l: string, r: string, strong = false) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e7ebf1;font-size:15px;${strong ? 'font-weight:700;' : ''}">${l}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e7ebf1;font-size:15px;font-weight:700;white-space:nowrap">${r}</td></tr>`;

  const findings = (s.findings || []).length
    ? `<tr><td style="padding:22px 0 0">${cap('What we found')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(s.findings || []).map((f: any) => row(esc(f.label), esc(f.value))).join('')}</table></td></tr>` : '';
  const why = (s.why || []).length
    ? (s.why || []).map((w: any) => `<div style="background:#f3f6fb;border-left:3px solid ${accent};padding:10px 12px;margin:0 0 8px;font-size:14px;line-height:1.45"><b>${esc(w.name)}</b><br><span style="color:#3c4656">${esc(w.because)}</span></div>`).join('') : '';
  const items = (s.items || []).map((i: any) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e7ebf1;font-size:15px"><span style="color:${accent};font-weight:700">&#10003;</span>&nbsp; ${esc(i.name)}</td></tr>`).join('');
  const others = (s.tiers || []).filter((t: any) => t.name !== s.option);

  const intro = owner
    ? `<b>${esc(view.signed_name || view.customer_name || 'Your customer')}</b> just signed and approved the <b>${esc(s.option)}</b> option for <b>${money(s.total)}</b>. The deposit to collect is <b>${money(s.deposit)}</b>. The full signed proposal is below.`
    : signed
    ? `Thank you, ${esc(view.signed_name || view.customer_name || '')}. Your proposal is signed. This is your copy for your records.`
    : `Here is your water plan from ${esc(view.company_name)}. There is no rush. Read it over, and when you are ready you can sign it from the button below.`;
  const proof = signed
    ? `<tr><td style="padding:18px 0 0"><div style="background:#eef4fc;border:1px solid #cfe0f5;padding:14px 16px;font-size:14px;line-height:1.5;color:#0d2550"><b>Signed electronically</b> by <b>${esc(view.signed_name)}</b> on ${esc(view.signed_at ? new Date(view.signed_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : '')}.<br>You approved the <b>${esc(s.option)}</b> option for <b>${money(s.total)}</b>. The signer agreed to use an electronic signature.</div></td></tr>` : '';
  const button = owner ? 'Open the signed proposal' : signed ? 'View your signed copy' : 'Review and sign your proposal';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#0d2550">
<div style="display:none;max-height:0;overflow:hidden">${signed ? 'Your signed proposal from ' : 'Your water plan from '}${esc(view.company_name)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:${dark};padding:22px 26px;border-bottom:4px solid ${accent}">
  ${logo ? `<img src="${esc(logo)}" alt="${esc(view.company_name)}" style="max-height:48px;max-width:230px;display:block">` : `<span style="color:#fff;font-size:22px;font-weight:700">${esc(view.company_name)}</span>`}
</td></tr>
<tr><td style="padding:26px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td>
    <div style="font-size:24px;font-weight:800;letter-spacing:-0.3px;color:${dark}">${owner ? 'New signed proposal' : signed ? 'Signed proposal' : 'Proposal'}</div>
    <div style="font-size:13px;color:#556070;margin-top:2px">${s.number ? 'No. ' + esc(s.number) + ' &nbsp;·&nbsp; ' : ''}${esc(day(s.date))}</div>
  </td></tr>
  <tr><td style="padding:18px 0 0;font-size:16px;line-height:1.55">${owner ? 'Good news,' : 'Hi ' + esc(view.customer_name || 'there') + ','}<br><br>${intro}</td></tr>
  <tr><td style="padding:20px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" width="50%" style="font-size:14px;line-height:1.5;padding-right:10px">${cap('Prepared for')}<b>${esc(view.customer_name || 'You')}</b>${s.address ? '<br>' + esc(s.address) : ''}</td>
    <td valign="top" width="50%" style="font-size:14px;line-height:1.5">${cap('Prepared by')}<b>${esc(s.preparedBy || view.company_name)}</b><br>${esc(view.company_name)}${phone ? '<br>' + esc(phone) : ''}</td>
  </tr></table></td></tr>
  ${owner ? `<tr><td style="padding:20px 0 0"><div style="background:#f3f6fb;border-left:3px solid ${accent};padding:12px 14px;font-size:14px;line-height:1.6">${cap('Customer contact')}<b>${esc(view.customer_name || '')}</b>${owner.phone ? '<br>' + esc(owner.phone) : ''}${owner.email ? '<br>' + esc(owner.email) : ''}${s.address ? '<br>' + esc(s.address) : ''}${owner.technician ? '<br><span style="color:#556070">Technician: ' + esc(owner.technician) + '</span>' : ''}</div></td></tr>` : ''}
  ${findings}
  <tr><td style="padding:22px 0 0">${cap('Our recommendation')}
    <div style="font-size:20px;font-weight:800;color:${dark}">The ${esc(s.option || '')} option</div>
    <div style="color:#556070;font-size:14px;margin:2px 0 12px">${esc(s.sub || '')}</div>
    ${why}
    <div style="margin-top:14px">${cap('What is included')}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
  </td></tr>
  <tr><td style="padding:22px 0 0">${cap('Your investment')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:10px 0;border-bottom:2px solid ${dark};font-size:20px;font-weight:800;color:${dark}">Total</td><td align="right" style="padding:10px 0;border-bottom:2px solid ${dark};font-size:20px;font-weight:800;color:${dark}">${money(s.total)}</td></tr>
      ${row('Deposit to schedule the work', money(s.deposit))}
      ${row('Estimated monthly payment, if financed', money(s.monthly) + '/mo')}
    </table>
    <div style="font-size:12px;color:#556070;margin-top:8px">The monthly payment is an estimate. Final financing terms are confirmed with the lender.</div>
    ${others.length ? `<div style="margin-top:14px">${cap('Other options we talked about')}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${others.map((t: any) => row(esc(t.name) + ' <span style="color:#556070;font-weight:400">· ' + esc(t.sub) + '</span>', money(t.total))).join('')}</table>` : ''}
  </td></tr>
  ${proof}
  <tr><td style="padding:26px 0 6px"><a href="${esc(url)}" style="display:inline-block;background:${accent};color:#ffffff;padding:15px 26px;text-decoration:none;font-weight:700;font-size:16px">${button}</a></td></tr>
  <tr><td style="padding:20px 0 0;border-top:1px solid #e7ebf1;margin-top:20px;font-size:13px;color:#556070;line-height:1.6"><b style="color:#0d2550">${esc(view.company_name)}</b>${phone || web ? '<br>' + esc([phone, web].filter(Boolean).join('  ·  ')) : ''}<br>${owner ? 'This copy was sent to you because you are an owner of ' + esc(view.company_name) + '.' : 'Questions? Just reply to this email.'}</td></tr>
</table></td></tr></table></td></tr></table></body></html>`;
  return { html, url };
}
