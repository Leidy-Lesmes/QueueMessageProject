const axios = require('axios');
const express = require('express');
const app = express();
const port = 4000;

app.use(express.json());

let requestQueue = [];
let instances = [
    'http://localhost:3000',
    'http://localhost:3001'
];

app.post('/add-to-queue', (req, res) => {
    const { keyword, email } = req.body;

    if (!keyword || !email) {
        return res.status(400).send('Keyword and email are required');
    }
    requestQueue.push({ keyword, email });
    console.log('Request Queue:', requestQueue);

    res.send('Request added to queue');
});

// Función para procesar la cola de solicitudes
function processQueue() {
    if (requestQueue.length === 0) {
        return;
    }

    let instanceIndex = 0;

    for (let i = 0; i < requestQueue.length; i++) {
        const request = requestQueue[i];
        const instance = instances[instanceIndex];

        axios.get(`${instance}/ping`)
            .then(response => {
                console.log(`Response from ${instance}:`, response.data);
                if (response.data.isBusy === false) {
                    console.log(`Sending request to instance ${instance}:`, request);
                    sendRequestToInstance(instance, request);
                    requestQueue.splice(i, 1);
                    return;
                };
            })
            .catch(error => {
                console.error(`Error pinging instance ${instance}:`, error.message);
            });
        console.log('Request Queue:', requestQueue);
        instanceIndex = (instanceIndex + 1) % instances.length;
    }
}

// Función para enviar la solicitud a la instancia
function sendRequestToInstance(instance, { keyword, email }) {
    axios.post(`${instance}/scrape-and-send`, { keyword, email })
        .then(response => {
            console.log(`Request processed by ${instance}:`, response.data);
        })
        .catch(error => {
            console.error(`Error processing request with ${instance}:`, error.message);
        })
        .finally(() => {
            processQueue();
        });
}

// Iniciar el intervalo para realizar ping cada 4 segundos
setInterval(processQueue, 4000);

app.listen(port, () => {
    console.log(`Queue manager running at http://localhost:${port}/`);
});
