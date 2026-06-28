/**
 * ViOs Taller - Panel Administrativo Centralizado
 * VERSIÓN DEFINITIVA, DEPURADA Y SIN DUPLICADOS
 */

window.addEventListener("DOMContentLoaded", async () => {
  // 1. Verificación de Seguridad
  const { data: { session } } = await window.db.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("btnLogout").addEventListener("click", (e) => {
    e.preventDefault();
    cerrarSesion();
  });

  inicializarFormularios();
  inicializarFormularioMateriales();

  document.getElementById("formConfigContacto")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = {
      telefono: document.getElementById("cfgTelefono").value,
      whatsapp: document.getElementById("cfgWhatsapp").value,
      correo: document.getElementById("cfgCorreo").value,
      facebook: document.getElementById("cfgFacebook").value,
      instagram: document.getElementById("cfgInstagram").value,
    };
    try {
      const { error } = await window.db.from("config_contacto").update(datos).eq("id", 1);
      if (error) throw error;
      mostrarNotificacion("Información de contacto actualizada exitosamente.", "success");
    } catch (err) {
      mostrarNotificacion("Error al guardar configuración: " + err.message, "error");
    }
  });

  // 3. Carga Inicial
  if (window.db) {
    cargarTrabajos();
    cargarHitosAdmin();
    cargarProveedoresAdmin();
    cargarInventario();
    cargarMaterialesEnCotizador();
    cargarClientesEnCotizador();
    cargarAlertasCRM(); // CRM de Inactividad (25 días)
    
    if (typeof activarRealtimeAdmin === "function") activarRealtimeAdmin();
    if (typeof aplicarRestriccionesDeRol === "function") aplicarRestriccionesDeRol();
  }
});

// --- SISTEMA TOAST DE NOTIFICACIONES ---
function mostrarNotificacion(mensaje, tipo = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast-vios";
    if (tipo === "error") {
        toast.style.background = "linear-gradient(135deg, #ff004c, #5e001c)";
        toast.style.boxShadow = "0 4px 15px rgba(255, 0, 76, 0.3)";
    } else if (tipo === "success") {
        toast.style.background = "linear-gradient(135deg, #00e676, #009624)";
    }
    toast.innerText = mensaje;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}

// --- ENTRADA EN TIEMPO REAL (REALTIME CANALS) ---
function activarRealtimeAdmin() {
  window.db.channel("realtime-trabajos-admin").on("postgres_changes", { event: "*", schema: "public", table: "trabajos" }, () => cargarTrabajos()).subscribe();
  window.db.channel("realtime-cronologia-admin").on("postgres_changes", { event: "*", schema: "public", table: "cronologia" }, () => cargarHitosAdmin()).subscribe();
  window.db.channel("realtime-proveedores-admin").on("postgres_changes", { event: "*", schema: "public", table: "proveedores" }, () => cargarProveedoresAdmin()).subscribe();
}

// --- RENDERIZADO Y CARGA DE TABLAS ---
async function cargarTrabajos() {
  const tbody = document.getElementById("tbodyCatalogoAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db.from("trabajos").select("*").order("id", { ascending: false });
    if (error) throw error;
    tbody.innerHTML = data.map((t) => `
        <tr>
            <td class="ps-3"><img src="${t.url_imagen}" class="rounded border" style="width: 50px; height: 50px; object-fit: cover;"></td>
            <td class="fw-bold text-info">${t.titulo}</td>
            <td><span class="badge bg-secondary bg-opacity-50 text-white-50">${t.categoria}</span></td>
            <td class="text-white-50 text-truncate" style="max-width: 250px;">${t.descripcion || ""}</td>
            <td class="text-end pe-3">
                <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('trabajos', '${t.id}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join("");
  } catch (err) { console.error("Error al cargar catálogo:", err.message); }
}

async function cargarHitosAdmin() {
  const tbody = document.getElementById("tbodyCronologiaAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db.from("cronologia").select("*").order("ano", { ascending: true });
    if (error) throw error;
    tbody.innerHTML = data.map((h) => `
        <tr>
            <td class="ps-3 fw-bold text-info font-monospace">${h.ano}</td>
            <td class="fw-bold">${h.titulo}</td>
            <td class="text-white-50">${h.descripcion}</td>
            <td class="text-end pe-3">
                <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('cronologia', '${h.id}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join("");
  } catch (err) { console.error("Error al cargar cronología:", err.message); }
}

async function cargarProveedoresAdmin() {
  const tbody = document.getElementById("tbodyProveedoresAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db.from("proveedores").select("*").order("id", { ascending: false });
    if (error) throw error;
    tbody.innerHTML = data.map((p) => `
        <tr>
            <td class="ps-3"><img src="${p.url_logo}" class="bg-light p-1 rounded" style="width: 70px; height: 30px; object-fit: contain;"></td>
            <td class="fw-bold text-white">${p.nombre}</td>
            <td class="text-end pe-3">
                <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('proveedores', '${p.id}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join("");
  } catch (err) { console.error("Error al cargar proveedores:", err.message); }
}

// --- MÓDULO DE ALMACENAMIENTO (STORAGE) ---
async function subirArchivoAlStorage(archivo, bucketName) {
  const extension = archivo.name.split('.').pop();
  const nombreUnico = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
  const filePath = `public/${nombreUnico}`;
  const { data, error } = await window.db.storage.from(bucketName).upload(filePath, archivo, { cacheControl: '3600', upsert: false });
  if (error) throw new Error("Fallo al subir archivo: " + error.message);
  const { data: urlData } = window.db.storage.from(bucketName).getPublicUrl(filePath);
  return urlData.publicUrl;
}

// --- ACCIONES AUXILIARES ---
async function eliminarRegistro(tabla, id) {
  if (!confirm(`¿Estás seguro de que deseas eliminar este registro de la tabla "${tabla}"?`)) return;
  try {
    const { error } = await window.db.from(tabla).delete().eq("id", id);
    if (error) throw error;
    mostrarNotificacion("Registro eliminado con éxito.", "success");
  } catch (err) {
    mostrarNotificacion("Error al eliminar: " + err.message, "error");
  }
}

// --- FORMULARIOS ---
function inicializarFormularios() {
  // GUARDAR TRABAJO
  document.getElementById("formNuevoTrabajo")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const fileInput = document.getElementById("addTrabajoImg");
    if (!fileInput.files || fileInput.files.length === 0) return mostrarNotificacion("Selecciona una imagen.", "error");

    btnSubmit.disabled = true;
    try {
      const urlReal = await subirArchivoAlStorage(fileInput.files[0], "trabajos");
      const nuevoTrabajo = {
        titulo: document.getElementById("addTrabajoTitulo").value,
        categoria: document.getElementById("addTrabajoCategoria").value,
        descripcion: document.getElementById("addTrabajoDesc").value,
        url_imagen: urlReal,
      };
      const { error } = await window.db.from("trabajos").insert([nuevoTrabajo]);
      if (error) throw error;

      mostrarNotificacion("¡Trabajo publicado!", "success");
      e.target.reset();
      bootstrap.Modal.getInstance(document.getElementById("modalNuevoTrabajo"))?.hide();
      cargarTrabajos();
    } catch (err) { mostrarNotificacion("Error al guardar: " + err.message, "error"); } 
    finally { btnSubmit.disabled = false; }
  });

  // GUARDAR HITO
  document.getElementById("formNuevoHito")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoHito = {
      ano: document.getElementById("addHitoAno").value,
      titulo: document.getElementById("addHitoTitulo").value,
      descripcion: document.getElementById("addHitoDesc").value,
    };
    try {
      const { error } = await window.db.from("cronologia").insert([nuevoHito]);
      if (error) throw error;
      mostrarNotificacion("¡Hito guardado!", "success");
      e.target.reset();
      bootstrap.Modal.getInstance(document.getElementById("modalNuevoHito"))?.hide();
      cargarHitosAdmin();
    } catch (err) { mostrarNotificacion("Error al guardar: " + err.message, "error"); }
  });

  // GUARDAR PROVEEDOR
  document.getElementById("formNuevoProveedor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const fileInput = document.getElementById("addProvLogo");
    if (!fileInput.files || fileInput.files.length === 0) return mostrarNotificacion("Selecciona una imagen.", "error");

    btnSubmit.disabled = true;
    try {
      const urlReal = await subirArchivoAlStorage(fileInput.files[0], "proveedores");
      const { error } = await window.db.from("proveedores").insert([{ nombre: document.getElementById("addProvNombre").value, url_logo: urlReal }]);
      if (error) throw error;

      mostrarNotificacion("¡Proveedor agregado!", "success");
      e.target.reset();
      bootstrap.Modal.getInstance(document.getElementById("modalNuevoProveedor"))?.hide();
      cargarProveedoresAdmin();
    } catch (err) { mostrarNotificacion("Error al guardar: " + err.message, "error"); } 
    finally { btnSubmit.disabled = false; }
  });
}

// --- INVENTARIO Y MATERIALES (SISTEMA INTELIGENTE) ---

function inicializarFormularioMateriales() {
  cargarMarcasEnDroplist(); // Carga Proveedores al droplist

  document.getElementById("formNuevoMaterial")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombreInput = document.getElementById("matNombre").value.trim();
    const proveedorId = document.getElementById("matProveedor").value;
    const dataMaterial = {
      nombre: nombreInput, unidad_medida: document.getElementById("matUnidad").value,
      costo_m2: 0, precio_venta_m2: parseFloat(document.getElementById("matPrecio").value),
      stock_actual: parseFloat(document.getElementById("matStock").value),
      proveedor_id: proveedorId || null, activo: true, ultima_actualizacion: new Date().toISOString()
    };

    try {
      // Búsqueda inteligente: ¿Ya existe pero está oculto?
      const { data: existente } = await window.db.from("materiales").select("id, activo").ilike("nombre", nombreInput);

      if (existente && existente.length > 0) {
        if (existente[0].activo) {
          return mostrarNotificacion("Ese material ya existe y está activo en tu tabla.", "error");
        } else {
          // MAGIA: El material estaba "eliminado/oculto". Lo reactivamos.
          mostrarNotificacion(`Reactivando material oculto en espera de stock...`, "success");
          await window.db.from("materiales").update(dataMaterial).eq("id", existente[0].id);
        }
      } else {
        // No existía, se crea de cero.
        await window.db.from("materiales").insert([dataMaterial]);
        mostrarNotificacion("¡Material registrado como nuevo!", "success");
      }

      document.getElementById("formNuevoMaterial").reset();
      bootstrap.Modal.getInstance(document.getElementById("modalNuevoMaterial"))?.hide();
      cargarInventario();
      cargarMaterialesEnCotizador();
    } catch (err) { mostrarNotificacion("Error: " + err.message, "error"); }
  });

  // Listener para el nuevo modal elegante de Ajuste
  document.getElementById("formAjustarStock")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("ajusteMaterialId").value;
    const stockActual = parseFloat(document.getElementById("ajusteStockActual").value);
    const ajuste = parseFloat(document.getElementById("ajusteCantidad").value);
    
    const nuevoStock = stockActual + ajuste;
    if (nuevoStock < 0) return mostrarNotificacion("El stock final no puede ser menor a cero.", "error");

    try {
      await window.db.from("materiales").update({ 
        stock_actual: nuevoStock, ultima_actualizacion: new Date().toISOString() 
      }).eq("id", id);
      
      mostrarNotificacion("Stock actualizado correctamente.", "success");
      bootstrap.Modal.getInstance(document.getElementById("modalAjustarStock"))?.hide();
      cargarInventario();
    } catch (err) { mostrarNotificacion("Error: " + err.message, "error"); }
  });
}

async function cargarMarcasEnDroplist() {
  const select = document.getElementById("matProveedor");
  if (!select) return;
  const { data } = await window.db.from("proveedores").select("id, nombre").order("nombre");
  if (data) select.innerHTML = '<option value="">Sin marca / Genérico</option>' + data.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");
}

async function cargarInventario() {
  const tbody = document.getElementById("tbodyInventario");
  if (!tbody) return;
  try {
    const { data, error } = await window.db.from("materiales").select("*").eq("activo", true).order("nombre", { ascending: true });
    if (error) throw error;
    
    const hoy = new Date();
    let html = "";

    for (let m of data) {
        // Lógica de 3 meses (90 días): Auto-ocultar si está en 0 y nadie lo toca
        if (m.stock_actual <= 0 && m.ultima_actualizacion) {
            const difDias = Math.floor((hoy - new Date(m.ultima_actualizacion)) / (1000 * 60 * 60 * 24));
            if (difDias >= 90) {
                // Se oculta silenciosamente
                window.db.from("materiales").update({ activo: false }).eq("id", m.id).then();
                continue; // Saltamos a la siguiente fila sin dibujarlo
            }
        }

        const esBajo = m.stock_actual <= (m.stock_minimo || 0);
        html += `
        <tr class="${esBajo ? 'fila-alerta-stock' : ''}">
            <td class="ps-3 fw-bold text-white">${m.nombre}</td>
            <td class="text-white-50">${m.unidad_medida || "N/A"}</td>
            <td class="text-white-50">${m.stock_minimo || 0}</td>
            <td class="fw-bold fs-6 ${esBajo ? "text-danger" : "text-success"}">${m.stock_actual || 0}</td>
            <td>${esBajo ? '<span class="badge bg-danger bg-opacity-25 text-danger border border-danger rounded-pill">Stock Bajo</span>' : '<span class="badge bg-success bg-opacity-25 text-success border border-success rounded-pill">Óptimo</span>'}</td>
            <td class="text-end pe-3">
                <button class="btn btn-outline-info btn-sm border-0 me-1" onclick="abrirModalAjuste('${m.id}', '${m.nombre}', ${m.stock_actual})"><i class="bi bi-sliders"></i></button>
                <button class="btn btn-outline-danger btn-sm border-0" onclick="inactivarMaterial('${m.id}', '${m.nombre}')"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
  } catch (err) { console.error("Error inventario:", err.message); }
}

// Dispara el modal elegante en lugar del feo prompt()
window.abrirModalAjuste = function(id, nombre, stockActual) {
    document.getElementById("ajusteMaterialId").value = id;
    document.getElementById("ajusteStockActual").value = stockActual;
    document.getElementById("ajusteNombreMaterial").innerText = nombre;
    document.getElementById("ajusteTextoStockActual").innerText = stockActual;
    document.getElementById("ajusteCantidad").value = "";
    new bootstrap.Modal(document.getElementById("modalAjustarStock")).show();
};

// "Soft Delete" en lugar de borrado físico destructivo
window.inactivarMaterial = async function(id, nombre) {
  if (!confirm(`¿Ocultar "${nombre}" del inventario? (Su historial financiero seguirá a salvo en la base de datos)`)) return;
  try {
    const { error } = await window.db.from("materiales").update({ activo: false }).eq("id", id);
    if (error) throw error;
    mostrarNotificacion("Material archivado correctamente.", "success");
    cargarInventario();
    cargarMaterialesEnCotizador();
  } catch (err) { mostrarNotificacion("Error: " + err.message, "error"); }
};

// --- COTIZADOR ---
async function cargarMaterialesEnCotizador() {
  const select = document.getElementById("selMaterialAdmin");
  if (!select) return;
  const { data, error } = await window.db.from("materiales").select("id, nombre, costo_m2, precio_venta_m2");
  if (!error) {
    select.innerHTML = '<option value="">Selecciona material...</option>' + data.map(m => `<option value="${m.id}" data-costo="${m.costo_m2}" data-venta="${m.precio_venta_m2}">${m.nombre}</option>`).join("");
  }
}

async function cargarClientesEnCotizador() {
  const select = document.getElementById("selClienteCotizador");
  if (!select) return;
  const { data, error } = await window.db.from("clientes").select("id, nombre, telefono").order("nombre", { ascending: true });
  if (!error) {
    select.innerHTML = '<option value="">Selecciona un cliente...</option>' + data.map(c => `<option value="${c.id}" data-telefono="${c.telefono || ""}">${c.nombre}</option>`).join("");
  }
}

let cotizacionActual = null; // Variable global para el PDF

document.getElementById("btnCalcularCotizacion")?.addEventListener("click", () => {
    const selectCliente = document.getElementById("selClienteCotizador");
    const selectMaterial = document.getElementById("selMaterialAdmin");
    const ancho = parseFloat(document.getElementById("cotAncho").value) || 0;
    const alto = parseFloat(document.getElementById("cotAlto").value) || 0;
    const precioCobrado = parseFloat(document.getElementById("cotPrecioManual").value) || 0;
    const ivaPorcentaje = parseFloat(document.getElementById("cotIvaPorcentaje").value) || 0; // Toma el IVA variable

    if (!selectCliente.value || !selectMaterial.value || ancho <= 0 || alto <= 0 || precioCobrado <= 0) {
      return mostrarNotificacion("Completa todos los campos correctamente.", "error");
    }

    const optionCliente = selectCliente.options[selectCliente.selectedIndex];
    const optionMaterial = selectMaterial.options[selectMaterial.selectedIndex];
    const m2 = ancho * alto;
    const costoBaseMaterial = parseFloat(optionMaterial.dataset.costo) || 0;

    const costoTotalMateriaPrima = m2 * costoBaseMaterial;
    const subtotalVenta = m2 * precioCobrado;
    const totalIva = subtotalVenta * ivaPorcentaje;
    const totalFinal = subtotalVenta + totalIva;
    const gananciaNeta = subtotalVenta - costoTotalMateriaPrima;

    cotizacionActual = {
      cliente_id: selectCliente.value, nombreCliente: optionCliente.text, telefonoCliente: optionCliente.dataset.telefono,
      material_id: selectMaterial.value, nombreMaterial: optionMaterial.text, cantidad_m2: m2,
      precio_aplicado: precioCobrado, total_estimado: totalFinal, notas: document.getElementById("cotNotas").value,
      folio: `VIO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    };

    document.getElementById("resultadoCotizacion").innerHTML = `$${totalFinal.toFixed(2)} <span class="d-block small text-success fw-normal mt-1">Ganancia est.: $${gananciaNeta.toFixed(2)}</span>`;
    document.getElementById("btnGuardarCotizacion").removeAttribute("disabled");
});

document.getElementById("selMaterialAdmin")?.addEventListener("change", (e) => {
  const option = e.target.options[e.target.selectedIndex];
  if (e.target.value) {
    document.getElementById("cotPrecioManual").value = option.dataset.venta;
    document.getElementById("infoCostoInterno").innerText = `Costo base: $${parseFloat(option.dataset.costo).toFixed(2)}`;
  }
});

// --- SISTEMA DE ALERTAS CRM (Inactividad) ---
async function cargarAlertasCRM() {
    const contenedor = document.getElementById("contenedorAlertas"); 
    if (!contenedor) return;
    try {
        const { data, error } = await window.db.from("clientes").select("nombre, ultima_compra");
        if (error) throw error;
        const hoy = new Date();
        const umbralDias = 25; 
        let html = "";
        data.forEach(cliente => {
            if (cliente.ultima_compra) {
                const dif = Math.floor((hoy - new Date(cliente.ultima_compra)) / (1000 * 60 * 60 * 24));
                if (dif >= umbralDias) {
                    html += `<div class="alert alert-warning mb-2 border-warning text-white" style="background: rgba(255, 179, 0, 0.15);"><i class="bi bi-exclamation-triangle-fill text-warning me-2"></i><strong>${cliente.nombre}</strong> no ha comprado en <strong>${dif} días</strong>. Sugerencia: Enviar promoción.</div>`;
                }
            }
        });
        contenedor.innerHTML = html || "<p class='text-white-50 small'>No hay alertas pendientes.</p>";
    } catch (err) { console.error("Error CRM:", err.message); }
}

// ... Mantener tu lógica jsPDF (generarPDFCotizacion) e inserción final (formCotizadorPro submit) intactas abajo ...

async function cerrarSesion() { /* Igual */ }

// Abrir modal de compra
window.abrirModalCompra = function(id, nombre) {
    document.getElementById("compraMaterialId").value = id;
    document.getElementById("compraMaterialNombre").value = nombre;
    new bootstrap.Modal(document.getElementById("modalNuevaCompra")).show();
};

// Procesar compra
document.getElementById("formNuevaCompra")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const materialId = document.getElementById("compraMaterialId").value;
    const rolls = parseFloat(document.getElementById("compraRollos").value);
    const largo = parseFloat(document.getElementById("compraLargo").value);
    const ancho = parseFloat(document.getElementById("compraAncho").value);
    const costoTotal = parseFloat(document.getElementById("compraCosto").value);

    // Normalización a m2 (esto es lo que se guarda en la tabla y lo que el trigger suma al stock)
    const metrosCuadrados = rolls * largo * ancho;

    try {
        const { error } = await window.db.from("entradas_inventario").insert([{
            material_id: materialId,
            metros_cuadrados_recibidos: metrosCuadrados,
            costo_total: costoTotal
        }]);

        if (error) throw error;

        mostrarNotificacion(`Compra registrada: ${metrosCuadrados} m² agregados.`, "success");
        bootstrap.Modal.getInstance(document.getElementById("modalNuevaCompra")).hide();
        cargarInventario(); // Refresca la tabla
    } catch (err) {
        mostrarNotificacion("Error al registrar compra: " + err.message, "error");
    }
});

// Lógica para aplicar el ajuste desde el modal
document.getElementById("formAjustarStock")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("ajusteMaterialId").value;
    const stockActual = parseFloat(document.getElementById("ajusteStockActual").value);
    const ajuste = parseFloat(document.getElementById("ajusteCantidad").value);
    
    const nuevoStock = stockActual + ajuste;
    if (nuevoStock < 0) return mostrarNotificacion("Error: El stock no puede ser menor a cero.", "error");

    try {
        // Directo a la tabla materiales
        const { error } = await window.db.from("materiales")
            .update({ stock_actual: nuevoStock, ultima_actualizacion: new Date().toISOString() })
            .eq("id", id);
            
        if (error) throw error;
        mostrarNotificacion("Stock ajustado correctamente.", "success");
        bootstrap.Modal.getInstance(document.getElementById("modalAjustarStock")).hide();
        cargarInventario();
    } catch (err) { mostrarNotificacion("Error: " + err.message, "error"); }
});

// --- SEGURIDAD: CONTROL DE ACCESOS POR ROL ---
async function aplicarRestriccionesDeRol() {
    try {
        const { data: { user } } = await window.db.auth.getUser();
        if (!user) return;
        const { data: perfil } = await window.db.from('perfiles').select('rol').eq('id', user.id).single();
        const rol = perfil?.rol;

        // Ocultar botones de borrar (clase .btn-outline-danger) si no es Master
        if (rol !== 'master') {
            document.querySelectorAll('.btn-outline-danger').forEach(btn => btn.style.display = 'none');
        }

        // Bloqueo de Pestañas según rol
        if (rol === 'systems' || rol === 'content_creator') {
            const tabsBloqueados = ['tab-inventario-btn', 'tab-cotizador-btn', 'tab-config-btn'];
            tabsBloqueados.forEach(id => {
                const el = document.getElementById(id);
                if(el) el.style.display = 'none';
            });
        }
        
        if (rol === 'content_creator') {
            const el = document.getElementById('tab-contacto-btn');
            if(el) el.style.display = 'none';
        }
    } catch (err) { console.error("Error RBAC:", err.message); }
}