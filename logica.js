/**
 * App de la clienta · lógica pura (sin DOM). Lee el .json que publica el Creador de dietas
 * (formato 1, docs/dieta-json.md) y prepara lo que se pinta. Se prueba en Node.
 */
var Logica = (function () {

  var FORMATO = 1;
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // Orden del súper (el mismo que las secciones del Creador). Lo que no esté aquí va al final.
  var SECCIONES = ['Fruta y verdura', 'Carnicería', 'Pescadería', 'Charcutería', 'Huevos', 'Lácteos', 'Lácteos sin lactosa',
    'Refrigerados', 'Panadería', 'Despensa', 'Conservas', 'Frutos secos', 'Bebidas', 'Congelados', 'Suplementos', 'Otros'];
  var FRACCIONES = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75 };

  function texto(v) { return v == null ? '' : String(v).trim(); }

  /** «60», «1,5», «⅓», «1 ½», «1/2», «2-3» → número; lo demás → null. */
  function numero(c) {
    var s = texto(c).replace(',', '.');
    if (!s) return null;
    var r = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (r) return (Number(r[1]) + Number(r[2])) / 2;
    var f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (f) return Number(f[1]) / Number(f[2]);
    var m = s.match(/^(\d+(?:\.\d+)?)?\s*([½⅓⅔¼¾])?$/);
    if (m && (m[1] || m[2])) return (m[1] ? Number(m[1]) : 0) + (m[2] ? FRACCIONES[m[2]] : 0);
    return null;
  }

  function decimal(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }

  /** «60 g», «1 ud», «al gusto», «chorrito». */
  function cantidad(c, u) {
    u = texto(u); c = texto(c);
    if (u === 'al gusto') return 'al gusto';
    if (!c) return u;
    return u ? c + ' ' + u : c;
  }

  /** Comprueba que el fichero es una dieta que esta app sabe leer. Devuelve el texto del problema o ''. */
  function problema(j) {
    if (!j || typeof j !== 'object') return 'El fichero no es una dieta.';
    if (j.formato !== FORMATO) return 'Esta dieta es de un formato que la app aún no conoce (' + j.formato + '). Actualiza la app.';
    if (!j.clienta || !Array.isArray(j.comidas) || !Array.isArray(j.semana) || j.semana.length !== 7 || !j.platos || !j.alimentos) {
      return 'La dieta está incompleta.';
    }
    return '';
  }

  /** Lunes de la semana de una fecha (a mediodía, para no tropezar con los cambios de hora). */
  function lunesDe(fecha) {
    var d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }
  function diaDeLaSemana(fecha) { return (fecha.getDay() + 6) % 7; }
  function fechaCorta(iso) { var p = String(iso).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + MESES[Number(p[1]) - 1] : texto(iso); }

  /** Un ingrediente listo para pintar: nombre, cantidad y sus «o bien». */
  function ingrediente(j, x) {
    var a = j.alimentos[x[0]] || { n: x[0] };
    return {
      nombre: a.n, cantidad: cantidad(x[1], x[2]),
      equivalentes: (x[3] || []).map(function (q) { return { nombre: (j.alimentos[q[0]] || { n: q[0] }).n, cantidad: cantidad(q[1], q[2]) }; })
    };
  }

  function plato(j, id) {
    var p = j.platos[id];
    if (!p) return null;
    return { id: id, nombre: p.n, preparacion: p.p || '', nut: p.nut || null, ingredientes: p.i.map(function (x) { return ingrediente(j, x); }) };
  }

  /** Las comidas de un día (0 = lunes): [{ nombre, hora, libre, opciones: [plato del día, …alternativas] }]. */
  function comidasDelDia(j, dia) {
    var d = j.semana[dia] || {};
    return j.comidas.filter(function (c) { return c.d.indexOf(dia) !== -1 && d[c.id]; }).map(function (c) {
      var e = d[c.id];
      if (e === 'LIBRE') return { id: c.id, nombre: c.n, hora: c.h, opcional: !!c.o, libre: true, opciones: [] };
      return { id: c.id, nombre: c.n, hora: c.h, opcional: !!c.o, libre: false, opciones: e.map(function (id) { return plato(j, id); }).filter(Boolean) };
    });
  }

  /** La semana de un vistazo: por día, cada comida con su plato y cuántas alternativas tiene. */
  function semana(j) {
    return j.semana.map(function (d, i) {
      return { dia: i, nombre: DIAS[i], comidas: comidasDelDia(j, i).map(function (c) {
        return { nombre: c.nombre, opcional: c.opcional, plato: c.libre ? 'Libre' : (c.opciones[0] || {}).nombre, alternativas: c.libre ? 0 : c.opciones.length - 1 };
      }) };
    });
  }

  /**
   * Lista de la compra: los ingredientes de los platos del día de toda la semana (no las
   * alternativas), sumados por unidad y agrupados por sección del súper.
   * → [{ seccion, items: [{ id, nombre, cantidad }] }]
   */
  /** Dieta «por opciones»: sin días, cada comida con varias opciones (las de semana[0]). */
  function porOpciones(j) { return !!j && j.modo === 'opciones'; }

  function compra(j) {
    if (porOpciones(j)) return compraOpciones(j);
    var por = {};
    j.semana.forEach(function (d, dia) {
      j.comidas.forEach(function (c) {
        var e = d[c.id];
        if (!e || e === 'LIBRE' || c.d.indexOf(dia) === -1 || !j.platos[e[0]]) return;
        j.platos[e[0]].i.forEach(function (x) {
          var a = por[x[0]] || (por[x[0]] = { id: x[0], veces: 0, sumas: {}, sueltas: false, soloOpcional: true });
          a.veces++;
          if (!c.o) a.soloOpcional = false;
          var n = numero(x[1]), u = texto(x[2]);
          if (u === 'al gusto') return;
          if (n == null) { a.sueltas = true; return; }
          a.sumas[u] = (a.sumas[u] || 0) + n;
        });
      });
    });
    var secciones = {};
    Object.keys(por).forEach(function (id) {
      var a = por[id], al = j.alimentos[id] || { n: id, s: 'Otros' };
      var partes = Object.keys(a.sumas).map(function (u) {
        var n = a.sumas[u];
        if (u === 'g' && n >= 1000) return decimal(n / 1000) + ' kg';
        if (u === 'ml' && n >= 1000) return decimal(n / 1000) + ' l';
        return cantidad(decimal(n), u);
      });
      var cant = partes.length ? partes.join(' + ') : 'para ' + a.veces + (a.veces === 1 ? ' comida' : ' comidas');
      var s = al.s || 'Otros';
      (secciones[s] = secciones[s] || []).push({ id: id, nombre: al.n, cantidad: cant, opcional: a.soloOpcional });
    });
    var orden = SECCIONES.slice();
    Object.keys(secciones).sort().forEach(function (s) { if (orden.indexOf(s) === -1) orden.push(s); });
    return orden.filter(function (s) { return secciones[s]; }).map(function (s) {
      return { seccion: s, items: secciones[s].sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }) };
    });
  }

  /** Por opciones: todo lo que usan sus opciones, sin cantidades (depende de lo que elija cada día). */
  function compraOpciones(j) {
    var por = {};
    j.comidas.forEach(function (c) {
      var e = j.semana[0][c.id];
      if (!e || e === 'LIBRE') return;
      e.forEach(function (pid) {
        (j.platos[pid] ? j.platos[pid].i : []).forEach(function (x) {
          var a = por[x[0]] || (por[x[0]] = { id: x[0], soloOpcional: true });
          if (!c.o) a.soloOpcional = false;
        });
      });
    });
    var secciones = {};
    Object.keys(por).forEach(function (id) {
      var al = j.alimentos[id] || { n: id, s: 'Otros' }, s = al.s || 'Otros';
      (secciones[s] = secciones[s] || []).push({ id: id, nombre: al.n, cantidad: '', opcional: por[id].soloOpcional });
    });
    var orden = SECCIONES.slice();
    Object.keys(secciones).sort().forEach(function (s) { if (orden.indexOf(s) === -1) orden.push(s); });
    return orden.filter(function (s) { return secciones[s]; }).map(function (s) {
      return { seccion: s, items: secciones[s].sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }) };
    });
  }

  /** Recomendaciones: primero las páginas fijas (cómo trabajamos…), luego las demás. */
  function recomendaciones(j) {
    var r = j.recomendaciones || [];
    return r.filter(function (x) { return x.pg; }).concat(r.filter(function (x) { return !x.pg; }));
  }

  /** Total del día, si Denise ha decidido enseñarlo (mostrarNutricion). */
  function nutricionDelDia(j, dia) {
    if (!j.ajustes || !j.ajustes.mostrarNutricion || !j.nutricion || !j.nutricion.dias) return null;
    return j.nutricion.dias[dia] || null;
  }

  /** El código del enlace personal («…/?k=abc…» o el antiguo «…/#k=abc…»), o ''. Vale un enlace pegado entero. */
  function codigoDeEnlace(texto) {
    var m = String(texto || '').match(/[?#&]k=([a-fA-F0-9]{32})(?![a-fA-F0-9])/);
    return m ? m[1].toLowerCase() : '';
  }

  /** La dirección del portal para pedir la dieta (con la versión que ya tiene, para no bajarla otra vez). */
  function urlPortal(portal, codigo, version) {
    return portal + (portal.indexOf('?') === -1 ? '?' : '&') + 'k=' + encodeURIComponent(codigo) + (version ? '&v=' + encodeURIComponent(version) : '');
  }

  /**
   * Qué hacer con lo que contesta el portal:
   *   { usar: dieta } · { nada: true } (no hay cambios, o no se pudo comprobar) ·
   *   { olvidar: mensaje } (enlace revocado: se borra la dieta del móvil) · { aviso: mensaje }
   */
  function decidir(r) {
    if (!r || typeof r !== 'object') return { nada: true };
    if (r.ok && r.dieta) return problema(r.dieta) ? { aviso: problema(r.dieta) } : { usar: r.dieta };
    if (r.ok) return { nada: true };
    if (r.codigo === 'no_valido') return { olvidar: r.mensaje };
    if (r.codigo === 'sin_dieta') return { aviso: r.mensaje };
    return { nada: true };
  }

  return {
    FORMATO: FORMATO, codigoDeEnlace: codigoDeEnlace, urlPortal: urlPortal, decidir: decidir, DIAS: DIAS, LETRAS: LETRAS, MESES: MESES,
    numero: numero, cantidad: cantidad, problema: problema, lunesDe: lunesDe, diaDeLaSemana: diaDeLaSemana,
    fechaCorta: fechaCorta, porOpciones: porOpciones, comidasDelDia: comidasDelDia, semana: semana, compra: compra,
    recomendaciones: recomendaciones, nutricionDelDia: nutricionDelDia
  };
})();
