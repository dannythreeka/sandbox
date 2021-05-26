"use strict"

const rp = require('request-promise');

module.exports = { getLunchList, getActivity }
const lunchList = ["Freshness Burger",
    "MOS BURGER",
    "Lotteria",
    "First Kitchen"]

function getLunchList() {
    return lunchList[getRandomInt(lunchList.length)];
}

async function getActivity() {
    var options = {
        uri: 'https://www.boredapi.com/api/activity/',
        headers: {
            'User-Agent': 'Request-Promise'
        },
        json: true
    };
    const result = await rp(options);

    return result["activity"];
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}