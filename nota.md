![1773469005934](image/nota/1773469005934.png)#  ParkingOS — Sistema de Gestión de Parqueadero Comercial

##  Estado actual del repo (Mar 2026)

- Stack real en este workspace: Next.js 16 (App Router), React 19, TypeScript 5, Prisma 7, PostgreSQL.
- Módulos principales ya conectados a API/DB: dashboard, turnos, reportes, notificaciones, tickets, pagos, settings, gestión y auditoría.
- RBAC aplicado: OPERATOR sin finanzas ni administración.
- Dev: `npm run dev` usa webpack por estabilidad en Windows (Turbopack puede fallar por recursos).

---

##  Checklist de validación RBAC (rápido)

### SUPER_ADMIN
- Accede a: Dashboard, Reportes, Pagos, Gestión, Settings, Auditoría, Usuarios, Suscripciones.
- Multi-sede: selector de sede visible y funcional (Gestión / Usuarios / Mensajes).
- Acciones: crear/editar sedes, tarifas, usuarios; telemetría visible.

### ADMIN
- Accede a: Dashboard, Reportes, Pagos, Gestión, Settings, Auditoría.
- No puede crear sedes (solo SUPER_ADMIN).
- Puede crear/editar zonas y tarifas en su sede.

### OPERATOR
- Accede a: Tickets, Turnos, Mapa, Mensajes, Notificaciones.
- Bloqueado de: Reportes, Pagos, Usuarios, Settings, Auditoría, Suscripciones.
- Datos financieros: sin acceso o valores en cero.

---

##  Script de Smoke Test por Rol (Demo / Entrevista)

Objetivo: mostrar el sistema sin improvisar en 8-12 minutos.

### Pre-demo (1 min)
- Iniciar app: `npm run dev`
- Si credenciales fallan: usar botón "Sincronizar Datos Maestros" en login.
- Usuarios demo:
  - SUPER_ADMIN: `matias.superadmin@acuario.com` / `Matias@Admin123`
  - ADMIN: `matias.admin@acuario.com` / `Matias@Admin123`
  - OPERATOR: `matias.operator@acuario.com` / `Matias@Admin123`

### Guión SUPER_ADMIN (3 min)
1. Entrar a Dashboard y validar KPIs.
2. Ir a Usuarios y crear un operador nuevo con sede.
3. Ir a Gestión y crear/editar una zona o tarifa.
4. Ir a Auditoría y mostrar trazabilidad de acción reciente.
5. Ir a Perfil y actualizar teléfono/nombre.

Resultado esperado:
- Ve módulos globales: Usuarios, Gestión, Reportes, Pagos, Settings, Auditoría.
- Puede crear ADMIN/OPERATOR y asignar sede.

### Guión ADMIN (3 min)
1. Entrar a Dashboard, Gestión y Settings.
2. Editar parámetros de sede (sin crear sede nueva global).
3. Ir a Usuarios y crear solo operador de su sede.
4. Revisar Reportes/Pagos de su contexto.

Resultado esperado:
- No puede crear SUPER_ADMIN.
- No tiene operaciones globales de multi-sede tipo dueño.

### Guión OPERATOR (3 min)
1. Entrar a Mapa/Tickets y registrar ingreso.
2. Procesar salida con cálculo de tarifa y pago en caja.
3. Abrir/cerrar turno en módulo de Turnos.
4. Revisar Mensajes/Notificaciones.

Resultado esperado:
- Sin acceso a Usuarios, Auditoría, Settings, Pagos, Reportes.
- Flujo operativo completo de cabina.

### Criterio de aprobación rápido
- Auth funciona con 3 roles.
- RBAC visual y API coherente (sin filtraciones de datos).
- Flujos core: entrada/salida, caja y turno sin errores.
- Auditoría registra operaciones críticas.

---

##  Cabos sueltos (estado actual)

### Cerrados
- Navegación por rol completa para módulos implementados.
- Vista de perfil creada y edición de perfil habilitada.
- Corrección de textos con caracteres dañados.
- Semilla de usuarios estable para demo.

### Pendientes reales (Roadmap)
- Stripe, notificaciones reales (email/SMS/push), Redis, OCR, API pública/webhooks.
- Storage S3/R2, PWA, i18n, testing E2E completo.

### Mapa de faltantes por prioridad (real)

| Prioridad | Módulo | Estado actual | Siguiente entrega concreta |
|---|---|---|---|
| Alta | Pagos digitales (Stripe) | Solo caja local | Endpoint de checkout + webhook `payment.completed` |
| Alta | Notificaciones reales | Solo in-app | Email transaccional + plantilla de vencimiento |
| Alta | Redis seguridad | Rate limit in-memory en login y operaciones críticas | Migrar a rate limit distribuido con Redis + políticas por sede |
| Media | API pública / Webhooks | No expuesto | `/api/v1` con API key y eventos básicos |
| Media | OCR de placas | Manual | Captura placa + parser OCR fallback |
| Media | Storage S3/R2 | Local | Subida de adjuntos de ticket/factura |
| Media | PWA/Mobile | Parcial | Manifest + offline cache de vistas operativas |
| Baja | i18n | Solo ES | Estructura de diccionario EN/PT |
| Baja | E2E completo | Smoke manual | Suite Playwright para login+ticket+shift |

### Alcance implementado vs propuesto

- Implementado: módulos operativos core (dashboard, mapa, tickets, turnos, pagos caja, reportes, gestión, usuarios, auditoría, perfil).
- Implementado: hardening activo en API (rate limit in-memory en login y operaciones críticas con 429/Retry-After, auditoría de bloqueos/fallos/exitos de login con IP anonimizada por hash y validación estricta de sede en cierres/salidas).
- Implementado: capa reusable de rate limiting in-memory compartida entre auth y dashboard, lista para migración incremental a backend distribuido (Redis).
- Implementado: selector de backend para rate limiting por entorno (`RATE_LIMIT_BACKEND`) con proveedor Redis disponible (`REDIS_URL`) y fallback seguro a memory.
- Implementado: smoke script de verificación de 429/Retry-After para rate limiting (`check-rate-limit.js`).
- Implementado: reporte CI-friendly para smoke de rate limit (formatos `json` y `junit`).
- Implementado: preflight de disponibilidad de servidor en smoke de rate limit (poll + timeout configurable).
- Implementado: modo estricto en smoke de rate limit para CI (`RL_FAIL_ON_SKIPPED=true`).
- Implementado: auto-start opcional de servidor en smoke de rate limit (`RL_AUTOSTART_SERVER=true`).
- Implementado: obtención automática de token para smoke de dashboard vía credenciales (`DASHBOARD_TEST_EMAIL`/`DASHBOARD_TEST_PASSWORD`).
- Implementado: script combinado `strict+auto` para smoke de rate limit (sin depender de server levantado manualmente).
- Implementado: pipeline CI con Postgres + migraciones + seed + smoke strict:auto + artifacts.
- Implementado: smoke E2E de negocio robusto con usuario de flujo configurable (evita dependencia de asignación de sede del operador).
- Propuesto/roadmap: integraciones externas, mobile avanzado, OCR, i18n completo y hardening adicional.

### Arquitectura & Funcionalidades — Calidad Producción Enterprise

---

##  Stack Tecnológico — Actualizado 2026 (real en este repo)

Basado en lo que está implementado en este workspace:

###  Frontend

| Tecnología | Por qué en 2026 |
|---|---|
| **Next.js 16** (App Router) | Framework fullstack, Route Handlers para API y Server Components |
| **React 19** + TypeScript strict | React es usado por el 39.5% de desarrolladores profesionales a nivel mundial (Stack Overflow Dev Survey 2025) |
| **TailwindCSS v4** + CSS custom | Utilidades + estilos propios del dashboard |
| **UI custom** | Componentes propios ajustados al dominio |

###  Backend

| Tecnología | Por qué en 2026 |
|---|---|
| **Next.js Route Handlers** | API REST simple dentro del mismo repo |
| **Prisma ORM v7** | ORM con type-safety nativo y migraciones |

###  Base de Datos & Infraestructura

| Tecnología | Por qué en 2026 |
|---|---|
| **PostgreSQL 17** | Estándar para bases de datos relacionales |
| **Redis** | (Roadmap) rate limiting y sesiones |
| **S3 / Cloudflare R2** | (Roadmap) almacenamiento de archivos |
| **Docker** + Docker Compose | (Roadmap) entorno reproducible |
| **GitHub Actions** | (Roadmap) CI/CD |

###  Deployment

| Tecnología | Por qué en 2026 |
|---|---|
| **Vercel** | (Roadmap) deploy frontend |
| **Railway** o **Render** | (Roadmap) backend + DB |

###  Diferenciador de Portafolio — IA

| Feature | Detalle |
|---|---|
| Reconocimiento de placas (OCR) | (Roadmap) Tesseract.js o API externa |
| Chatbot de soporte | (Roadmap) integración con LLM |
| Predicción de ocupación | (Roadmap) modelo con datos históricos |

###  Stack Final Condensado

```
Frontend:   Next.js 16 · React 19 · TypeScript 5 · TailwindCSS v4
Backend:    Next.js Route Handlers · Prisma v7
Database:   PostgreSQL
Auth:       JWT · RBAC
```

> **Nota UI:** el look actual usa glassmorphism para demo; en roadmap se contempla una versión más data-dense y dark-mode-first.

---

##  Diagrama de Arquitectura

![Diagrama de arquitectura ParkingOS](image.png)

---

##  Roles del Sistema — Lógica de Negocio del Parqueadero

El sistema de roles refleja la jerarquía real de un parqueadero comercial:

### `SUPER_ADMIN` — Dueño / Gerente General del Parqueadero

El nivel más alto del sistema. Tiene acceso total y sin restricciones.

| Permiso | Detalle |
|---|---|
| Gestión completa del sistema | Crear, editar, eliminar parqueaderos (multi-sede) |
| Gestión de usuarios | Crear/eliminar admins, operadores, clientes |
| Configuración financiera | Definir tarifas, convenios, descuentos globales |
| Reportes ejecutivos | Ingresos consolidados, ocupación por sede, rentabilidad |
| Auditoría total | Ver log de auditoría de todos los usuarios y acciones |
| Configuración de integraciones | Stripe, Twilio, S3, APIs externas |
| Gestión de suscripciones | Planes de mensualidades, contratos corporativos |

**Caso real:** *El dueño del parqueadero del centro comercial revisa desde su casa los ingresos del día, compara ocupación entre sus 3 sedes y ajusta la tarifa porque viene un evento el fin de semana.*

---

### `ADMIN` — Administrador de Sede / Jefe de Operaciones

Encargado de una sede específica. Gestiona el día a día operativo.

| Permiso | Detalle |
|---|---|
| Gestión de sede | Configurar zonas, espacios, horarios de la sede asignada |
| Gestión de operadores | Crear/editar/desactivar operadores de su sede |
| Gestión de turnos | Abrir/cerrar turnos, asignar operadores a turnos |
| Tarifas de sede | Ajustar tarifas locales (dentro de los rangos del SUPER_ADMIN) |
| Reportes de sede | Ocupación, ingresos, vehículos frecuentes de su sede |
| Cierre de caja | Supervisar cuadre de caja de todos los turnos |
| Mantenimiento | Marcar espacios en mantenimiento, gestionar incidencias |
| Clientes y abonados | Aprobar mensualidades, gestionar convenios locales |

**Caso real:** *La administradora del parqueadero del piso B2 abre el turno de la mañana, revisa que todos los espacios estén bien asignados, aprueba una mensualidad nueva para un empleado del edificio, y al final del día supervisa el cierre de caja del operador del turno tarde.*

---

### `OPERATOR` — Operador de Cabina / Cajero

El que está en el día a día, en la cabina de entrada/salida. Solo tiene acceso a funciones operativas.

| Permiso | Detalle |
|---|---|
| Registrar entrada | Escanear placa, asignar espacio, generar ticket QR |
| Registrar salida | Buscar vehículo por placa/ticket, calcular tarifa, cobrar |
| Cobrar en caja | Procesar pagos en efectivo y digitales |
| Consultar disponibilidad | Ver mapa de espacios en tiempo real |
| Gestionar su turno | Abrir/cerrar SU propio turno, hacer corte de caja |
| Registrar incidencias | Reportar daños, vehículos abandonados, problemas |
| Consultar vehículos | Buscar vehículo por placa (solo lectura del historial) |

**No puede:** Modificar tarifas, eliminar registros, ver reportes financieros, gestionar otros usuarios.

**Caso real:** *Juan llega a su turno a las 6 AM, abre turno en el sistema, durante el día registra entradas/salidas, cobra a cada vehículo, y a las 2 PM cierra turno imprimiendo su reporte de caja con el total recaudado en efectivo y digital.*

---

### `CUSTOMER` — Cliente Registrado

Usuario final que usa el parqueadero. Puede tener cuenta para beneficios.

| Permiso | Detalle |
|---|---|
| Ver sus tickets | Historial de entradas/salidas y tickets activos |
| Ver sus facturas | Descargar facturas electrónicas en PDF |
| Gestionar vehículos | Registrar/editar sus vehículos (placa, tipo, foto) |
| Pagar online | Pagar ticket activo desde el celular antes de llegar al carro |
| Mensualidad | Ver estado de su abono mensual, renovar, pagar |
| Wallet / Prepago | Recargar saldo para pagos rápidos |
| Notificaciones | Recibir alertas de vencimiento, tickets, promociones |
| Soporte | Contactar soporte, abrir reclamos |

**No puede:** Ver datos de otros clientes, acceder al panel administrativo, modificar tarifas.

**Caso real:** *María tiene mensualidad activa. Entra al parqueadero, el sistema reconoce su placa y le asigna espacio automáticamente. Cuando su mensualidad está por vencer, recibe notificación por email y la renueva desde la app.*

---

### `GUEST` — Visitante sin cuenta (implícito)

No tiene cuenta en el sistema. Su interacción es 100% a través del operador.

| Permiso | Detalle |
|---|---|
| Recibir ticket físico/digital | Al entrar recibe un ticket QR que usa para la salida |
| Pagar al salir | Paga en caja (efectivo o tarjeta) |

**Caso real:** *Un conductor entra al parqueadero del centro comercial, recibe un ticket QR, estaciona 3 horas, va a la caja antes de sacar el carro, paga $12.000 y sale.*

---

###  Matriz de Permisos por Rol

| Funcionalidad | SUPER_ADMIN | ADMIN | OPERATOR | CUSTOMER |
|---|:---:|:---:|:---:|:---:|
| Crear/eliminar sedes | SI | NO | NO | NO |
| Configurar sede (zonas, espacios) | SI | SI | NO | NO |
| Gestionar usuarios | SI | SI (solo operadores) | NO | NO |
| Definir tarifas globales | SI | NO | NO | NO |
| Ajustar tarifas de sede | SI | SI | NO | NO |
| Registrar entrada/salida | SI | SI | SI | NO |
| Cobrar en caja | SI | SI | SI | NO |
| Ver mapa de espacios | SI | SI | SI | NO |
| Gestionar turnos | SI | SI | SI (solo el propio) | NO |
| Ver reportes financieros | SI | SI (su sede) | NO | NO |
| Ver auditoría | SI | SI (su sede) | NO | NO |
| Pagar online | NO | NO | NO | SI |
| Ver sus tickets/facturas | NO | NO | NO | SI |
| Gestionar sus vehículos | NO | NO | NO | SI |
| Renovar mensualidad | NO | NO | NO | SI |

---

##  Módulos y Funcionalidades del Sistema

### 1.  Módulo de Autenticación y Autorización

- Registro e inicio de sesión con email/password y OAuth2 (Google)
- JWT con Access Token de corta vida + Refresh Token rotativo
- Sistema de roles: `SUPER_ADMIN`, `ADMIN`, `OPERATOR`, `CUSTOMER`
- Guards por rol y por recurso (RBAC granular)
- Bloqueo de cuenta por intentos fallidos (5 intentos → bloqueo 15 min)
- 2FA opcional con TOTP (Google Authenticator)
- Sesiones concurrentes controladas (máx. 3 dispositivos por usuario)

---

### 2.  Módulo de Gestión del Parqueadero

- Configuración del parqueadero: nombre, dirección, foto, horarios, capacidad
- Soporte **multi-sede** para cadenas de parqueaderos
- Definición de **zonas**: cubierta, descubierta, VIP, motos, discapacitados, eléctricos (con cargador)
- Gestión de **espacios** individuales con número, tipo y estado:
  - `AVAILABLE` — Disponible
  - `OCCUPIED` — Ocupado
  - `RESERVED` — Reservado (abonado/mensualidad)
  - `MAINTENANCE` — En mantenimiento
  - `OUT_OF_SERVICE` — Fuera de servicio
- Mapa visual interactivo de la planta del parqueadero en tiempo real
- Historial de cambios de estado por espacio
- Configuración de horarios de operación (apertura, cierre, horario nocturno)

---

### 3.  Módulo de Vehículos y Registro

- Registro de vehículos por placa con tipo: `CAR`, `MOTORCYCLE`, `TRUCK`, `VAN`, `ELECTRIC`, `BICYCLE`
- Reconocimiento automático de placa (integración con OCR — Tesseract.js o API externa)
- Historial completo de visitas por vehículo
- Lista de vehículos frecuentes / favoritos
- Vinculación de vehículo con cliente registrado (un cliente puede tener múltiples vehículos)
- **Blacklist**: lista negra de placas (vehículos con deudas o prohibidos)
- Fotos de entrada/salida del vehículo (almacenadas en S3/R2)

---

### 4.  Módulo de Entradas y Salidas (Core Operacional)

- Registro de **entrada**: timestamp, operador, espacio asignado, foto (opcional), placa detectada
- Registro de **salida**: timestamp, cálculo automático de tiempo y tarifa
- Búsqueda rápida por placa (input + scanner de código QR)
- Generación de **ticket digital** con código QR único por sesión
- Soporte de entradas sin registro previo (vehículos ocasionales / GUEST)
- Estados de ticket: `ACTIVE`, `COMPLETED`, `CANCELLED`, `LOST`, `EXPIRED`
- Penalización por ticket perdido (tarifa configurable)
- Tiempo de gracia configurable (ej: 15 min gratis para salida sin parquear)
- **Ticket perdido**: flujo especial con verificación de propiedad del vehículo

---

### 5.  Módulo de Tarifas y Precios

- Configuración de tarifas por tipo de vehículo y por zona
- Modalidades:
  -  Por **hora fraccionada** (cobro por minuto)
  -  Por **día completo** (tarifa plana)
  -  **Mensualidad** (abono mensual con espacio fijo o flotante)
  -  **Nocturna** (tarifa reducida en horario nocturno)
  -  **Por fracción** (cada 15 min, 30 min, etc.)
- Tarifas especiales: convenios con empresas, abonados, empleados del centro comercial
- Tarifas dinámicas por horario pico / horario valle
- Previsualización del costo antes de confirmar salida
- Promociones temporales (ej: "primera hora gratis los martes")
- Descuento por validación de ticket en comercios del centro comercial

---

### 6.  Módulo de Pagos y Facturación

- Pago en caja (efectivo) con cálculo de vuelto y denominaciones
- Pago digital: integración con **Stripe** (tarjeta, Apple Pay, Google Pay)
- Pago anticipado desde la app (CUSTOMER paga antes de llegar al carro)
- Generación de **facturas electrónicas** en PDF (almacenadas en S3/R2)
- Historial de transacciones por turno, por día, por operador
- Cierre de caja al final del turno con reporte de cuadre (efectivo vs digital)
- Soporte de pagos pendientes / deudas por vehículo (blacklist automática)
- Wallet / Prepago: saldo virtual para clientes frecuentes
- Notas crédito y anulaciones con trazabilidad

---

### 7.  Módulo de Reportes y Analytics

- **Dashboard operativo** en tiempo real:
  - Espacios libres vs ocupados (por zona)
  - Ingresos del día / semana / mes
  - Vehículos actualmente dentro del parqueadero
- Reporte de ocupación por hora, día, semana, mes
- Reporte de ingresos con filtros avanzados (por zona, tipo de vehículo, operador, método de pago)
- Top vehículos más frecuentes
- **KPIs del negocio**:
  - Tasa de rotación por espacio
  - Tiempo promedio de estancia
  - Ingreso promedio por vehículo
  - Porcentaje de ocupación por franja horaria
- Exportación a **CSV / PDF / Excel**
- Gráficas de tendencias con `Recharts`
- Comparativa entre sedes (SUPER_ADMIN)

---

### 8.  Módulo de Clientes y Mensualidades

- Registro de clientes con perfil completo (nombre, email, teléfono, documentos)
- Gestión de **abonados mensuales**:
  - Tipo de contrato: espacio **fijo** (plaza reservada 24/7) o **flotante** (acceso sin plaza fija)
  - Fecha inicio/fin, renovación automática o manual
  - Precio mensual según tipo de vehículo y zona
- Notificación de vencimiento de mensualidad (email + SMS — 7 días antes, 3 días, 1 día)
- Wallet virtual para prepago de parqueadero
- Historial de consumo por cliente
- Convenios corporativos: empresas que pagan mensualidades para sus empleados
- Portal del cliente: acceso web/móvil para gestionar su cuenta

---

### 9.  Módulo de Notificaciones

- **Emails transaccionales** con `Nodemailer` + plantillas `Handlebars`:
  - Bienvenida, ticket de entrada, factura, vencimiento de mensualidad
- **SMS** con `Twilio` para alertas críticas:
  - Vencimiento de mensualidad, deudas pendientes
- **Notificaciones push en tiempo real** vía WebSockets (`Socket.io`):
  - Actualización de espacios en mapa
  - Cambio de estado de ticket
- **Alertas al admin:**
  -  Parqueadero lleno (ocupación > 95%)
  -  Espacio en mantenimiento
  -  Caja descuadrada
  -  Vehículo de blacklist intentando entrar
  -  Vehículo con más de 24h sin salir

---

### 10.  Módulo de Configuración y Administración

- Panel de configuración general del sistema
- Gestión de usuarios y operadores (CRUD + asignación de roles)
- **Bitácora de auditoría**: log de TODAS las acciones críticas con:
  - Usuario responsable
  - Acción realizada
  - Timestamp
  - IP de origen
  - Datos antes/después del cambio
- Configuración de integraciones externas (Stripe, Twilio, S3, OCR)
- Parámetros de seguridad: tiempos de sesión, reintentos, políticas de contraseña
- Configuración de parámetros del negocio (tiempo de gracia, penalización por ticket perdido, etc.)

---

### 11.  Módulo de Turnos y Operadores

- **Apertura de turno**: el operador inicia sesión → se registra hora de inicio, caja inicial (fondo de caja)
- **Cierre de turno**: el operador finaliza → el sistema genera reporte automático:
  - Total recaudado en efectivo
  - Total recaudado en digital
  - Cantidad de vehículos atendidos
  - Diferencia entre esperado vs real (cuadre de caja)
- **Asignación de turnos** por el ADMIN:
  - Turno mañana (6:00 - 14:00)
  - Turno tarde (14:00 - 22:00)
  - Turno noche (22:00 - 6:00)
  - Horarios personalizables por sede
- **Cambio de turno** con verificación:
  - El operador saliente cierra y cuadra caja
  - El operador entrante verifica el conteo y firma digital
- **Registro de operador responsable** en cada transacción (trazabilidad total)
- **Reporte de productividad** por operador:
  - Vehículos atendidos
  - Tiempo promedio de atención
  - Descuadres históricos

---

### 12.  Módulo de Seguridad Avanzada

- **Rate limiting** por IP y por usuario (Redis-based)
- **CORS** configurado por dominio permitido
- **Helmet.js** para headers HTTP seguros
- **CSRF protection** en formularios
- **Encriptación de datos sensibles** en reposo:
  - Datos de pago (nunca almacenados directamente — Stripe Tokens)
  - Información personal (encriptación AES-256)
- **Sanitización de inputs** contra XSS e inyecciones SQL
- **Logs de seguridad** y detección de anomalías:
  - Intentos de acceso no autorizado
  - Patrones sospechosos (múltiples IPs, horarios inusuales)
- **Presigned URLs** para subida/descarga segura de archivos (S3/R2)
- **Políticas de contraseña**: mínimo 8 caracteres, mayúscula, minúscula, número, símbolo
- **Backup automático** de base de datos (diario + semanal completo)

---

### 13.  Módulo Mobile / PWA

- **Progressive Web App** (PWA) instalable en cualquier dispositivo
- **Vista del ticket en móvil** con código QR para salida rápida
- **Pago desde el celular** antes de llegar al carro (reduce colas)
- **Encontrar mi vehículo**: mapa del parqueadero con la ubicación de tu espacio
- **Notificaciones push nativas** (vencimiento de mensualidad, ticket activo)
- **Escaneo de QR** con cámara del teléfono (para operadores en cabina)
- **Modo offline**: cache de datos críticos para operación sin internet temporal

---

### 14.  API Pública y Webhooks

- **API REST pública** (versioned: `/api/v1/`) para integraciones con:
  - Sistemas de acceso vehicular (barreras automáticas)
  - Apps de centros comerciales
  - Sistemas de contabilidad externos
  - Pantallas LED de disponibilidad
- **Webhooks** para notificar eventos a sistemas externos:
  - `vehicle.entered` — Vehículo ingresó
  - `vehicle.exited` — Vehículo salió
  - `payment.completed` — Pago realizado
  - `parking.full` — Parqueadero lleno
  - `subscription.expiring` — Mensualidad por vencer
- **API Keys** con scopes para control de acceso granular
- **Rate limiting** diferenciado para API pública vs interna
- Documentación con **Swagger / OpenAPI**

---

### 15.  Internacionalización (i18n) — Roadmap

- Soporte multi-idioma con `next-intl`
- Multi-moneda para tarifas: COP, USD, EUR, MXN
- Formato de fechas/horas según locale
- Facturas en el idioma del cliente

---

##  Estructura de Carpetas Sugerida (Monorepo)

---

##  Decisiones de arquitectura (ADR)

### ¿Por qué Next.js fullstack y no NestJS separado?
- Mantener frontend + API en el mismo repo reduce fricción y acelera iteración para este portafolio.
- Route Handlers cubren las necesidades actuales sin overhead de microservicios.

### ¿Por qué PostgreSQL y no MongoDB?
- El dominio es relacional (usuarios, sedes, tickets, pagos) y requiere consistencia fuerte.

### ¿Por qué Prisma y no TypeORM?
- Mejor DX con type-safety y migraciones explícitas.

### ¿Por qué JWT y RBAC?
- Permite control granular por rol con un flujo simple y auditable.

```
parkingos/
├── apps/
│   ├── api/                  ← NestJS backend
│   │   ├── src/
│   │   │   ├── auth/         ← Autenticación, JWT, guards, roles
│   │   │   ├── parking/      ← Gestión de sedes, zonas, espacios
│   │   │   ├── vehicles/     ← Registro y gestión de vehículos
│   │   │   ├── tickets/      ← Entradas, salidas, tickets QR
│   │   │   ├── rates/        ← Tarifas, precios, promociones
│   │   │   ├── payments/     ← Pagos, facturación, Stripe
│   │   │   ├── reports/      ← Reportes, analytics, KPIs
│   │   │   ├── customers/    ← Clientes, mensualidades, abonos
│   │   │   ├── notifications/← Emails, SMS, push, websockets
│   │   │   ├── shifts/       ← Turnos, operadores, cuadre de caja
│   │   │   ├── security/     ← Rate limiting, auditoría, logs
│   │   │   ├── webhooks/     ← API pública, webhooks, API keys
│   │   │   └── common/       ← Guards, decorators, pipes, filters, interceptors
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── test/
│   └── web/                  ← Next.js frontend
│       ├── app/
│       │   ├── (auth)/       ← Login, registro, recuperar contraseña
│       │   ├── (dashboard)/  ← Panel principal según rol
│       │   ├── (parking)/    ← Mapa, espacios, zonas
│       │   ├── (tickets)/    ← Entrada/salida, búsqueda
│       │   ├── (payments)/   ← Caja, pagos, facturas
│       │   ├── (reports)/    ← Reportes y gráficas
│       │   ├── (customers)/  ← Gestión de clientes
│       │   ├── (settings)/   ← Configuración del sistema
│       │   └── (customer-portal)/ ← Portal del cliente final
│       ├── components/
│       │   ├── ui/           ← shadcn/ui components
│       │   ├── parking-map/  ← Mapa interactivo del parqueadero
│       │   ├── ticket/       ← Componentes de ticket y QR
│       │   └── dashboard/    ← Widgets del dashboard
│       ├── lib/
│       │   ├── trpc/         ← Cliente tRPC
│       │   ├── auth/         ← Auth.js config
│       │   └── utils/        ← Helpers
│       └── i18n/             ← Archivos de traducción
├── packages/
│   ├── ui/                   ← Componentes compartidos
│   ├── types/                ← Tipos TypeScript compartidos
│   ├── validators/           ← Schemas Zod compartidos
│   └── utils/                ← Helpers reutilizables
├── docker-compose.yml
├── turbo.json
└── .github/
    └── workflows/            ← GitHub Actions CI/CD
```

---

##  Buenas Prácticas que se Aplicarán

- **Clean Architecture** con separación clara de capas (Controller → Service → Repository)
- **DTOs + Zod** para validación de entrada en todos los endpoints
- **Paginación, filtros y ordenamiento** en todos los listados
- **Manejo global de errores** con `ExceptionFilter` personalizado + códigos de error tipados
- **Variables de entorno** con `@nestjs/config` + validación con `Zod`
- **Migraciones de DB** con `Prisma Migrate` (nunca modificar DB manualmente)
- **Commits convencionales** (`feat:`, `fix:`, `chore:`) con `commitlint` + `husky`
- **Linting y formateo**: `ESLint` + `Prettier` con pre-commit hooks
- **README profesional** con diagrama de arquitectura, instrucciones de setup y documentación de API
- **Seed data** para desarrollo local con datos realistas
- **Feature flags** para despliegue gradual de funcionalidades
- **Health checks** en todos los servicios (`/health` endpoint)

---

##  Estrategia de Testing

### Unit Tests (Vitest)
- Tests de servicios de negocio (cálculo de tarifas, validaciones de placa, lógica de turnos)
- Tests de utilidades compartidas
- Mocks de dependencias externas (Stripe, Twilio, S3)
- **Cobertura objetivo: ≥ 80%**

### Integration Tests (Vitest + Supertest)
- Tests de endpoints completos con base de datos de test (PostgreSQL en Docker)
- Verificar guards de roles (RBAC)
- Verificar flujos de autenticación
- Verificar cálculos de tarifas end-to-end

### E2E Tests (Playwright)
- Flujo completo: Entrada → Estancia → Pago → Salida
- Flujo de registro e inicio de sesión
- Flujo de operador: apertura de turno → atención → cierre de caja
- Flujo de cliente: pago online → descarga de factura
- Tests de responsive / mobile

### Performance Tests
- Load testing con `k6` para endpoints críticos
- Verificar tiempos de respuesta bajo carga (< 200ms para operaciones core)

---

##  Observabilidad y Monitoreo

- **Winston** para structured logging (JSON) con niveles (error, warn, info, debug)
- **Health checks** en `/health` con verificación de DB, Redis y servicios externos
- **Sentry** para tracking de errores en producción (frontend + backend)
- **Métricas** de negocio en el dashboard del SUPER_ADMIN
- **Alertas automáticas** cuando servicios críticos fallan

---

##  Dashboard v2 & Elite Navigation (Marzo 2026) — Actualización High-Fidelity

El sistema ha evolucionado a una interfaz **Enterprise-Native** centrada en la eficiencia operativa y estética premium:

###  Navegación "Pill NavBar"
- **Arquitectura Horizontal:** Se eliminó el sidebar lateral en favor de un hub de navegación flotante tipo "Pill" en la parte superior.
- **Micro-interacciones:** Transiciones elásticas y efectos de glassmorphism (backdrop-filter: blur) para un look moderno de app móvil nativa.
- **Acceso Directo:** Dashboard, Mapa, Operativo, Caja y Alertas integrados directamente en el flujo visual principal.

###  Diseño "Soft Gold & Chalk"
- **Paleta Corporativa:** Uso de `--accent-gold (#e9b949)` y `--bg-primary (#e0e4e7)` para un look elegante y profesional.
- **White Card Deck:** Sistema de tarjetas blancas con sombras multi-capa para visualización de datos maestros y formularios adaptivos.
- **Responsive Adaptive:** Todos los formularios (Entrada, Salida, Reserva) se adaptan dinámicamente al viewport sin perder la jerarquía visual.

###  Inteligencia Artificial Integrada
- **Predictive Occupancy:** Sistema de IA que analiza datos históricos para predecir la ocupación en las próximas 2 horas.
- **AI Smart Assistant:** Burbuja flotante de asistencia inteligente que ofrece sugerencias proactivas (ej: "Zona VIP cerca del límite, habilitar tarifas dinámicas?").
- **SCAN AI:** Simulación de reconocimiento de placas para agilizar el ingreso vehicular desde el módulo operativo.

---
 2026 ParkingOS — Ingeniería de Software de Clase Mundial.