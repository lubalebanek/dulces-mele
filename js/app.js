/* ============================================================
   GESTOR DE PASTELERÍA — app.js
   Núcleo: navegación entre secciones, notificaciones (toast),
   confirmaciones, apertura/cierre de modales y utilidades
   compartidas por el resto de los módulos (formatCLP, fechas, etc).
   ============================================================ */

const App = (() => {

  const SECTIONS = [
    { id: 'dashboard',   label: 'Inicio',      icon: 'home' },
    { id: 'pedidos',     label: 'Pedidos',     icon: 'clipboard' },
    { id: 'ventas',      label: 'Ventas',      icon: 'sale' },
    { id: 'productos',   label: 'Productos',   icon: 'cake' },
    { id: 'inventario',  label: 'Inventario',  icon: 'box' },
    { id: 'gastos',      label: 'Gastos',      icon: 'coin' },
    { id: 'reportes',    label: 'Reportes',    icon: 'chart' },
    { id: 'calendario',  label: 'Calendario',  icon: 'calendar' },
    { id: 'config',      label: 'Datos',       icon: 'gear' },
  ];

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    sale: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/>',
    cake: '<path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8"/><path d="M4 21h16"/><path d="M12 11V6"/><path d="M9 6c0-1.2.9-2 1.5-3 .6 1 1.5 1.8 1.5 3s-.7 2-1.5 2S9 7.2 9 6Z"/>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9.5v5"/>',
    chart: '<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M2 20h20"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    close: '<path d="M18 6 6 18M6 6l18 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };

  let currentSection = 'dashboard';

  function svgIcon(name, extra=''){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name]||''}</svg>`;
  }

  /* ---------------- Formato ---------------- */
  function formatCLP(value){
    const n = Math.round(Number(value) || 0);
    return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  }
  function formatDate(iso){
    if (!iso) return '—';
    const [y,m,d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }
  function formatDateLong(iso){
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------------- Toast ---------------- */
  function toast(message, type = 'success'){
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-hide');
      setTimeout(() => { el.remove(); }, 220);
    }, 2800);
  }

  /* ---------------- Confirmación ---------------- */
  function confirmAction({ title, message, confirmLabel = 'Eliminar', danger = true, requireTyping = null, onConfirm }){
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal confirm-modal" role="dialog" aria-modal="true">
        <div class="confirm-icon">!</div>
        <h3>${title}</h3>
        <p class="text-soft">${message}</p>
        ${requireTyping ? `<div class="field full" style="margin-top:10px;"><label>Escribe "${requireTyping}" para confirmar</label><input type="text" id="confirm-typing" /></div>` : ''}
        <div class="modal-footer">
          <button class="btn btn-secondary" data-cancel>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm ${requireTyping ? 'disabled' : ''}>${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function closeConfirm(){
      overlay.classList.add('is-closing');
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 160);
    }

    if (requireTyping){
      const input = overlay.querySelector('#confirm-typing');
      const btn = overlay.querySelector('[data-confirm]');
      input.addEventListener('input', () => {
        btn.disabled = input.value.trim() !== requireTyping;
      });
    }
    overlay.querySelector('[data-cancel]').addEventListener('click', closeConfirm);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeConfirm(); });
    overlay.querySelector('[data-confirm]').addEventListener('click', () => {
      closeConfirm();
      onConfirm();
    });
  }

  /* ---------------- Modal genérico ---------------- */
  function openModal(innerHTML, { large = false, onClose = null } = {}){
    closeModal(true);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal-overlay';
    overlay.innerHTML = `<div class="modal ${large ? 'modal-lg' : ''}" role="dialog" aria-modal="true">${innerHTML}</div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', escListener);
    if (onClose) overlay.dataset.hasOnClose = 'true';
    overlay._onClose = onClose;
    return overlay;
  }
  function escListener(e){
    if (e.key === 'Escape') closeModal();
  }
  function closeModal(immediate = false){
    const overlay = document.getElementById('active-modal-overlay');
    if (overlay){
      if (typeof overlay._onClose === 'function') overlay._onClose();
      document.removeEventListener('keydown', escListener);
      if (immediate){
        overlay.remove();
      } else {
        overlay.classList.add('is-closing');
        setTimeout(() => {
          if (overlay.parentNode) overlay.remove();
        }, 160);
      }
    }
  }

  /* ---------------- Navegación ---------------- */
  function renderNav(){
    const sidebarList = document.getElementById('sidebar-nav-list');
    const bottomList = document.getElementById('bottom-nav-list');
    sidebarList.innerHTML = SECTIONS.map(s => `
      <li>
        <button class="nav-item ${s.id === currentSection ? 'active' : ''}" data-section="${s.id}">
          ${svgIcon(s.icon)}<span>${s.label}</span>
        </button>
      </li>`).join('');

    const mobileSections = SECTIONS.filter(s => ['dashboard','pedidos','ventas','productos','inventario'].includes(s.id));
    bottomList.innerHTML = mobileSections.map(s => `
      <button class="bottom-nav-item ${s.id === currentSection ? 'active' : ''}" data-section="${s.id}">
        ${svgIcon(s.icon)}<span>${s.label}</span>
      </button>`).join('');

    document.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => goTo(btn.dataset.section));
    });
  }

  function goTo(sectionId){
    currentSection = sectionId;
    renderNav();
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="empty-state">Cargando…</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    main.classList.remove('page-enter');
    void main.offsetWidth;
    main.classList.add('page-enter');

    switch(sectionId){
      case 'dashboard':  Dashboard.render(main); break;
      case 'pedidos':    Pedidos.render(main); break;
      case 'ventas':     Ventas.render(main); break;
      case 'productos':  Productos.render(main); break;
      case 'inventario': Inventario.render(main); break;
      case 'gastos':     Gastos.render(main); break;
      case 'reportes':   Reportes.render(main); break;
      case 'calendario': Calendario.render(main); break;
      case 'config':     Config.render(main); break;
      default: main.innerHTML = '<div class="empty-state">Sección no encontrada.</div>';
    }
  }

  /* ---------------- Validaciones compartidas ---------------- */
  function isPositiveNumber(v){
    return v !== '' && v !== null && !isNaN(v) && Number(v) >= 0;
  }
  function isValidDate(v){
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());
  }

  function init(){
    Storage.init();
    renderNav();
    goTo('dashboard');
  }

  return {
    svgIcon, formatCLP, formatDate, formatDateLong, toast, confirmAction,
    openModal, closeModal, goTo, isPositiveNumber, isValidDate, init,
    get currentSection(){ return currentSection; }
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
