// js/login.js

// 1. Verificación inicial: Si el usuario ya tiene sesión, mandarlo al admin
window.addEventListener("DOMContentLoaded", async () => {
    const { data: { session } } = await window.db.auth.getSession();
    
    // Si ya existe una sesión, enviamos al usuario al panel administrativo directamente
    // para evitar que vea el login si ya entró.
    if (session) {
        window.location.href = 'admin.html';
        return;
    }
    // Si no hay sesión, NO hacemos nada (permitimos que el usuario vea el formulario)
});

// 2. Lógica del formulario de login
document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formAdminLogin");

    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("adminEmailInput").value;
        const password = document.getElementById("adminPasswordInput").value;
        const errorMsg = document.getElementById("loginErrorMsg");

        try {
            // 1. Intentar login con Supabase Auth
            const { data, error } = await window.db.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // 2. Si es exitoso, obtener el rol desde la tabla 'perfiles'
            const { data: perfil, error: perfilError } = await window.db
                .from('perfiles')
                .select('rol')
                .eq('id', data.user.id)
                .single();

            if (perfilError) throw perfilError;

            // 3. Guardar rol y redirigir
            localStorage.setItem('user_rol', perfil.rol);
            window.location.href = 'admin.html';

        } catch (err) {
            console.error("Error:", err.message);
            errorMsg.classList.remove("d-none");
            errorMsg.textContent = "Credenciales incorrectas o usuario no autorizado.";
        }
    });
});