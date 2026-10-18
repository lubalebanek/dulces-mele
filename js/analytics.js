/* ============================================================
   GESTOR DE PASTELERÍA — analytics.js
   Funciones compartidas de fechas y cálculos usadas por
   dashboard.js, reportes.js y calendario.js.
   ============================================================ */

const Analytics = (() => {

  function pad(n){ return String(n).padStart(2,'0'); }
  function toISO(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

  function startOfWeek(date){
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - day);
    return d;
  }

  function getRange(periodo, customStart, customEnd){
    const hoy = new Date();
    let start, end;
    if (periodo === 'semana'){
      start = startOfWeek(hoy);
      end = new Date(start); end.setDate(end.getDate() + 6);
    }else if (periodo === 'mes'){
      start = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      end = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    }else if (periodo === 'mesAnterior'){
      start = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      end = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    }else if (periodo === 'personalizado'){
      start = customStart ? new Date(customStart + 'T00:00:00') : hoy;
      end = customEnd ? new Date(customEnd + 'T00:00:00') : hoy;
    }else{
      start = end = hoy;
    }
    return { start: toISO(start), end: toISO(end) };
  }

  function inRange(fecha, start, end){
    return fecha >= start && fecha <= end;
  }

  function filterByRange(items, start, end){
    return items.filter(i => inRange(i.fecha, start, end));
  }

  function sum(items, key){
    return items.reduce((acc, i) => acc + (Number(i[key]) || 0), 0);
  }

  function groupBy(items, keyFn){
    const map = {};
    items.forEach(i => {
      const k = keyFn(i);
      if (!map[k]) map[k] = [];
      map[k].push(i);
    });
    return map;
  }

  return { toISO, startOfWeek, getRange, inRange, filterByRange, sum, groupBy, pad };
})();
