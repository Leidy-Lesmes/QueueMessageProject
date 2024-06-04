const axios = require('axios');
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = 4000;
const cors = require('cors');

app.use(cors());
app.use(express.json());

let requestQueue = [];
let instances = ['http://localhost:5001'];
const maxRequestsPerInstance = 2; // Máximo de solicitudes por instancia

let isCreatingInstance = false; // Flag to avoid multiple instance creation

app.post('/add-to-queue', (req, res) => {
    const { keyword, email } = req.body;

    if (!keyword || !email) {
        return res.status(400).send('Keyword and email are required');
    }
    requestQueue.push({ keyword, email });
    console.log('Request Queue:', requestQueue);

    processQueue(); // Procesar la cola inmediatamente después de agregar una solicitud

    res.send('Request added to queue');
});

function processQueue() {
    if (requestQueue.length === 0) {
        return;
    }

    let instanceIndex = 0;
    let requestCounter = new Array(instances.length).fill(0);

    for (let i = 0; i < requestQueue.length; i++) {
        const request = requestQueue[i];
        const instance = instances[instanceIndex];

        axios.get(`${instance}/ping`)
            .then(response => {
                console.log(`Response from ${instance}:`, response.data);
                if (response.data.isBusy === false && requestCounter[instanceIndex] < maxRequestsPerInstance) {
                    console.log(`Sending request to instance ${instance}:`, request);
                    sendRequestToInstance(instance, request);
                    requestQueue.splice(i, 1);
                    requestCounter[instanceIndex]++;
                    i--; // Decrementar i para considerar el cambio en la longitud de la cola
                }
            })
            .catch(error => {
                console.error(`Error pinging instance ${instance}:`, error.message);
            });

        instanceIndex = (instanceIndex + 1) % instances.length;
    }

    // Verificar si hay más solicitudes en la cola que las que pueden manejar las instancias actuales
    const totalCapacity = instances.length * maxRequestsPerInstance;
    if (requestQueue.length > totalCapacity && !isCreatingInstance) {
        console.log('Creating new instance due to queue size...');
        createNewInstance().then(() => {
            console.log('Instance created successfully');
            processQueue();
        }).catch((error) => {
            console.error('Error creating new instance:', error);
        });
    }

    console.log('Request Queue:', requestQueue);
}

let lastAssignedPort = 5002; // Puerto inicial, o ajusta según tus necesidades
if (process.env.NODE_PORT) {
    lastAssignedPort = parseInt(process.env.NODE_PORT);
}

function createNewInstance() {
    isCreatingInstance = true;
    lastAssignedPort += 1;
    const NODE_PORT = lastAssignedPort;
    const NODE_IP = process.env.NODE_IP || 'localhost';
    const IP_SW = process.env.IP_SW || 'http://localhost:4000';

    const newInstanceURL = `http://${NODE_IP}:${NODE_PORT}`;
    instances.push(newInstanceURL);
    console.log(`Nueva instancia agregada a la lista: ${newInstanceURL}`);
    console.log('Lista actual de instancias:', instances);

    const filePath = path.join(__dirname, '../Instancia-Algoritmo-Scrapping-/queue_consumer/scrapy-pdf-generator.js');
    process.env.NODE_PORT = lastAssignedPort; // Actualizar el valor de NODE_PORT
    const command = `start cmd /k node ${filePath} ${NODE_PORT} ${NODE_IP} ${IP_SW}`;

    console.log(`Executing command: ${command}`);

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error al ejecutar el comando: ${error.message}`);
                reject(error);
            } else {
                console.log(`Instancia creada con éxito. Puerto: ${NODE_PORT}`);

                isCreatingInstance = false;
                resolve();
            }
        });
    });
}


// Función para enviar la solicitud a la instancia
function sendRequestToInstance(instance, { keyword, email }) {
    axios.post(`${instance}/scrape-and-send`, { keyword, email })
        .then(response => {
            console.log(`Request processed by ${instance}:`, response.data);
        })
        .catch(error => {
            console.error(`Error processing request with ${instance}:`, error.message);
        });
}

// Iniciar el intervalo para realizar ping cada 4 segundos
setInterval(processQueue, 4000);

if (!process.env.NODE_PORT) {
    process.env.NODE_PORT = '5002';
}

app.listen(port, () => {
    console.log(`Queue manager running at http://localhost:${port}/`);
});
