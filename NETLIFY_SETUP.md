# Netlify Staging Setup — AJÚA BPM

## Paso 1 — Crear cuenta Netlify

1. Ir a [netlify.com](https://netlify.com)
2. Click **Sign up** → **Continue with GitHub**
3. Autorizar acceso a tu cuenta GitHub

## Paso 2 — Crear el sitio

1. En el dashboard → **Add new site** → **Import an existing project**
2. Elegir **GitHub**
3. Buscar y seleccionar el repo `ajua-bpm`
4. Configurar:
   - **Branch to deploy:** `staging`
   - **Publish directory:** `.` (un solo punto)
   - Build command: dejar vacío
5. Click **Deploy site**

## Paso 3 — Obtener NETLIFY_AUTH_TOKEN

1. Click en tu avatar (arriba a la derecha) → **User settings**
2. Ir a la sección **Applications**
3. En **Personal access tokens** → **New access token**
4. Nombre: `github-actions-ajuabpm`
5. Click **Generate token**
6. **Copiar el token ahora** — no se vuelve a mostrar

## Paso 4 — Obtener NETLIFY_SITE_ID

1. En el dashboard, entrar al sitio recién creado
2. Ir a **Site configuration** → **General**
3. En la sección **Site details** → copiar el **Site ID**
   (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Paso 5 — Agregar Secrets en GitHub

1. Ir al repo en GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** — agregar los dos:

| Secret name          | Valor                        |
|----------------------|------------------------------|
| `NETLIFY_AUTH_TOKEN` | El token del Paso 3          |
| `NETLIFY_SITE_ID`    | El Site ID del Paso 4        |

## Paso 6 — Configurar dominio test.agroajua.com (opcional)

1. En Netlify → tu sitio → **Domain management** → **Add custom domain**
2. Ingresar `test.agroajua.com`
3. En tu proveedor DNS agregar:
   ```
   CNAME  test  [tu-sitio].netlify.app
   ```

## Verificar que funciona

Hacer cualquier cambio en rama `staging` y push:
```bash
git add .
git commit -m "test: staging deploy"
git push origin staging
```

Ver el deploy en GitHub → Actions → **Deploy AJÚA BPM Staging**.
Al terminar, el sitio estará en `https://[tu-sitio].netlify.app` o `https://test.agroajua.com`.
