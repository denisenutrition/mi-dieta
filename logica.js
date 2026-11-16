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

  // --- Mi consulta: imprescindibles, consejo del día y presentación de una dieta nueva ------

  /** Lo marcado ★ por Denise (recomendaciones y tablas, sin las páginas fijas). */
  function imprescindibles(j) {
    return (j.recomendaciones || []).filter(function (r) { return r.imp && !r.pg; })
      .concat((j.tablas || []).filter(function (t) { return t.imp; }));
  }

  /** Frases sueltas para el consejo del día: primero las de las imprescindibles, luego el resto. */
  function consejos(j) {
    var recs = (j.recomendaciones || []).filter(function (r) { return !r.pg; });
    var orden = recs.filter(function (r) { return r.imp; }).concat(recs.filter(function (r) { return !r.imp; }));
    var out = [];
    orden.forEach(function (r) { (r.l || []).forEach(function (l) { if (texto(l)) out.push({ titulo: r.t, texto: texto(l) }); }); });
    return out;
  }

  /** El consejo de un día: va rotando, uno distinto cada día (el mismo durante todo el día). */
  function consejoDelDia(j, fecha) {
    var c = consejos(j);
    if (!c.length) return null;
    var dia = Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86400000);
    return c[dia % c.length];
  }

  /** Pantallas de «Lo importante de tu plan» al llegar una dieta nueva: la nota y las imprescindibles. */
  function presentacion(j) {
    var out = [];
    if (texto(j.nota)) out.push({ titulo: 'Nota de tu dietista', nota: true, lineas: String(j.nota).split(/\n+/).map(texto).filter(Boolean) });
    imprescindibles(j).forEach(function (r) {
      out.push({ titulo: r.t, lineas: r.l ? r.l.slice() : (r.p || []).map(function (x) { return x[0] + (x[1] ? ' · ' + x[1] : ''); }) });
    });
    return out;
  }

  // --- «Mi revisión»: el formulario antes de cada cita ----------------------------------------
  // Las preguntas (de momento fijas; Denise las revisará). escala: 1-5 con sus extremos.
  var PREGUNTAS = [
    { id: 'peso', tipo: 'numero', texto: 'Tu peso (kg)', ayuda: 'Opcional. Mejor en ayunas.' },
    { id: 'seguido', tipo: 'opciones', texto: '¿Cuánto has seguido el plan?', opciones: ['Casi todo', 'Más o menos la mitad', 'Poco'] },
    { id: 'energia', tipo: 'escala', texto: 'Energía', extremos: ['Muy poca', 'Mucha'] },
    { id: 'hambre', tipo: 'escala', texto: 'Hambre entre horas', extremos: ['Nada', 'Mucha'] },
    { id: 'descanso', tipo: 'escala', texto: 'Descanso', extremos: ['Mal', 'Muy bien'] },
    { id: 'digestiones', tipo: 'escala', texto: 'Digestiones', extremos: ['Mal', 'Muy bien'] },
    { id: 'costado', tipo: 'texto', texto: '¿Qué te ha costado más?' },
    { id: 'funcionado', tipo: 'texto', texto: '¿Qué te ha gustado o te ha funcionado?' },
    { id: 'preguntas', tipo: 'texto', texto: '¿Algo que quieras cambiar o preguntarme?' }
  ];

  /** Respuestas del formulario → [[pregunta, respuesta]…] para el portal (las escalas, con su sentido). */
  function respuestasParaEnviar(valores) {
    return PREGUNTAS.map(function (p) {
      var v = valores[p.id] == null ? '' : String(valores[p.id]).trim();
      if (p.tipo === 'escala' && v) v = v + ' de 5 (1 = ' + p.extremos[0].toLowerCase() + ', 5 = ' + p.extremos[1].toLowerCase() + ')';
      return [p.texto, v];
    });
  }

  function hayRespuestas(valores) {
    return PREGUNTAS.some(function (p) { return valores[p.id] != null && String(valores[p.id]).trim(); });
  }

  /** Días que faltan de hoy (Date) a una fecha «AAAA-MM-DD» (0 = hoy, negativo = ya pasó). */
  function diasHasta(hoy, iso) {
    var p = String(iso).split('-');
    return Math.round((Date.UTC(+p[0], p[1] - 1, +p[2]) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86400000);
  }

  /** «Martes 24 nov» */
  function fechaLarga(iso) {
    var p = String(iso).split('-'), d = new Date(+p[0], p[1] - 1, +p[2], 12);
    return DIAS[(d.getDay() + 6) % 7] + ' ' + Number(p[2]) + ' ' + MESES[Number(p[1]) - 1];
  }

  /** Avisar (punto rojo) cuando la revisión está abierta, sin enviar, y faltan 3 días o menos. */
  function avisarRevision(cita, hoy) {
    return !!(cita && cita.abierta && !cita.enviada && diasHasta(hoy, cita.fecha) <= 3);
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
    fechaCorta: fechaCorta, porOpciones: porOpciones, imprescindibles: imprescindibles, consejos: consejos,
    consejoDelDia: consejoDelDia, presentacion: presentacion,
    PREGUNTAS: PREGUNTAS, respuestasParaEnviar: respuestasParaEnviar, hayRespuestas: hayRespuestas, diasHasta: diasHasta,
    fechaLarga: fechaLarga, avisarRevision: avisarRevision, comidasDelDia: comidasDelDia, semana: semana, compra: compra,
    recomendaciones: recomendaciones, nutricionDelDia: nutricionDelDia
  };
})();
