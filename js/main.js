/**
 * ViOs Taller - Script Central de la Vista Pública (main.js)
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. Regla botón WhatsApp en Contacto ---
    const botonWhatsapp = document.getElementById('whatsapp-btn');
    if (window.location.pathname.includes('contacto.html') && botonWhatsapp) {
        botonWhatsapp.style.setProperty('display', 'none', 'important');
    }

   // --- 2. Lógica Calculadora Interactiva ---
    const inputConcepto = document.getElementById("inputConcepto"); // <--- NUEVA REFERENCIA
    const inputAncho = document.getElementById("inputAncho");
    const inputAlto = document.getElementById("inputAlto");
    const vAncho = document.getElementById("v-ancho");
    const vAlto = document.getElementById("v-alto");
    const resArea = document.getElementById("resArea");
    const lblDimension = document.getElementById("lblDimension");
    const previewLona = document.getElementById("previewLona");
    const btnZap = document.getElementById("btnZap");
    const TELEFONO_VIOS = "521234567890"; // Reemplaza con tu número real de ser necesario

    function actualizarCalculadora() {
        if (!inputAncho || !inputAlto || !btnZap) return;
        const ancho = parseFloat(inputAncho.value);
        const alto = parseFloat(inputAlto.value);
        const area = ancho * alto;

        // Leer el trabajo personalizado o asignar valor genérico si está vacío
        const concepto = inputConcepto && inputConcepto.value.trim() !== "" 
            ? inputConcepto.value.trim() 
            : "un trabajo personalizado";

        if (vAncho) vAncho.textContent = `${ancho.toFixed(1)} m`;
        if (vAlto) vAlto.textContent = `${alto.toFixed(1)} m`;
        if (resArea) resArea.textContent = `${area.toFixed(2)} m²`;
        if (lblDimension) lblDimension.textContent = `${ancho} x ${alto} m`;

        if (previewLona) {
            previewLona.style.width = `${ancho * 60}px`;
            previewLona.style.height = `${alto * 60}px`;
        }

        // TEXTO PERSONALIZADO DINÁMICO
        const mensaje = encodeURIComponent(`¡Hola ViOs! Me interesa cotizar *${concepto}* con medidas de ${ancho}m x ${alto}m (Total: ${area.toFixed(2)}m²).`);
        btnZap.href = `https://wa.me/${TELEFONO_VIOS}?text=${mensaje}`;
    }

    if (inputAncho && inputAlto) {
        inputAncho.addEventListener("input", actualizarCalculadora);
        inputAlto.addEventListener("input", actualizarCalculadora);
        
        // Agregar escucha al escribir el concepto para actualizar el enlace en vivo
        if (inputConcepto) {
            inputConcepto.addEventListener("input", actualizarCalculadora);
        }
        
        actualizarCalculadora();
    }

    // --- 3. Botón Scroll Top ---
    const btnScrollTop = document.getElementById("btnScrollTop");
    if (btnScrollTop) {
        window.addEventListener("scroll", () => {
            btnScrollTop.style.opacity = window.scrollY > 300 ? "1" : "0";
            btnScrollTop.style.pointerEvents = window.scrollY > 300 ? "all" : "none";
        });
        btnScrollTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    // --- 4. Disparadores de Base de Datos (Supabase Cooldown Check) ---
    function inicializarModulosDB() {
        // Esperamos brevemente a que el objeto global `window.db` esté listo
        if (!window.db) {
            setTimeout(inicializarModulosDB, 300);
            return;
        }

        // Carga e inicialización del catálogo en tiempo real si el contenedor existe
        if (document.getElementById("grid-trabajos")) {
            cargarCatalogoPublico();
            window.db.channel('public:trabajos')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajos' }, () => cargarCatalogoPublico())
              .subscribe();
        }

        // Carga de la marquesina de marcas aliadas
        if (document.querySelector(".logo-ticker-track")) {
            cargarCarruselProveedores();
        }

        // Carga de la trayectoria histórica
        if (document.getElementById("timeline-container")) {
            cargarCronologiaPublica();
        }

        
    }

    inicializarModulosDB();
});

// ================= FUNCIONES ASÍNCRONAS DE RENDERIZADO PÚBLICO =================

// --- Catálogo de Trabajos ---
async function cargarCatalogoPublico() {
    const grid = document.getElementById("grid-trabajos");
    if (!grid) return;

    try {
        const { data, error } = await window.db.from('trabajos').select('*').order('id', { ascending: false });
        
        if (error) throw error;

        grid.innerHTML = ""; 

        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center text-white-50 py-5">
                    <i class="bi bi-images display-4 d-block mb-3 text-secondary"></i>
                    <p>Galería en actualización. Muy pronto verás nuestros proyectos más recientes.</p>
                </div>`;
            return;
        }

        data.forEach(item => {
            const imagenSrc = item.url_imagen || item.imagen || item.imagen_url || 'https://via.placeholder.com/500x350?text=ViOs+Dise%C3%B1o';

            grid.insertAdjacentHTML('beforeend', `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card catalog-card shadow-sm mb-4 bg-dark text-white border-secondary position-relative overflow-hidden">
                        <div class="card-img-container" style="height: 250px; overflow: hidden; position: relative;">
                            <img src="${imagenSrc}" class="card-img-top w-100 h-100" alt="${item.titulo}" style="object-fit: cover;">
                            <span class="badge bg-info text-dark position-absolute top-0 end-0 m-3 rounded-pill fw-bold px-3 py-2 small shadow">
                                ${item.categoria || 'Trabajo'}
                            </span>
                        </div>
                        <div class="card-body p-4">
                            <h5 class="card-title fw-bold text-info mb-2">${item.titulo}</h5>
                            <p class="card-text text-white-50 small mb-0">${item.descripcion || 'Sin descripción'}</p>
                        </div>
                    </div>
                </div>
            `);
        });

        asignarSoporteTouch();

    } catch (err) {
        console.error("Error al cargar el catálogo desde Supabase:", err);
        grid.innerHTML = `<p class="text-danger text-center col-12 py-4">Error al conectar con la galería de trabajos.</p>`;
    }
}

// --- Carrusel de Proveedores Adaptativo e Inteligente ---
async function cargarCarruselProveedores() {
    const track = document.querySelector('.logo-ticker-track');
    const container = document.querySelector('.logo-ticker-container');
    if (!track || !container) return;

    try {
        const { data: marcas, error } = await window.db.from('proveedores').select('*').order('id', { ascending: false });
        if (error) throw error;

        if (!marcas || marcas.length === 0) {
            // Si no hay ningún proveedor en la BD, ocultamos la sección por completo
            track.closest('section')?.classList.add('d-none');
            return;
        }

        // Mapeamos los logos dinámicos agregando una clase base
        const estructuraLogos = marcas.map(m => `
            <img src="${m.url_logo}" alt="Proveedor ${m.nombre}" title="${m.nombre}" class="ticker-logo-item">
        `).join('');

        // EVALUACIÓN DE CANTIDAD DE LOGOS
        if (marcas.length < 5) {
            // CASO A: Pocos logos. Desactivamos animación, los centramos y escalamos
            track.style.animation = "none";
            track.style.width = "100%";
            track.style.justifyContent = "center";
            track.style.flexWrap = "wrap"; // Por si en pantallas chicas bajan
            
            // Inyectamos solo una vez (sin clonar)
            track.innerHTML = estructuraLogos;

            // Agregamos una clase especial al contenedor para que el CSS aplique un tamaño más grande
            container.classList.add('fijos-y-grandes');
        } else {
            // CASO B: Muchos logos. Activamos animación infinita tradicional
            track.style.animation = "scrollTicker 32s linear infinite";
            track.style.justifyContent = "flex-start";
            
            // Duplicamos exactamente la cadena para evitar huecos en el scroll continuo
            track.innerHTML = estructuraLogos + estructuraLogos;
            
            container.classList.remove('fijos-y-grandes');
        }

    } catch (err) {
        console.error("Error al renderizar el carrusel de proveedores:", err);
    }
}

// --- Línea de Tiempo (Historia) ---
async function cargarCronologiaPublica() {
    const contenedor = document.getElementById("timeline-container");
    if (!contenedor) return;

    try {
        const { data: hitos, error } = await window.db.from('cronologia').select('*').order('ano', { ascending: true });

        if (error) throw error;

        contenedor.innerHTML = "";

        if (!hitos || hitos.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center text-white-50 py-5">
                    <i class="bi bi-clock-history display-4 d-block mb-3 text-info"></i>
                    <p>Nuestra historia se está escribiendo. ¡Pronto conocerás más hitos!</p>
                </div>`;
            return;
        }

        hitos.forEach((hito, index) => {
            const article = document.createElement("article");
            article.className = (index === hitos.length - 1) ? "mb-4" : "mb-5";

            let badgeClass = "bg-info text-dark"; 
            if (hito.ano.toLowerCase() === "presente" || hito.ano.toLowerCase() === "actualidad") {
                badgeClass = "bg-success text-white"; 
            } else if (index % 2 !== 0) {
                badgeClass = "text-white"; 
            }

            const inlineStyle = badgeClass === "text-white" ? 'style="background-color: #6f42c1;"' : '';

            article.innerHTML = `
                <div class="d-flex align-items-center gap-3 mb-3">
                    <span class="badge ${badgeClass} rounded-pill px-3 py-2 fw-bold" ${inlineStyle}>${hito.ano}</span>
                    <h2 class="h3 fw-bold mb-0">${hito.titulo}</h2>
                </div>
                <p class="text-white-50 leading-relaxed">${hito.descripcion}</p>
            `;
            contenedor.appendChild(article);
        });

    } catch (err) {
        console.error("Error al cargar la cronología:", err);
        contenedor.innerHTML = `<p class="text-danger text-center py-5">Error al conectar con la trayectoria histórica.</p>`;
    }
}

// ================= SOPORTE ADAPTATIVO TOUCH (TARJETAS) =================

function asignarSoporteTouch() {
    const catalogCards = document.querySelectorAll('.catalog-card');
    catalogCards.forEach(card => {
        card.removeEventListener('click', touchHandler);
        card.addEventListener('click', touchHandler);
    });
}

function touchHandler(e) {
    const catalogCards = document.querySelectorAll('.catalog-card');
    if (!this.classList.contains('active')) {
        catalogCards.forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        e.preventDefault();
    } else {
        this.classList.remove('active');
    }
}

// Cerrar estados activos al dar click fuera de las tarjetas
document.addEventListener('click', (e) => {
    if (!e.target.closest('.catalog-card')) {
        document.querySelectorAll('.catalog-card').forEach(card => card.classList.remove('active'));
    }
});

async function cargarContactoPublico() {
    // Si no estamos en la página de contacto, ignoramos
    const contenedorRedes = document.getElementById("redes-dinamicas"); 
    if (!contenedorRedes) return;

    try {
        const { data, error } = await window.db.from('config_contacto').select('*').eq('id', 1).single();
        if (error) throw error;

        // Aquí inyectarías el data.telefono, data.facebook, etc., en los href de tus botones
        // Ejemplo: document.getElementById("btn-fb").href = data.facebook;
    } catch (err) {
        console.error("Error al cargar contacto:", err);
    }
}