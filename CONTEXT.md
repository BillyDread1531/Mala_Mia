# MALA MÍA — CONTEXTO MAESTRO DEL PROYECTO

> Fuente de verdad funcional y técnica del proyecto.
> Debe leerse antes de modificar arquitectura, base de datos o código.
> Si una decisión improvisada contradice este archivo, prevalece este archivo salvo autorización explícita.

## 1. IDENTIDAD Y OBJETIVO

**Nombre:** MALA MÍA  
**Negocio:** tienda de ropa nueva para mujer en Guatemala.  
**Administradores iniciales:** Andrea y Billy.

El sistema es principalmente administrativo, no un ecommerce público.

Objetivos:
- productos y catálogo;
- tallas y colores;
- inventario físico;
- compras y proveedores;
- ventas;
- descuentos;
- envíos;
- devoluciones;
- cambios;
- correcciones;
- gastos;
- costos y utilidad;
- movimientos de dinero;
- distribución de utilidades;
- comprobantes;
- reportes;
- auditoría.

El ecommerce público y los pagos online pueden existir en el futuro, pero no forman parte del MVP.

## 2. FILOSOFÍA

> Todo debe ser fácil de usar para la persona usuaria y complejo internamente cuando sea necesario.

La interfaz debe minimizar clics, decisiones repetitivas y términos técnicos. El sistema calcula, recomienda y alerta; la administradora decide.

## 3. ARQUITECTURA BLOQUEADA

### Stack
- Frontend: React + TypeScript + Vite + PWA.
- Backend: NestJS + TypeScript.
- Base de datos: MySQL 8.
- Diseño/administración de BD: MySQL Workbench.
- Arquitectura: monolito modular + API REST.

### NO introducir inicialmente
- PostgreSQL
- MongoDB
- Redis
- Kafka
- RabbitMQ
- NATS
- Kubernetes
- Docker
- Terraform
- ArgoCD
- microservicios
- GraphQL
- API Gateway independiente
- CI/CD complejo

No agregar tecnología por iniciativa propia. Si en el futuro existe una necesidad real, se evalúa antes.

### Costos
Objetivo aproximado: Q0 de operación usando soluciones gratuitas/open source/free-tier cuando sea viable.

## 4. DISPOSITIVOS Y UX

Debe funcionar bien en:
1. iPhone (principal)
2. tablet Samsung
3. desktop

Debe ser responsive/adaptativo y preparado como PWA.

### Identidad visual
Marca femenina, juvenil y moderna:
- blanco;
- crema;
- gris cálido;
- negro suave;
- fucsia/rosa fuerte como acento;
- corazón fucsia/rosa como elemento distintivo.

No hacer una interfaz completamente rosada ni un dashboard administrativo genérico.

### Navegación
Mobile:
- Inicio
- Ventas
- Inventario
- Más
- acción rápida central

Tablet:
- Inicio
- Ventas
- Inventario
- Compras
- Reportes
- Más

Desktop:
- Inicio
- Ventas
- Inventario
- Compras
- Gastos
- Reportes
- notificaciones/usuario

Más:
- Proveedores
- Dinero
- Comprobantes
- Usuarios
- Actividad
- Configuración

### Búsqueda
Debe ser instantánea, case-insensitive, tolerante a espacios y con coincidencias parciales/prefijo. Buscar “rosa” puede encontrar Rosa, Rosa fuerte, Rosa pálido, etc.

### Notificaciones
No usar alertas del navegador como UX principal. Usar tarjetas flotantes de éxito, advertencia, error e información. Preferir mensajes inline para recalculaciones.

## 5. DASHBOARD

Mostrar:
- saludo;
- ventas de hoy;
- utilidad de hoy;
- inventario;
- stock bajo;
- ventas del mes;
- utilidad del mes;
- acciones rápidas.

Acciones:
- Nueva venta
- Agregar producto
- Registrar gasto
- Registrar compra

## 6. PRODUCTOS

Datos:
- nombre;
- categoría;
- código;
- descripción opcional;
- fotografías opcionales;
- tallas;
- colores;
- precio actual;
- costo actual;
- precio recomendado.

El código se genera automáticamente, puede editarse y debe ser único. No usar UUID como identificador visible.

Crear producto NO crea stock.

Terminología para usuario:
- Producto
- Tallas y colores
- Inventario
- Disponible para venta
- Ya no disponible

Internamente puede usarse ProductVariant, pero no mostrar “variant” al usuario.

## 7. TALLAS, COLORES Y CATEGORÍAS

No hardcodear.

Tallas iniciales:
- XS
- S
- M
- L
- XL
- XXL
- 1/2
- 3/4
- 5/6
- 7/8

Colores iniciales:
- Negro
- Blanco
- Rojo
- Azul
- Beige
- Fucsia
- Verde
- Morado
- Rosa
- Gris
- Café

Categorías iniciales:
- Blusas
- Pantalones
- Vestidos
- Faldas
- Sets
- Camisas
- Shorts
- Sudaderas
- Jeans

Todo debe poder configurarse.

## 8. INVENTARIO

Se controla por combinación exacta:

Producto + talla + color.

La pantalla muestra principalmente combinaciones que realmente recibieron existencias, no todas las combinaciones posibles en cero.

Estados:
- Disponible
- Stock bajo
- Agotado
- Ya no disponible

Umbral inicial: 2. Es configurable.

### Fuente de verdad
`inventory_movements` es el historial de movimientos.

Movimientos conceptuales:
- compra;
- venta;
- devolución;
- cambio;
- ajuste;
- corrección.

No borrar movimientos históricos.

### Ajustes
Siempre requieren motivo:
- Prenda dañada
- Prenda perdida
- Error de conteo
- Corrección de inventario
- Otro

Si es Otro, exigir explicación.

## 9. COSTOS Y PRECIOS

Diferenciar:
- costo de compra;
- costos adicionales de adquisición;
- costo real.

Costos adicionales pueden incluir transporte, traslado, importación u otros costos directamente relacionados con adquirir la mercancía.

### Costo promedio ponderado
Versión inicial: weighted average cost.

Ejemplo:
10 × Q50 + 10 × Q70 = Q1200 / 20 = Q60 promedio.

Las ventas deben conservar snapshot histórico de costo y precio para no alterar el pasado cuando cambien costos/precios.

### Precio de venta
Debe poder editarse directamente, sin botón “Editar”.

Ejemplo:
`Precio de venta [ Q100 ]`
`Precio recomendado: Q100`

Si la usuaria escribe Q150 o Q90, recalcular inmediatamente utilidad y margen.

### Precio recomendado
Fórmula:
`costo / (1 - margen_objetivo)`

Ejemplo:
Q65 / (1 - 0.35) = Q100.

Margen inicial: 35%. Configurable.

El precio recomendado NO reemplaza automáticamente el precio real.

## 10. VENTAS

Flujo:
1. Buscar producto.
2. Elegir talla.
3. Elegir color.
4. Cantidad.
5. Agregar.
6. Repetir si corresponde.
7. Descuento.
8. Envío si corresponde.
9. Forma de pago.
10. Confirmar.
11. Generar comprobante.

Una venta puede contener múltiples productos y combinaciones.

Si se venden 3 unidades idénticas, una sola línea con cantidad 3.

### Cliente
No es obligatorio. Puede existir “Venta mostrador”.

### Pagos de ventas
Inicialmente:
- Efectivo
- Transferencia

No agregar tarjeta a ventas salvo autorización.

### Descuentos
- monto fijo o porcentaje;
- afectan total cobrado y utilidad.

### Envíos
Opción:
`☐ Agregar envío`

Datos:
- cargo al cliente;
- quién paga: Cliente / MALA MÍA;
- costo real del envío.

Si cliente paga Q35 y courier cuesta Q35, no es utilidad de ropa. Si cliente paga Q35 y cuesta Q30, Q5 es margen de envío. Si MALA MÍA paga, el costo afecta el resultado.

## 11. HISTORIAL, CORRECCIONES, DEVOLUCIONES Y CAMBIOS

No eliminar ventas.

Menú contextual puede incluir:
- Devolución
- Cambio
- Corregir
- Anular
- Comprobante

### Corrección
Ejemplo: venta registrada M/Rojo pero debía ser S/Rojo.
Internamente:
- M/Rojo +1
- S/Rojo -1

Conservar venta original y registrar:
- fecha;
- usuario;
- antes;
- después;
- motivo.

Si afecta dinero, motivo obligatorio.

### Devolución
Puede ser parcial o total.
Debe registrar:
- producto/combinación;
- cantidad;
- motivo;
- forma de reembolso;
- si vuelve vendible o queda dañado.

### Cambio
Ejemplo M/Beige Q100 -> L/Beige Q100:
- M/Beige +1
- L/Beige -1

Debe quedar vinculado a la venta original.

Si la nueva prenda cuesta más, cobrar diferencia. Si cuesta menos, devolver diferencia. Comparar contra el precio histórico de la venta original, no contra el precio actual.

## 12. COMPRAS

Proveedor obligatorio.

Proveedor:
- nombre;
- teléfono;
- WhatsApp;
- contacto;
- dirección;
- red social;
- notas.

Los demás datos son opcionales.

Una compra puede contener muchos productos y combinaciones y debe agruparse visualmente por producto.

### Costos
Modos:
- INDIVIDUAL
- TOTAL

Si solo se conoce total:
100 prendas / Q1000 = Q10 promedio estimado.

Debe marcarse como estimado.

Costos adicionales:
mercadería Q1000 + transporte Q100 = Q1100 de adquisición.

### Pago de compras
- Efectivo
- Transferencia
- Tarjeta

### Historial
No borrar compras.
Debe existir corrección o devolución al proveedor.

### Proveedores
Lista:
- nombre;
- cantidad de compras;
- última compra;
- total comprado.

Detalle con contactos e historial.

## 13. FINANZAS

### Utilidad bruta
Ventas - COGS.

### Utilidad real/neta operativa
Utilidad bruta - gastos operativos.

Comprar inventario NO es automáticamente gasto operativo.

### Gastos
Categorías iniciales:
- Publicidad
- Transporte
- Empaque
- Envíos
- Alquiler
- Servicios
- Comisiones
- Equipo
- Mantenimiento
- Otros

Configurables.

### Dinero
Representa movimientos financieros del negocio, no una billetera personal.

Debe diferenciarse flujo de caja de utilidad.

## 14. DISTRIBUCIÓN DE UTILIDADES

Control visual semanal.

Inicial:
- Para mí 50%
- Reinversión 30%
- Reserva 20%

Debe sumar 100% y ser configurable.

Se aplica sobre utilidad real después de COGS + gastos operativos.

No es una billetera personal.

Las semanas históricas permanecen.

## 15. REPORTES

No crear tabla `reports`.

Derivar reportes de datos transaccionales.

Períodos:
- semana actual;
- semana anterior;
- semana seleccionada;
- mes actual;
- mes anterior;
- mes seleccionado;
- año;
- rango personalizado.

Reportes:
- ventas;
- COGS;
- utilidad bruta;
- gastos;
- utilidad real;
- inventario;
- productos más vendidos;
- métodos de pago;
- compras;
- proveedores;
- stock bajo;
- movimientos de dinero;
- distribución.

Visuales en la aplicación. PDF no es requisito inicial.

## 16. COMPROBANTES

Después de cada venta.

Debe ser:
- profesional;
- coherente con MALA MÍA;
- histórico/frozen.

Debe poder:
- ver;
- imprimir;
- compartir;
- guardar.

Preferencia inicial: HTML + impresión/compartir. PDF después.

Mostrar:
- MALA MÍA;
- Comprobante de venta;
- fecha;
- número;
- productos;
- talla;
- color;
- cantidad;
- precio;
- subtotal;
- descuento;
- envío;
- total;
- forma de pago;
- “Gracias por tu compra. 💗”.

NO mostrar costos internos, margen ni utilidad.

Número visible tipo:
`Venta #1042`

UUID solo si se necesita internamente.

## 17. CONFIGURACIÓN

Secciones:
- Mi negocio
- Precios y ganancias
- Inventario
- Ventas
- Compras
- Gastos
- Usuarios
- Comprobantes
- Notificaciones

Solo configuraciones útiles. No exponer configuraciones técnicas al usuario final.

## 18. AUTENTICACIÓN Y SEGURIDAD

Login:
- username;
- password.

No usar email como requisito.

Usuarios iniciales:
- Andrea
- Billy

No inventar contraseñas. Se proporcionarán cuando corresponda.

Contraseñas:
- nunca texto plano;
- preferencia Argon2id;
- bcrypt como alternativa documentada.

Sesiones:
- persistentes por dispositivo;
- sin timeout de inactividad por defecto;
- invalidación por logout, revocación, cambio de contraseña, limpieza o evento de seguridad.

Preferencia:
- HttpOnly;
- Secure en producción;
- SameSite apropiado;
- sesiones almacenadas en servidor.

Roles:
### ADMIN
Acceso completo.

### SELLER
Ventas, inventario de consulta y comprobantes; sin costos sensibles, correcciones financieras, configuración ni usuarios.

## 19. AUDITORÍA

Auditar como mínimo:
- correcciones;
- anulaciones;
- ajustes;
- devoluciones;
- cambios;
- cambios de configuración;
- cambios de usuarios;
- cambios sensibles de precios;
- operaciones financieras relevantes.

Registrar:
- usuario;
- acción;
- fecha/hora;
- entidad;
- información relevante.

## 20. ERRORES

UX amigable. No mostrar al usuario mensajes técnicos como “403 Forbidden”.

Los detalles técnicos pueden quedar en logs.

## 21. BASE DE DATOS ACTUAL

Base:
`mala_mia`

MySQL 8.

Tablas existentes: **31**.

1. roles
2. users
3. user_sessions
4. business_settings
5. app_settings
6. categories
7. sizes
8. colors
9. products
10. product_sizes
11. product_colors
12. inventory_items
13. inventory_movements
14. suppliers
15. payment_methods
16. purchases
17. purchase_items
18. purchase_additional_costs
19. sales
20. sale_items
21. receipts
22. returns
23. return_items
24. exchanges
25. exchange_items
26. expense_categories
27. expenses
28. financial_movements
29. profit_distribution_settings
30. profit_distribution_periods
31. audit_logs

### Datos iniciales confirmados

Roles:
- ADMIN
- SELLER

Negocio:
- MALA MÍA
- mensaje: `Gracias por tu compra. 💗`

Métodos:
- Efectivo
- Transferencia
- Tarjeta solo para compras/gastos, no ventas.

Categorías:
- Blusas
- Pantalones
- Vestidos
- Faldas
- Sets
- Camisas
- Shorts
- Sudaderas
- Jeans

Tallas:
- XS
- S
- M
- L
- XL
- XXL
- 1/2
- 3/4
- 5/6
- 7/8

Colores:
- Negro
- Blanco
- Rojo
- Azul
- Beige
- Fucsia
- Verde
- Morado
- Rosa
- Gris
- Café

Gastos:
- Publicidad
- Transporte
- Empaque
- Envíos
- Alquiler
- Servicios
- Comisiones
- Equipo
- Mantenimiento
- Otros

Configuración:
- margen objetivo: 35.00
- stock bajo: 2
- mensaje: `Gracias por tu compra. 💗`

Distribución:
- 50 / 30 / 20

## 22. ADVERTENCIA CRÍTICA DE BASE DE DATOS

NO ejecutar nuevamente:
`DROP DATABASE IF EXISTS mala_mia`

salvo autorización explícita.

No destruir datos existentes.

No recrear toda la base para resolver un problema pequeño.

Usar migraciones/scripts controlados para cambios.

## 23. REGLAS DE HISTORIAL

Nunca borrar silenciosamente:
- ventas;
- compras;
- devoluciones;
- cambios;
- movimientos de inventario;
- movimientos financieros;
- auditorías;
- comprobantes.

Las correcciones deben generar registros relacionados cuando corresponda.

## 24. IMÁGENES

Fotos de productos son opcionales.

El sistema debe funcionar sin fotos.

No asumir proveedor de almacenamiento de pago.

## 25. REGLAS DE CÓDIGO

Preferir:
- TypeScript estricto;
- módulos por dominio;
- nombres descriptivos;
- DTOs validados;
- separación controller/service/data access;
- errores consistentes;
- autorización;
- pruebas de lógica crítica;
- configuración en variables de entorno;
- evitar duplicación;
- evitar magic numbers;
- evitar reglas configurables hardcodeadas.

No sobreingenierizar.

## 26. VARIABLES DE ENTORNO

Nunca escribir secretos en código.

Debe existir `.env.example` sin secretos.

El `.env` real no debe entrar al repositorio.

## 27. GIT

`main` como rama principal.

Features:
- `feature/authentication`
- `feature/inventory`
- `feature/sales`
- `feature/purchases`
- etc.

Commits claros, por ejemplo:
- `feat(auth): add username login`
- `feat(inventory): add stock movement service`
- `fix(sales): prevent selling unavailable stock`

No editar simultáneamente la misma parte del proyecto sin coordinación.

## 28. REPARTO CHATGPT + CLAUDE

### ChatGPT + Billy = Arquitectura / Technical Lead
Responsable de:
- requisitos;
- arquitectura;
- reglas;
- decisiones;
- revisión;
- errores;
- coherencia;
- alcance.

### Claude Premium = Programador / Implementation Agent
Responsable de:
- escribir código;
- implementar módulos;
- endpoints;
- componentes;
- DTOs;
- servicios;
- pruebas;
- refactor;
- correcciones;
- commits.

Claude NO cambia decisiones arquitectónicas importantes por iniciativa propia.

Si una decisión afecta arquitectura, BD, negocio, seguridad, UX importante o costo, debe solicitar decisión.

## 29. FLUJO DE TRABAJO

1. Billy consulta a ChatGPT.
2. ChatGPT define tarea, alcance, reglas, archivos y pruebas.
3. Billy entrega la orden a Claude.
4. Claude implementa.
5. Claude verifica y reporta.
6. Billy prueba.
7. Problemas o decisiones vuelven a ChatGPT.
8. ChatGPT decide el siguiente paso.

La fuente de verdad real debe ser Git + este archivo + esquema MySQL, no el historial de una conversación.

## 30. FASES DE IMPLEMENTACIÓN

### Fase 1 — Base técnica
- NestJS;
- conexión MySQL;
- variables de entorno;
- ORM/migraciones;
- health check;
- estructura modular;
- errores.

### Fase 2 — Auth
- users;
- roles;
- login;
- hashing;
- sesiones;
- logout;
- persistencia;
- protección;
- seed cuando existan contraseñas reales.

### Fase 3 — Configuración y catálogos
- negocio;
- categorías;
- tallas;
- colores;
- pagos;
- gastos;
- margen;
- stock.

### Fase 4 — Productos e inventario
- productos;
- combinaciones;
- existencias;
- movimientos;
- ajustes;
- stock bajo.

### Fase 5 — Compras/proveedores
- proveedores;
- compras;
- costos;
- adicionales;
- inventario.

### Fase 6 — Ventas
- venta;
- descuentos;
- pago;
- envío;
- stock;
- utilidad;
- comprobante.

### Fase 7 — Devoluciones/cambios/correcciones
- devoluciones;
- cambios;
- correcciones;
- anulaciones;
- auditoría.

### Fase 8 — Gastos/finanzas
- gastos;
- movimientos;
- utilidad;
- distribución.

### Fase 9 — Reportes
- dashboard;
- reportes;
- filtros;
- gráficos.

### Fase 10 — UX/PWA/pulido
- responsive;
- PWA;
- notificaciones;
- accesibilidad;
- rendimiento;
- UX;
- pruebas.

## 31. CRITERIO DE TERMINADO

Una funcionalidad no está terminada solo porque compila.

Debe:
- funcionar;
- validar datos;
- respetar permisos;
- respetar reglas de negocio;
- actualizar relaciones;
- mantener historial;
- manejar errores;
- tener pruebas cuando la lógica sea importante;
- no romper funcionalidades existentes.

## 32. NO INVENTAR

Claude no debe inventar:
- requisitos;
- módulos;
- roles;
- métodos de pago;
- categorías;
- campos;
- reglas financieras;
- comportamiento de devoluciones;
- cambios;
- costos;
- funcionalidades públicas;
- proveedores externos.

Si una duda afecta el negocio, preguntar.

## 33. PROHIBICIONES EXPLÍCITAS

No:
- cambiar MySQL por PostgreSQL;
- convertir a microservicios;
- agregar Docker sin autorización;
- agregar Kubernetes;
- agregar Kafka/RabbitMQ;
- agregar login por correo;
- crear ecommerce público como MVP;
- agregar pasarela de pagos;
- borrar ventas;
- borrar compras históricas;
- borrar movimientos;
- hardcodear tallas/colores/categorías;
- guardar contraseñas planas;
- mostrar costos en comprobantes;
- destruir la BD para aplicar cambios;
- introducir dependencias innecesarias;
- implementar alcance nuevo sin autorización.

## 34. DECISIONES ABIERTAS

Pueden definirse durante el desarrollo:
- hosting;
- almacenamiento de imágenes;
- ORM exacto;
- estrategia de migraciones;
- biblioteca de gráficos;
- biblioteca UI;
- PDF;
- WhatsApp/API futura;
- detalles visuales.

No deben modificar las reglas principales.

## 35. ESTADO ACTUAL

Al crear este documento:
- MySQL `mala_mia` está creada.
- El esquema inicial fue ejecutado correctamente.
- Existen 31 tablas.
- Los seeds iniciales existen.
- Las contraseñas reales de Andrea y Billy aún no están definidas.
- Backend/frontend están por comenzar.
- ChatGPT = arquitecto/revisor.
- Claude Premium = programador.

## 36. REGLA FINAL

Cuando exista una duda importante:

> NO ADIVINAR.

Convertir la duda en una decisión explícita y documentarla.

MALA MÍA debe crecer de forma ordenada, profesional, económica, mantenible y fácil de usar.

# FIN DEL CONTEXTO MAESTRO


cd apps/api && npm run start     # o npm run start:dev para hot-reload
cd apps/web && npm run dev
