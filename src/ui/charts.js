(function () {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = window.VNDFinance.money;
  function donut(items, total, size) {
    const s = size || 184, r = 65, c = 2 * Math.PI * r;
    if (!total) return '<div class="chart-empty"><div class="empty-ring">' + window.VNDIcon('chart', 24) + '</div><strong>Chưa có dữ liệu chi tiêu</strong><span>Thêm giao dịch chi để xem phân bổ.</span></div>';
    let offset = 0;
    const circles = items.map(item => {
      const arc = Math.max(0, item.amount / total * c);
      const node = '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="' + esc(item.color) + '" stroke-width="18" stroke-dasharray="' + arc + ' ' + (c - arc) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')" stroke-linecap="butt"><title>' + esc(item.name) + ': ' + fmt(item.amount) + '</title></circle>';
      offset += arc; return node;
    }).join('');
    return '<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 ' + s + ' ' + s + '" role="img" aria-label="Biểu đồ phân bổ chi tiêu">' + circles + '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="51" fill="var(--surface)"/><text x="50%" y="48%" text-anchor="middle" class="donut-total">' + esc(fmt(total)) + '</text><text x="50%" y="58%" text-anchor="middle" class="donut-caption">Tổng chi tiêu</text></svg></div>';
  }
  function legend(items, total) {
    if (!items.length) return '';
    return '<div class="chart-legend">' + items.slice(0, 6).map(item => '<div class="legend-row"><span class="legend-name"><i style="background:' + esc(item.color) + '"></i>' + esc(item.name) + '</span><strong>' + Math.round(item.amount / total * 100) + '%</strong></div>').join('') + '</div>';
  }
  function bars(series, mode) {
    if (!series.length || !series.some(x => x.income || x.expense)) return '<div class="chart-empty"><div class="empty-ring">' + window.VNDIcon('analytics', 24) + '</div><strong>Chưa có dữ liệu để so sánh</strong><span>Ghi nhận giao dịch để biểu đồ được cập nhật.</span></div>';
    const w = 680, h = 220, left = 42, right = 12, top = 12, bottom = 30;
    const max = Math.max(1, ...series.map(x => Math.max(x.income, x.expense))) * 1.12;
    const plotH = h - top - bottom, slot = (w - left - right) / series.length, barW = Math.min(17, slot * .28);
    const grid = [0, .25, .5, .75, 1].map(p => {
      const y = top + plotH * p;
      return '<line x1="' + left + '" x2="' + (w - right) + '" y1="' + y + '" y2="' + y + '" stroke="var(--border)" stroke-dasharray="3 5"/><text x="' + (left - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="axis-label">' + (max * (1 - p) >= 1000000 ? (max * (1 - p) / 1000000).toFixed(1) + 'tr' : Math.round(max * (1 - p) / 1000) + 'k') + '</text>';
    }).join('');
    const barsSvg = series.map((d, i) => {
      const center = left + slot * i + slot / 2;
      const ih = d.income / max * plotH, eh = d.expense / max * plotH;
      return '<rect x="' + (center - barW - 2) + '" y="' + (top + plotH - ih) + '" width="' + barW + '" height="' + ih + '" rx="4" fill="#16A34A"><title>' + esc(d.label) + ' · Thu nhập: ' + fmt(d.income) + '</title></rect><rect x="' + (center + 2) + '" y="' + (top + plotH - eh) + '" width="' + barW + '" height="' + eh + '" rx="4" fill="#2563EB"><title>' + esc(d.label) + ' · Chi tiêu: ' + fmt(d.expense) + '</title></rect><text x="' + center + '" y="' + (h - 7) + '" text-anchor="middle" class="axis-label">' + esc(d.label) + '</text>';
    }).join('');
    return '<svg class="bar-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Biểu đồ thu nhập và chi tiêu">' + grid + barsSvg + '</svg>';
  }
  function hBars(items, max) {
    if (!items.length) return '<div class="chart-empty compact"><strong>Chưa có dữ liệu</strong><span>Chưa có khoản chi trong khoảng thời gian này.</span></div>';
    return '<div class="horizontal-bars">' + items.map(item => '<div class="hbar-row"><div class="hbar-head"><span>' + esc(item.name) + '</span><strong>' + fmt(item.amount) + '</strong></div><div class="progress-track"><span style="width:' + Math.min(100, item.amount / max * 100) + '%;background:' + esc(item.color) + '"></span></div></div>').join('') + '</div>';
  }
  window.VNDCharts = { donut, legend, bars, hBars };
})();
