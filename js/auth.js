(() => {
  const ADMIN_USER_ID = 'd5fdf151-0622-4b43-af2e-bd1f074eb7b2';
  document.documentElement.classList.add('admin-auth-checking');

  const style = document.createElement('style');
  style.textContent = `
    html.admin-auth-checking .app-shell,
    html.admin-auth-checking .bottom-nav { visibility: hidden !important; }
    .admin-auth-screen { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; padding: 20px; background: #f8f3ed; font-family: system-ui, sans-serif; }
    .admin-auth-card { width: min(100%, 420px); padding: 28px; border: 1px solid #e6ddd2; border-radius: 18px; background: #fff; box-shadow: 0 12px 40px #3b2a2218; }
    .admin-auth-card h1 { margin: 0 0 8px; color: #503d35; font-size: 24px; }
    .admin-auth-card p { color: #70645d; line-height: 1.5; }
    .admin-auth-card label { display: block; margin: 16px 0 6px; font-weight: 600; color: #503d35; }
    .admin-auth-card input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #d9cec2; border-radius: 8px; font: inherit; }
    .admin-auth-card button { width: 100%; margin-top: 20px; padding: 12px; border: 0; border-radius: 8px; background: #8c4b5c; color: white; font: inherit; font-weight: 700; cursor: pointer; }
    .admin-auth-error { min-height: 20px; color: #a33232 !important; }
    .admin-logout-button { margin-top: 8px; padding: 6px 10px; border: 1px solid currentColor; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
  `;
  document.head.appendChild(style);

  function showLogin(message = '') {
    document.documentElement.classList.remove('admin-auth-checking');
    document.querySelector('.admin-auth-screen')?.remove();
    const screen = document.createElement('div');
    screen.className = 'admin-auth-screen';
    screen.innerHTML = `
      <section class="admin-auth-card">
        <h1>Panel de administración</h1>
        <p>Inicia sesión con la cuenta administradora de Dulces Mele.</p>
        <form id="admin-auth-form">
          <label for="admin-auth-email">Correo</label>
          <input id="admin-auth-email" type="email" autocomplete="username" required>
          <label for="admin-auth-password">Contraseña</label>
          <input id="admin-auth-password" type="password" autocomplete="current-password" required>
          <p class="admin-auth-error" id="admin-auth-error" role="alert"></p>
          <button type="submit">Iniciar sesión</button>
        </form>
      </section>`;
    document.body.appendChild(screen);
    document.getElementById('admin-auth-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      const errorText = document.getElementById('admin-auth-error');
      button.disabled = true;
      errorText.textContent = '';
      try {
        const { data, error } = await SupabaseBridge.signIn(
          document.getElementById('admin-auth-email').value.trim(),
          document.getElementById('admin-auth-password').value
        );
        if (error) throw error;
        if (!data.user || data.user.id !== ADMIN_USER_ID) {
          await SupabaseBridge.signOut();
          throw new Error('Esta cuenta no tiene acceso al panel.');
        }
        location.reload();
      } catch (error) {
        errorText.textContent = error.message || 'No se pudo iniciar sesión.';
        button.disabled = false;
      }
    });
  }

  function addLogoutButton() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer || document.getElementById('admin-logout')) return;
    const button = document.createElement('button');
    button.id = 'admin-logout';
    button.type = 'button';
    button.className = 'admin-logout-button';
    button.textContent = 'Cerrar sesión';
    button.addEventListener('click', async () => {
      await SupabaseBridge.signOut();
      location.reload();
    });
    footer.appendChild(button);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await SupabaseBridge.getCurrentUser();
    if (!user || user.id !== ADMIN_USER_ID) {
      if (user) await SupabaseBridge.signOut();
      showLogin();
      return;
    }
    await SupabaseBridge.iniciarSincronizacionAdmin();
    addLogoutButton();
    document.documentElement.classList.remove('admin-auth-checking');
  });
})();
