let chartType, chartStatus;
let currentProjectIndex = 0;
let filteredFeatures = [];
let allFeatures = [];
let districtMap, neighborhoodMap;

document.addEventListener("DOMContentLoaded", () => {
    // Fetch GeoJSON data with enhanced logging
    console.log("Attempting to fetch GeoJSON data...");
    fetch("data/COH_CIPSpnt.geojson")
        .then(response => {
            console.log("Fetch response status:", response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} (${response.statusText})`);
            }
            return response.json();
        })
        .then(data => {
            console.log("GeoJSON data received:", data);
            const geojsonLayer = {
                features: data.features
            };
            if (geojsonLayer.features && geojsonLayer.features.length > 0) {
                allFeatures = geojsonLayer.features;
                filteredFeatures = geojsonLayer.features;
                console.log("Features loaded:", allFeatures.length);
                console.log("Sample feature attributes:", allFeatures[0]?.properties || allFeatures[0]?.attributes);
                populateFilters(allFeatures);
                setTimeout(() => {
                    updateDashboard(allFeatures);
                    updateProjectDetails(0);
                }, 100);
            } else {
                console.log("No features returned from GeoJSON");
                document.getElementById("projectDetails").innerHTML = "<p>No projects available.</p>";
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            document.getElementById("projectDetails").innerHTML = "<p>Error loading data: " + err.message + "</p>";
        });

    // Load ArcGIS modules for maps
    console.log("Loading ArcGIS modules...");
    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/GeoJSONLayer",
        "esri/widgets/Legend"
    ], (Map, MapView, GeoJSONLayer, Legend) => {
        console.log("ArcGIS modules loaded successfully");
        const geojsonLayerForMap = new GeoJSONLayer({
            url: "data/COH_CIPSpnt.geojson",
            popupTemplate: {
                title: "{ProjectName}",
                content: [
                    {
                        type: "fields",
                        fieldInfos: [
                            { fieldName: "Type", label: "Project Type" },
                            { fieldName: "CategoryDepartment", label: "Category/Department" },
                            { fieldName: "ProjectStatus", label: "Status" },
                            { fieldName: "PrimaryFundingSource", label: "Primary Funding Source" },
                            { fieldName: "ConstructionStartDate", label: "Construction Start Date" },
                            { fieldName: "ConstructionCompletionDate", label: "Construction End Date" }
                        ]
                    }
                ]
            },
            renderer: {
                type: "simple",
                symbol: {
                    type: "simple-marker",
                    color: "#0056b3",
                    size: 8,
                    outline: {
                        color: "#ffffff",
                        width: 1
                    }
                }
            }
        });

        // Initialize District Map
        districtMap = new Map({
            basemap: "streets-vector",
            layers: [geojsonLayerForMap]
        });

        const districtView = new MapView({
            container: "map-district",
            map: districtMap,
            center: [-80.1496, 26.0112],
            zoom: 12
        });

        districtView.when(() => {
            const districtLegend = new Legend({
                view: districtView
            });
            districtView.ui.add(districtLegend, "bottom-left");
            console.log("District map initialized");
        });

        // Initialize Neighborhood Map
        neighborhoodMap = new Map({
            basemap: "streets-vector",
            layers: [geojsonLayerForMap]
        });

        const neighborhoodView = new MapView({
            container: "map-neighborhood",
            map: neighborhoodMap,
            center: [-80.1496, 26.0112],
            zoom: 12
        });

        neighborhoodView.when(() => {
            const neighborhoodLegend = new Legend({
                view: neighborhoodView
            });
            neighborhoodView.ui.add(neighborhoodLegend, "bottom-left");
            console.log("Neighborhood map initialized");
        });
    }, (err) => {
        console.error("Error loading ArcGIS modules:", err);
        document.getElementById("map-district").innerHTML = "<p>Error loading map: ArcGIS modules failed to load.</p>";
        document.getElementById("map-neighborhood").innerHTML = "<p>Error loading map: ArcGIS modules failed to load.</p>";
    });
});

function switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.getElementById(tab + "-tab").classList.remove("hidden");
}

function populateFilters(features) {
    const fields = {
        "filter-type": { field: "Type", map: { 0: "Public", 1: "Private", 2: "Public-Private" } },
        "filter-category": { field: "CategoryDepartment" },
        "filter-status": { field: "ProjectStatus" },
        "filter-funding": { field: "PrimaryFundingSource" },
        "filter-start": { field: "ConstructionStartDate" },
        "filter-end": { field: "ConstructionCompletionDate" }
    };

    function updateDependentFilters() {
        const projectTypeRadios = document.querySelectorAll('input[name="project-type"]');
        let projectTypeValue = "All";
        projectTypeRadios.forEach(radio => {
            if (radio.checked) projectTypeValue = radio.value;
        });

        const activeFilters = {
            "filter-type": projectTypeValue,
            "filter-category": document.getElementById("filter-category")?.value || "All",
            "filter-status": document.getElementById("filter-status")?.value || "All",
            "filter-funding": document.getElementById("filter-funding")?.value || "All",
            "filter-start": document.getElementById("filter-start")?.value || "All",
            "filter-end": document.getElementById("filter-end")?.value || "All"
        };
        console.log("Active filters:", activeFilters);

        const filtered = features.filter(f => {
            const attrs = f.properties || f.attributes || {};
            return Object.entries(activeFilters).every(([key, val]) => {
                if (val === "All") return true;
                const fieldValue = attrs[fields[key].field];
                return fieldValue == val || (val === "" && (fieldValue === null || fieldValue === undefined));
            });
        });
        console.log("Filtered features:", filtered.length);

        const typeValues = new Set();
        allFeatures.forEach(f => {
            const attrs = f.properties || f.attributes || {};
            const v = attrs[fields["filter-type"].field];
            if (v !== null && v !== undefined && v !== "") {
                typeValues.add(v);
            }
        });
        console.log("Values for filter-type:", Array.from(typeValues));

        for (const [id, config] of Object.entries(fields)) {
            if (id === "filter-type") continue;
            const select = document.getElementById(id);
            if (!select) {
                console.log(`Select element not found: ${id}`);
                continue;
            }

            const otherFilters = { ...activeFilters };
            otherFilters[id] = "All";
            const filteredForThisField = features.filter(f => {
                const attrs = f.properties || f.attributes || {};
                return Object.entries(otherFilters).every(([key, val]) => {
                    if (val === "All") return true;
                    const fieldValue = attrs[fields[key].field];
                    return fieldValue == val || (val === "" && (fieldValue === null || fieldValue === undefined));
                });
            });

            const values = new Set();
            filteredForThisField.forEach(f => {
                const attrs = f.properties || f.attributes || {};
                const v = attrs[config.field];
                if (v !== null && v !== undefined && v !== "") {
                    values.add(v);
                }
            });
            console.log(`Values for ${id}:`, Array.from(values));

            const currentValue = select.value;
            if (values.size === 0) {
                select.innerHTML = `<option value="All">N/A</option>`;
                select.disabled = true;
            } else {
                select.innerHTML = `<option value="All">All</option>`;
                Array.from(values).sort().forEach(v => {
                    const label = config.map ? config.map[v] : v;
                    select.innerHTML += `<option value="${v}">${label || 'Unnamed'}</option>`;
                });
                select.disabled = false;

                if (Array.from(values).includes(currentValue) || currentValue === "All") {
                    select.value = currentValue;
                } else {
                    select.value = "All";
                }
            }
        }
        filteredFeatures = filtered;
        setTimeout(() => updateDashboard(filtered), 100);
        updateProjectDetails(0);
    }

    for (const [id, config] of Object.entries(fields)) {
        if (id === "filter-type") continue;
        const select = document.getElementById(id);
        if (!select) {
            console.log(`Initial select element not found: ${id}`);
            continue;
        }
        select.addEventListener("change", updateDependentFilters);
    }

    const projectTypeRadios = document.querySelectorAll('input[name="project-type"]');
    projectTypeRadios.forEach(radio => {
        radio.addEventListener("change", updateDependentFilters);
    });

    const clearButton = document.getElementById("clear-filters");
    if (clearButton) {
        clearButton.addEventListener("click", () => {
            Object.keys(fields).forEach(id => {
                if (id === "filter-type") return;
                const select = document.getElementById(id);
                if (select) select.value = "All";
            });
            const allRadio = document.querySelector('input[name="project-type"][value="All"]');
            if (allRadio) allRadio.checked = true;
            filteredFeatures = allFeatures;
            updateDependentFilters();
        });
    }

    updateDependentFilters();
}

function applyFilters() {
    // No longer needed as filters are handled by updateDependentFilters
}

function updateDashboard(features) {
    if (!features || features.length === 0) {
        console.log("No features to display in dashboard");
        document.getElementById("totalProjects").textContent = "0";
        document.getElementById("publicCount").textContent = "0";
        document.getElementById("privateCount").textContent = "0";
        document.getElementById("mixedCount").textContent = "0";
        if (chartType) chartType.destroy();
        if (chartStatus) chartStatus.destroy();
        document.getElementById("projectDetails").innerHTML = "<p>No projects available.</p>";
        return;
    }

    const counts = { 0: 0, 1: 0, 2: 0 };
    const statusCounts = {};
    features.forEach(f => {
        const attrs = f.properties || f.attributes || {};
        const t = attrs.Type;
        if (counts[t] !== undefined) counts[t]++;
        const s = attrs.ProjectStatus || "Unknown";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const total = features.length;
    const typePercentages = {
        0: ((counts[0] / total) * 100).toFixed(2),
        1: ((counts[1] / total) * 100).toFixed(2),
        2: ((counts[2] / total) * 100).toFixed(2)
    };
    const statusPercentages = {};
    for (const [key, value] of Object.entries(statusCounts)) {
        statusPercentages[key] = ((value / total) * 100).toFixed(2);
    }

    document.getElementById("totalProjects").textContent = total;
    document.getElementById("publicCount").textContent = counts[0] || 0;
    document.getElementById("privateCount").textContent = counts[1] || 0;
    document.getElementById("mixedCount").textContent = counts[2] || 0;

    const ctxType = document.getElementById("chartType");
    const ctxStatus = document.getElementById("chartStatus");
    if (!ctxType || !ctxStatus) {
        console.log("Canvas elements not found:", ctxType, ctxStatus);
        return;
    }

    const createCharts = () => {
        const typeContext = ctxType.getContext("2d");
        const statusContext = ctxStatus.getContext("2d");

        if (!typeContext || !statusContext) {
            console.log("Canvas context not available, retrying...");
            setTimeout(createCharts, 100);
            return;
        }

        if (chartType) chartType.destroy();
        if (chartStatus) chartStatus.destroy();

        chartType = new Chart(typeContext, {
            type: "doughnut",
            data: {
                labels: ["Public", "Private", "Public-Private"],
                datasets: [{
                    data: [counts[0] || 0, counts[1] || 0, counts[2] || 0],
                    backgroundColor: ["#28a745", "#4682b4", "#ffa500"],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: "Projects by Type" },
                    legend: {
                        position: "top",
                        labels: {
                            generateLabels: function(chart) {
                                const data = chart.data;
                                return data.labels.map((label, i) => ({
                                    text: `${label} (${data.datasets[0].data[i]} - ${typePercentages[i]}%)`,
                                    fillStyle: chart.data.datasets[0].backgroundColor[i],
                                    hidden: isNaN(data.datasets[0].data[i]) || data.datasets[0].data[i] === 0,
                                    index: i
                                }));
                            }
                        }
                    }
                }
            }
        });

        chartStatus = new Chart(statusContext, {
            type: "doughnut",
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: Object.keys(statusCounts).map((_, i) => `hsl(${i * 30}, 70%, 50%)`),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: "Projects by Status" },
                    legend: {
                        position: "top",
                        labels: {
                            generateLabels: function(chart) {
                                const data = chart.data;
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = statusPercentages[label] || "0.00";
                                    return {
                                        text: `${label} (${value} - ${percentage}%)`,
                                        fillStyle: chart.data.datasets[0].backgroundColor[i],
                                        hidden: isNaN(value) || value === 0,
                                        index: i
                                    };
                                });
                            }
                        }
                    }
                }
            }
        });
    };

    createCharts();
}

function updateProjectDetails(index) {
    const projectDetails = document.getElementById("projectDetails");
    if (!projectDetails || !filteredFeatures.length) {
        projectDetails.innerHTML = "<p>No projects available.</p>";
        return;
    }

    const f = filteredFeatures[index];
    const attrs = f.properties || f.attributes || {};
    const typeMap = { 0: "Public", 1: "Private", 2: "Public-Private" };
    const projectType = attrs.Type !== undefined && typeMap[attrs.Type] ? typeMap[attrs.Type] : "N/A";

    projectDetails.innerHTML = `
        <div class="project-detail-nav">
            <button onclick="updateProjectDetails((currentProjectIndex - 1 + ${filteredFeatures.length}) % ${filteredFeatures.length})"><</button>
            <span>${index + 1} of ${filteredFeatures.length}</span>
            <button onclick="updateProjectDetails((currentProjectIndex + 1) % ${filteredFeatures.length})">></button>
        </div>
        <div class="project-detail">
            <h2>${attrs.ProjectName || 'Unnamed Project'}</h2>
            <p><strong>Project Type:</strong> <span style="color: orangeRed">${projectType}</span></p>
            <p><strong>Category/Department:</strong> ${attrs.CategoryDepartment || 'N/A'}</p>
            <p><strong>Status:</strong> ${attrs.ProjectStatus || 'N/A'}</p>
            <p><strong>Primary Funding Source:</strong> ${attrs.PrimaryFundingSource || 'N/A'}</p>
            <p><strong>Additional Funding Sources:</strong> ${attrs.AdditionalFundingSources || 'N/A'}</p>
            <p><strong>District:</strong> ${attrs.District || 'N/A'}</p>
            <p><strong>Neighborhood:</strong> ${attrs.Neighborhood || 'N/A'}</p>
            <p><strong>Description:</strong> ${attrs.ProjectDescription || 'N/A'}</p>
            <p><strong>Project Update:</strong> ${attrs.ProjectUpdate || 'N/A'}</p>
            <p><strong>Construction Start Date:</strong> ${attrs.ConstructionStartDate || 'N/A'}</p>
            <p><strong>Construction Completion Date:</strong> ${attrs.ConstructionCompletionDate || 'N/A'}</p>
            <p><strong>PoC Name:</strong> ${attrs.PoCName || 'N/A'}</p>
            <p><strong>PoC Department:</strong> ${attrs.PoCDepartmentDivision || 'N/A'}</p>
            <p><strong>PoC Email:</strong> ${attrs.PoCEmail || 'N/A'}</p>
            <p><strong>PoC Phone:</strong> ${attrs.PoCPhone || 'N/A'}</p>
        </div>
    `;
    currentProjectIndex = index;
}
