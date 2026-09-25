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

const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {
    console.log('Servidor de puntajes corriendo en http://localhost:3000');
});
