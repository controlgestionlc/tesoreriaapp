# Tesorería Firestore

Aplicación web instalable (PWA) para administrar el flujo de caja de varias empresas y varias cuentas corrientes. Está preparada para GitHub Pages y conectada al proyecto Firebase `tesoreriaapp-e8bac` mediante Firebase Authentication + Cloud Firestore.

## Funciones incluidas

- Empresas y cuentas corrientes independientes, con saldo de apertura.
- Documentos por cobrar y por pagar, con vencimientos y proyección de 30, 60 o 90 días.
- Auxiliar de clientes y proveedores por empresa, buscable dinámicamente por RUT o nombre.
- Número de documento y contraparte obligatorios para clientes y proveedores.
- Carga Excel de hasta 300 documentos con revisión previa y detección de duplicados. Acepta la plantilla propia y el formato `REGISTRO FLUJO CAJA`.
- Creación automática de auxiliares nuevos desde el RUT y nombre del archivo; si una fila no trae RUT, intenta reutilizar un auxiliar anterior por nombre.
- Movimientos manuales, préstamos y leasing; estos últimos admiten hasta 60 cuotas.
- Cobros y pagos totales o parciales que actualizan el saldo bancario.
- Compromisos forestales para bosque en pie, madera puesta en planta u orilla de camino, con fecha, monto, contraparte y detalle del negocio.
- Flujo de aprobación: los compromisos quedan pendientes hasta que un gerente o administrador los confirma; solo entonces afectan la proyección de caja.
- Roles Administrador, Gerente y Supervisor. El supervisor usa una vista móvil simplificada y solo puede consultar o editar sus propios compromisos pendientes.
- Panel gerencial con monto clicable para abrir el detalle del compromiso y acciones de confirmar o descartar.
- Exportación a Excel, interfaz responsiva estilo SAP e instalación en PC, Android y iPhone.
- Acceso por correo/contraseña o Google. Cada equipo comparte un espacio protegido por roles en Firestore.

## 1. Terminar de preparar Firebase

La configuración web ya está incorporada. Solo debes completar estas acciones en [Firebase Console](https://console.firebase.google.com/) para el proyecto `tesoreriaapp-e8bac`:

1. En **Build → Authentication → Sign-in method**, habilita:
   - **Email/Password**.
   - **Google** si deseas usar ese botón de acceso.
2. En **Build → Firestore Database**, crea la base de datos si todavía no existe. Selecciona una región cercana a tus usuarios.
3. Instala Firebase CLI y publica las reglas incluidas:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

Las reglas incluidas aplican los permisos de Administrador, Gerente y Supervisor directamente en Firestore. **Debes publicar estas reglas antes de subir la versión 1.2 a GitHub**, pues la aplicación crea el espacio compartido al iniciar sesión.

## Roles y alta de usuarios

- **Administrador:** acceso financiero completo, aprobación de compromisos y administración de usuarios.
- **Gerente:** acceso financiero completo y aprobación de compromisos.
- **Supervisor:** solo ve las empresas disponibles y sus propios compromisos; puede crear, editar o eliminar los que sigan pendientes.

Para incorporar a una persona:

1. La persona crea su cuenta e inicia sesión una vez en la aplicación, para registrar su correo.
2. El administrador entra en **Usuarios y permisos → Agregar usuario**, escribe ese correo y asigna Gerente o Supervisor.
3. La persona cierra sesión y vuelve a ingresar. Desde el móvil verá automáticamente la interfaz correspondiente a su rol.

Los usuarios existentes se convierten automáticamente en administradores de su propio espacio y conservan sus datos actuales; no se requiere migración manual.

## 2. Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

No necesitas crear `.env.local`: la configuración de `tesoreriaapp-e8bac` está incluida. Si en el futuro quieres conectar otro proyecto, copia `.env.example` como `.env.local` y reemplaza sus valores. La configuración web identifica el proyecto; no reemplaza las reglas de seguridad. No incluyas cuentas de servicio ni claves privadas en este repositorio.

## 3. Publicar en GitHub Pages

1. Descomprime este ZIP y sube **el contenido de la carpeta** a la raíz de un repositorio GitHub.
2. Abre **Settings → Pages** y selecciona **Source: GitHub Actions**.
3. Haz un push a la rama `main` o ejecuta manualmente el flujo **Deploy Tesorería to GitHub Pages** desde la pestaña Actions.
4. Copia el dominio publicado, por ejemplo `usuario.github.io`, y agrégalo en **Firebase Console → Authentication → Settings → Authorized domains**.

Las variables `VITE_FIREBASE_*` de GitHub son opcionales y únicamente se necesitan si deseas reemplazar el proyecto Firebase incorporado.

El flujo `.github/workflows/deploy-pages.yml` instala dependencias, comprueba los tipos, construye la aplicación y publica `dist/`. La ruta relativa de Vite permite alojarla tanto en `usuario.github.io` como en `usuario.github.io/nombre-repositorio/`.

## 4. Instalar en PC o móvil

- **Chrome o Edge en PC:** menú del navegador → **Instalar Tesorería**.
- **Android / Chrome:** menú ⋮ → **Agregar a pantalla principal** → **Instalar**.
- **iPhone / Safari:** Compartir → **Agregar a pantalla de inicio**.

La app requiere conexión para consultar saldos y guardar cambios. Los datos financieros no se guardan en la caché del service worker.

## Modelo de datos

Cada cuenta autenticada tiene estas subcolecciones:

```text
memberships/{uid}
userDirectory/{hashCorreo}
users/{ownerUid}/members
users/{ownerUid}/companies
users/{ownerUid}/accounts
users/{ownerUid}/partners
users/{ownerUid}/entries
users/{ownerUid}/payments
users/{ownerUid}/commitments
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

Desde **Importar Excel**, descarga la plantilla incluida o usa un archivo con las columnas `TIPO`, `DOCUMENTO`, `NUMERO DOC`, `FECHA EMISION`, `VENCIMIENTO`, `RUT`, `AUXILIAR` e `IMPORTE A PAGAR`. Los valores `INGRESO` y `EGRESO` se reconocen automáticamente. Las remuneraciones, imposiciones e impuestos se clasifican sin exigir auxiliar; para facturas se crean los auxiliares inexistentes. Si el vencimiento viene vacío, se asignan 30 días desde la emisión. Ninguna fila ni auxiliar se guarda si la revisión detecta errores.
