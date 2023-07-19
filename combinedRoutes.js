const express = require('express');
const router = express.Router();
const fs = require('fs');
const readline = require('readline');
const fetch = require('node-fetch');

const OPEN_WEATHER_API = 'd11ad90a4ab6e0b72bf65e5ce7970f92';

// Wetterdaten
async function getWeatherData() {
    const stadt = 'berlin';
    const apiLink = 'https://api.openweathermap.org/data/2.5/weather?q=' + stadt + '&appid=' + OPEN_WEATHER_API + '&units=metric';

    const response = await fetch(apiLink);
    const json = await response.json();

    const wetterdaten = {
        dt: unix_to_date(json.dt),
        date: get_currentTime(),
        temperatur: json.main.temp,
        Luftfeuchtigkeit: json.main.humidity,
        Windgeschwindigkeit: json.wind.speed
    };

    return wetterdaten;
}

function get_currentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function unix_to_date(dt) {
    var now = new Date(dt * 1000);
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Stromdaten
function getProducedElecInvorhersage(req, res, next) {
    const vorhersagedaten = {
        heute: [],
        morgen: [],
        uebermorgen: []
    };
    let counter = 0;

    const readStream = fs.createReadStream('pvwatts_hourly.csv', 'utf-8');
    let rl = readline.createInterface({ input: readStream });

    rl.on('line', (line) => {
        counter++;
        let monat = line.split(',')[0];
        let tag = line.split(',')[1];
        let stunde = line.split(',')[2];
        let [currMonat, currTag, currStunde] = getCurrentTime();

        if (line.split(',')[0] == currMonat && line.split(',')[1] == currTag) {
            console.log(monat + '/' + tag + '/' + stunde + ' ==> ' + line.split(',')[10]);
            vorhersagedaten.heute.push({
                monat: monat,
                tag: tag,
                stunde: stunde,
                wert: line.split(',')[10]
            });
        }

        if (line.split(',')[0] == currMonat && line.split(',')[1] == currTag + 1) {
            console.log(monat + '/' + tag + '/' + stunde + ' ==> ' + line.split(',')[10]);
            vorhersagedaten.morgen.push({
                monat: monat,
                tag: tag,
                stunde: stunde,
                wert: line.split(',')[10]
            });
        }

        if (line.split(',')[0] == currMonat && line.split(',')[1] == currTag + 2) {
            console.log(monat + '/' + tag + '/' + stunde + ' ==> ' + line.split(',')[10]);
            vorhersagedaten.uebermorgen.push({
                monat: monat,
                tag: tag,
                stunde: stunde,
                wert: line.split(',')[10]
            });
        }
    });

    rl.on('close', () => {
        console.log(`About ${counter} areas have geographic units of over 200 units in 2020`);
        console.log('Data parsing completed');
        req.vorhersagedaten = vorhersagedaten;
        next();
    });

    readStream.on('error', (error) => console.log(error.message));
    readStream.on('data', (chunk) => {});

    readStream.on('end', () => {
        console.log('Reading complete');
    });
}

function getCurrentTime() {
    let jetzt = new Date();
    let monat = jetzt.getMonth() + 1;
    let tag = jetzt.getDate();
    let stunde = jetzt.getHours();

    return [monat, tag, stunde];
}

// Preisdaten
function getPreise(req, res, next) {
    const { m, t, s } = req.query; // Extrahiere die Werte von Monat, Tag und Stunde aus der Anfrage-URL
    let counter = 0;
    let value = 0;

    const readStream = fs.createReadStream('preise.csv', 'utf-8');
    let rl = readline.createInterface({ input: readStream });

    rl.on('line', (line) => {
        counter++;

        let tag = line.split(',')[0].split('.')[0];
        let monat = line.split(',')[0].split('.')[1];
        let stunde = line.split(',')[1].split(':')[0];
        let preis = line.split(',')[2];

        if (monat === m && tag === t && stunde === s) {
            console.log(monat + '/' + tag + '/' + stunde);
            value = preis;
        }
    });

    rl.on('close', () => {
        console.log(`About ${counter} areas have geographic units of over 200 units in 2020`);
        console.log('Data parsing completed');
        const jsonData = { preiswert: value };
        req.preisdaten = jsonData;
        next();
    });

    readStream.on('error', (error) => console.log(error.message));
    readStream.on('data', (chunk) => {
        // console.log(chunk)
    });

    readStream.on('end', () => {
        console.log('Reading complete');
    });
}


router.get('/combined', getPreise, getProducedElecInvorhersage, handleCombined);

async function handleCombined(req, res) {
    try {
        const vorhersagedaten = req.vorhersagedaten;
        const preisdaten = req.preisdaten;
        const wetterdaten = await getWeatherData();

        res.render('combined', { vorhersagedaten, preisdaten, wetterdaten });
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).send('Fehler beim Abrufen der Daten');
    }
}

module.exports = router;
