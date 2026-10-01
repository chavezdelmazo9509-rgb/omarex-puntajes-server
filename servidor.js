const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const ARCHIVO_PUNTAJES = 'puntajes.json';

function leerPuntajes() {
    if (!fs.existsSync(ARCHIVO_PUNTAJES)) {
        return [];
    }
    const contenido = fs.readFileSync(ARCHIVO_PUNTAJES, 'utf8');
    return JSON.parse(contenido);
}

function guardarPuntajes(lista) {
    fs.writeFileSync(ARCHIVO_PUNTAJES, JSON.stringify(lista, null, 2));
}

app.get('/puntajes', function(req, res) {
    const lista = leerPuntajes();
    res.json(lista);
});

app.post('/puntajes', function(req, res) {
    const nuevo = req.body;
    let lista = leerPuntajes();
    lista.push(nuevo);
    lista.sort(function(a, b) { return b.puntos - a.puntos; });
    lista = lista.slice(0, 10);
    guardarPuntajes(lista);
    res.json(lista);
});

// ===== Top 10 de "Adivina el Anime" =====
// Gana quien acierta más; si empatan, gana quien tardó menos segundos.
const ARCHIVO_ANIME = 'puntajes-anime.json';

function leerAnime() {
    if (!fs.existsSync(ARCHIVO_ANIME)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(ARCHIVO_ANIME, 'utf8'));
}

app.get('/anime', function(req, res) {
    res.json(leerAnime());
});

app.post('/anime', function(req, res) {
    const datos = req.body || {};
    const aciertos = Number(datos.aciertos);
    const segundos = Number(datos.segundos);

    // Revisar que los datos tengan sentido (10 rondas de 15 segundos)
    if (!Number.isInteger(aciertos) || aciertos < 1 || aciertos > 10 ||
        !Number.isFinite(segundos) || segundos <= 0 || segundos > 150) {
        return res.status(400).json({ error: 'Puntaje no válido' });
    }

    const nombre = String(datos.nombre || '').trim().slice(0, 12) || 'Otaku';

    let lista = leerAnime();
    lista.push({ nombre: nombre, aciertos: aciertos, segundos: Math.round(segundos * 10) / 10 });
    lista.sort(function(a, b) {
        if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
        return a.segundos - b.segundos;
    });
    lista = lista.slice(0, 10);
    fs.writeFileSync(ARCHIVO_ANIME, JSON.stringify(lista, null, 2));
    res.json(lista);
});

const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {
    console.log('Servidor de puntajes corriendo en http://localhost:3000');
});
