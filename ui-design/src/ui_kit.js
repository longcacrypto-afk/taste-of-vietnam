// =============================================================================
// CUSTOM SVG ICON KIT, 3D MASCOTS & DESKTOP MANAGEMENT PANEL SHELLS (AI CHEF STYLE)
// =============================================================================

window.UI_KIT = {
  icon(name, cls = 'w-4 h-4') {
    const paths = {
      chefHat: '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/>',
      sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
      search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/>',
      bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
      utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
      moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4M17 5h4"/>',
      snack: '<path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0 1 12 2Z"/><path d="M5 10h14l-1.5 10h-11Z"/>',
      dessert: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3M12 8v3M17 8v3"/>',
      clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
      heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
      mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
      leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
      home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
      compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
      pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      arrowLeft: '<path d="m15 18-6-6 6-6"/>',
      arrowRight: '<path d="m9 18 6-6-6-6"/>',
      send: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
      star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#FACC15" stroke="#FACC15"/>',
      dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
      store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
      scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
      megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
      chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
      alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
      calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
    };
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkles}</svg>`;
  },

  categoryRow() {
    const cats = [
      { label: 'Bữa sáng', icon: 'sun', bg: 'bg-[#FEF3C7]', color: 'text-[#F59E0B]', scr: 'M2-S01' },
      { label: 'Bữa trưa', icon: 'utensils', bg: 'bg-[#DCFCE7]', color: 'text-[#16A34A]', scr: 'M3-S01' },
      { label: 'Bữa tối', icon: 'moon', bg: 'bg-[#EDE9FE]', color: 'text-[#7C3AED]', scr: 'M3-S04' },
      { label: 'Ăn vặt', icon: 'snack', bg: 'bg-[#FCE7F3]', color: 'text-[#DB2777]', scr: 'M2-S02' },
      { label: 'Tráng miệng', icon: 'dessert', bg: 'bg-[#FFE4E6]', color: 'text-[#E11D48]', scr: 'M2-S03' }
    ];
    return `
      <div class="grid grid-cols-5 gap-2 text-center">
        ${cats.map(c => `
          <button onclick="goScreen('${c.scr}')" class="flex flex-col items-center gap-1.5 group">
            <div class="w-12 h-12 rounded-full ${c.bg} ${c.color} flex items-center justify-center shadow-sm group-hover:scale-105 transition">
              ${this.icon(c.icon, 'w-5 h-5')}
            </div>
            <span class="text-[11px] font-semibold text-[#334155]">${c.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  },

  mascotSVG(type = 'mam', size = 'w-20 h-20') {
    const palettes = {
      mam: { body: '#FDE047', bodyDark: '#F59E0B', screen: '#0F172A', eye: '#38BDF8', apron: '#FFFFFF' },
      miu: { body: '#FB923C', bodyDark: '#EA580C', screen: '#1E293B', eye: '#FDE047', apron: '#BAE6FD' },
      la:  { body: '#4ADE80', bodyDark: '#16A34A', screen: '#064E3B', eye: '#A7F3D0', apron: '#ECFDF5' },
      bep: { body: '#FFFBEB', bodyDark: '#F59E0B', screen: '#292524', eye: '#FB923C', apron: '#F97316' }
    };
    const p = palettes[type] || palettes.mam;
    return `
      <svg viewBox="0 0 120 130" class="${size} drop-shadow-md select-none">
        <defs>
          <radialGradient id="g-${type}" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="${p.body}"/>
            <stop offset="100%" stop-color="${p.bodyDark}"/>
          </radialGradient>
        </defs>
        <path d="M18 28 L21 34 L27 37 L21 40 L18 46 L15 40 L9 37 L15 34 Z" fill="#FACC15"/>
        <path d="M104 20 L106 24 L110 26 L106 28 L104 32 L102 28 L98 26 L102 24 Z" fill="#38BDF8"/>
        <path d="M36 36 C26 22, 46 10, 60 16 C74 10, 94 22, 84 36 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <rect x="38" y="33" width="44" height="10" rx="4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.5"/>
        <rect x="28" y="42" width="64" height="62" rx="28" fill="url(#g-${type})" stroke="#FFFFFF" stroke-width="2"/>
        <rect x="36" y="50" width="48" height="30" rx="14" fill="${p.screen}"/>
        <circle cx="49" cy="63" r="4" fill="${p.eye}"/>
        <circle cx="47.5" cy="61.5" r="1.3" fill="#FFFFFF"/>
        <circle cx="71" cy="63" r="4" fill="${p.eye}"/>
        <circle cx="69.5" cy="61.5" r="1.3" fill="#FFFFFF"/>
        <path d="M54 70 Q60 75 66 70" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M40 84 H80 L76 104 H44 Z" fill="${p.apron}"/>
        <circle cx="54" cy="92" r="2" fill="#38BDF8"/>
        <circle cx="66" cy="92" r="2" fill="#F43F5E"/>
        <g transform="rotate(18 96 76)">
          <rect x="93" y="62" width="5" height="34" rx="2.5" fill="#D97706"/>
          <ellipse cx="95.5" cy="56" rx="7" ry="9" fill="#F59E0B"/>
        </g>
        <ellipse cx="48" cy="108" rx="9" ry="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
        <ellipse cx="72" cy="108" rx="9" ry="5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
      </svg>
    `;
  },

  tagPill(label, variant = 'yellow') {
    const styles = {
      yellow: 'bg-[#FEF3C7] text-[#B45309]',
      blue:   'bg-[#DBEAFE] text-[#1D4ED8]',
      green:  'bg-[#DCFCE7] text-[#15803D]',
      purple: 'bg-[#EDE9FE] text-[#6D28D9]',
      mint:   'bg-[#D1FAE5] text-[#047857]',
      orange: 'bg-[#FFEDD5] text-[#C2410C]',
      rose:   'bg-[#FFE4E6] text-[#BE123C]',
      dark:   'bg-[#18181B] text-[#FBBF24]'
    };
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${styles[variant] || styles.yellow}">${label}</span>`;
  },

  // Custom Vector Bar Chart for Admin & Merchant Dashboards
  barChart(bars = [45, 68, 52, 84, 76, 95, 88], labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], color = '#FBBF24', highlightIdx = 5) {
    return `
      <div class="pt-3 pb-1">
        <div class="grid grid-cols-7 gap-2 items-end h-32 px-2">
          ${bars.map((val, i) => `
            <div class="flex flex-col items-center gap-1.5 h-full justify-end group">
              <span class="text-[9px] font-extrabold ${i === highlightIdx ? 'text-[#0F172A] bg-[#FEF3C7] px-1.5 py-0.2 rounded' : 'text-[#64748B] opacity-0 group-hover:opacity-100'}">${val}%</span>
              <div class="w-full max-w-[28px] rounded-t-xl transition-all duration-300" style="height:${val}%; background:${i === highlightIdx ? '#18181B' : color}"></div>
              <span class="text-[10px] font-bold text-[#64748B]">${labels[i] || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // Custom Vector Smooth Line Chart for ROAS / Impressions / Latency
  lineChart(title = 'Xu hướng 7 ngày', valueLabel = '+24.8%', stroke = '#22C55E') {
    return `
      <div class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
        <div class="flex justify-between items-center text-xs">
          <span class="font-extrabold text-[#0F172A]">${title}</span>
          <span class="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-extrabold">${valueLabel}</span>
        </div>
        <svg viewBox="0 0 320 90" class="w-full h-24 overflow-visible">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${stroke}" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="${stroke}" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="20" x2="320" y2="20" stroke="#E2E8F0" stroke-dasharray="3 3"/>
          <line x1="0" y1="50" x2="320" y2="50" stroke="#E2E8F0" stroke-dasharray="3 3"/>
          <line x1="0" y1="80" x2="320" y2="80" stroke="#E2E8F0"/>
          <path d="M0,72 Q45,62 80,54 T160,38 T240,24 T320,12 L320,85 L0,85 Z" fill="url(#lineGrad)"/>
          <path d="M0,72 Q45,62 80,54 T160,38 T240,24 T320,12" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="80" cy="54" r="4" fill="#FFFFFF" stroke="${stroke}" stroke-width="2.5"/>
          <circle cx="160" cy="38" r="4" fill="#FFFFFF" stroke="${stroke}" stroke-width="2.5"/>
          <circle cx="240" cy="24" r="4" fill="#FFFFFF" stroke="${stroke}" stroke-width="2.5"/>
          <circle cx="320" cy="12" r="5" fill="${stroke}" stroke="#FFFFFF" stroke-width="2"/>
        </svg>
      </div>
    `;
  },

  // Custom Vector Donut Chart for Category / Conversion Split
  donutChart(centerTop = 'Tổng', centerBig = '10.8k', items = [
    { label: 'Chỉ đường Maps', pct: '42%', color: '#FBBF24' },
    { label: 'GrabFood', pct: '23%', color: '#22C55E' },
    { label: 'ShopeeFood', pct: '18%', color: '#F97316' },
    { label: 'Xanh SM / Gọi', pct: '17%', color: '#3B82F6' }
  ]) {
    return `
      <div class="flex items-center gap-4 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
        <div class="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" stroke-width="4.5"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#FBBF24" stroke-width="4.5" stroke-dasharray="38 62" stroke-dashoffset="0"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#22C55E" stroke-width="4.5" stroke-dasharray="24 76" stroke-dashoffset="-38"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#F97316" stroke-width="4.5" stroke-dasharray="19 81" stroke-dashoffset="-62"/>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#3B82F6" stroke-width="4.5" stroke-dasharray="19 81" stroke-dashoffset="-81"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-[9px] text-[#64748B] font-bold">${centerTop}</span>
            <span class="text-xs font-extrabold text-[#0F172A]">${centerBig}</span>
          </div>
        </div>
        <div class="flex-1 space-y-1.5 text-[11px]">
          ${items.map(it => `
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-[#334155] font-medium">
                <span class="w-2.5 h-2.5 rounded-full" style="background:${it.color}"></span>
                <span>${it.label}</span>
              </span>
              <b class="text-[#0F172A]">${it.pct}</b>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // Mobile Top Header Bar in AI Chef Benchmark Style
  mobileHeader(title, subtitle, backScreen = 'M3-S01', rightBadge = '') {
    return `
      <div class="flex items-center justify-between pb-1">
        <button onclick="goScreen('${backScreen}')" class="w-9 h-9 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] shadow-sm hover:bg-[#F1F5F9]">
          ${this.icon('arrowLeft', 'w-4 h-4')}
        </button>
        <div class="text-center">
          <div class="font-extrabold text-sm text-[#0F172A] flex items-center justify-center gap-1">
            <span class="text-[#F59E0B]">${this.icon('sparkles', 'w-3.5 h-3.5')}</span>
            <span>${title}</span>
          </div>
          <div class="text-[10px] text-[#64748B]">${subtitle}</div>
        </div>
        <div>
          ${rightBadge || `<button onclick="goScreen('M3-S04')" class="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center shadow-sm">${this.icon('chefHat', 'w-4 h-4')}</button>`}
        </div>
      </div>
    `;
  },

  // Mascot Speech Banner (AI Chef Screen 3 Style)
  mascotTip(mascotType, title, message, bubbleBg = 'bg-[#EFF6FF] border-[#DBEAFE]') {
    return `
      <div class="flex items-center gap-2">
        <div class="shrink-0 -ml-1">${this.mascotSVG(mascotType, 'w-16 h-20')}</div>
        <div class="flex-1 ${bubbleBg} border rounded-2xl rounded-bl-sm p-3 text-[11px] text-[#0F172A] leading-relaxed shadow-sm">
          <div class="font-extrabold text-xs mb-0.5">${title}</div>
          <div class="text-[#334155]">${message}</div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // MERCHANT PORTAL MANAGEMENT SHELL (M6 & M7 — REZTRO + AI CHEF POLISH)
  // ===========================================================================
  merchantShell(activeId, pageTitle, pageSubtitle, kpis, mainContentHtml) {
    const navItems = [
      { id: 'M6-S02', label: 'Tổng quan Quán', icon: 'dashboard' },
      { id: 'M6-S03', label: 'Hồ sơ & Giờ mở', icon: 'store' },
      { id: 'M6-S04', label: 'Chi nhánh (2)', icon: 'pin' },
      { id: 'M6-S05', label: 'Thực đơn & Giá', icon: 'utensils' },
      { id: 'M6-S06', label: 'AI Menu OCR', icon: 'scan', badge: 'AI' },
      { id: 'M6-S07', label: 'Món đặc biệt & KM', icon: 'flame' },
      { id: 'M6-S08', label: 'Thống kê Quán', icon: 'chart' },
      { id: 'M6-S09', label: 'Nhân viên & Quyền', icon: 'users' },
      { id: 'M7-S01', label: 'Quảng bá M7 (ROAS)', icon: 'megaphone', badge: '7x' },
      { id: 'M7-S02', label: 'DS Chiến dịch', icon: 'calendar' },
      { id: 'M7-S03', label: 'Tạo Quảng cáo', icon: 'plus' },
      { id: 'M7-S06', label: 'Preview Tài trợ', icon: 'sparkles' },
      { id: 'M7-S08', label: 'Thanh toán VietQR', icon: 'shield' }
    ];

    return `
      <div class="bg-[#F8FAFC] text-[#0F172A] rounded-3xl border border-[#E2E8F0] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px] text-xs">
        <!-- Left Sidebar -->
        <aside class="lg:col-span-3 bg-[#18181B] text-white p-4 flex flex-col justify-between">
          <div class="space-y-4">
            <!-- Brand Header -->
            <div class="flex items-center gap-2.5 pb-3 border-b border-white/10">
              <div class="w-9 h-9 rounded-xl bg-[#FBBF24] text-[#0F172A] flex items-center justify-center font-extrabold shadow">
                ${this.icon('chefHat', 'w-5 h-5')}
              </div>
              <div>
                <div class="font-extrabold text-sm leading-none">Merchant Portal</div>
                <div class="text-[10px] text-[#4ADE80] font-semibold mt-1">● Phở Phát Tài (Verified)</div>
              </div>
            </div>

            <!-- Navigation Menu -->
            <nav class="space-y-1">
              ${navItems.map(item => {
                const isAct = item.id === activeId;
                return `
                  <button onclick="goScreen('${item.id}')" class="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition ${isAct ? 'bg-[#FBBF24] text-[#0F172A] font-extrabold shadow' : 'text-gray-300 hover:bg-white/10 font-medium'}">
                    <span class="flex items-center gap-2 truncate">
                      ${this.icon(item.icon, 'w-4 h-4 shrink-0')}
                      <span class="truncate">${item.label}</span>
                    </span>
                    ${item.badge ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${isAct ? 'bg-[#18181B] text-[#FBBF24]' : 'bg-[#22C55E] text-white'}">${item.badge}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </nav>
          </div>

          <!-- Mascot Măm Helper Box in Sidebar -->
          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2.5 mt-4">
            <div class="shrink-0">${this.mascotSVG('bep', 'w-12 h-14')}</div>
            <div class="text-[10px] text-gray-300 leading-snug">
              <b class="text-[#FBBF24] block">Bếp AI Hỗ trợ Quán</b>
              Chụp ảnh bảng giá để AI OCR tự cập nhật thực đơn trong 5 giây!
            </div>
          </div>
        </aside>

        <!-- Main Workspace (9 cols) -->
        <div class="lg:col-span-9 p-5 space-y-5 bg-[#F8FAFC]">
          <!-- Top Bar -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold">✨ ${activeId}</span>
                <h3 class="text-base font-extrabold text-[#0F172A]">${pageTitle}</h3>
              </div>
              <p class="text-[11px] text-[#64748B] mt-0.5">${pageSubtitle}</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-1.5 text-[11px] text-[#64748B]">
                ${this.icon('search', 'w-3.5 h-3.5')}
                <span>Tìm món, chi nhánh, chiến dịch...</span>
              </div>
              <button onclick="goScreen('M6-S06')" class="px-3.5 py-2 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0F172A] font-extrabold text-[11px] flex items-center gap-1 shadow-sm">
                ${this.icon('scan', 'w-3.5 h-3.5')}
                <span>Quét Menu OCR</span>
              </button>
            </div>
          </div>

          <!-- KPI Row -->
          ${kpis && kpis.length ? `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              ${kpis.map(k => `
                <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl ${k.bg || 'bg-[#FEF3C7] text-[#F59E0B]'} flex items-center justify-center shrink-0">
                    ${this.icon(k.icon || 'sparkles', 'w-5 h-5')}
                  </div>
                  <div class="min-w-0">
                    <div class="text-[10px] text-[#64748B] truncate">${k.label}</div>
                    <div class="text-base font-extrabold text-[#0F172A] flex items-baseline gap-1.5">
                      <span>${k.value}</span>
                      ${k.delta ? `<span class="text-[10px] font-bold text-[#16A34A]">${k.delta}</span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Dynamic Body -->
          <div class="space-y-4">
            ${mainContentHtml}
          </div>
        </div>
      </div>
    `;
  },

  // ===========================================================================
  // ADMIN CMS & ANALYTICS MANAGEMENT SHELL (M9, M10, M17 — TUNIE + AI CHEF POLISH)
  // ===========================================================================
  adminShell(activeId, pageTitle, pageSubtitle, kpis, mainContentHtml) {
    const navItems = [
      { id: 'M9-S01', label: 'Admin Dashboard', icon: 'dashboard' },
      { id: 'M9-S02', label: 'Thư viện Món (542)', icon: 'utensils' },
      { id: 'M9-S03', label: 'Công thức & Kcal', icon: 'flame' },
      { id: 'M9-S04', label: 'Duyệt Quán Mới', icon: 'store', badge: '8' },
      { id: 'M9-S05', label: 'Duyệt AI Menu OCR', icon: 'scan', badge: '12' },
      { id: 'M9-S06', label: 'Báo sai từ User', icon: 'alert', badge: '5' },
      { id: 'M9-S07', label: 'Kiểm duyệt Ads M7', icon: 'megaphone' },
      { id: 'M9-S08', label: 'Người dùng & RBAC', icon: 'users' },
      { id: 'M9-S09', label: 'Audit Log & AI Config', icon: 'shield' },
      { id: 'M10-S01', label: 'Analytics Tổng quan', icon: 'chart' },
      { id: 'M10-S02', label: 'Phễu Chuyển đổi', icon: 'sliders' },
      { id: 'M10-S03', label: 'Độ chính xác AI (94%)', icon: 'sparkles' },
      { id: 'M10-S04', label: 'Conversion Đối tác', icon: 'pin' },
      { id: 'M10-S06', label: 'Live Events (14)', icon: 'clock' },
      { id: 'M17-S01', label: 'B2G Du lịch & Brand', icon: 'globe' }
    ];

    return `
      <div class="bg-[#F8FAFC] text-[#0F172A] rounded-3xl border border-[#E2E8F0] shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px] text-xs">
        <!-- Left Sidebar -->
        <aside class="lg:col-span-3 bg-[#0F172A] text-white p-4 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="flex items-center gap-2.5 pb-3 border-b border-white/10">
              <div class="w-9 h-9 rounded-xl bg-[#22C55E] text-white flex items-center justify-center font-extrabold shadow">
                ${this.icon('shield', 'w-5 h-5')}
              </div>
              <div>
                <div class="font-extrabold text-sm leading-none">Admin CMS & Ops</div>
                <div class="text-[10px] text-[#FBBF24] font-semibold mt-1">● Taste of Vietnam Core</div>
              </div>
            </div>

            <nav class="space-y-1 max-h-[420px] overflow-y-auto no-scrollbar">
              ${navItems.map(item => {
                const isAct = item.id === activeId;
                return `
                  <button onclick="goScreen('${item.id}')" class="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition ${isAct ? 'bg-[#FBBF24] text-[#0F172A] font-extrabold shadow' : 'text-slate-300 hover:bg-white/10 font-medium'}">
                    <span class="flex items-center gap-2 truncate">
                      ${this.icon(item.icon, 'w-4 h-4 shrink-0')}
                      <span class="truncate">${item.label}</span>
                    </span>
                    ${item.badge ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${isAct ? 'bg-[#0F172A] text-[#FBBF24]' : 'bg-[#EF4444] text-white'}">${item.badge}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </nav>
          </div>

          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2.5 mt-4">
            <div class="shrink-0">${this.mascotSVG('la', 'w-12 h-14')}</div>
            <div class="text-[10px] text-slate-300 leading-snug">
              <b class="text-[#4ADE80] block">Lá Safety Guard</b>
              0.00% vi phạm dị ứng cứng trên toàn bộ 48.200 phiên gợi ý!
            </div>
          </div>
        </aside>

        <!-- Main Admin Workspace (9 cols) -->
        <div class="lg:col-span-9 p-5 space-y-5 bg-[#F8FAFC]">
          <!-- Top Header -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold">🛡️ ${activeId}</span>
                <h3 class="text-base font-extrabold text-[#0F172A]">${pageTitle}</h3>
              </div>
              <p class="text-[11px] text-[#64748B] mt-0.5">${pageSubtitle}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[11px] font-extrabold">● LiteLLM p95: 1.12s</span>
              <button onclick="goScreen('M9-S05')" class="px-3.5 py-2 rounded-full bg-[#18181B] text-white font-extrabold text-[11px] flex items-center gap-1">
                ${this.icon('sparkles', 'w-3.5 h-3.5 text-[#FBBF24]')}
                <span>Hàng đợi Duyệt AI</span>
              </button>
            </div>
          </div>

          <!-- KPI Row -->
          ${kpis && kpis.length ? `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              ${kpis.map(k => `
                <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl ${k.bg || 'bg-[#DCFCE7] text-[#16A34A]'} flex items-center justify-center shrink-0">
                    ${this.icon(k.icon || 'chart', 'w-5 h-5')}
                  </div>
                  <div class="min-w-0">
                    <div class="text-[10px] text-[#64748B] truncate">${k.label}</div>
                    <div class="text-base font-extrabold text-[#0F172A] flex items-baseline gap-1.5">
                      <span>${k.value}</span>
                      ${k.delta ? `<span class="text-[10px] font-bold text-[#16A34A]">${k.delta}</span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Dynamic Admin Content -->
          <div class="space-y-4">
            ${mainContentHtml}
          </div>
        </div>
      </div>
    `;
  }
};
