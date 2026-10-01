const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ===== Base de datos (Upstash Redis) =====
// En Render se configuran estas 2 variables (Environment).
// Si no están, se usan los archivos .json como antes (sirve para probar en tu PC).
// Quita espacios y comillas que a veces se pegan sin querer al copiar
function limpiarVariable(valor) {
    return String(valor || '').trim().replace(/^["']|["']$/g, '').trim();
}
const DB_URL = limpiarVariable(process.env.UPSTASH_REDIS_REST_URL);
const DB_TOKEN = limpiarVariable(process.env.UPSTASH_REDIS_REST_TOKEN);
const USA_BASE_DE_DATOS = Boolean(DB_URL && DB_TOKEN);

// Avisos claros en los Logs de Render si algo está mal configurado
if (DB_URL && !DB_URL.startsWith('https://')) {
    console.log('⚠️ UPSTASH_REDIS_REST_URL debe empezar con https:// — copia la URL de la sección "REST API" de Upstash (no la que empieza con redis:// o rediss://).');
}
if (DB_URL && !DB_TOKEN) {
    console.log('⚠️ Falta la variable UPSTASH_REDIS_REST_TOKEN en Render.');
}
if (DB_TOKEN && !DB_URL) {
    console.log('⚠️ Falta la variable UPSTASH_REDIS_REST_URL en Render.');
}

// Envía un comando a Upstash, por ejemplo ['GET', 'puntajes:snake']
async function comandoDB(comando) {
    const respuesta = await fetch(DB_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(comando)
    });
    if (respuesta.status === 401) {
        throw new Error('Upstash respondió 401: el TOKEN está mal. Copia otra vez UPSTASH_REDIS_REST_TOKEN de la sección "REST API".');
    }
    if (!respuesta.ok) {
        throw new Error('Upstash respondió ' + respuesta.status);
    }
    const datos = await respuesta.json();
    return datos.result;
}

// Lee una lista de puntajes (de la base de datos o del archivo)
async function leerLista(clave, archivo) {
    if (USA_BASE_DE_DATOS) {
        const texto = await comandoDB(['GET', clave]);
        return texto ? JSON.parse(texto) : [];
    }
    if (!fs.existsSync(archivo)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
}

// Guarda una lista de puntajes (en la base de datos o en el archivo)
async function guardarLista(clave, archivo, lista) {
    if (USA_BASE_DE_DATOS) {
        await comandoDB(['SET', clave, JSON.stringify(lista)]);
        return;
    }
    fs.writeFileSync(archivo, JSON.stringify(lista, null, 2));
}

function limpiarNombre(nombre, porDefecto) {
    return String(nombre || '').trim().slice(0, 12) || porDefecto;
}

// ===== Top 10 de Snake =====
const SNAKE = { clave: 'puntajes:snake', archivo: 'puntajes.json' };

app.get('/puntajes', async function(req, res) {
    try {
        res.json(await leerLista(SNAKE.clave, SNAKE.archivo));
    } catch (error) {
        console.log('Error al leer puntajes de Snake:', error.message);
        res.status(500).json({ error: 'No se pudo leer el marcador' });
    }
});

app.post('/puntajes', async function(req, res) {
    const datos = req.body || {};
    const puntos = Number(datos.puntos);
    if (!Number.isFinite(puntos) || puntos <= 0) {
        return res.status(400).json({ error: 'Puntaje no válido' });
    }

    try {
        let lista = await leerLista(SNAKE.clave, SNAKE.archivo);
        lista.push({ nombre: limpiarNombre(datos.nombre, 'Jugador'), puntos: Math.round(puntos) });
        lista.sort(function(a, b) { return b.puntos - a.puntos; });
        lista = lista.slice(0, 10);
        await guardarLista(SNAKE.clave, SNAKE.archivo, lista);
        res.json(lista);
    } catch (error) {
        console.log('Error al guardar puntaje de Snake:', error.message);
        res.status(500).json({ error: 'No se pudo guardar el puntaje' });
    }
});

// ===== Top 10 de "Adivina el Anime" =====
// Gana quien acierta más; si empatan, gana quien tardó menos segundos.
const ANIME = { clave: 'puntajes:anime', archivo: 'puntajes-anime.json' };

app.get('/anime', async function(req, res) {
    try {
        res.json(await leerLista(ANIME.clave, ANIME.archivo));
    } catch (error) {
        console.log('Error al leer puntajes de anime:', error.message);
        res.status(500).json({ error: 'No se pudo leer el Top 10' });
    }
});

app.post('/anime', async function(req, res) {
    const datos = req.body || {};
    const aciertos = Number(datos.aciertos);
    const segundos = Number(datos.segundos);

    // Revisar que los datos tengan sentido (10 rondas de 15 segundos)
    if (!Number.isInteger(aciertos) || aciertos < 1 || aciertos > 10 ||
        !Number.isFinite(segundos) || segundos <= 0 || segundos > 150) {
        return res.status(400).json({ error: 'Puntaje no válido' });
    }

    try {
        let lista = await leerLista(ANIME.clave, ANIME.archivo);
        lista.push({ nombre: limpiarNombre(datos.nombre, 'Otaku'), aciertos: aciertos, segundos: Math.round(segundos * 10) / 10 });
        lista.sort(function(a, b) {
            if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
            return a.segundos - b.segundos;
        });
        lista = lista.slice(0, 10);
        await guardarLista(ANIME.clave, ANIME.archivo, lista);
        res.json(lista);
    } catch (error) {
        console.log('Error al guardar puntaje de anime:', error.message);
        res.status(500).json({ error: 'No se pudo guardar el puntaje' });
    }
});

const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {
    console.log('Servidor de puntajes corriendo en el puerto ' + PUERTO);
    console.log(USA_BASE_DE_DATOS ? 'Guardando en la base de datos (Upstash) ✅' : 'Guardando en archivos .json (sin base de datos)');
});
