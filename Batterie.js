const express = require('express');
const fetch = require('node-fetch');
const ejs = require('ejs');
const path = require('path');
const app = express();
const port = 5001;
const Chart = require('chart.js');
const fs = require('fs');
const csv = require('csv-parser');


// Funktion zum Abrufen von Wetterdaten
async function fetchWeatherData(stadt) {
    const OPEN_WEATHER_API = 'd11ad90a4ab6e0b72bf65e5ce7970f92';
    const WeatherAPILink = 'https://api.openweathermap.org/data/2.5/weather?q=' + stadt + '&appid=' + OPEN_WEATHER_API + '&units=metric';

    try {
        const response = await fetch(WeatherAPILink);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fehler beim Abrufen der Wetterdaten:', error);
        return null;
    }
}

// Funktion zum Abrufen von Solar-Daten
async function fetchSolarData() {
    const apiKey = 'bRLrzOOFeHPpnRnqxxzskorqS298hf6JiND8iBFB';
    const lat = '52.5162';
    const lon = '13.3777';
    const systemCapacity = '15';
    const moduleType = '0';
    const losses = '10';
    const arrayType = '1';
    const tilt = '30';
    const azimuth = '180';
    const dataset = 'intl';
    const timeframe = 'hourly';

    const solarAPIUrl = `https://developer.nrel.gov/api/pvwatts/v8.json?api_key=${apiKey}&lat=${lat}&lon=${lon}&system_capacity=${systemCapacity}&module_type=${moduleType}&losses=${losses}&array_type=${arrayType}&tilt=${tilt}&azimuth=${azimuth}&dataset=${dataset}&timeframe=${timeframe}`;

    try {
        const response = await fetch(solarAPIUrl);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fehler beim Abrufen der Solar-Daten:', error);
        return null;
    }
}

// Funktion zum Abrufen von Preis-Daten
async function fetchPreisData() {
    const PreisAPIOptions = {
        method: 'GET',
        url: 'https://api.corrently.io/v2.0/gsi/marketdata?zip=10963',
    };

    try {
        const response = await fetch(PreisAPIOptions.url, PreisAPIOptions.params);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fehler beim Abrufen der Preis-Daten:', error);
        return null;
    }
}

// Stromverbrauch CSV Datei
async function readCSVData() {
    const consumptionData = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream('Realisierter_Stromverbrauch_viertelstunde.csv')
            .pipe(csv({ separator: ';' }))
            .on('data', (row) => {
                consumptionData.push({
                    date: row.Datum,
                    startTime: row.Anfang,
                    endTime: row.Ende,
                    consumption: parseFloat(row['Gesamt (Netzlast) [MWh] Originalauflösungen'])
                });
            })
            .on('end', () => {
                resolve(consumptionData);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Hauptfunktion für das Energiemanagement
// Hauptfunktion für das Energiemanagement
async function energiemanagement() {
    try {
        const stadt = 'Berlin';

        const weatherData = await fetchWeatherData(stadt);
        const solarData = await fetchSolarData();
        const preisData = await fetchPreisData();
        const consumptionData = await readCSVData();

        if (weatherData && solarData && preisData && consumptionData) {
            const solarGeneration = solarData.outputs.dc_monthly.reduce((acc, val) => acc + val, 0);
            
            // Calculer la consommation totale à partir des données de consommation du CSV
            const totalConsumptionMWh = consumptionData.reduce((acc, val) => acc + val.consumption, 0);

            // Convertir la consommation totale en kWh
            const totalConsumptionkWh = totalConsumptionMWh * 1000;

            // Calculer l'énergie injectée dans le réseau et l'énergie consommée du réseau
            const energyToGrid = Math.max(solarGeneration - totalConsumptionkWh, 0);
            const energyFromGrid = Math.max(totalConsumptionkWh - solarGeneration, 0);

            // Tarifs réduits d'injection d'électricité en Allemagne (en €/kWh)
            const feedInTariffUpTo40kW = 0.0380; // Pour les systèmes de 10 kW à 40 kW
            
            // Calculer les gains et les dépenses en fonction de l'énergie injectée et consommée
            const earnings = energyToGrid * feedInTariffUpTo40kW;
            const expenses = energyFromGrid * (preisData.averagePrice * 1000); // Convertir le prix en €/kWh en €/kWh

            // ...

            return {
                solarGeneration: solarGeneration,
                energyConsumption: totalConsumptionkWh,
                energyToGrid: energyToGrid,
                energyFromGrid: energyFromGrid,
                earnings: earnings,
                expenses: expenses,
                // Autres résultats...
            };
        } else {
            throw new Error('Fehler beim Abrufen der Daten.');
        }
    } catch (error) {
        console.error('Fehler beim Energiemanagement:', error);
        throw new Error('Energiemanagement fehlgeschlagen.');
    }
}


// Simuler des seuils de recharge et de décharge pour la batterie
const FIXED_RECHARGE_THRESHOLD = 80;
const FIXED_DECHARGE_THRESHOLD = 20;

// Fonction pour simuler la récupération du seuil de recharge
async function fetchRechargeThreshold() {
    return FIXED_RECHARGE_THRESHOLD;
}

// Fonction pour simuler la récupération du seuil de décharge
async function fetchDechargeThreshold() {
    return FIXED_DECHARGE_THRESHOLD;
}

// Endpunkt zum Aufrufen des Energiemanagement-Algorithmus
app.get('/api/batterie', async (req, res) => {
    try {
        const batteryInfo = await energiemanagement();
        const rechargeThreshold = await fetchRechargeThreshold();
        const dechargeThreshold = await fetchDechargeThreshold();

        // ... (autres traitements)

        // Utilisation d'EJS pour rendre la page "battery.ejs" avec les données de la batterie
        ejs.renderFile(path.join('views', 'batterie.ejs'), {
            batteryInfo: batteryInfo,
            simulatedBatteryParams: {
                rechargeThreshold: rechargeThreshold,
                dechargeThreshold: dechargeThreshold
            }
        }, (err, html) => {
            if (err) {
                console.error('Fehler beim Rendern der Seite:', err);
                res.status(500).json({ error: 'Fehler beim Rendern der Seite.' });
            } else {
                res.send(html);
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route pour gérer la mise à jour des paramètres de la batterie
app.post('/api/batterie/parametres', async (req, res) => {
    try {
        const rechargeThreshold = parseInt(req.body.rechargeThreshold);
        const dechargeThreshold = parseInt(req.body.dechargeThreshold);

        // Mettre à jour les valeurs simulées des seuils
        simulatedBatteryParams.rechargeThreshold = rechargeThreshold;
        simulatedBatteryParams.dechargeThreshold = dechargeThreshold;

        // Rediriger l'utilisateur vers la page de l'interface utilisateur mise à jour
        res.render('/api/batterie', { batteryInfo, simulatedBatteryParams, updated: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Server starten
app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}.`);
});
