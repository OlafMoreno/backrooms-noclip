# Manual de Docker para Backrooms: No-Clip

Este documento explica cómo usar Docker en este proyecto para arrancar el servidor, ver cambios en tiempo real y trabajar sin instalar dependencias manualmente.

---

## 1. ¿Qué hace Docker aquí?

Docker empaqueta el servidor del juego y todas sus dependencias en un contenedor aislado. Gracias a ello, no es necesario instalar Node.js manualmente ni gestionar sus versiones en el equipo anfitrión, evitando problemas de compatibilidad. Además, el proyecto se ejecuta de forma idéntica en cualquier máquina que disponga de Docker.

En este repositorio, Docker se utiliza para levantar el servidor del MMO y exponerlo en el puerto 8080.

---

## 2. Archivos importantes

- [Dockerfile](Dockerfile): define cómo construir la imagen del servidor.
- [docker-compose.yml](docker-compose.yml): define cómo arrancar el contenedor, sincronizar cambios y ejecutar los pipelines.
- [server](server): código del servidor Node.js.
- [game](game): archivos del cliente que sirve el servidor.
- [pipeline](pipeline): scripts Node para descargar, parsear, generar mapas y empaquetar datos.

---

## 3. Requisitos previos

Necesitas tener instalado Docker Desktop o Docker Engine.

Comprueba que funciona con:

```bash
docker --version
docker compose version
```

Si ambos comandos responden, ya puedes usarlo.

---

## 4. Arrancar el proyecto

Desde la raíz del proyecto, ejecuta:

```bash
docker compose up --build -d
```

Esto hará lo siguiente:

1. Construye la imagen del servidor.
2. Levanta el contenedor.
3. Expone el puerto 8080 en tu equipo.

Después abre en el navegador:

```text
http://localhost:8080
```

---

## 5. Actualizaciones en tiempo real

La configuración actual monta tus carpetas locales dentro del contenedor, así que los cambios que hagas en [server](server) y [game](game) se reflejan automáticamente.

### Modo normal

Si ya tienes el contenedor arrancado, simplemente cambia archivos en la carpeta y el contenedor los verá al instante.

### Modo watch de Compose

Si quieres que Docker supervise cambios de forma más activa, puedes usar:

```bash
docker compose watch
```

Esto hace lo siguiente:

- sincroniza cambios de [server](server) al contenedor;
- sincroniza cambios de [game](game) al contenedor;
- vuelve a reconstruir si cambia [server/package.json](server/package.json).

---

## 6. Ejecutar pipelines desde Docker

Los scripts del pipeline de este proyecto se encuentran en [pipeline](pipeline). Puedes ejecutarlos desde Docker sin instalar nada en tu máquina.

Comandos rápidos:

```bash
docker compose exec server node ./pipeline/build-data.js
docker compose exec server node ./pipeline/make-map.js
docker compose exec server node ./pipeline/parse.js
docker compose exec server node ./pipeline/download.js
docker compose exec server node ./pipeline/level0-audit.js
```

Si editas las fichas de [data/game](data/game), el comando más importante es:

```bash
docker compose exec server node ./pipeline/build-data.js
```

Esto regenerará [game/js/data.js](game/js/data.js) con los cambios.

Si quieres lanzar un pipeline y ver la salida completa en la terminal del contenedor, usa:

```bash
docker compose exec server sh
cd /app
node pipeline/build-data.js
```

---

## 7. Ver logs

Para ver lo que pasa dentro del contenedor:

```bash
docker compose logs -f server
```

Esto sirve para detectar errores de arranque o problemas del servidor.

Si solo quieres ver la clave de admin que aparece al arrancar, usa:

```bash
docker compose logs server | findstr /I "clave de admin"
```

En Windows, ese comando muestra la línea con la clave de administrador directamente.

---

## 8. Detener y reiniciar

### Detener

```bash
docker compose down
```

### Reiniciar

```bash
docker compose up --build -d
```

### Reiniciar desde cero

```bash
docker compose down --volumes
docker compose up --build -d
```

---

## 9. Puerto usado

El servidor escucha en el puerto 8080.

Si ese puerto ya está ocupado, cambia la línea en [docker-compose.yml](docker-compose.yml):

```yaml
ports:
  - "9090:8080"
```

Y accede a:

```text
http://localhost:9090
```

---

## 10. Uso para otras personas

Si quieres que alguien más acceda al juego desde tu red local, puede abrir:

```text
http://TU_IP_LOCAL:8080
```

Si lo quieres publicar en internet, necesitas:

- abrir el puerto en el router o firewall;
- usar un VPS o servidor remoto;
- configurar HTTPS si quieres un acceso público más serio.

---

## 11. Problemas habituales

### El contenedor no inicia

Revisa los logs:

```bash
docker compose logs -f server
```

### El puerto 8080 está ocupado

Cambia el puerto en [docker-compose.yml](docker-compose.yml) y vuelve a levantarlo.

### No se ven los cambios al instante

Prueba:

```bash
docker compose watch
```

O reinicia el servicio:

```bash
docker compose up --build -d
```

---

## 12. Resumen rápido

Arrancar:

```bash
docker compose up --build -d
```

Ver cambios en tiempo real:

```bash
docker compose watch
```

Abrir en el navegador:

```text
http://localhost:8080
```

