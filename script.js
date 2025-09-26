// =================================================================
// 1. CONFIGURACIÓN DE LA APLICACIÓN
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCtXd_SbmnLP_4UE5aPTt0QaC7d8IfyqFs",
    authDomain: "apibursatil.firebaseapp.com",
    databaseURL: "https://apibursatil-default-rtdb.firebaseio.com",
    projectId: "apibursatil",
    storageBucket: "apibursatil.firebasestorage.app",
    messagingSenderId: "431674471207",
    appId: "1:431674471207:web:968054afaa61d238b7af02",
    measurementId: "G-BMJTP0N94Z"
};

// =================================================================
// 2. INICIALIZACIÓN Y VARIABLES
// =================================================================
const TOKEN_DB = "76b915bd875ed131308e03c2882b36";
const SYMBOL_HISTORICO = "DANHOS13"; 
const SYMBOL_ACTUAL = "DANHOS13"; 

let danhosChart = null;
let historicalData = [];

// Inicializa Firebase y referencias a la base de datos
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const historyRef = database.ref('history/' + SYMBOL_HISTORICO);

// =================================================================
// 3. LÓGICA DE HORARIO Y ACTUALIZACIÓN
// =================================================================
function isMarketOpen() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    const openTime = 8 * 60 + 30; 
    const closeTime = 15 * 60;   
    
    return currentTimeInMinutes >= openTime && currentTimeInMinutes <= closeTime;
}

function updateData() {
    console.log('Actualizando datos...');

    const marketIsOpen = isMarketOpen();
    const targetUrlQuote = "https://api.databursatil.com/v1/cotizaciones?token=" 
        + TOKEN_DB 
        + "&emisora_serie=" + SYMBOL_ACTUAL 
        + "&bolsa=BMV,BIVA&concepto=U,P,A,X,N,C,M,V,O,I";
    
    fetch(targetUrlQuote)
        .then(function(response) { return response.json(); })
        .then(function(quoteData) {
            if (quoteData && quoteData[SYMBOL_ACTUAL]) {
                const danhos = quoteData[SYMBOL_ACTUAL].BMV;
                const priceValue = parseFloat(danhos.U); // precio actual
                const previousCloseValue = parseFloat(danhos.A); // cierre anterior
                const volumeValue = parseInt(danhos.V);

                // Cálculo del cambio diario
                var changeValue = 0;
                var percentageChange = 0;
                if (previousCloseValue && previousCloseValue !== 0) {
                    changeValue = priceValue - previousCloseValue;
                    percentageChange = (changeValue / previousCloseValue) * 100;
                }

                // Texto formateado
                var formattedChangeAmount = (changeValue >= 0 ? '+' : '−') + "$" + Math.abs(changeValue).toFixed(2);
                var percentageText = (changeValue >= 0 ? '+' : '−') + Math.abs(percentageChange).toFixed(2) + "%";

                // Actualizar tarjetas
                var changeCard = document.querySelector('.change-card');
                changeCard.classList.remove('positive-change', 'negative-change');
                if (changeValue > 0) {
                    changeCard.classList.add('positive-change');
                } else if (changeValue < 0) {
                    changeCard.classList.add('negative-change');
                }

                document.getElementById("price").textContent = "$" + priceValue.toFixed(2);
                document.getElementById("volume").textContent = volumeValue.toLocaleString("es-MX");
                document.getElementById("change-value").textContent = formattedChangeAmount;
                document.getElementById("change-percentage").textContent = percentageText;

                // Guardar en Firebase si el mercado está abierto
                if (marketIsOpen) {
                    const now = new Date();
                    const timestampKey = now.toISOString().replace(/\./g, '_');
                    historyRef.child(timestampKey).set({
                        price: priceValue,
                        timestamp: now.toISOString()
                    });
                }

                // Ahora construimos la gráfica
                historyRef.once('value').then(function(snapshot) {
                    const historyFromDB = snapshot.val();
                    historicalData = [];

                    if (historyFromDB) {
                        const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);

                        Object.keys(historyFromDB).forEach(function(key) {
                            const timestamp = new Date(key.replace(/_/g, '.'));
                            if (timestamp.getTime() > oneDayAgo) {
                                historicalData.push({
                                    x: timestamp,
                                    y: historyFromDB[key].price
                                });
                            }
                        });
                        historicalData.sort(function(a, b) { return a.x - b.x; });
                    }

                    // 🚑 Fallback: si no hay datos, mostrar el precio actual
                    if (historicalData.length === 0) {
                        historicalData.push({
                            x: new Date(),
                            y: priceValue
                        });
                    }

                    if (danhosChart) {
                        danhosChart.destroy();
                    }

                    const ctx = document.getElementById('danhosChart').getContext('2d');
                    danhosChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            datasets: [{
                                label: "Precio de " + SYMBOL_HISTORICO,
                                data: historicalData,
                                borderColor: 'rgb(75, 192, 192)',
                                tension: 0.1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: {
                                    type: 'time',
                                    time: {
                                        unit: 'minute',
                                        displayFormats: { minute: 'h:mm a' }
                                    }
                                },
                                y: { beginAtZero: false }
                            },
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        title: function(context) {
                                            var date = new Date(context[0].parsed.x);
                                            return "Hora: " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        },
                                        label: function(context) {
                                            return "Precio: $" + context.parsed.y.toFixed(2);
                                        }
                                    }
                                }
                            }
                        }
                    });
                });

            } else {
                console.error('No se encontraron datos de cotización actuales.');
            }
        })
        .catch(function(error) {
            console.error('Error al obtener datos de cotización:', error);
        });
}

updateData();
setInterval(updateData, 5 * 60 * 1000);


