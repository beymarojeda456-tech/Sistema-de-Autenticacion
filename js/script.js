document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------
    // CONFIGURACIÓN INICIAL DEL SISTEMA
    // ----------------------------------------------------------------
    const MAX_ATTEMPTS = 3; // Número máximo de errores de login que permitimos
    const LOCKOUT_DURATION_MS = 60 * 1000; // El tiempo que la cuenta queda bloqueada (60 segundos)
    
    // EXPLICACIÓN DE LAS REGLAS DE ROBUSTEZ:
    // Estas son las "Reglas del Juego" que las contraseñas y correos deben cumplir.
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regla para un formato de correo básico.
    
    // Regla de Contraseña Fuerte (Se usa en Registro y Recuperación):
    // La expresión regular garantiza que la contraseña tenga minúsculas, mayúsculas, números,
    // símbolos y que mida al menos 8 caracteres.
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    const MOBILE_REGEX = /^\d{7,15}$/; // Regla para que el móvil sea solo dígitos (7 a 15)

    // Referencias a todas las secciones visibles del HTML
    const sections = {
        'login': document.getElementById('login-section'),
        'register': document.getElementById('register-section'),
        'recover': document.getElementById('recover-section'),
        'welcome': document.getElementById('welcome-section')
    };

    // Referencias a elementos clave del formulario de Login
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');
    const blockedRecoveryLink = document.getElementById('blocked-recovery-link');
    const welcomeMessageText = document.getElementById('welcome-message-text');

    // ----------------------------------------------------------------
    // GESTIÓN DE DATOS (Simulación de Base de Datos con LocalStorage)
    // ----------------------------------------------------------------
    // Función que lee todos los usuarios guardados
    const getUsers = () => {
        const users = localStorage.getItem('users');
        return users ? JSON.parse(users) : [];
    };

    // Función que sobrescribe la lista de usuarios con los cambios
    const saveUsers = (users) => {
        localStorage.setItem('users', JSON.stringify(users));
    };

    // ----------------------------------------------------------------
    // LÓGICA DE INTERFAZ Y VISTAS
    // ----------------------------------------------------------------
    // Esto se encarga de cambiar el icono del "ojo" y mostrar/ocultar la contraseña
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggle.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                toggle.textContent = '👁️';
            }
        });
    });

    // Oculta todas las secciones y solo muestra la que se le indica
    const switchView = (targetId) => {
        Object.values(sections).forEach(section => section.classList.add('hidden'));
        const targetSection = sections[targetId];
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    };

    // Maneja los enlaces de "Cambiar a Registro" o "Cambiar a Recuperación"
    document.querySelectorAll('.switch-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            // Limpia mensajes de error al cambiar de formulario
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            blockedRecoveryLink.classList.add('hidden'); 
            switchView(target);
        });
    });

    // ----------------------------------------------------------------
    // MÓDULO DE CREACIÓN DE CUENTA (REGISTRO)
    // ----------------------------------------------------------------
    const registerForm = document.getElementById('register-form');
    const registerMessage = document.getElementById('register-message');

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const fullName = document.getElementById('register-full-name').value;
        const mobileNumber = document.getElementById('register-mobile').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const users = getUsers();

        registerMessage.textContent = ''; 

        // CÓMO SE VALIDA LA CONTRASEÑA Y OTROS CAMPOS:
        // Aquí comprobamos que el usuario haya cumplido todas las "Reglas del Juego" (REGEX)
        if (!EMAIL_REGEX.test(email) || !MOBILE_REGEX.test(mobileNumber) || password !== confirmPassword || !PASSWORD_REGEX.test(password)) {
             // Aquí irían los mensajes de error específicos (que ya están implementados arriba,
             // pero se omiten en este comentario para mantener el foco en la lógica)
             if (!EMAIL_REGEX.test(email)) registerMessage.textContent = 'Por favor, ingresa un correo electrónico válido.';
             else if (!MOBILE_REGEX.test(mobileNumber)) registerMessage.textContent = 'Por favor, ingresa un número de móvil válido.';
             else if (password !== confirmPassword) registerMessage.textContent = 'Las contraseñas no coinciden.';
             else if (!PASSWORD_REGEX.test(password)) registerMessage.textContent = 'Contraseña debe tener min. 8 chars, Mayús, Minús, Número y Símbolo.';
             return;
        }
        
        if (users.some(user => user.email === email)) {
            registerMessage.textContent = 'Este correo ya está registrado.';
            return;
        }

        // Si todo está bien, creamos y guardamos el nuevo usuario
        const newUser = {
            fullName: fullName,
            mobileNumber: mobileNumber,
            email: email,
            password: password,
        };

        users.push(newUser);
        saveUsers(users);

        alert('Registro exitoso! Ahora puedes iniciar sesión.');
        registerForm.reset();
        switchView('login');
    });

    // ----------------------------------------------------------------
    // MÓDULO DE INICIO DE SESIÓN (LOGIN)
    // ----------------------------------------------------------------
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const users = getUsers();
        loginMessage.textContent = '';
        blockedRecoveryLink.classList.add('hidden'); 

        const now = Date.now();
        
        // MANEJO DEL BLOQUEO:
        // Recuperamos el historial de intentos fallidos de este usuario.
        // Si no existe, creamos un objeto con 0 intentos.
        let userStatus = JSON.parse(localStorage.getItem(`status_${email}`)) || { attempts: 0, lockoutTime: 0 };

        // 1. Si el tiempo de bloqueo aún no ha pasado, mostramos el mensaje de bloqueo.
        if (userStatus.lockoutTime > now) {
            loginMessage.textContent = `Cuenta bloqueada por intentos fallidos.`;
            blockedRecoveryLink.classList.remove('hidden'); // Mostramos el enlace de recuperación
            return;
        }

        // 2. Buscamos el usuario con las credenciales correctas
        const foundUser = users.find(user => 
            user.email === email && user.password === password
        );

        if (foundUser) {
            // ÉXITO: Reiniciamos el contador de intentos y damos la bienvenida.
            sessionStorage.setItem('loggedInUser', JSON.stringify(foundUser)); 
            localStorage.removeItem(`status_${email}`); // Limpiamos el historial de bloqueo
            
            welcomeMessageText.innerHTML = `Bienvenido al sistema, <strong>${foundUser.fullName}</strong>`; 
            loginForm.reset();
            switchView('welcome');
        } else {
            // FALLO: Aplicamos las reglas de bloqueo si el usuario existe
            const userExists = users.some(user => user.email === email);
            
            if (userExists) {
                userStatus.attempts += 1; // Un intento más
                
                if (userStatus.attempts >= MAX_ATTEMPTS) {
                    // BLOQUEO ALCANZADO:
                    // Establecemos el tiempo futuro de desbloqueo y reseteamos el contador.
                    userStatus.lockoutTime = now + LOCKOUT_DURATION_MS;
                    userStatus.attempts = 0;
                    
                    loginMessage.textContent = `Cuenta bloqueada por intentos fallidos.`;
                    blockedRecoveryLink.classList.remove('hidden');

                } else {
                    loginMessage.textContent = `Usuario o contraseña incorrectos.`; 
                }
                // Guardamos el estado actualizado para el próximo intento.
                localStorage.setItem(`status_${email}`, JSON.stringify(userStatus));
            } else {
                loginMessage.textContent = `Usuario o contraseña incorrectos.`; 
            }
        }
    });

    // ----------------------------------------------------------------
    // MÓDULO DE CERRAR SESIÓN
    // ----------------------------------------------------------------
    document.getElementById('logout-button').addEventListener('click', () => {
        sessionStorage.removeItem('loggedInUser');
        switchView('login');
    });

    // ----------------------------------------------------------------
    // MÓDULO DE RECUPERACIÓN DE CONTRASEÑA (Flujo Simplificado)
    // ----------------------------------------------------------------
    const resetPasswordForm = document.getElementById('reset-password-form');
    const resetMessage = document.getElementById('reset-message');
    
    // Este módulo asume que el usuario puede cambiar la contraseña inmediatamente
    // al proveer su correo, sin necesidad de códigos o pasos intermedios.
    resetPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Requerimos el email para saber QUÉ cuenta debemos modificar
        const emailIdentifier = document.getElementById('reset-email-identifier').value; 
        const newPassword = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;
        resetMessage.textContent = '';
        
        let users = getUsers();
        let userToUpdate = users.find(user => user.email === emailIdentifier);

        if (!userToUpdate) {
            resetMessage.textContent = 'Error: El correo electrónico no está registrado.';
            return;
        }

        // CÓMO SE VALIDA LA NUEVA CONTRASEÑA (¡Debe cumplir las reglas de robustez!)
        if (newPassword !== confirmPassword) {
            resetMessage.textContent = 'Las nuevas contraseñas no coinciden.';
            return;
        }
        
        if (!PASSWORD_REGEX.test(newPassword)) {
             resetMessage.textContent = 'La nueva contraseña debe tener min. 8 chars, Mayús, Minús, Número y Símbolo.';
            return;
        }
        
        // CÓMO SE ACTUALIZA LA CONTRASEÑA OLVIDADA:
        
        // 1. Aplicamos el cambio al objeto del usuario
        userToUpdate.password = newPassword;
        
        // 2. Guardamos la nueva lista de usuarios en la "base de datos"
        users = users.map(user => user.email === userToUpdate.email ? userToUpdate : user);
        saveUsers(users);

        // 3. Desbloqueamos la Cuenta: Esto es crucial si la cuenta se bloqueó en el login
        //    (Removemos el registro de intentos fallidos para el usuario)
        localStorage.removeItem(`status_${userToUpdate.email}`); 

        // 4. Mostramos el mensaje de éxito y volvemos al login
        alert('Contraseña actualizada. Ahora puede iniciar sesión.'); 
        resetPasswordForm.reset();
        
        switchView('login');
    });

    // ----------------------------------------------------------------
    // VERIFICAR ESTADO DE SESIÓN AL CARGAR
    // ----------------------------------------------------------------
    // Verifica si el usuario ya inició sesión previamente y lo redirige
    const checkSession = () => {
        const loggedInUserJSON = sessionStorage.getItem('loggedInUser');
        if (loggedInUserJSON) {
            const user = JSON.parse(loggedInUserJSON);
            welcomeMessageText.innerHTML = `Bienvenido al sistema, <strong>${user.fullName}</strong>`;
            switchView('welcome');
        } else {
            switchView('login');
        }
    };

    checkSession();
});