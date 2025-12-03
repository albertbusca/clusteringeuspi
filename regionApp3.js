import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let regionData;
let gdpClosest;
let spiClosest;
let cacheDistance;
let cacheNuts;
let cacheMap;
let cacheAgg;
let cacheGDP;
let cachePopulation;
let cacheFactor;
let cachePDP;
let cacheThreshold;
let nuts2;

let slicedObject;
let regionRow;


const urlParams = new URLSearchParams(window.location.search);
const regionName = urlParams.get('region');
const colors = ['#E6B800', '#0B39A2', '#00A174', '#FF8133', '#D7003D', '#B3F8FF'];


var crs3035 = new L.Proj.CRS('EPSG:3035',
    '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
    {
        resolutions: [8192, 4096, 2048, 1024, 512, 256],
        origin: [2000000, 1700000],
    }
);

var map = L.map('map', {
    crs: crs3035,
    minZoom: 0,
    maxZoom: 0,
    zoomControl: false, // Disables zoom buttons
    dragging: true, // Disables panning
    scrollWheelZoom: false, // Disables zooming with scroll
    doubleClickZoom: false, // Disables zooming on double-click
    touchZoom: false // Disables pinch zoom on touch devices});
});

map.setMaxBounds(L.latLngBounds(L.latLng(65, 92), L.latLng(25, -25)));

map.createPane('basePane');
map.getPane('basePane').style.zIndex = 100;
map.createPane('regionsPane');
map.getPane('regionsPane').style.zIndex = 101;
map.attributionControl.setPrefix(false);

async function fetchNutsMap() {
    if (!cacheMap) {
        const response = await fetch('data/nuts2_plus.geojson');
        cacheMap = await response.json();
    }
    return cacheMap;
};

function processNUTSdata() {
    fetchNutsMap().then(data => {
        nuts2 = L.Proj.geoJson(data, {
            pane: 'regionsPane',
            style: (feature) => style(feature),
            onEachFeature,
        }).addTo(map);
    });
}

function style(feature) {
    if (feature.properties.NUTS_ID1 == regionName) {
        proj4.defs('EPSG:3035', '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
        const meters = [L.geoJSON(feature).getBounds().getCenter()];
        const latLng = proj4("EPSG:3035", "EPSG:4326", [Object.values(meters[0])[1], Object.values(meters[0])[0]]);
        map.setView([latLng[1], latLng[0]], 0);

        return {
            fillColor: '#FC0',
            weight: 1,
            opacity: 1,
            color: 'black',
            fillOpacity: 0.7
        };
    } else {
        return {
            fillColor: '#3E6CD5',
            weight: 1,
            opacity: 1,
            color: 'black',
            fillOpacity: 0.7
        };
    }
};

function onEachFeature(feature, layer) {
    layer.on('click', () => {
        window.location.href = 'region-page.html?region=' + encodeURIComponent(feature.properties.NUTS_ID1);
    });
}

processNUTSdata();

fetch('data/globalmap.geojson')
    .then(response => response.json())
    .then(data => {
        var style = {
            color: 'grey',
            weight: 1,
            fillOpacity: 0.2
        }
        var globalLayer = L.Proj.geoJson(data, { style: style, pane: 'basePane' }).addTo(map);
        globalLayer.bringToBack();
    });

async function fetchDistanceData() {
    if (!cacheDistance) { cacheDistance = await d3.csv("data/dist_matrix.csv"); }
    return cacheDistance;
}

async function fetchNutsData() {
    if (!cacheNuts) { cacheNuts = d3.csv("data/nuts_data.csv"); }
    return cacheNuts;
}

async function fetchAggData() {
    if (!cacheAgg) { cacheAgg = d3.csv("data/euspi_aggregated.csv"); }
    return cacheAgg;
}

async function fetchGDPData() {
    if (!cacheGDP) { cacheGDP = d3.csv("data/gdp_data.csv"); }
    return cacheGDP;
}

async function fetchPopData() {
    if (!cachePopulation) { cachePopulation = d3.csv("data/nuts2_population.csv"); }
    return cachePopulation;
}

async function fetchFactorData() {
    if (!cacheFactor) { cacheFactor = await d3.csv("data/factor_data.csv"); }
    return cacheFactor;
}

async function fetchPDPdata() {
    if (!cachePDP) {
        cachePDP = await fetch("data/pdp_list.json");
        cachePDP = await cachePDP.json();
    }
    return cachePDP;
}

async function fetchPdpThreshold() {
    if (!cacheThreshold) {
        cacheThreshold = await fetch("data/pdp_threshold.json");
        cacheThreshold = await cacheThreshold.json();
    }
    return cacheThreshold;
}

async function fetchMerge() {
    return fetch('data/merge.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => console.error('Error:', error));
}

function extractRegions(clusterId, mergeMatrix) {
    if (clusterId < 0) {
        // If it's a region (negative ID), return its absolute value
        return [Math.abs(clusterId)];
    } else {
        // If it's a cluster, recursively explore its components
        const row = mergeMatrix[clusterId - 1]; // Adjust for 0-based indexing

        console.log(mergeMatrix);
        console.log(row, clusterId);
        return [
            ...extractRegions(row[0], mergeMatrix),
            ...extractRegions(row[1], mergeMatrix),
        ];
    }
}

function findClosestRegions(regionId, mergeMatrix, distanceMatrix) {
    let searchValue = -regionId - 1; // Start with the region as negative
    let mergedRegions = [];     // To store found regions

    console.log(regionId, searchValue);

    for (let i = 0; i < mergeMatrix.length; i++) {
        if (mergeMatrix[i].includes(searchValue)) {
            // Identify the other element in the merge
            const otherValue = mergeMatrix[i].find(value => value !== searchValue);
            console.log(mergeMatrix[i], otherValue);

            // Recursively extract regions from the other cluster or region
            const newRegions = extractRegions(otherValue, mergeMatrix);
            mergedRegions = [...new Set([...mergedRegions, ...newRegions])]; // Unique regions

            // Filter by distance if more than 5 regions are found
            if (mergedRegions.length > 5) {
                // Ensure `mergedRegions` is numeric
                mergedRegions = mergedRegions.map(Number);
                console.log(mergedRegions);
                console.log(distanceMatrix);
                // Extract distances
                const distances = mergedRegions.map(region =>
                    distanceMatrix[regionId][region] // Adjust for 0-based indexing
                );

                // Debugging print statements
                console.log(
                    `Distances from region ${regionId} to merged regions:`,
                    distances
                );

                // Sort distances and select the closest regions
                const sortedIndices = distances
                    .map((distance, index) => ({ distance, index }))
                    .sort((a, b) => a.distance - b.distance)
                    .map(item => item.index);
                mergedRegions = sortedIndices
                    .slice(0, 5)
                    .map(index => mergedRegions[index]);
            }

            // Update searchValue to the current cluster
            searchValue = i + 1; // Adjust to match 1-based indexing of clusters
            console.log(mergedRegions);

            // Stop if we have 5 or more regions
            if (mergedRegions.length >= 5) break;
        }
    }

    return mergedRegions; // Return the closest 5 regions
}


async function getClosestRegions(n) {
    return new Promise((resolve) => {
        Promise.all([fetchDistanceData(), fetchNutsData(), fetchMerge()]).then(([distanceData, nutsData, mergeData]) => {
            regionData = nutsData.filter(d => d.NUTS_ID1 === regionName);
            regionRow = nutsData.findIndex(d => d.NUTS_ID1 === regionName);
            spiClosest = findClosestRegions(regionRow, mergeData, distanceData);
            const badGdpRows = nutsData.filter(d => {
                const v = d.gdp;
                return v === null || v === undefined || v === "" || Number.isNaN(+v);
            });

            console.log("Non‑numeric / missing gdp rows:", badGdpRows);
            gdpClosest = nutsData
                .map(({ gdp, NUTS_ID1 }) => ({ gdp: parseFloat(gdp), NUTS_ID1 }))
                .filter(({ NUTS_ID1 }) => NUTS_ID1 !== regionName)
                .map(({ gdp, NUTS_ID1 }) => ({
                    gdp,
                    NUTS_ID1,
                    diff: Math.abs(gdp - regionData[0]["gdp"]),
                }))
                .sort((a, b) => a.diff - b.diff)
                .slice(0, n);

            resolve({ spiClosest, gdpClosest });
        });
    });
}

function updatePage() {
    if (regionData[0]["Country"] == "EL") {
        document.getElementById("countryFlag").src = `https://raw.githubusercontent.com/hampusborgos/country-flags/refs/heads/main/svg/gr.svg`
    } else {
        document.getElementById("countryFlag").src = `https://raw.githubusercontent.com/hampusborgos/country-flags/refs/heads/main/svg/${regionData[0]["Country"].toLowerCase()}.svg`
    }

    fetchNutsData().then(data => {
        const option = document.createElement("option");
        option.text = regionData[0]['Region name'];
        option.value = regionName;
        document.getElementById('regionName').add(option);


        const regionNames = data.map(row => ({
            'NUTS_ID1': row['NUTS_ID1'],
            'Region Name': row['Region name']
        }));

        regionNames.forEach(element => {
            const option = document.createElement("option");
            option.text = `${element["Region Name"]} (${element["NUTS_ID1"]})`
            option.value = element["NUTS_ID1"];
            document.querySelectorAll('select.region-select').forEach(sel => {
                sel.add(option.cloneNode(true));
            });

        });

        document.getElementById('nutsId').textContent = regionName;
        const sel = document.getElementById('factor-region-select');

        // Create placeholder option once
        const placeholder = document.createElement('option');
        placeholder.text = "Select a region";
        placeholder.value = "";         // empty value
        placeholder.disabled = true;
        placeholder.selected = true;    // initially selected

        sel.add(placeholder, 0);



        spiClosest.forEach((region, index) => {
            console.log(data);
            // const SPI = data.find(d => d[""] === region.toString());
            const SPI = data[region - 1];
            console.log(region, index, SPI);
            if (SPI) {
                const rank = index + 1;
                document.getElementById(`SPI${rank}`).textContent = `${SPI["Region name"]} (${SPI["NUTS_ID1"]})`;
                document.getElementById(`SPI${rank}`).addEventListener('click', function () {
                    window.location.href = 'region-page.html?region=' + encodeURIComponent(SPI["NUTS_ID1"]);
                });
            } else {
                console.warn(`Region not found at index ${region["index"]}`);
            }

        });

        var dataSpiderChart = [spiderChartData(regionData[0], -1)];
        var dataBarChart = [barChartData(regionData[0], -1)];
        gdpClosest.forEach((region, index) => {
            const GDP = data.find(d => d["NUTS_ID1"] === region["NUTS_ID1"]);

            if (GDP) {
                const rank = index + 1; // To get the rank (1st, 2nd, etc.)
                document.getElementById(`GDP${rank}`).textContent = `${GDP["Region name"]} (${GDP["NUTS_ID1"]})`;
                document.getElementById(`GDP${rank}`).addEventListener('click', function () {
                    window.location.href = 'region-page.html?region=' + encodeURIComponent(GDP["NUTS_ID1"]);
                });
            } else {
                console.warn(`Region not found for code ${region["NUTS_ID1"]}`);
            }

            dataSpiderChart.push(spiderChartData(GDP, index));
            dataBarChart.push(barChartData(GDP, index));

        });

        console.log("HGKDHGFAJFLKDAFA");
        console.log(dataBarChart);

        const isMobile = window.innerWidth < 768;


        const pcSpiderLayout = {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, 100]
                }
            },
            dragmode: false,
            font: { family: 'Source Sans 3' }
        };

        const mobileSpiderLayout = {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, 100] // Adjust range
                },
                angularaxis: {
                    showticklabels: false
                }
            },
            dragmode: false,
            font: { family: 'Source Sans 3' },
            legend: {
                orientation: 'h',
                yanchor: 'top',
                y: 0,
                xanchor: 'center',
                x: 0.5
            },
            margin: { t: 0, b: 250, l: 0, r: 0 },

        };

        const config = {
            responsive: true,
            staticPlot: false,
            autosize: true,
            displayModeBar: false,
        }

        const spiderLayout = isMobile ? mobileSpiderLayout : pcSpiderLayout;

        Plotly.newPlot('spiderChart', dataSpiderChart, spiderLayout, config);

        const pcBarLayout = {
            font: { family: 'Source Sans 3' },
            barmode: 'group',
            showlegend: true,
            yaxis: {
                type: 'category',
                showticklabels: true,
                categoryorder: 'array',
                categoryarray: Object.keys(slicedObject).reverse(),
            },
            dragmode: false,
            margin: {
                l: 200,
            },
            responsive: true,
        };

        const mobileBarLayout = {
            font: { family: 'Source Sans 3' },
            barmode: 'group',
            showlegend: true,
            xaxis: {
                type: 'category',
                showticklabels: true,
                categoryorder: 'array',
                categoryarray: Object.keys(slicedObject).reverse(),
                tickangle: -90
            },
            dragmode: false,
            margin: {
                b: 200,
            },
            legend: {
                orientation: 'v',  // horizontal legend
                yanchor: 'bottom',
                y: 1.02,           // just above the plot area
                xanchor: 'left',
                x: 0
            },
            responsive: true,
        };

        const barLayout = isMobile ? mobileBarLayout : pcBarLayout;

        Plotly.newPlot('barChart', dataBarChart, barLayout, config);
    });
}

function spiderChartData(data, n) {
    const entries = Object.entries(data);
    const slicedEntries = entries.slice(4, 16);
    const slicedObject = Object.fromEntries(slicedEntries);

    const dataChart = {
        type: 'scatterpolar',
        r: Object.values(slicedObject),
        theta: Object.keys(slicedObject),
        fill: 'none', // Set fill to 'none' for no fill
        mode: 'lines+markers',
        name: data["Region name"] + " (" + data["Country"] + ")",
        line: {
            color: colors[n + 1], // Line color
            width: 2 // Line width
        },
        marker: {
            size: 10,
            color: colors[n + 1]
        },
        visible: (n + 1) > 1 ? 'legendonly' : true
    }
    console.log(dataChart);
    return dataChart;
}

function barChartData(data, n) {
    const isMobile = window.innerWidth < 768;

    const entries = Object.entries(data);
    const slicedEntries = entries.slice(4, 16);
    slicedObject = Object.fromEntries(slicedEntries);

    let dataChart;

    if (isMobile) {
        dataChart = {
            type: 'bar',
            x: Object.keys(slicedObject),          // numbers on x? or categories on x? you choose
            y: Object.values(slicedObject),            // or swap depending on how you want it
            // orientation: 'v', // default, can omit
            hovertext: Object.values(slicedObject),
            hoverinfo: 'text',
            name: data["Region name"],
            marker: {
                size: 10,
                color: colors[n + 1]
            },
            visible: (n + 1) > 1 ? 'legendonly' : true
        };
    } else {
        dataChart = {
            type: 'bar',
            x: Object.values(slicedObject),
            y: Object.keys(slicedObject),
            orientation: 'h',
            hovertext: Object.values(slicedObject),
            hoverinfo: 'text',
            name: data["Region name"],
            marker: {
                size: 10,
                color: colors[n + 1]
            },
            visible: (n + 1) > 1 ? 'legendonly' : true
        };
    }

    return dataChart;
}

document.getElementById("spiderChartButton").addEventListener('click', function () {
    this.classList.add("selected");
    console.log(document.getElementById("spiderChart").style.display);
    document.getElementById("barChartButton").classList.remove("selected");
    document.getElementById("spiderChart").style.display = "block";
    Plotly.relayout("spiderChart", {
        width: document.getElementById("chartContainer").clientWidth,
        height: document.getElementById("chartContainer").clientHeight
    });
    document.getElementById("barChart").style.display = "none";
});

document.getElementById("barChartButton").addEventListener('click', function () {
    this.classList.add("selected");
    document.getElementById("spiderChartButton").classList.remove("selected");
    document.getElementById("barChart").style.display = "block";
    Plotly.relayout("barChart", {
        width: document.getElementById("chartContainer").clientWidth,
        height: document.getElementById("chartContainer").clientHeight
    });
    document.getElementById("spiderChart").style.display = "none";
});

$('#regionName').select2();
$('.select2-container .select2-selection--single').css({
    border: 'none',
});
$('.select2-container .select2-selection--single .select2-selection__rendered').css({
    lineHeight: '3rem',
    fontSize: '2.625rem',
    textWrap: 'balance',
    fontWeight: '700',
    color: 'black',
    margin: 0,
    width: '90%',
    marginTop: '-0.8rem'
})
$('.select2-container .select2-selection__arrow').css({
    'background-image': 'url("assets/search-icon.svg")',
    'background-size': 'contain',
    'background-repeat': 'no-repeat',
    'background-position': 'center'
});
$('.select2-container .select2-selection__arrow b').css('display', 'none');
$('#regionName').on('change', function () {
    window.location.href = 'region-page.html?region=' + encodeURIComponent(this.value);
});

async function regionStats(regionName) {
    // 1. Fetch your data
    const data = await fetchAggData(); // assume it returns an array of objects

    // 2. Extract the needed columns
    const mapped = data.map(d => ({
        id: d.NUTS_ID,
        value: parseFloat(d["Aggregated Index"])  // ✅ correct column name
    }));

    // 3. Sort by value (descending)
    const sorted = [...mapped].sort((a, b) => b.value - a.value);

    // 4. Find the selected region
    const regionEntry = sorted.find(d => d.id === regionName);
    const regionEUSPI = sorted.find(d => d.id === regionName)?.value;
    const peerSPI = mapped.filter(d => gdpClosest.some(g => g.NUTS_ID1 === d.id));

    if (!regionEntry) {
        console.error("Region not found:", regionName);
        return;
    }

    const mean = peerSPI.reduce((sum, d) => sum + d.value, 0) / peerSPI.length;

    // 5. Find the rank (1-based index)
    const rank = sorted.findIndex(d => d.id === regionName) + 1;

    // 6. Display results
    document.getElementById("euspi-value").innerHTML =
        `<strong>EU-SPI:</strong> ${regionEUSPI.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${rank}/${sorted.length})`;
    if ((regionEUSPI - mean) > 0) {
        document.getElementById("performance-vs-economic-level").textContent = "Strong performance for its economic level";
    } else {
        document.getElementById("performance-vs-economic-level").textContent = "Weak performance for its economic level";
    }

    // Optional: return the info
    return { id: regionEntry.id, value: regionEntry.value, rank };
}

async function gdpStats(regionName) {
    // 1. Fetch your data
    const data = await fetchGDPData();

    // 2. Extract the needed columns
    const mapped = data.map(d => ({
        id: d.NUTSID,
        value: parseFloat(d["pps_pc"])
    }));

    // 3. Sort by value (descending)
    const sorted = [...mapped].sort((a, b) => b.value - a.value);

    // 4. Find the selected region
    const regionEntry = sorted.find(d => d.id === regionName);
    const regionGDP = sorted.find(d => d.id === regionName)?.value;

    if (!regionEntry) {
        console.error("Region not found:", regionName);
        return;
    }

    // 5. Find the rank (1-based index)
    const rank = sorted.findIndex(d => d.id === regionName) + 1;

    // 6. Display results
    document.getElementById("gdp-value").innerHTML =
        `<strong>GDPpc:</strong> ${regionGDP.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${rank}/${sorted.length})`;

    // Optional: return the info
    return { id: regionEntry.id, value: regionEntry.value, rank };
}

async function popStats(regionName) {
    // 1. Fetch your data
    const data = await fetchPopData();

    // 2. Extract the needed columns
    const mapped = data.map(d => ({
        id: d.NUTSID,
        value: d.Population
    }));

    // 3. Sort by value (descending)
    const sorted = [...mapped].sort((a, b) => b.value - a.value);

    // 4. Find the selected region
    const regionEntry = sorted.find(d => d.id === regionName);
    const regionPop = sorted.find(d => d.id === regionName)?.value;

    if (!regionEntry) {
        console.error("Region not found:", regionName);
        return;
    }

    // 5. Find the rank (1-based index)
    const rank = sorted.findIndex(d => d.id === regionName) + 1;

    // 6. Display results
    document.getElementById("pop-value").innerHTML =
        `<strong>Population:</strong> ${parseInt(regionPop).toLocaleString("de-DE")} (${rank}/${sorted.length})`;

    // Optional: return the info
    return { id: regionEntry.id, value: regionEntry.value, rank };
}

async function betterSPI(regionName, gdpClosest) {
    //1. Fetch your data
    const data = await fetchNutsData();

    const regionSPI = data.filter(d => d.NUTS_ID1 === regionName);
    const peerSPI = data.filter(d => gdpClosest.some(g => g.NUTS_ID1 === d.NUTS_ID1));

    const columns = Object.keys(peerSPI[0]); // get all column names

    // filter numeric columns (those that can be parsed into numbers)
    const numericCols = columns.filter(col =>
        peerSPI.some(d => !isNaN(parseFloat(d[col])))
    );

    // compute mean for each numeric column
    const means = {};
    numericCols.forEach(col => {
        const validValues = peerSPI
            .map(d => parseFloat(d[col]))
            .filter(v => !isNaN(v)); // ignore non-numeric or empty values

        const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        means[col] = mean;
    });

    const includeCols = [
        "Access to Advanced Education",
        "Access to Basic Knowledge",
        "Access to ICT",
        "Environmental Quality",
        "Health and Wellness",
        "Nutrition and Basic Medical Care",
        "Personal Freedom and Choice",
        "Personal Rights",
        "Personal Security",
        "Shelter",
        "Tolerance and Inclusion",
        "Water and Sanitation"
    ];

    const diff = {};
    includeCols.forEach(key => {
        const a = parseFloat(regionSPI[0][key]);
        const b = parseFloat(means[key]);
        if (!isNaN(a) && !isNaN(b)) diff[key] = a - b;
    });

    const diffArray = Object.entries(diff).map(([key, value]) => ({ key, value }));

    diffArray.sort((a, b) => b.value - a.value);

    const top3 = diffArray.slice(0, 3).filter(d => d.value > 0);
    const bottom3 = diffArray.slice(-3).sort((a, b) => a.value - b.value).filter(d => d.value < 0);

    const topList = document.getElementById("top3-list");
    const bottomList = document.getElementById("bottom3-list");

    topList.innerHTML = "";
    bottomList.innerHTML = "";

    top3.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `${d.key} (+${d.value.toFixed(0)})`;
        topList.appendChild(li);
    });

    bottom3.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `${d.key} (${d.value.toFixed(0)})`;
        bottomList.appendChild(li);
    });

    if (top3.length === 0) topList.innerHTML = "<li>This region doesn't have high relative performance in any components</li>";
    if (bottom3.length === 0) bottomList.innerHTML = "<li>This region doesn't have low relative performance in any components</li>";
}

async function highlightRegions(spiClosest, gdpClosest) {
    const data = await fetchNutsData();
    const spiRegions = spiClosest.map(index => data[index - 1].NUTS_ID1);
    const gdpRegions = gdpClosest.map(d => d.NUTS_ID1);
    console.log(spiRegions, gdpRegions);

    nuts2.eachLayer(layer => {
        const id = layer.feature.properties.NUTS_ID1;

        if (spiRegions.includes(id)) {
            layer.setStyle({
                fillColor: '#D7003D'
            })
        }

        if (gdpRegions.includes(id)) {
            layer.setStyle({
                fillColor: '#00A174'
            })
        }
    });
}

async function factorBarPlot(regionName, secondRegionName, factorName) {
    const data = await fetchFactorData();
    const mapped = data.map(d => ({
        id: d.NUTS_ID1,
        clusterId: d.Cluster,
        value: parseFloat(d[factorName])
    }));

    const mean = arr =>
        arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN;

    const cluster1Vals = mapped
        .filter(d => d.clusterId === "1")
        .map(d => d.value);
    const meanCluster1 = mean(cluster1Vals);

    const cluster2Vals = mapped
        .filter(d => d.clusterId === "2" && !Number.isNaN(d.value))
        .map(d => d.value);
    const meanCluster2 = mean(cluster2Vals);

    const regionObj = mapped.find(d => d.id === regionName);
    const regionValue = regionObj ? regionObj.value : null;

    let labels = ['Cluster 1 mean', 'Cluster 2 mean', regionName];
    let values = [meanCluster1, meanCluster2, regionValue];
    let colors = ['#FE6162', '#6467FE', '#FFCC00'];

    if (secondRegionName) {
        const region2Obj = mapped.find(d => d.id === secondRegionName);
        const region2Value = region2Obj ? region2Obj.value : null;

        labels.push(secondRegionName);
        values.push(region2Value);
        colors.push('#00A174');  // color for second region
    }

    const trace = {
        x: labels,
        y: values,
        type: 'bar',
        marker: { color: colors }
    };

    const layout = {
        yaxis: {
            automargin: true,
            tickvals: [0, 0.5, 1, 1.5, 2, -0.5, -1, -1.5, -2],      // whatever ticks you want
            ticktext: ['EU mean', '0.5', '1', '1.5', '2', '-0.5', '-1', '-1.5', '-2']  // label 0 as EU mean
        },
        xaxis: { automargin: true },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot('factor-graph', [trace], layout, config);
}

let factorName = document.querySelector('.factor-button.selection')
    .dataset.factor;   // initial selected

document.querySelectorAll('.factor-button').forEach(btn => {
    // Factor titles and their components
    const factorTitles = {
        "F1": "Health",
        "F2": "Freedom, Employment and Housing (FEH)",
        "F3": "Eco-social Instutional Quality (ESIQ)",
        "F4": "Education"
    };

    const factorComponents = {
        "F1": [
            "Nutrition and Basic Medical Care",
            "Health and Wellness"
        ],
        "F2": [
            "Personal Freedom and Choice",
            "Shelter"
        ],
        "F3": [
            "Environmental Quality",
            "Access to Advanced Education",
            "Access to ICT",
            "Personal Rights",
            "Tolerance and Inclusion"
        ],
        "F4": [
            "Access to Basic Knowledge"
        ]
    };

    btn.addEventListener('click', () => {
        // update visual selection
        document.querySelectorAll('.factor-button')
            .forEach(b => b.classList.remove('selection'));
        btn.classList.add('selection');

        // get factorName from clicked button
        factorName = btn.dataset.factor;

        // update factor title and components list
        document.getElementById('factor-title').textContent = factorTitles[factorName] || factorName;
        const componentsList = document.getElementById('factor-components');
        componentsList.innerHTML = '';
        if (factorComponents[factorName]) {
            factorComponents[factorName].forEach(component => {
                const li = document.createElement('li');
                li.textContent = component;
                componentsList.appendChild(li);
            });
        } else {
            componentsList.innerHTML = '<li>No components available</li>';
        }

        // now recompute means / redraw chart using factorName
        const secondRegionName = document.getElementById('factor-region-select') ? document.getElementById('factor-region-select').value : null;
        factorBarPlot(regionName, secondRegionName, factorName);
    });
});

document.getElementById('factor-region-select').addEventListener('change', (e) => {
    const secondRegionName = e.target.value;
    const factorName = document.querySelector('.factor-button.selection').dataset.factor;
    factorBarPlot(regionName, secondRegionName, factorName);
});

let componentCarousel;

async function pdpCompute() {
    const nutsData = await fetchNutsData();
    const thresholdData = await fetchPdpThreshold();

    // Select the top PDPs for the region
    regionData = nutsData.filter(d => d.NUTS_ID1 === regionName);
    console.log(regionData);
    console.log(thresholdData);

    const region = regionData[0];

    const components = [
        "Nutrition and Basic Medical Care",
        "Water and Sanitation",
        "Shelter",
        "Personal Security",
        "Access to Basic Knowledge",
        "Access to ICT",
        "Health and Wellness",
        "Environmental Quality",
        "Personal Rights",
        "Personal Freedom and Choice",
        "Tolerance and Inclusion",
        "Access to Advanced Education"
    ];

    const diffs = components.map(name => {
        const regionValStr = region[name];         // e.g. "91.019..."
        const thrVal = thresholdData[name];     // e.g. 80

        const regionVal = regionValStr == null ? null : Number(regionValStr);
        const diff = (regionVal != null && thrVal != null)
            ? Math.abs(regionVal - thrVal)
            : null;

        return {
            name,
            region: regionVal,
            threshold: thrVal,
            diff
        };
    });

    diffs.sort((a, b) => {
        if (a.diff == null && b.diff == null) return 0;
        if (a.diff == null) return 1;
        if (b.diff == null) return -1;

        return a.diff - b.diff;
    });

    const top3 = diffs.slice(0, 3);
    console.log(top3);

    const carouselOrder = diffs;
    [carouselOrder[0], carouselOrder[1]] =
        [carouselOrder[1], carouselOrder[0]];

    return (carouselOrder);
}

async function pdpGraph(componentName, regionValue) {
    const pdpData = await fetchPDPdata();
    const graphData = pdpData[componentName];

    const xs = graphData.map(d => d.x);
    const ys = graphData.map(d => d.y);

    const pdpTrace = {
        x: xs,
        y: ys,
        mode: 'lines',
        type: 'scatter',
        name: componentName
    };

    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);

    const vlineTrace = {
        x: [regionValue, regionValue],
        y: [yMin, yMax],
        mode: "lines",
        type: "scatter",
        name: "Region value",
        line: { color: "red", dash: "dash" },
        hoverinfo: "none"
    };

    const layout = {
        title: componentName,
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    return { traces: [pdpTrace, vlineTrace], layout };
}

let carouselIndex = 1;

async function renderCarousel() {
    const components = await pdpCompute();

    // Clear previous content
    document.getElementById('pdp-prev').innerHTML = '';
    document.getElementById('pdp-next').innerHTML = '';
    document.getElementById('pdp-now').innerHTML = '';

    // Get indices for previous, current, and next plots
    const currentIndex = carouselIndex;
    const previousIndex = (currentIndex - 1 + components.length) % components.length;
    const nextIndex = (currentIndex + 1) % components.length;

    console.log(previousIndex, currentIndex, nextIndex);

    // Draw the previous plot
    const pdpPrev = await pdpGraph(components[previousIndex].name, regionData[0][components[previousIndex].name]);
    Plotly.newPlot('pdp-prev', pdpPrev.traces, pdpPrev.layout, { staticPlot: true, displayModeBar: false });

    // Draw the current plot
    const pdpNow = await pdpGraph(components[currentIndex].name, regionData[0][components[currentIndex].name]);
    Plotly.newPlot('pdp-now', pdpNow.traces, pdpNow.layout, { staticPlot: true, displayModeBar: false });

    // Draw the next plot
    const pdpNext = await pdpGraph(components[nextIndex].name, regionData[0][components[nextIndex].name]);
    Plotly.newPlot('pdp-next', pdpNext.traces, pdpNext.layout, { staticPlot: true, displayModeBar: false });
}

function nextPage() {
    carouselIndex += 1;
    if (carouselIndex >= 8) {
        carouselIndex = 0;  // wrap around
    }
    renderCarousel(componentCarousel);
}

function prevPage() {
    carouselIndex -= 1;
    if (carouselIndex < 0) {
        carouselIndex = 7;  // wrap around
    }
    renderCarousel(componentCarousel);
}

getClosestRegions(5)
    .then(updatePage)
    .then(() => regionStats(regionName))
    .then(() => gdpStats(regionName))
    .then(() => popStats(regionName))
    .then(() => betterSPI(regionName, gdpClosest))
    .then(() => highlightRegions(spiClosest, gdpClosest))
    .then(() => factorBarPlot(regionName, null, factorName))
    .then(() => resizePlots())
    .then(() => pdpCompute())
    .then(() => renderCarousel(componentCarousel));

function resizePlots() {
    const spiderChart = document.getElementById('spiderChart');
    const barChart = document.getElementById('barChart');

    if (spiderChart && spiderChart.offsetParent !== null) {
        Plotly.relayout("spiderChart", {
            width: document.getElementById("chartContainer").clientWidth,
            height: document.getElementById("chartContainer").clientHeight
        });
    }

    if (barChart && barChart.offsetParent !== null) {
        Plotly.relayout("barChart", {
            width: document.getElementById("chartContainer").clientWidth,
            height: document.getElementById("chartContainer").clientHeight
        });
    }
};

window.addEventListener("resize", () => {
    const spiderChart = document.getElementById('spiderChart');
    const barChart = document.getElementById('barChart');

    if (spiderChart && spiderChart.offsetParent !== null) {
        Plotly.relayout("spiderChart", {
            width: document.getElementById("chartContainer").clientWidth,
            height: document.getElementById("chartContainer").clientHeight
        });
    }

    if (barChart && barChart.offsetParent !== null) {
        Plotly.relayout("barChart", {
            width: document.getElementById("chartContainer").clientWidth,
            height: document.getElementById("chartContainer").clientHeight
        });
    }
});

let mobile = window.innerWidth < 768;

window.addEventListener('resize', () => {
    const nowMobile = window.innerWidth < 768;
    if (nowMobile === mobile) return; // no breakpoint change → do nothing

    mobile = nowMobile;


    if (nowMobile) {
        document.getElementById("chart-menu").style.display = "none";
        document.getElementById("barChart").style.display = "none";
        document.getElementById("spiderChart").style.display = "block";
    } else {
        document.getElementById("chart-menu").style.display = "flex";
    }
    // purge and redraw with the new layout type
    updatePage();
});

document.getElementById("spiderChartButton").addEventListener('click', function () {
    this.classList.add("selected");
    console.log(document.getElementById("spiderChart").style.display);
    document.getElementById("barChartButton").classList.remove("selected");
    document.getElementById("spiderChart").style.display = "block";
    Plotly.relayout("spiderChart", {
        width: document.getElementById("chartContainer").clientWidth,
        height: document.getElementById("chartContainer").clientHeight
    });
    document.getElementById("barChart").style.display = "none";
});

document.getElementById("barChartButton").addEventListener('click', function () {
    this.classList.add("selected");
    document.getElementById("spiderChartButton").classList.remove("selected");
    document.getElementById("barChart").style.display = "block";
    Plotly.relayout("barChart", {
        width: document.getElementById("chartContainer").clientWidth,
        height: document.getElementById("chartContainer").clientHeight
    });
    document.getElementById("spiderChart").style.display = "none";
});

document.getElementById("pdp-next-button").addEventListener("click", nextPage);
document.getElementById("pdp-prev-button").addEventListener("click", prevPage);
