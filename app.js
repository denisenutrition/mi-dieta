/**
 * App de la clienta · pantalla. Pinta la dieta guardada en el móvil (localStorage) con las
 * funciones de logica.js. De dónde llega la dieta:
 *   ?ejemplo         → la dieta ficticia de ejemplo/dieta.json (pruebas)
 *   «Abrir fichero»  → un .json publicado por el Creador (pruebas)
 *   (paso 2: el enlace personal de la clienta, a través del portal)
 * Una vez guardada, funciona sin conexión.
 */
(function () {
  'use strict';

  var CLAVE = 'dieta';
  var j = null;                                   // la dieta en uso
  var hoy = new Date();
  var hoyIdx = Logica.diaDeLaSemana(hoy);
  var lunes = Logica.lunesDe(hoy);
  var diaSel = hoyIdx;
  var vista = 'hoy';

  // --- utilidades ---------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) anexar(n, arguments[i]);
    return n;
  }
  function anexar(n, h) {
    if (h == null || h === false) return;
    if (Array.isArray(h)) { h.forEach(function (x) { anexar(n, x); }); return; }
    n.appendChild(typeof h === 'object' ? h : document.createTextNode(String(h)));
  }
  /** Sustituye el contenido de un nodo; acepta elementos, textos y listas (anidadas). */
  function poner(n) {
    var f = document.createDocumentFragment();
    for (var i = 1; i < arguments.length; i++) anexar(f, arguments[i]);
    n.replaceChildren(f);
  }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function leer(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function fechaDe(i) { var d = new Date(lunes); d.setDate(lunes.getDate() + i); return d; }
  /** Lo que se guarda de cada dieta (la compra tachada) va con su versión: una dieta nueva empieza limpia. */
  function claveDieta(k) { return k + '-' + j.clienta.id + '-v' + j.version; }
  function nutTexto(n) { return n ? n.kcal + ' kcal · P ' + n.prot + ' g · HC ' + n.hc + ' g · G ' + n.grasa + ' g' : ''; }

  // --- cargar la dieta -------------------------------------------------------------
  function usar(dieta, origen) {
    var p = Logica.problema(dieta);
    if (p) { bienvenida(p); return false; }
    j = dieta;
    guardar(CLAVE, { dieta: dieta, origen: origen, guardada: new Date().toISOString() });
    arrancar();
    return true;
  }

  function bienvenida(error, texto) {
    $('con-dieta').hidden = true;
    $('aviso').hidden = true;
    $('bienvenida').hidden = false;
    $('pruebas-bienvenida').hidden = !CONFIG.pruebas;
    $('bienvenida-texto').textContent = texto || 'Aquí verás tu plan cuando abras el enlace que te ha enviado tu dietista.';
    $('bienvenida-error').hidden = !error;
    $('bienvenida-error').textContent = error || '';
  }

  function abrirFichero() { $('fichero').click(); }
  $('fichero').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    f.text().then(function (t) {
      var d;
      try { d = JSON.parse(t); } catch (e) { bienvenida('Ese fichero no es una dieta (.json).'); return; }
      if (usar(d, 'fichero')) { vista = 'hoy'; diaSel = hoyIdx; pintar(); }
    });
    this.value = '';
  });
  document.addEventListener('click', function (e) { if (CONFIG.pruebas && e.target.closest('[data-abrir-fichero]')) abrirFichero(); });

  // --- cabecera -------------------------------------------------------------------
  function pintarCabecera() {
    $('hola').textContent = 'Hola, ' + j.clienta.nombre;
    $('chip-dieta').textContent = 'Dieta v' + j.version + ' · desde ' + Logica.fechaCorta(j.desde);
    var sub = { hoy: 'Tu día, comida a comida. Desliza para ver alternativas.', semana: 'Tu semana de un vistazo.', compra: 'Lo que necesitas para esta semana.', mas: 'Tus recomendaciones y tu plan.' };
    $('subtitulo').textContent = sub[vista];
    var dias = $('dias');
    dias.hidden = vista !== 'hoy';
    poner(dias, Logica.LETRAS.map(function (l, i) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === diaSel), class: 'dia' + (i === diaSel ? ' activo' : '') + (i === hoyIdx ? ' hoy' : ''),
        'aria-label': Logica.DIAS[i] + (i === hoyIdx ? ' (hoy)' : ''), onclick: function () { diaSel = i; pintar(); } },
        el('span', { class: 'l' }, l), el('span', { class: 'n' }, fechaDe(i).getDate()));
    }));
  }

  // --- Hoy ------------------------------------------------------------------------
  function listaIngredientes(p) {
    return el('ul', { class: 'ingredientes' }, p.ingredientes.map(function (x) {
      if (!x.equivalentes.length) return el('li', null, el('span', null, x.nombre), el('span', { class: 'cant' }, x.cantidad));
      // Con cambios posibles: un ⇄ discreto; al tocar, se despliegan.
      var li = el('li', { class: 'con-eq', role: 'button', tabindex: '0', 'aria-expanded': 'false',
        'aria-label': x.nombre + ', ' + x.cantidad + '. Toca para ver con qué puedes cambiarlo' },
        el('span', null, x.nombre, el('span', { class: 'cambio', 'aria-hidden': 'true' }, '⇄')),
        el('span', { class: 'cant' }, x.cantidad),
        el('div', { class: 'eqs' }, el('span', { class: 't' }, 'Puedes cambiarlo por'),
          x.equivalentes.map(function (q) { return el('div', { class: 'f' }, el('span', null, q.nombre), el('span', null, q.cantidad)); })));
      function alternar() { var a = li.classList.toggle('abierto'); li.setAttribute('aria-expanded', String(a)); }
      li.addEventListener('click', alternar);
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
      return li;
    }));
  }

  function tarjetaComida(c) {
    if (c.libre) {
      return el('article', { class: 'comida libre' },
        el('div', { class: 'comida-cab' }, el('span', { class: 'nombre' }, c.nombre + ' libre'), el('span', { class: 'hora' }, c.hora)),
        el('p', null, 'Elige lo que te apetezca y disfrútalo con calma. El plan ya cuenta con ella.'));
    }
    var ops = c.opciones.map(function (p, k) {
      return el('div', { class: 'opcion' },
        k ? el('span', { class: 'etiqueta-alt' }, 'Alternativa ' + k) : null,
        el('h3', null, p.nombre),
        p.nut ? el('p', { class: 'nut' }, nutTexto(p.nut)) : null,
        listaIngredientes(p),
        p.preparacion ? el('details', { class: 'prep' }, el('summary', null, 'Cómo se hace'), el('p', null, p.preparacion)) : null);
    });
    var carril = el('div', { class: 'opciones' }, ops);
    var actual = 0;
    // Con el dedo se desliza; los puntos también se pueden pulsar (ratón o teclado).
    function ir(k) { carril.scrollTo({ left: k * carril.clientWidth, behavior: 'smooth' }); }
    var puntos = el('div', { class: 'puntos' }, ops.map(function (o, k) {
      return el('button', { type: 'button', class: k ? '' : 'on', 'aria-label': 'Opción ' + (k + 1) + ' de ' + ops.length, onclick: function () { ir(k); } }, el('i'));
    }));
    var pista = el('span', { class: 'pista' }, 'Opción 1 de ' + ops.length + ' · desliza');
    if (ops.length > 1) {
      carril.addEventListener('scroll', function () {
        actual = Math.round(carril.scrollLeft / carril.clientWidth);
        Array.prototype.forEach.call(puntos.children, function (p, i) { p.className = i === actual ? 'on' : ''; });
        pista.textContent = 'Opción ' + (actual + 1) + ' de ' + ops.length + (actual ? '' : ' · desliza');
      }, { passive: true });
    }
    return el('article', { class: 'comida' },
      el('div', { class: 'comida-cab' }, el('span', { class: 'nombre' }, c.nombre), el('span', { class: 'hora' }, c.hora)),
      carril,
      ops.length > 1 ? el('div', { class: 'pie-opciones' }, puntos, pista) : null);
  }

  function pintarHoy() {
    var f = fechaDe(diaSel);
    var comidas = Logica.comidasDelDia(j, diaSel);
    var nut = Logica.nutricionDelDia(j, diaSel);
    poner($('v-hoy'),
      el('div', { class: 'titulo-dia' }, el('h2', null, diaSel === hoyIdx ? 'Hoy, ' + Logica.DIAS[diaSel].toLowerCase() : Logica.DIAS[diaSel]),
        el('span', null, f.getDate() + ' ' + Logica.MESES[f.getMonth()] + (nut ? ' · ' + nut.kcal + ' kcal' : ''))),
      comidas.length ? el('div', { class: 'comidas' }, comidas.map(tarjetaComida)) : el('p', { class: 'vacio' }, 'Este día no tiene comidas en tu plan.'),
      el('p', { class: 'nota-cantidades' }, 'Cantidades ' + j.ajustes.cantidades + ', pesadas ' + j.ajustes.pesos + '.',
        el('br'), 'Toca un ingrediente con ⇄ para ver con qué puedes cambiarlo.'),
      el('button', { type: 'button', class: 'ir-mas', onclick: function () { cambiar('mas'); } },
        'Cómo leer las cantidades y tus recomendaciones: pestaña «Más» (la última) →'));
  }

  // Deslizar el día entero (fuera de las tarjetas con alternativas).
  (function () {
    var x0 = null, y0 = null, enCarril = false;
    var zona = $('v-hoy');
    zona.addEventListener('touchstart', function (e) {
      enCarril = !!e.target.closest('.opciones');
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    zona.addEventListener('touchend', function (e) {
      if (x0 == null || enCarril) { x0 = null; return; }
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      diaSel = (diaSel + (dx < 0 ? 1 : 6)) % 7;
      pintar();
    }, { passive: true });
  })();

  // --- Semana ---------------------------------------------------------------------
  function pintarSemana() {
    poner($('v-semana'), el('div', { class: 'semana' }, Logica.semana(j).map(function (d) {
      var f = fechaDe(d.dia), i = d.dia;
      return el('section', { class: 'sem-dia' + (i === hoyIdx ? ' hoy' : '') },
        el('h3', null, el('span', null, d.nombre + ' ' + f.getDate() + (i === hoyIdx ? ' · hoy' : '')),
          el('button', { type: 'button', onclick: function () { diaSel = i; cambiar('hoy'); } }, 'Ver día')),
        d.comidas.map(function (c) {
          return el('div', { class: 'sem-fila' }, el('span', { class: 'm' }, c.nombre),
            el('span', null, c.plato, c.alternativas ? el('span', { class: 'n-alt' }, c.alternativas + (c.alternativas === 1 ? ' alternativa' : ' alternativas')) : null));
        }));
    })));
  }

  // --- Compra ---------------------------------------------------------------------
  function pintarCompra() {
    var kHechos = claveDieta('compra-hechos'), hechos = leer(kHechos, {});
    var cerradas = leer('compra-cerradas', {});
    var secciones = Logica.compra(j);
    // Reiniciar con una segunda confirmación dentro de la página (para no borrarla sin querer).
    var confirmar = el('div', { class: 'confirmar', hidden: true },
      el('p', null, '¿Estás segura? Se desmarcará todo lo que has tachado.'),
      el('div', { class: 'botones' },
        el('button', { type: 'button', class: 'btn', onclick: function () { confirmar.hidden = true; bReiniciar.hidden = false; } }, 'Cancelar'),
        el('button', { type: 'button', class: 'btn peligro', onclick: function () { guardar(kHechos, {}); pintarCompra(); } }, 'Sí, reiniciar')));
    var hay = Object.keys(hechos).some(function (k) { return hechos[k]; });
    var bReiniciar = el('button', { type: 'button', class: 'btn', disabled: !hay, onclick: function () { confirmar.hidden = false; bReiniciar.hidden = true; } }, 'Reiniciar la lista');
    poner($('v-compra'),
      el('p', { class: 'intro' }, 'Sale de los platos del día de toda la semana. Si cambias un plato por su alternativa, ajusta a ojo. Toca para tachar; toca el nombre de una sección para plegarla.'),
      secciones.map(function (s) {
        var cuenta = el('span', { class: 'cuenta' });
        function contar() { cuenta.textContent = s.items.filter(function (it) { return hechos[it.id]; }).length + ' de ' + s.items.length; }
        contar();
        var sec = el('details', { class: 'seccion-compra', open: !cerradas[s.seccion] },
          el('summary', null, el('span', { class: 'nombre-sec' }, s.seccion), cuenta),
          el('div', { class: 'lista' }, s.items.map(function (it) {
            var cb = el('input', { type: 'checkbox', id: 'c-' + it.id });
            cb.checked = !!hechos[it.id];
            var fila = el('label', { class: 'item' + (cb.checked ? ' hecho' : ''), for: 'c-' + it.id }, cb,
              el('span', { class: 'txt' }, it.nombre), el('span', { class: 'cant' }, it.cantidad));
            cb.addEventListener('change', function () {
              hechos[it.id] = cb.checked; guardar(kHechos, hechos);
              fila.className = 'item' + (cb.checked ? ' hecho' : '');
              contar();
              bReiniciar.disabled = !Object.keys(hechos).some(function (x) { return hechos[x]; });
            });
            return fila;
          })));
        sec.addEventListener('toggle', function () { cerradas[s.seccion] = !sec.open; guardar('compra-cerradas', cerradas); });
        return sec;
      }),
      el('div', { class: 'reiniciar' }, bReiniciar, confirmar));
  }

  // --- Más ------------------------------------------------------------------------
  function bloqueRecomendacion(r, abierto) {
    return el('details', { class: 'bloque', open: abierto }, el('summary', null, r.t), el('ul', null, r.l.map(function (t) { return el('li', null, t); })));
  }

  function pintarMas() {
    var recs = Logica.recomendaciones(j);
    var paginas = recs.filter(function (r) { return r.pg; }), otras = recs.filter(function (r) { return !r.pg; });
    var obj = j.nutricion && j.ajustes.mostrarNutricion ? j.nutricion.objetivo : null;
    poner($('v-mas'),
      el('div', { class: 'tarjeta' }, el('h3', null, 'Tu dieta'),
        el('p', null, 'Versión ' + j.version + ', desde el ' + Logica.fechaCorta(j.desde) + '.'),
        el('div', { class: 'ajustes' },
          el('span', null, 'Cantidades ' + j.ajustes.cantidades),
          el('span', null, 'Pesos ' + j.ajustes.pesos),
          j.ajustes.sin.map(function (x) { return el('span', null, 'Sin ' + x); }),
          obj && obj.kcal ? el('span', null, obj.kcal + ' kcal al día') : null),
        leer('acceso', null) && CONFIG.portal ? el('div', { class: 'comprobar' },
          el('span', { id: 'comprobacion' }, textoComprobada()),
          el('button', { type: 'button', class: 'btn', onclick: function () { comprobar(true); } }, 'Buscar cambios')) : null),
      otras.length ? [el('div', { class: 'grupo-mas' }, 'Recomendaciones'), otras.map(function (r, i) { return bloqueRecomendacion(r, i === 0); })] : null,
      (j.tablas || []).length ? [el('div', { class: 'grupo-mas' }, 'Tablas'), j.tablas.map(function (t) {
        return el('details', { class: 'bloque' }, el('summary', null, t.t),
          el('div', { class: 'porciones' }, t.p.map(function (x) { return el('div', null, x[0], x[1] ? el('small', null, x[1]) : null); })));
      })] : null,
      paginas.length ? [el('div', { class: 'grupo-mas' }, 'Cómo trabajamos'), paginas.map(function (r) { return bloqueRecomendacion(r, false); })] : null,
      CONFIG.pruebas ? el('div', { class: 'pruebas' }, el('button', { type: 'button', 'data-abrir-fichero': true }, 'Cargar otra dieta desde un fichero · para pruebas')) : null);
  }

  // --- navegación -----------------------------------------------------------------
  var PINTAR = { hoy: pintarHoy, semana: pintarSemana, compra: pintarCompra, mas: pintarMas };
  function pintar() {
    if (!j) return;
    pintarCabecera();
    ['hoy', 'semana', 'compra', 'mas'].forEach(function (k) { $('v-' + k).hidden = k !== vista; });
    document.querySelectorAll('nav.pestanas button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === vista); });
    PINTAR[vista]();
  }
  function cambiar(v) { vista = v; guardar('vista', v); pintar(); window.scrollTo(0, 0); }
  document.querySelectorAll('nav.pestanas button').forEach(function (b) { b.addEventListener('click', function () { cambiar(b.dataset.v); }); });
  document.addEventListener('keydown', function (e) {
    if (!j || vista !== 'hoy' || e.target.closest('input')) return;
    if (e.key === 'ArrowRight') { diaSel = (diaSel + 1) % 7; pintar(); }
    if (e.key === 'ArrowLeft') { diaSel = (diaSel + 6) % 7; pintar(); }
  });

  function arrancar() {
    $('bienvenida').hidden = true;
    $('con-dieta').hidden = false;
    var aviso = $('aviso');
    aviso.hidden = !/^X-/.test(j.clienta.id);
    aviso.textContent = 'Dieta de ejemplo con datos inventados';
  }

  // --- el portal: la dieta llega con el enlace personal -----------------------------------
  var comprobando = false;

  /** Pregunta al portal si hay una dieta nueva. Sin conexión o si falla, se queda con la que tiene. */
  function comprobar(manual) {
    var acceso = leer('acceso', null);
    if (!acceso || !acceso.codigo || !CONFIG.portal || comprobando) return Promise.resolve();
    comprobando = true;
    if (manual) estadoComprobacion('Buscando cambios…');
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var reloj = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(Logica.urlPortal(CONFIG.portal, acceso.codigo, j ? j.version : ''), { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        var d = Logica.decidir(r);
        if (r && r.ok) guardar('comprobada', new Date().toISOString());
        if (d.usar) {
          var nueva = !j || j.version !== d.usar.version;
          usar(d.usar, 'portal');
          if (nueva) { diaSel = hoyIdx; vista = 'hoy'; }
          pintar();
        } else if (d.olvidar) {
          olvidar(d.olvidar);
        } else if (d.aviso && !j) {
          bienvenida('', d.aviso);
        } else if (manual) {
          pintar();
        }
      })
      .catch(function () {
        if (!j) bienvenida('No se ha podido conectar. Comprueba que tienes internet y vuelve a abrir el enlace.');
        else if (manual) estadoComprobacion('Sin conexión: sigues viendo la dieta guardada.');
      })
      .then(function () { clearTimeout(reloj); comprobando = false; });
  }

  /** Enlace revocado (o clienta de baja): la dieta se borra del móvil. */
  function olvidar(mensaje) {
    try { localStorage.removeItem(CLAVE); localStorage.removeItem('acceso'); localStorage.removeItem('comprobada'); } catch (e) {}
    j = null;
    bienvenida(mensaje);
  }

  function estadoComprobacion(t) { var n = $('comprobacion'); if (n) n.textContent = t; }

  function textoComprobada() {
    var c = leer('comprobada', null);
    if (!c) return '';
    var f = new Date(c), h = ('0' + f.getHours()).slice(-2) + ':' + ('0' + f.getMinutes()).slice(-2);
    var mismoDia = f.toDateString() === new Date().toDateString();
    return 'Comprobado ' + (mismoDia ? 'hoy a las ' + h : 'el ' + f.getDate() + ' ' + Logica.MESES[f.getMonth()] + ' a las ' + h) + '.';
  }

  // Al volver a la app (estaba en segundo plano), si hace más de media hora, se comprueba.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var c = leer('comprobada', null);
    if (!c || Date.now() - new Date(c).getTime() > 30 * 60 * 1000) comprobar(false);
  });

  // --- inicio ---------------------------------------------------------------------
  var codigo = Logica.codigoDeEnlace(location.hash);
  if (codigo) {
    // Viene del enlace personal: se guarda el código. Se DEJA en la dirección a propósito: en el
    // iPhone, «Añadir a pantalla de inicio» guarda la dirección que hay en ese momento, y la app
    // instalada no comparte lo guardado por Safari; con el código en la dirección, se las apaña sola.
    var anterior = leer('acceso', null);
    if (anterior && anterior.codigo !== codigo) { try { localStorage.removeItem(CLAVE); } catch (e) {} }
    if (!anterior || anterior.codigo !== codigo) guardar('acceso', { codigo: codigo, desde: new Date().toISOString() });
  }
  vista = PINTAR[location.hash.slice(1)] ? location.hash.slice(1) : leer('vista', 'hoy');
  if (!PINTAR[vista]) vista = 'hoy';
  var guardada = leer(CLAVE, null);
  if (codigo || (leer('acceso', null) && !(guardada && guardada.dieta))) {
    if (guardada && !Logica.problema(guardada.dieta)) { j = guardada.dieta; arrancar(); pintar(); }
    else bienvenida('', CONFIG.portal ? 'Buscando tu dieta…' : 'La app aún no está conectada con tu dietista.');
    comprobar(false);
  } else if (CONFIG.pruebas && /[?&]ejemplo\b/.test(location.search)) {
    fetch('ejemplo/dieta.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { if (usar(d, 'ejemplo')) pintar(); history.replaceState(null, '', location.pathname + location.hash); })
      .catch(function () { bienvenida('No se ha podido cargar la dieta de ejemplo.'); });
  } else if (guardada && !Logica.problema(guardada.dieta)) {
    j = guardada.dieta;
    arrancar();
    pintar();
    comprobar(false);
  } else {
    bienvenida('');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
