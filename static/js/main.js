// ==========================================================================
// Scriba - JavaScript Application Logic & Visualizations
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        activeTab: 'dashboard',
        selectedFile: null,
        dataset: {
            page: 1,
            limit: 10,
            search: '',
            category: ''
        },
        weights: {
            sim: 70,
            cite: 15,
            time: 15
        },
        charts: {
            scatter: null,
            timeline: null,
            growth: null
        },
        loadedPapers: [] // Cache for lookup
    };

    // DOM Cache
    const navLinks = document.querySelectorAll('.nav-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Sliders
    const sliderSim = document.getElementById('weight-sim');
    const sliderCite = document.getElementById('weight-cite');
    const sliderTime = document.getElementById('weight-time');
    const valSim = document.getElementById('val-sim');
    const valCite = document.getElementById('val-cite');
    const valTime = document.getElementById('val-time');
    const weightErrorMsg = document.getElementById('weight-error-msg');
    
    // Drag & Drop
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileNameText = document.getElementById('file-name');
    const btnRemoveFile = document.getElementById('btn-remove-file');
    
    // Recommender
    const recommenderForm = document.getElementById('recommender-form');
    const abstractInput = document.getElementById('abstract-input');
    const btnRecommend = document.getElementById('btn-recommend');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const resultsContent = document.getElementById('results-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    const extractedKeywordsDiv = document.getElementById('extracted-keywords');
    const recommendationsList = document.getElementById('recommendations-list');
    
    // Dataset explorer
    const datasetSearch = document.getElementById('dataset-search');
    const datasetCategoryFilter = document.getElementById('dataset-category-filter');
    const papersTableBody = document.getElementById('papers-table-body');
    const paginationInfo = document.getElementById('pagination-info');
    const btnPrevPage = document.getElementById('btn-prev-page');
    const btnNextPage = document.getElementById('btn-next-page');
    
    // Global Header Search
    const globalSearchInput = document.getElementById('global-search');
    
    // Modals
    const addPaperModal = document.getElementById('add-paper-modal');
    const previewPaperModal = document.getElementById('preview-paper-modal');
    const btnOpenAddModal = document.getElementById('btn-open-modal');
    const btnCloseAddModal = document.getElementById('btn-close-modal');
    const btnCancelAddModal = document.getElementById('btn-cancel-modal');
    const addPaperForm = document.getElementById('add-paper-form');
    
    const btnClosePreview = document.getElementById('btn-close-preview');
    const btnClosePreviewFooter = document.getElementById('btn-close-preview-footer');
    const btnUseRecommenderInput = document.getElementById('btn-use-recommender');
    
    let activePreviewAbstract = ""; // Track current active preview abstract

    // ==========================================
    // 1. Tab Navigation Routing
    // ==========================================
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        state.activeTab = tabId;
        
        // Update sidebar links
        navLinks.forEach(l => {
            if (l.getAttribute('data-tab') === tabId) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });
        
        // Update content panes
        tabPanes.forEach(pane => {
            if (pane.id === `tab-${tabId}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // Trigger updates if necessary
        if (tabId === 'dashboard') {
            loadDashboard();
        } else if (tabId === 'dataset') {
            loadDataset();
        }
    }

    // ==========================================
    // 2. Weight Sliders Balancing Logic
    // ==========================================
    // Automatically balances sliders to sum to 100% when one is dragged
    function balanceWeights(changedSlider) {
        let sim = parseInt(sliderSim.value);
        let cite = parseInt(sliderCite.value);
        let time = parseInt(sliderTime.value);
        
        const sum = sim + cite + time;
        
        if (sum !== 100) {
            // Auto-distribute the remainder proportionally to the other two
            if (changedSlider === 'sim') {
                const remainder = 100 - sim;
                const otherSum = cite + time;
                if (otherSum === 0) {
                    cite = Math.round(remainder / 2);
                    time = remainder - cite;
                } else {
                    cite = Math.round((cite / otherSum) * remainder);
                    time = remainder - cite;
                }
            } else if (changedSlider === 'cite') {
                const remainder = 100 - cite;
                const otherSum = sim + time;
                if (otherSum === 0) {
                    sim = Math.round(remainder / 2);
                    time = remainder - sim;
                } else {
                    sim = Math.round((sim / otherSum) * remainder);
                    time = remainder - sim;
                }
            } else if (changedSlider === 'time') {
                const remainder = 100 - time;
                const otherSum = sim + cite;
                if (otherSum === 0) {
                    sim = Math.round(remainder / 2);
                    cite = remainder - sim;
                } else {
                    sim = Math.round((sim / otherSum) * remainder);
                    cite = remainder - sim;
                }
            }
            
            // Constrain
            sim = Math.max(0, Math.min(100, sim));
            cite = Math.max(0, Math.min(100, cite));
            time = Math.max(0, Math.min(100, time));
            
            // Re-verify sum is 100 due to float rounding
            const currentSum = sim + cite + time;
            if (currentSum !== 100) {
                const diff = 100 - currentSum;
                if (changedSlider !== 'sim') sim += diff;
                else if (changedSlider !== 'cite') cite += diff;
                else time += diff;
            }
            
            // Update Slider Elements values without infinite trigger loops
            sliderSim.value = sim;
            sliderCite.value = cite;
            sliderTime.value = time;
        }
        
        // Sync labels
        valSim.textContent = `${sliderSim.value}%`;
        valCite.textContent = `${sliderCite.value}%`;
        valTime.textContent = `${sliderTime.value}%`;
        
        state.weights.sim = parseInt(sliderSim.value);
        state.weights.cite = parseInt(sliderCite.value);
        state.weights.time = parseInt(sliderTime.value);
    }

    sliderSim.addEventListener('input', () => balanceWeights('sim'));
    sliderCite.addEventListener('input', () => balanceWeights('cite'));
    sliderTime.addEventListener('input', () => balanceWeights('time'));

    // ==========================================
    // 3. File Upload / Dropzone Setup
    // ==========================================
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' && ext !== 'txt') {
            alert('Please select a valid PDF or TXT paper file.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File exceeds the 5MB size limit.');
            return;
        }
        state.selectedFile = file;
        fileNameText.textContent = file.name;
        fileInfo.style.display = 'inline-flex';
        abstractInput.value = '';
        abstractInput.placeholder = `Selected file: ${file.name}. Click 'Analyze & Recommend' below to extract text and analyze similar papers.`;
        abstractInput.disabled = true;
    }

    btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid triggering dropzone click
        clearSelectedFile();
    });

    function clearSelectedFile() {
        state.selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        abstractInput.placeholder = "Enter abstract text here (e.g. 'This paper presents a deep learning approach for image segmentation using convolutional neural networks...')";
        abstractInput.disabled = false;
        abstractInput.value = '';
    }

    // ==========================================
    // 4. Recommendation Engine API Call
    // ==========================================
    recommenderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        runRecommendation();
    });

    function runRecommendation() {
        const hasText = abstractInput.value.trim().length > 0;
        const hasFile = state.selectedFile !== null;

        if (!hasText && !hasFile) {
            alert("Please paste an abstract or select a file to continue.");
            return;
        }

        // Toggle visibility
        resultsPlaceholder.style.display = 'none';
        resultsContent.style.display = 'block';
        loadingOverlay.style.display = 'flex';
        extractedKeywordsDiv.innerHTML = '';
        recommendationsList.innerHTML = '';
        
        btnRecommend.disabled = true;

        const formData = new FormData();
        // Weights in fraction
        const wSim = state.weights.sim / 100;
        const wCite = state.weights.cite / 100;
        const wTime = state.weights.time / 100;

        let fetchPromise;

        if (hasFile) {
            formData.append('file', state.selectedFile);
            fetchPromise = fetch(`/api/recommend?sim=${wSim}&cite=${wCite}&time=${wTime}`, {
                method: 'POST',
                body: formData
            });
        } else {
            fetchPromise = fetch(`/api/recommend?sim=${wSim}&cite=${wCite}&time=${wTime}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ abstract: abstractInput.value.trim() })
            });
        }

        fetchPromise
            .then(res => res.json())
            .then(data => {
                loadingOverlay.style.display = 'none';
                btnRecommend.disabled = false;

                if (data.status === 'error') {
                    alert(`Error parsing paper: ${data.message}`);
                    resultsPlaceholder.style.display = 'flex';
                    resultsContent.style.display = 'none';
                    return;
                }

                // Render Extracted Keywords
                if (data.keywords && data.keywords.length > 0) {
                    data.keywords.forEach(([kw, score]) => {
                        const tag = document.createElement('span');
                        tag.className = 'keyword-tag';
                        tag.innerHTML = `${kw} <span class="kw-score">${score}</span>`;
                        extractedKeywordsDiv.appendChild(tag);
                    });
                } else {
                    extractedKeywordsDiv.innerHTML = '<p class="text-muted">No keywords extracted.</p>';
                }

                // Render Recommendations
                if (data.recommendations && data.recommendations.length > 0) {
                    data.recommendations.forEach((rec, index) => {
                        const item = document.createElement('div');
                        item.className = 'rec-item';
                        item.innerHTML = `
                            <span class="rec-rank">#${index + 1}</span>
                            <h4 class="rec-title">${rec.title}</h4>
                            <p class="rec-authors">${rec.authors}</p>
                            <div class="rec-details-row">
                                <span><i class="fa-solid fa-graduation-cap"></i> ${rec.venue}</span>
                                <span><i class="fa-solid fa-calendar"></i> ${rec.year}</span>
                                <span><i class="fa-solid fa-award"></i> ${rec.citations} Citations</span>
                                <span class="tag tag-${getCategoryTag(rec.category)}">${rec.category}</span>
                            </div>
                            <div class="score-pills">
                                <span class="score-pill total">Hybrid Match: ${(rec.hybrid_score * 100).toFixed(1)}%</span>
                                <span class="score-pill">Content: ${(rec.similarity_score * 100).toFixed(1)}%</span>
                                <span class="score-pill">Citation Score: ${(rec.citation_score * 100).toFixed(1)}%</span>
                                <span class="score-pill">Recency Decay: ${(rec.recency_score * 100).toFixed(1)}%</span>
                            </div>
                            <div style="margin-top: 12px; display: flex; gap: 10px;">
                                <button class="btn btn-sm btn-secondary btn-view-rec-abstract" data-id="${rec.id}">
                                    <i class="fa-solid fa-align-left"></i> View Abstract
                                </button>
                            </div>
                        `;
                        recommendationsList.appendChild(item);
                    });

                    // Add click listeners to recommendations view abstract
                    document.querySelectorAll('.btn-view-rec-abstract').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const pId = parseInt(btn.getAttribute('data-id'));
                            showPaperPreview(pId);
                        });
                    });
                } else {
                    recommendationsList.innerHTML = '<p class="text-muted">No similar papers found.</p>';
                }
            })
            .catch(err => {
                loadingOverlay.style.display = 'none';
                btnRecommend.disabled = false;
                alert(`API Error: ${err}`);
                resultsPlaceholder.style.display = 'flex';
                resultsContent.style.display = 'none';
            });
    }

    // Helpers
    function getCategoryTag(category) {
        switch (category) {
            case 'AI/ML': return 'aiml';
            case 'Cybersecurity': return 'security';
            case 'Data Engineering': return 'data';
            case 'HCI': return 'hci';
            case 'Networks & IoT': return 'networks';
            default: return 'aiml';
        }
    }

    // ==========================================
    // 5. Dashboard Metrics & Visualizations
    // ==========================================
    function loadDashboard() {
        fetch('/api/trends')
            .then(res => res.json())
            .then(data => {
                if (data.status !== 'success') return;
                
                const nodes = data.clusters.nodes;
                const labels = data.clusters.labels;
                state.loadedPapers = nodes; // Save nodes to lookup abstracts later

                // 1. Update statistics cards
                document.getElementById('stat-total-papers').textContent = nodes.length;
                
                // Max citations check
                const maxCiteNode = nodes.reduce((max, node) => node.citations > max.citations ? node : max, nodes[0]);
                if (maxCiteNode) {
                    document.getElementById('stat-max-citations').textContent = `${maxCiteNode.citations} (${maxCiteNode.venue})`;
                }
                
                // Top growth field
                if (data.growth && data.growth.length > 0) {
                    const topGrowth = data.growth[0];
                    document.getElementById('stat-hot-field').textContent = `${topGrowth.category} (+${topGrowth.growth_score}%)`;
                }

                // 2. Render K-Means & PCA Scatter Plot
                renderScatterPlot(data.clusters);
                
                // 3. Render Timeline Chart
                renderTimelineChart(data.timeline);
                
                // 4. Render Growth Chart
                renderGrowthChart(data.growth);
            })
            .catch(err => console.error("Error loading dashboard data:", err));
    }

    function renderScatterPlot(clusterData) {
        const ctx = document.getElementById('scatterChart').getContext('2d');
        
        if (state.charts.scatter) {
            state.charts.scatter.destroy();
        }

        // Group points by cluster id
        const datasets = [];
        const clusterColors = [
            'rgba(99, 102, 241, 0.75)',  // Indigo
            'rgba(239, 68, 68, 0.75)',   // Red
            'rgba(14, 165, 233, 0.75)',  // Blue
            'rgba(16, 185, 129, 0.75)',  // Green
            'rgba(245, 158, 11, 0.75)'   // Orange/Yellow
        ];
        
        const clusterBorderColors = [
            '#6366f1', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b'
        ];

        // 5 clusters
        for (let i = 0; i < 5; i++) {
            const clusterPoints = clusterData.nodes.filter(n => n.cluster_id === i).map(n => ({
                x: n.x,
                y: n.y,
                title: n.title,
                authors: n.authors,
                category: n.category,
                year: n.year,
                citations: n.citations,
                id: n.id
            }));
            
            datasets.push({
                label: clusterData.labels[i] || `Cluster ${i + 1}`,
                data: clusterPoints,
                backgroundColor: clusterColors[i],
                borderColor: clusterBorderColors[i],
                borderWidth: 1,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHoverBorderWidth: 2,
                pointHoverBorderColor: '#ffffff'
            });
        }

        state.charts.scatter = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e5e7eb',
                            font: { family: 'Outfit', size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const paper = context.raw;
                                return [
                                    `Title: ${paper.title.substring(0, 50)}...`,
                                    `Authors: ${paper.authors}`,
                                    `Field: ${paper.category} | Citations: ${paper.citations}`,
                                    `PCA Mapping: (${paper.x.toFixed(2)}, ${paper.y.toFixed(2)})`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#6b7280' },
                        title: { display: true, text: 'PCA Component 1', color: '#9ca3af' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#6b7280' },
                        title: { display: true, text: 'PCA Component 2', color: '#9ca3af' }
                    }
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const datasetIdx = elements[0].datasetIndex;
                        const dataIdx = elements[0].index;
                        const paper = datasets[datasetIdx].data[dataIdx];
                        showPaperPreview(paper.id);
                    }
                }
            }
        });
    }

    function renderTimelineChart(timeline) {
        const ctx = document.getElementById('timelineChart').getContext('2d');
        
        if (state.charts.timeline) {
            state.charts.timeline.destroy();
        }

        const colors = ['#6366f1', '#ef4444', '#0ea5e9', '#10b981', '#f59e0b'];
        const datasets = timeline.series.map((s, idx) => ({
            label: s.name,
            data: s.data,
            borderColor: colors[idx],
            backgroundColor: colors[idx] + '1A', // transparent fill
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
        }));

        state.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeline.years,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#e5e7eb', font: { family: 'Outfit', size: 10 } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#6b7280' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#6b7280', stepSize: 1 }
                    }
                }
            }
        });
    }

    function renderGrowthChart(growthData) {
        const ctx = document.getElementById('growthChart').getContext('2d');
        
        if (state.charts.growth) {
            state.charts.growth.destroy();
        }

        const categories = growthData.map(g => g.category);
        const scores = growthData.map(g => g.growth_score);
        
        // Colors mapping based on growth positivity
        const backgroundColors = scores.map(s => s >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)');
        const borderColors = scores.map(s => s >= 0 ? '#10b981' : '#ef4444');

        state.charts.growth = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Trend Growth Index (%)',
                    data: scores,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        ticks: { color: '#6b7280' },
                        title: { display: true, text: 'Growth Rate Ratio (%)', color: '#9ca3af' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#e5e7eb' }
                    }
                }
            }
        });
    }

    // Trigger explicit re-clustering
    document.getElementById('btn-recluster').addEventListener('click', () => {
        loadDashboard();
    });

    // ==========================================
    // 6. Dataset Explore Datatable API
    // ==========================================
    function loadDataset() {
        const { page, limit, search, category } = state.dataset;
        fetch(`/api/papers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category=${category}`)
            .then(res => res.json())
            .then(data => {
                if (data.status !== 'success') return;
                
                // Clear body
                papersTableBody.innerHTML = '';
                
                if (data.papers && data.papers.length > 0) {
                    data.papers.forEach(p => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${p.id}</td>
                            <td>
                                <div class="table-title">${p.title}</div>
                                <div class="table-authors">${p.authors}</div>
                            </td>
                            <td><span class="tag tag-${getCategoryTag(p.category)}">${p.category}</span></td>
                            <td>${p.venue} (${p.year})</td>
                            <td>${p.citations}</td>
                            <td>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-sm btn-secondary btn-view-abstract" data-id="${p.id}"><i class="fa-solid fa-eye"></i> View</button>
                                    <button class="btn btn-sm btn-primary btn-run-recommend" data-id="${p.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> Match</button>
                                </div>
                            </td>
                        `;
                        papersTableBody.appendChild(row);
                    });

                    // Add button listeners
                    document.querySelectorAll('.btn-view-abstract').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const pId = parseInt(btn.getAttribute('data-id'));
                            showPaperPreview(pId);
                        });
                    });

                    document.querySelectorAll('.btn-run-recommend').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const pId = parseInt(btn.getAttribute('data-id'));
                            runSimilarityForPaper(pId);
                        });
                    });

                } else {
                    papersTableBody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align: center; padding: 40px;">No papers match the active search criteria.</td></tr>`;
                }

                // Update pagination controls
                const totalPages = Math.ceil(data.total / limit) || 1;
                paginationInfo.textContent = `Page ${page} of ${totalPages} (Total: ${data.total})`;
                
                btnPrevPage.disabled = page <= 1;
                btnNextPage.disabled = page >= totalPages;
            })
            .catch(err => console.error("Error loading papers list:", err));
    }

    // Pagination Listeners
    btnPrevPage.addEventListener('click', () => {
        if (state.dataset.page > 1) {
            state.dataset.page--;
            loadDataset();
        }
    });

    btnNextPage.addEventListener('click', () => {
        state.dataset.page++;
        loadDataset();
    });

    // Filtering inputs
    datasetSearch.addEventListener('input', () => {
        state.dataset.search = datasetSearch.value;
        state.dataset.page = 1; // reset
        loadDataset();
    });

    datasetCategoryFilter.addEventListener('change', () => {
        state.dataset.category = datasetCategoryFilter.value;
        state.dataset.page = 1; // reset
        loadDataset();
    });

    // Global Search redirect
    globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = globalSearchInput.value.trim();
            if (query) {
                state.dataset.search = query;
                state.dataset.page = 1;
                datasetSearch.value = query;
                switchTab('dataset');
            }
        }
    });

    // ==========================================
    // 7. Preview Modal Handler
    // ==========================================
    function showPaperPreview(paperId) {
        // Query server/cache for abstract
        let paper = state.loadedPapers.find(p => p.id === paperId);
        
        if (!paper) {
            // Fetch dynamically
            fetch(`/api/papers?search=&page=1&limit=1000`)
                .then(res => res.json())
                .then(data => {
                    const found = data.papers.find(p => p.id === paperId);
                    if (found) renderPreviewModal(found);
                });
        } else {
            // Retrieve exact abstract from server since scatter caching only holds basic info
            fetch(`/api/papers?search=${encodeURIComponent(paper.title)}&limit=1`)
                .then(res => res.json())
                .then(data => {
                    const found = data.papers[0];
                    if (found) renderPreviewModal(found);
                });
        }
    }

    function renderPreviewModal(paper) {
        document.getElementById('preview-title').textContent = paper.title;
        document.getElementById('preview-authors').textContent = paper.authors;
        document.getElementById('preview-venue-year').textContent = `${paper.venue} (${paper.year})`;
        document.getElementById('preview-citations').textContent = paper.citations;
        
        const catSpan = document.getElementById('preview-category');
        catSpan.className = `tag tag-${getCategoryTag(paper.category)}`;
        catSpan.textContent = paper.category;
        
        document.getElementById('preview-abstract').textContent = paper.abstract;
        activePreviewAbstract = paper.abstract; // Cache this
        
        previewPaperModal.classList.add('active');
    }

    // Modal Close operations
    function closePreviewModal() {
        previewPaperModal.classList.remove('active');
    }

    btnClosePreview.addEventListener('click', closePreviewModal);
    btnClosePreviewFooter.addEventListener('click', closePreviewModal);
    
    // Close modal on background click
    previewPaperModal.addEventListener('click', (e) => {
        if (e.target === previewPaperModal) closePreviewModal();
    });

    // Use current preview in Recommender input
    btnUseRecommenderInput.addEventListener('click', () => {
        closePreviewModal();
        clearSelectedFile();
        abstractInput.value = activePreviewAbstract;
        switchTab('recommender');
        runRecommendation();
    });

    function runSimilarityForPaper(paperId) {
        // Direct integration from browse table: click recommend
        fetch(`/api/papers?search=&page=1&limit=1000`)
            .then(res => res.json())
            .then(data => {
                const paper = data.papers.find(p => p.id === paperId);
                if (paper) {
                    clearSelectedFile();
                    abstractInput.value = paper.abstract;
                    switchTab('recommender');
                    runRecommendation();
                }
            });
    }

    // ==========================================
    // 8. Add Paper Form Integration
    // ==========================================
    btnOpenAddModal.addEventListener('click', () => {
        addPaperModal.classList.add('active');
    });

    function closeAddModal() {
        addPaperModal.classList.remove('active');
        addPaperForm.reset();
    }

    btnCloseAddModal.addEventListener('click', closeAddModal);
    btnCancelAddModal.addEventListener('click', closeAddModal);
    
    addPaperModal.addEventListener('click', (e) => {
        if (e.target === addPaperModal) closeAddModal();
    });

    addPaperForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const newPaper = {
            title: document.getElementById('paper-title').value.trim(),
            authors: document.getElementById('paper-authors').value.trim(),
            abstract: document.getElementById('paper-abstract').value.trim(),
            year: parseInt(document.getElementById('paper-year').value),
            category: document.getElementById('paper-category').value,
            venue: document.getElementById('paper-venue').value.trim(),
            citations: parseInt(document.getElementById('paper-citations').value || 0)
        };

        fetch('/api/add-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPaper)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert("Paper successfully cataloged and database re-indexed!");
                closeAddModal();
                // Refresh data states
                loadDashboard();
                if (state.activeTab === 'dataset') {
                    loadDataset();
                }
            } else {
                alert(`Error adding paper: ${data.message}`);
            }
        })
        .catch(err => alert(`API Error: ${err}`));
    });

    // ==========================================
    // 9. Startup Operations
    // ==========================================
    // Load dashboard immediately on startup
    loadDashboard();
});
