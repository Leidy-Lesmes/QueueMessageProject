require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
app.use(express.json());
const server = http.createServer(app);

const connectedClients = [];

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    const origin = socket.handshake.query.clientUrl || 'unknown';
    console.log(`Nuevo cliente conectado desde: ${origin}`);

    connectedClients.push(origin);

    socket.on('disconnect', () => {
        console.log(`Cliente ${origin} desconectado.`);
        
        const index = connectedClients.indexOf(origin);
        if (index !== -1) {
            connectedClients.splice(index, 1);
        }
    });
});

// Array para almacenar los trabajos en la cola
const messageQueue = [];
const MAX_JOBS_PER_INSTANCE = 5;

// Endpoint para obtener la lista de URLs de los clientes conectados
app.get('/connected-clients', (req, res) => {
    res.json(connectedClients);
});

// Endpoint para recibir datos
app.post('/add-job', async (req, res) => {
    const { keyword, email } = req.body;

    // Imprimir los valores recibidos en la consola
    console.log('Keyword recibida:', keyword);
    console.log('Email recibido:', email);

    // Validar que ambos datos están presentes
    if (!keyword || !email) {
        return res.status(400).send('La palabra clave y el correo electronico son obligatorios');
    }

    // Agregar el trabajo a la cola
    messageQueue.push({ keyword, email });

     // Emitir evento para enviar datos al consumidor
     io.emit('new-job', { keyword, email });

     console.log('Trabajo enviado al consumidor:');
     console.log('Keyword:', keyword);
     console.log('Email:', email);
     
    res.send('Peticion agregada a la cola');
});


const port = process.env.PORT || 4000;
server.listen(port, () => {
    console.log(`Servidor HTTP escuchando en el puerto ${port}`);
});
