import { rp, STATUS, PAYLABEL } from './sb';
const dt = d => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
export async function makePdf(file, title, sub, sections) {
  const { jsPDF } = await import('jspdf'); const d = new jsPDF({ unit: 'pt', format: 'a4' }); const W = d.internal.pageSize.getWidth(); let y = 50;
  d.setFont('helvetica', 'bold'); d.setFontSize(20); d.setTextColor(242, 106, 31); d.text(title, 40, y); y += 18;
  d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(120); d.text(sub, 40, y); y += 26;
  for (const s of sections) {
    if (y > 740) { d.addPage(); y = 50 }
    d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(30); d.text(s.h, 40, y); y += 18;
    if (s.kv) { s.kv.forEach(([k, v]) => { d.setFont('helvetica', 'normal'); d.setFontSize(10); d.text(k, 40, y); d.setFont('helvetica', 'bold'); d.text(String(v), 230, y); y += 15 }); y += 12; continue }
    const xs = []; let x = 40; s.w.forEach(w => { xs.push(x); x += w });
    const row = (cells, b) => { if (y > 800) { d.addPage(); y = 50 } d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(9); cells.forEach((c, i) => { const t = d.splitTextToSize(String(c), s.w[i] - 6)[0] || ''; const rx = (s.right || []).includes(i) ? xs[i] + s.w[i] - 6 - d.getTextWidth(t) : xs[i]; d.text(t, rx, y) }); y += 14 };
    d.setFillColor(255, 241, 232); d.rect(36, y - 11, W - 72, 16, 'F'); d.setTextColor(242, 106, 31); row(s.head, true); d.setTextColor(30);
    s.rows.forEach(r => row(r)); if (!s.rows.length) row(['Belum ada data']); y += 16;
  }
  d.save(file);
}
export async function receiptPdf(o, customer, driver) {
  const { jsPDF } = await import('jspdf'); const items = o.items || [];
  const d = new jsPDF({ unit: 'pt', format: [226, 330 + items.length * 24] }); let y = 28; const R = 226 - 16;
  const c = (t, b, sz = 9) => { d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(sz); d.text(t, 113, y, { align: 'center' }); y += sz + 4 };
  const lr = (a, b, bold) => { d.setFont('helvetica', bold ? 'bold' : 'normal'); d.setFontSize(9); d.text(String(a), 16, y); d.text(String(b), R, y, { align: 'right' }); y += 13 };
  const hr = () => { d.setDrawColor(200); d.setLineDashPattern([2, 2], 0); d.line(16, y, R, y); y += 12 };
  d.setTextColor(30); c('FOODDASH', true, 15); c('Struk Pesanan', false); hr();
  lr('No', '#' + o.id.slice(0, 8)); lr('Tanggal', dt(o.created_at)); lr('Customer', customer || '-'); if (driver) lr('Driver', driver); lr('Bayar', PAYLABEL[o.payment_method] || o.payment_method || '-'); lr('Status', STATUS[o.status] || o.status); hr();
  items.forEach(i => { d.setFont('helvetica', 'bold'); d.setFontSize(9); d.text(String(i.name).slice(0, 30), 16, y); y += 12; lr(`${i.qty} x ${rp(i.price)}`, rp(i.qty * i.price)) }); hr();
  lr('Subtotal', rp(o.subtotal)); lr(`Ongkir (${o.distance_km || 0} km)`, rp(o.delivery_fee)); lr('Biaya layanan', rp(o.service_fee)); hr(); lr('TOTAL', rp(o.total), true); y += 6;
  d.setFont('helvetica', 'normal'); d.setFontSize(8); d.text(d.splitTextToSize('Alamat: ' + (o.address || '-'), 194), 16, y); y += 24; c('Terima kasih sudah memesan!', false, 8);
  d.save('struk-' + o.id.slice(0, 8) + '.pdf');
}
