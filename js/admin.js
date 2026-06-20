/**
 * ViOs Taller - Panel Administrativo Centralizado (Realtime Edition)
 * Versión Protegida con Gestión de Inventario
 */

// --- PROTECCIÓN DE ACCESO Y ARRANQUE ---
window.addEventListener("DOMContentLoaded", async () => {
  // 1. Verificación de Seguridad: Redirigir si no hay sesión
  const {
    data: { session },
  } = await window.db.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("btnLogout").addEventListener("click", (e) => {
    e.preventDefault(); // Evita que el enlace # recargue la página
    cerrarSesion(); // Llama a la función que ya creamos
  });

  // 2. Inicialización de Formularios
  inicializarFormularios();
  inicializarFormularioMateriales();

  document
    .getElementById("formConfigContacto")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const datos = {
        telefono: document.getElementById("cfgTelefono").value,
        whatsapp: document.getElementById("cfgWhatsapp").value,
        correo: document.getElementById("cfgCorreo").value,
        facebook: document.getElementById("cfgFacebook").value,
        instagram: document.getElementById("cfgInstagram").value,
      };

      try {
        // Asumiendo que tu tabla se llama config_contacto y tiene el id 1
        const { error } = await window.db
          .from("config_contacto")
          .update(datos)
          .eq("id", 1);
        if (error) throw error;
        alert("Información de contacto actualizada exitosamente.");
      } catch (err) {
        alert("Error al guardar: " + err.message);
      }
    });

  // 3. Carga de datos y Realtime (solo si estamos logueados)
  if (window.db) {
    cargarTrabajos();
    cargarHitosAdmin();
    cargarProveedoresAdmin();
    cargarInventario();
    cargarConfigContacto();
    activarRealtimeAdmin();
    aplicarRestriccionesDeRol();
    cargarMaterialesEnCotizador();
    cargarClientesEnCotizador(); // <--- ¡AGREGA ESTA LÍNEA AQUÍ!
  }
});

// --- ENTRADA EN TIEMPO REAL (REALTIME CANALS) ---
function activarRealtimeAdmin() {
  window.db
    .channel("realtime-trabajos-admin")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trabajos" },
      () => {
        cargarTrabajos();
      },
    )
    .subscribe();

  window.db
    .channel("realtime-cronologia-admin")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cronologia" },
      () => {
        cargarHitosAdmin();
      },
    )
    .subscribe();

  window.db
    .channel("realtime-proveedores-admin")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "proveedores" },
      () => {
        cargarProveedoresAdmin();
      },
    )
    .subscribe();
}

// --- RENDERIZADO Y CARGA DE TABLAS ---

async function cargarTrabajos() {
  const tbody = document.getElementById("tbodyCatalogoAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db
      .from("trabajos")
      .select("*")
      .order("id", { ascending: false });
    if (error) throw error;

    tbody.innerHTML = data
      .map(
        (t) => `
            <tr>
                <td class="ps-3"><img src="${t.url_imagen}" class="rounded border" style="width: 50px; height: 50px; object-fit: cover;"></td>
                <td class="fw-bold text-info">${t.titulo}</td>
                <td><span class="badge bg-secondary bg-opacity-50 text-white-50">${t.categoria}</span></td>
                <td class="text-white-50 text-truncate" style="max-width: 250px;">${t.descripcion || ""}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-outline-warning btn-sm border-0" onclick="prepararEditarTrabajo('${t.id}', '${t.titulo}', '${t.categoria}', \`${t.descripcion || ""}\`)"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('trabajos', '${t.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `,
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar catálogo:", err.message);
  }
}

async function cargarHitosAdmin() {
  const tbody = document.getElementById("tbodyCronologiaAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db
      .from("cronologia")
      .select("*")
      .order("ano", { ascending: true });
    if (error) throw error;

    tbody.innerHTML = data
      .map(
        (h) => `
            <tr>
                <td class="ps-3 fw-bold text-info font-monospace">${h.ano}</td>
                <td class="fw-bold">${h.titulo}</td>
                <td class="text-white-50">${h.descripcion}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-outline-warning btn-sm border-0" onclick="prepararEditarHito('${h.id}', '${h.ano}', '${h.titulo}', \`${h.descripcion}\`)"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('cronologia', '${h.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `,
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar cronología:", err.message);
  }
}

async function cargarProveedoresAdmin() {
  const tbody = document.getElementById("tbodyProveedoresAdmin");
  if (!tbody) return;
  try {
    const { data, error } = await window.db
      .from("proveedores")
      .select("*")
      .order("id", { ascending: false });
    if (error) throw error;

    tbody.innerHTML = data
      .map(
        (p) => `
            <tr>
                <td class="ps-3"><img src="${p.url_logo}" class="bg-light p-1 rounded" style="width: 70px; height: 30px; object-fit: contain;"></td>
                <td class="fw-bold text-white">${p.nombre}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('proveedores', '${p.id}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `,
      )
      .join("");
  } catch (err) {
    console.error("Error al cargar proveedores:", err.message);
  }
}

// --- ACCIONES AUXILIARES ---

async function eliminarRegistro(tabla, id) {
  if (
    !confirm(
      `¿Estás seguro de que deseas eliminar este registro de la tabla "${tabla}"?`,
    )
  )
    return;
  try {
    const { error } = await window.db.from(tabla).delete().eq("id", id);
    if (error) throw error;
    alert("Registro eliminado con éxito.");
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// --- FORMULARIOS DE INTERFACING ---

function inicializarFormularios() {
  // --- GUARDAR NUEVO TRABAJO ---
  document
    .getElementById("formNuevoTrabajo")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = e.target.querySelector('button[type="submit"]');
      // Asegúrate de que el ID en tu HTML sea 'addTrabajoImg'
      const fileInput = document.getElementById("addTrabajoImg");

      if (!fileInput.files || fileInput.files.length === 0) {
        alert("Por favor, selecciona una imagen.");
        return;
      }

      btnSubmit.disabled = true;

      try {
        // 1. Subir al Storage (Bucket: 'trabajos')
        const urlReal = await subirArchivoAlStorage(
          fileInput.files[0],
          "trabajos",
        );

        // 2. Preparar el objeto con la URL REAL
        const nuevoTrabajo = {
          titulo: document.getElementById("addTrabajoTitulo").value,
          categoria: document.getElementById("addTrabajoCategoria").value,
          descripcion: document.getElementById("addTrabajoDesc").value,
          url_imagen: urlReal, // Aquí guardamos la URL que nos devolvió el Storage
        };

        // 3. Insertar en la tabla
        const { error } = await window.db
          .from("trabajos")
          .insert([nuevoTrabajo]);
        if (error) throw error;

        alert("¡Trabajo publicado con imagen real!");
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoTrabajo"),
        )?.hide();
        cargarTrabajos();
      } catch (err) {
        alert("Error al guardar: " + err.message);
      } finally {
        btnSubmit.disabled = false;
      }
    });

  // --- GUARDAR NUEVO HITO CRONOLÓGICO ---
  document
    .getElementById("formNuevoHito")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nuevoHito = {
        ano: document.getElementById("addHitoAno").value,
        titulo: document.getElementById("addHitoTitulo").value,
        descripcion: document.getElementById("addHitoDesc").value,
      };

      try {
        const { error } = await window.db
          .from("cronologia")
          .insert([nuevoHito]);
        if (error) throw error;

        alert("¡Hito histórico guardado!");
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoHito"),
        )?.hide();
        cargarHitosAdmin();
      } catch (err) {
        alert("Error al guardar: " + err.message);
      }
    });

  // --- GUARDAR NUEVO TRABAJO ---
  document
    .getElementById("formNuevoTrabajo")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = e.target.querySelector('button[type="submit"]');
      const fileInput = document.getElementById("addTrabajoImg");

      if (!fileInput.files || fileInput.files.length === 0) {
        alert("Por favor, selecciona una imagen.");
        return;
      }

      btnSubmit.disabled = true;
      try {
        const urlReal = await subirArchivoAlStorage(
          fileInput.files[0],
          "trabajos",
        );
        const nuevoTrabajo = {
          titulo: document.getElementById("addTrabajoTitulo").value,
          categoria: document.getElementById("addTrabajoCategoria").value,
          descripcion: document.getElementById("addTrabajoDesc").value,
          url_imagen: urlReal,
        };

        const { error } = await window.db
          .from("trabajos")
          .insert([nuevoTrabajo]);
        if (error) throw error;

        alert("¡Trabajo publicado!");
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoTrabajo"),
        )?.hide();
        cargarTrabajos();
      } catch (err) {
        alert("Error al guardar: " + err.message);
      } finally {
        btnSubmit.disabled = false;
      }
    });

  // --- GUARDAR NUEVO HITO ---
  document
    .getElementById("formNuevoHito")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nuevoHito = {
        ano: document.getElementById("addHitoAno").value,
        titulo: document.getElementById("addHitoTitulo").value,
        descripcion: document.getElementById("addHitoDesc").value,
      };

      try {
        const { error } = await window.db
          .from("cronologia")
          .insert([nuevoHito]);
        if (error) throw error;
        alert("¡Hito guardado!");
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoHito"),
        )?.hide();
        cargarHitosAdmin();
      } catch (err) {
        alert("Error al guardar: " + err.message);
      }
    });

  // --- GUARDAR NUEVO PROVEEDOR  ---
  document
    .getElementById("formNuevoProveedor")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = e.target.querySelector('button[type="submit"]');
      const fileInput = document.getElementById("addProvLogo");
      const nombre = document.getElementById("addProvNombre").value;

      if (!fileInput.files || fileInput.files.length === 0) {
        alert("Por favor, selecciona una imagen para el logo.");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerText = "Subiendo...";

      try {
        const urlReal = await subirArchivoAlStorage(
          fileInput.files[0],
          "proveedores",
        );
        const { error } = await window.db
          .from("proveedores")
          .insert([{ nombre: nombre, url_logo: urlReal }]);
        if (error) throw error;

        alert("¡Proveedor agregado!");
        e.target.reset();
        bootstrap.Modal.getInstance(
          document.getElementById("modalNuevoProveedor"),
        )?.hide();
        cargarProveedoresAdmin();
      } catch (err) {
        alert("Error al guardar: " + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Subir Logo";
      }
    });
}

// --- Lógica para guardar Materiales (Punto 11) ---
function inicializarFormularioMateriales() {
  const formMaterial = document.getElementById("formNuevoMaterial");

  formMaterial?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dataMaterial = {
      nombre: document.getElementById("matNombre").value,
      unidad_medida: document.getElementById("matUnidad").value,
      costo_m2: 0,
      precio_venta_m2: parseFloat(document.getElementById("matPrecio").value),
      stock_actual: parseFloat(document.getElementById("matStock").value),
    };

    try {
      const { error } = await window.db
        .from("materiales")
        .insert([dataMaterial]);
      if (error) throw error;

      alert("¡Material registrado con éxito!");
      formMaterial.reset();

      // ¡AGREGA ESTO AQUÍ!
      refrescarCotizador();

      // Si tienes un modal, ciérralo también
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("modalNuevoMaterial"),
      );
      if (modal) modal.hide();
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  });
}

async function cargarConfigContacto() {
  console.log("Configuración de contacto cargada.");
}

async function cargarAlertas() {
  const contenedorAlertas = document.getElementById("contenedor-alertas"); // Crea este div en tu HTML
  if (!contenedorAlertas) return;

  const { data, error } = await window.db
    .from("alertas")
    .select("*, clientes(nombre)") // Hacemos un JOIN para traer el nombre del cliente
    .eq("leido", false);

  if (error) console.error(error);

  if (data && data.length > 0) {
    contenedorAlertas.innerHTML = data
      .map(
        (alerta) => `
            <div class="alert alert-warning">
                <strong>${alerta.clientes.nombre}</strong>: ${alerta.mensaje}
                <button onclick="marcarLeida(${alerta.id})" class="btn btn-sm btn-outline-dark">Entendido</button>
            </div>
        `,
      )
      .join("");
  }
}

async function marcarLeida(id) {
  await window.db.from("alertas").update({ leido: true }).eq("id", id);
  cargarAlertas(); // Recargar lista
}

async function procesarCotizacion(materialId, cantidad, margen) {
  // 1. Obtener costo base del material
  const { data: mat } = await window.db
    .from("materiales")
    .select("costo_adquisicion")
    .eq("id", materialId)
    .single();

  // 2. Calcular precio usando RPC (en el servidor)
  const { data: precioFinal, error } = await window.db.rpc(
    "calcular_precio_final",
    {
      costo_materia: mat.costo_adquisicion,
      margen_ganancia: margen,
    },
  );

  if (error) return alert("Error al calcular");

  // 3. Aquí puedes mostrar el precio en el UI y luego
  // realizar el INSERT en 'cotizaciones' y 'detalle_cotizacion'
  console.log("Precio sugerido al cliente:", precioFinal * cantidad);
}

function aplicarRestriccionesDeRol() {
  const rol = localStorage.getItem("user_rol");

  // Si no es master, ocultar botones de administración crítica o eliminación
  if (rol !== "master" && rol !== "admin") {
    // Ocultar botones de borrar
    document
      .querySelectorAll(".btn-outline-danger")
      .forEach((btn) => (btn.style.display = "none"));
    // Ocultar secciones de configuración del sistema si existen
    document
      .querySelectorAll(".config-admin-only")
      .forEach((el) => (el.style.display = "none"));
  }
}

async function cerrarSesion() {
  await window.db.auth.signOut();
  localStorage.removeItem("user_rol"); // Limpiamos nuestro rol guardado
  window.location.href = "login.html";
}

// ==========================================
// MÓDULO DE INVENTARIO Y STOCK
// ==========================================

async function cargarInventario() {
  const tbody = document.getElementById("tbodyInventario");
  if (!tbody) return;

  try {
    const { data, error } = await window.db
      .from("materiales")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) throw error;

    tbody.innerHTML = data
      .map((m) => {
        const min = m.stock_minimo || 0;
        const actual = m.stock_actual || 0;
        // Comprobamos si el stock está en peligro
        const esBajo = actual <= min;

        const estadoHtml = esBajo
          ? `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger"><i class="bi bi-exclamation-triangle me-1"></i>Bajo</span>`
          : `<span class="badge bg-success bg-opacity-25 text-success border border-success"><i class="bi bi-check-circle me-1"></i>Óptimo</span>`;

        return `
        <tr>
            <td class="ps-3 fw-bold text-white">${m.nombre}</td>
            <td class="text-white-50">${m.unidad_medida || "N/A"}</td>
            <td class="text-white-50">${min}</td>
            <td class="fw-bold fs-6 ${esBajo ? "text-danger" : "text-success"}">${actual}</td>
            <td>${estadoHtml}</td>
            <td class="text-end pe-3">
                <button class="btn btn-outline-info btn-sm border-0 me-1" onclick="ajustarStock('${m.id}', '${m.nombre}', ${actual})" title="Ajuste Manual">
                    <i class="bi bi-sliders"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarRegistro('materiales', '${m.id}')" title="Eliminar Material">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Error al cargar inventario:", err.message);
  }
}

// Función para sumar o restar material manualmente (mermas o compras nuevas)
async function ajustarStock(id, nombre, stockActual) {
  const ajuste = prompt(
    `Ajuste de inventario para: ${nombre}\n\nStock actual: ${stockActual}\n\nIngresa la cantidad a SUMAR (ej: 10) o RESTAR (ej: -5):`,
  );

  // Validamos que no esté vacío y sea un número
  if (ajuste === null || ajuste.trim() === "" || isNaN(ajuste)) return;

  const nuevoStock = parseFloat(stockActual) + parseFloat(ajuste);

  try {
    const { error } = await window.db
      .from("materiales")
      .update({ stock_actual: nuevoStock })
      .eq("id", id);

    if (error) throw error;

    // Recargamos la tabla al instante para ver el cambio de color
    cargarInventario();
  } catch (err) {
    alert("Error al actualizar el stock: " + err.message);
  }
}
async function subirArchivoAlStorage(file, bucketName) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await window.db.storage
    .from(bucketName)
    .upload(filePath, file);

  if (error) throw error;

  // Obtener URL pública
  const { data: publicUrlData } = window.db.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// 1. Cargar materiales desde la BD al abrir el panel o al iniciar
// 1. Cargar materiales desde la BD al abrir el panel o al iniciar
async function cargarMaterialesEnCotizador() {
  const select = document.getElementById("selMaterialAdmin");
  const { data, error } = await window.db
    .from("materiales")
    .select("id, nombre, costo_m2, precio_venta_m2");

  if (error) {
    console.error("Error al cargar materiales:", error);
    return;
  }

  select.innerHTML =
    '<option value="">Selecciona material...</option>' +
    data
      .map(
        (m) => `
            <option value="${m.id}" 
                    data-costo="${m.costo_m2}" 
                    data-venta="${m.precio_venta_m2}">
                ${m.nombre}
            </option>`,
      )
      .join("");
}

// 2. Cargar la lista de clientes en el menú desplegable (MOVIDA AQUÍ PARA EVITAR EL DEFINE ERROR)
async function cargarClientesEnCotizador() {
  const select = document.getElementById("selClienteCotizador");
  if (!select) return;

  try {
    const { data, error } = await window.db
      .from("clientes")
      .select("id, nombre, telefono")
      .order("nombre", { ascending: true });

    if (error) throw error;

    select.innerHTML = '<option value="">Selecciona un cliente...</option>';
    data.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente.id;
      option.text = cliente.nombre;
      option.dataset.telefono = cliente.telefono || "";
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Error al cargar clientes:", err.message);
  }
}

// 2. Refrescar lista después de agregar un material nuevo
// Llamar a esta función justo después de guardar el nuevo material en tu lógica existente
function refrescarCotizador() {
  cargarMaterialesEnCotizador();
}

// ESCUCHAR CLIC EN "CALCULAR" (REVISADO Y CONSOLIDADO)
document
  .getElementById("btnCalcularCotizacion")
  ?.addEventListener("click", () => {
    const selectCliente = document.getElementById("selClienteCotizador");
    const selectMaterial = document.getElementById("selMaterialAdmin");
    const ancho = parseFloat(document.getElementById("cotAncho").value) || 0;
    const alto = parseFloat(document.getElementById("cotAlto").value) || 0;
    const precioCobrado =
      parseFloat(document.getElementById("cotPrecioManual").value) || 0;
    const ivaPorcentaje =
      parseFloat(document.getElementById("cotIvaPorcentaje").value) || 0;
    const notas = document.getElementById("cotNotas").value.trim();

    if (
      !selectCliente.value ||
      !selectMaterial.value ||
      ancho <= 0 ||
      alto <= 0 ||
      precioCobrado <= 0
    ) {
      alert(
        "Completa todos los campos correctamente. Verifica que el precio no sea cero.",
      );
      return;
    }

    const optionCliente = selectCliente.options[selectCliente.selectedIndex];
    const optionMaterial = selectMaterial.options[selectMaterial.selectedIndex];

    // FÓRMULAS
    const m2 = ancho * alto;
    const costoBaseMaterial = parseFloat(optionMaterial.dataset.costo) || 0;

    const costoTotalMateriaPrima = m2 * costoBaseMaterial;
    const subtotalVenta = m2 * precioCobrado;
    const totalIva = subtotalVenta * ivaPorcentaje;
    const totalFinal = subtotalVenta + totalIva;
    const gananciaNeta = subtotalVenta - costoTotalMateriaPrima;

    const anoActual = new Date().getFullYear();
    const folioProvisional = `VIO-${anoActual}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Guardamos todo en la variable global temporal
    cotizacionActual = {
      cliente_id: selectCliente.value,
      nombreCliente: optionCliente.text,
      telefonoCliente: optionCliente.dataset.telefono,
      material_id: selectMaterial.value,
      nombreMaterial: optionMaterial.text,
      cantidad_m2: m2,
      precio_aplicado: precioCobrado,
      total_estimado: totalFinal,
      costo_materia_prima: costoTotalMateriaPrima,
      ganancia: gananciaNeta,
      notas: notas,
      folio: folioProvisional,
    };

    // Mostrar en UI con desglose de ganancia
    document.getElementById("resultadoCotizacion").innerHTML = `
        $${totalFinal.toFixed(2)} 
        <span class="d-block small text-success fw-normal mt-1" style="font-size: 0.9rem;">
            <i class="bi bi-graph-up-arrow"></i> Ganancia est.: $${gananciaNeta.toFixed(2)}
        </span>
    `;

    const textoMensaje = `Hola *${optionCliente.text}*, recibe la cotización *${folioProvisional}* por concepto de *${optionMaterial.text}* con un costo total de *$${totalFinal.toFixed(2)}* (Medidas: ${ancho}x${alto} mts).`;

    document.getElementById("textoMensajePreview").innerText = textoMensaje;
    document.getElementById("vistaPreviaMensaje").classList.remove("d-none");
    document.getElementById("btnGuardarCotizacion").removeAttribute("disabled");
  });

// AUTO-LLENAR PRECIO SUGERIDO AL ELEGIR MATERIAL
document.getElementById("selMaterialAdmin")?.addEventListener("change", (e) => {
  const select = e.target;
  const option = select.options[select.selectedIndex];
  const inputPrecioManual = document.getElementById("cotPrecioManual");
  const textoCosto = document.getElementById("infoCostoInterno");

  if (select.value) {
    // Ponemos el precio de venta sugerido en el cuadro para que el vendedor lo edite si quiere
    inputPrecioManual.value = option.dataset.venta;
    // Mostramos el costo interno (solo visible para el vendedor)
    textoCosto.innerText = `Costo base del material: $${parseFloat(option.dataset.costo).toFixed(2)}`;
  } else {
    inputPrecioManual.value = "";
    textoCosto.innerText = "Costo base: $0.00";
  }
});

// ==========================================
// MÓDULO DE EXPORTACIÓN PDF (jsPDF COMPLETO)
// ==========================================
function generarPDFCotizacion(datos) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 1. Encabezado de la Agencia
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(13, 202, 240); // Cyan
  doc.text("ViOs Taller", 20, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Diseño, Impresión y Servicios Técnicos", 20, 28);
  doc.text("Mexicali, Baja California", 20, 33);

  // 2. Datos de Control
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Cotización: ${datos.folio}`, 130, 20);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-MX")}`, 130, 28);

  doc.setDrawColor(200, 200, 200);
  doc.line(20, 40, 190, 40);

  // 3. Datos del Cliente
  doc.setFont("helvetica", "bold");
  doc.text("Datos del Cliente", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${datos.nombreCliente}`, 20, 58);
  doc.text(`WhatsApp: ${datos.telefonoCliente || "No registrado"}`, 20, 66);

  // 4. Desglose
  doc.setFont("helvetica", "bold");
  doc.text("Detalles del Servicio", 20, 85);
  doc.line(20, 88, 190, 88);

  doc.setFont("helvetica", "normal");
  doc.text(`Concepto:`, 20, 98);
  doc.text(datos.nombreMaterial, 50, 98);

  doc.text(`Superficie:`, 20, 106);
  doc.text(`${datos.cantidad_m2.toFixed(2)} m²`, 65, 106);

  doc.text(`Precio Cobrado (m²):`, 20, 114);
  doc.text(`$${datos.precio_aplicado.toFixed(2)}`, 65, 114);

  doc.line(20, 125, 190, 125);

  // 5. Total
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL ESTIMADO:", 110, 135);
  doc.setFontSize(14);
  doc.setTextColor(25, 135, 84);
  doc.text(`$${datos.total_estimado.toFixed(2)}`, 160, 135);

  // 6. Notas
  if (datos.notas && datos.notas.trim() !== "") {
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Notas Adicionales:", 20, 150);
    doc.setFont("helvetica", "normal");
    const lineasNotas = doc.splitTextToSize(datos.notas, 170);
    doc.text(lineasNotas, 20, 158);
  }

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Este documento es una estimación de costo. Válido por 15 días.",
    20,
    275,
  );

  const nombreArchivo = `${datos.folio}_Cotizacion_${datos.nombreCliente.replace(/\s+/g, "_")}.pdf`;
  doc.save(nombreArchivo);
}

// 3. EVENT LISTENER PARA REGISTRAR EN BD Y DISPARAR IMPRESIÓN
document
  .getElementById("formCotizadorPro")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!cotizacionActual) {
      alert("Por favor, calcula la cotización antes de registrarla.");
      return;
    }

    const btnSubmit = document.getElementById("btnGuardarCotizacion");
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

    try {
      // Enviar a la tabla 'cotizaciones'
      const { data: nuevaCotizacion, error: errCot } = await window.db
        .from("cotizaciones")
        .insert([
          {
            cliente_id: cotizacionActual.cliente_id,
            total_estimado: cotizacionActual.total_estimado,
            fecha_creacion: new Date().toISOString(),
          },
        ])
        .select();

      if (errCot) throw errCot;
      const idCotizacion = nuevaCotizacion[0].id;

      // Enviar desglose detallado
      const { error: errDetalle } = await window.db
        .from("detalle_cotizacion")
        .insert([
          {
            cotizacion_id: idCotizacion,
            material_id: cotizacionActual.material_id,
            cantidad: cotizacionActual.cantidad_m2,
            precio_aplicado: cotizacionActual.precio_aplicado, // <--- CAMBIADO AQUÍ
          },
        ]);

      if (errDetalle) throw errDetalle;

      alert(`¡Cotización registrada con éxito en Supabase!`);

      // Generar y descargar el PDF de inmediato
      generarPDFCotizacion(cotizacionActual);

      // Limpieza del Formulario
      e.target.reset();
      document.getElementById("resultadoCotizacion").innerText = "$0.00";
      document.getElementById("vistaPreviaMensaje").classList.add("d-none");
      cotizacionActual = null;
    } catch (err) {
      alert("Error en la Base de Datos: " + err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML =
        '<i class="bi bi-disk-fill me-1"></i> Registrar e Imprimir';
    }
  });

  // Función para registrar venta y actualizar stock
async function registrarVentaYDescontarStock(e) {
    e.preventDefault();
    
    const materialId = document.getElementById("selectVentaMaterial").value;
    const cantidadVenta = parseFloat(document.getElementById("ventaCantidad").value);
    const totalVenta = parseFloat(document.getElementById("ventaTotal").value);

    try {
        // 1. Obtener datos actuales del material
        const { data: material, error: errMat } = await window.db
            .from("materiales")
            .select("stock_actual, stock_minimo, nombre")
            .eq("id", materialId)
            .single();

        if (errMat) throw errMat;

        // 2. Calcular nuevo stock
        const nuevoStock = material.stock_actual - cantidadVenta;

        // 3. Insertar venta
        const { error: errVenta } = await window.db.from("ventas").insert([{
            material_id: materialId, // Asegúrate de tener este campo en tu tabla ventas
            cantidad_vendida: cantidadVenta,
            total_venta: totalVenta,
            fecha_venta: new Date().toISOString()
        }]);
        if (errVenta) throw errVenta;

        // 4. Actualizar stock en tabla materiales
        const { error: errUpdate } = await window.db
            .from("materiales")
            .update({ stock_actual: nuevoStock })
            .eq("id", materialId);
        if (errUpdate) throw errUpdate;

        // 5. Verificar alerta de stock bajo
        if (nuevoStock <= material.stock_minimo) {
            alert(`⚠️ ALERTA: El material "${material.nombre}" tiene stock bajo (${nuevoStock}m restantes).`);
        } else {
            alert("Venta registrada y stock actualizado con éxito.");
        }

        // Limpieza
        document.getElementById("formRegistrarVenta").reset();
        bootstrap.Modal.getInstance(document.getElementById("modalRegistrarVenta")).hide();
        cargarInventario(); // Refrescar vista de inventario

    } catch (err) {
        console.error("Error al registrar venta:", err);
        alert("Error al procesar la venta: " + err.message);
    }
}

/**
 * Carga los materiales y los muestra en la tabla del inventario
 */
async function cargarInventario() {
    const tbody = document.getElementById("tablaInventarioBody");
    if (!tbody) return;

    try {
        // Consultar la tabla de materiales
        const { data, error } = await window.db
            .from("materiales")
            .select("*");

        if (error) throw error;

        // Limpiar tabla
        tbody.innerHTML = "";

        // Rellenar tabla
        data.forEach(material => {
            const esBajo = material.stock_actual <= material.stock_minimo;
            
            // Fila con clase de alerta si el stock es bajo
            const fila = document.createElement("tr");
            if (esBajo) fila.classList.add("table-danger"); // Pone la fila roja si falta material

            fila.innerHTML = `
                <td class="ps-3">${material.nombre}</td>
                <td><strong>${material.stock_actual}</strong> <small>m</small></td>
                <td>${material.stock_minimo} <small>m</small></td>
                <td>
                    ${esBajo 
                        ? '<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-triangle"></i> Bajo</span>' 
                        : '<span class="badge bg-success"><i class="bi bi-check-circle"></i> OK</span>'}
                </td>
            `;
            tbody.appendChild(fila);
        });
    } catch (err) {
        console.error("Error al cargar inventario:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error al cargar datos</td></tr>`;
    }
}

// Asegurarse de que el inventario cargue al abrir la página
document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();
});

async function cargarInventario() {
    const tbody = document.getElementById("tbodyInventario");
    if (!tbody) return;

    // Indicador de carga
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-white-50">Cargando materiales...</td></tr>';

    try {
        const { data, error } = await window.db
            .from("materiales")
            .select("*");

        if (error) throw error;

        // Limpiar el tbody
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay materiales registrados.</td></tr>';
            return;
        }

        // Llenar filas
        data.forEach(material => {
            const esBajo = material.stock_actual <= material.stock_minimo;
            const fila = document.createElement("tr");
            
            if (esBajo) fila.classList.add("table-danger"); // Pone la fila en rojo si es bajo

            fila.innerHTML = `
                <td class="ps-3 fw-bold">${material.nombre}</td>
                <td>${material.unidad_medida}</td>
                <td>${material.stock_minimo}</td>
                <td>${material.stock_actual}</td>
                <td>
                    ${esBajo 
                        ? '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle"></i> Bajo</span>' 
                        : '<span class="badge bg-success"><i class="bi bi-check-circle"></i> OK</span>'}
                </td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-info" onclick="editarMaterial(${material.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(fila);
        });
    } catch (err) {
        console.error("Error al cargar inventario:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar datos.</td></tr>';
    }
}
document.getElementById('tab-inventario-btn').addEventListener('click', () => {
    cargarInventario();
});

// Inicializar listener
document.getElementById("formRegistrarVenta").addEventListener("submit", registrarVentaYDescontarStock);