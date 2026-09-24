# Tesorería Firestore

Aplicación web instalable (PWA) para administrar el flujo de caja de varias empresas y varias cuentas corrientes. Está preparada para GitHub Pages y usa Firebase Authentication + Cloud Firestore.

## Funciones incluidas

- Empresas y cuentas corrientes independientes, con saldo de apertura.
- Documentos por cobrar y por pagar, con vencimientos y proyección de 30, 60 o 90 días.
- Auxiliar de clientes y proveedores por empresa, buscable dinámicamente por RUT o nombre.
- Número de documento y contraparte obligatorios para clientes y proveedores.
- Carga Excel de hasta 300 documentos con revisión previa y detección de duplicados.
- Movimientos manuales, préstamos y leasing; estos últimos admiten hasta 60 cuotas.
- Cobros y pagos totales o parciales que actualizan el saldo bancario.
- Exportación a Excel, interfaz responsiva estilo SAP e instalación en PC, Android y iPhone.
- Acceso por correo/contraseña o Google. Los datos de cada usuario quedan aislados en Firestore.

## 1. Crear y preparar Firebase

1. En [Firebase Console](https://console.firebase.google.com/), crea un proyecto.
2. En **Project settings → Your apps**, agrega una aplicación web y conserva sus datos de configuración.
3. En **Build → Authentication → Sign-in method**, habilita:
   - **Email/Password**.
   - **Google** si deseas usar ese botón de acceso.
4. En **Build → Firestore Database**, crea la base de datos. Selecciona una región cercana a tus usuarios.
5. Instala Firebase CLI y publica las reglas incluidas:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,firestore:indexes
   ```

Las reglas permiten leer y escribir únicamente dentro de `users/{uid}/...` cuando el usuario autenticado coincide con ese `uid`. Publícalas antes de ingresar datos reales.

## 2. Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Completa `.env.local` con los seis valores de la configuración web de Firebase:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

La configuración web de Firebase identifica el proyecto; no reemplaza las reglas de seguridad. No incluyas cuentas de servicio ni claves privadas en este repositorio.

## 3. Publicar en GitHub Pages

1. Descomprime este ZIP y sube **el contenido de la carpeta** a la raíz de un repositorio GitHub.
2. En el repositorio abre **Settings → Secrets and variables → Actions → Variables**.
3. Crea estas variables con los valores de tu aplicación web Firebase:

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

4. Abre **Settings → Pages** y selecciona **Source: GitHub Actions**.
5. Haz un push a la rama `main` o ejecuta manualmente el flujo **Deploy Tesorería to GitHub Pages** desde la pestaña Actions.
6. Copia el dominio publicado, por ejemplo `usuario.github.io`, y agrégalo en **Firebase Console → Authentication → Settings → Authorized domains**.

El flujo `.github/workflows/deploy-pages.yml` instala dependencias, comprueba los tipos, construye la aplicación y publica `dist/`. La ruta relativa de Vite permite alojarla tanto en `usuario.github.io` como en `usuario.github.io/nombre-repositorio/`.

## 4. Instalar en PC o móvil

- **Chrome o Edge en PC:** menú del navegador → **Instalar Tesorería**.
- **Android / Chrome:** menú ⋮ → **Agregar a pantalla principal** → **Instalar**.
- **iPhone / Safari:** Compartir → **Agregar a pantalla de inicio**.

La app requiere conexión para consultar saldos y guardar cambios. Los datos financieros no se guardan en la caché del service worker.

## Modelo de datos

Cada cuenta autenticada tiene estas subcolecciones:

```text
users/{uid}/companies
users/{uid}/accounts
users/{uid}/partners
users/{uid}/entries
users/{uid}/payments
```

Los documentos de cliente/proveedor usan un identificador determinista para evitar duplicados incluso si dos dispositivos intentan crear el mismo documento. Los abonos y las importaciones se guardan mediante transacciones de Firestore.

## Comandos

```bash
npm run dev       # desarrollo
npm run test      # pruebas unitarias
npm run build     # verificación TypeScript y compilación
npm run preview   # vista local de la compilación
```

## Importación Excel

Desde **Importar Excel**, descarga la plantilla incluida. Registra primero los auxiliares; el nombre y RUT del archivo deben corresponder a un cliente o proveedor de la empresa. Si el vencimiento viene vacío, se asignan 30 días desde la emisión. Ninguna fila se guarda si la revisión detecta errores.
