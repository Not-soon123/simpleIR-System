// Global variables
let currentIRSystem = null;
let currentResults = [];

// Tab switching
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update active states
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
        
        // Refresh data when switching tabs
        if (tab === 'index') {
            refreshInvertedIndex();
        } else if (tab === 'stats') {
            refreshStatistics();
        }
    });
});

// Load documents from folder
const loadFolderBtn = document.getElementById('load-folder-btn');
if (loadFolderBtn) {
    loadFolderBtn.addEventListener('click', async () => {
        const folderPathInput = document.getElementById('folder-path');
        const folderPath = folderPathInput ? folderPathInput.value.trim() || 'my_documents' : 'my_documents';
        showLoaderStatus('Loading documents...', 'info');
        
        try {
            const response = await fetch('/load_documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: folderPath })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showLoaderStatus(`✅ Successfully loaded ${data.doc_count} documents!`, 'success');
                displayDocumentInfo(data.doc_names);
                showToast(`${data.doc_count} documents loaded successfully`, 'success');
            } else {
                showLoaderStatus(`❌ ${data.message}`, 'error');
            }
        } catch (error) {
            showLoaderStatus('❌ Error loading documents', 'error');
            console.error(error);
        }
    });
}

// Load example documents
const loadExampleBtn = document.getElementById('load-example-btn');
if (loadExampleBtn) {
    loadExampleBtn.addEventListener('click', async () => {
        showLoaderStatus('Loading example documents...', 'info');
        
        try {
            const response = await fetch('/use_example', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                showLoaderStatus(`✅ Successfully loaded ${data.doc_count} example documents!`, 'success');
                displayDocumentInfo(data.doc_names);
                showToast('Example documents loaded successfully', 'success');
            }
        } catch (error) {
            showLoaderStatus('❌ Error loading example documents', 'error');
            console.error(error);
        }
    });
}

// Search functionality
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
if (searchBtn) searchBtn.addEventListener('click', performSearch);
if (searchInput) searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

function showResultsLoading() {
    const loading = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    if (loading) {
        loading.style.display = 'block';
    }
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
}

async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query) {
        showToast('Please enter a search query', 'warning');
        return;
    }
    
    showResultsLoading();
    
    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResults(data);
            displayQueryInfo(data);
        } else {
            showToast(data.message || 'Search failed', 'error');
        }
    } catch (error) {
        showToast('Error performing search', 'error');
        console.error(error);
    }
}

function displayResults(data) {
    const resultsContainer = document.getElementById('results-container');
    const resultsSection = document.getElementById('results-section');
    const resultsCount = document.getElementById('results-count');
    
    if (data.results.length === 0) {
        resultsContainer.innerHTML = '<div class="loading">No results found. Try different keywords.</div>';
        resultsCount.textContent = '(0)';
    } else {
        resultsCount.textContent = `(${data.results.length})`;
        
        resultsContainer.innerHTML = data.results.map(result => `
            <div class="result-item" onclick="toggleResultExpand(this, '${escapeHtml(result.doc_id)}')">
                <div class="result-header">
                    <span class="result-doc-id">📄 ${escapeHtml(result.doc_id)}</span>
                    <span class="result-score">Score: ${result.score}</span>
                </div>
                <div class="result-snippet">
                    ${highlightTerms(result.snippet, data.query_terms)}
                </div>
                <div class="result-full-content" id="content-${escapeHtml(result.doc_id)}">
                    ${highlightTerms(result.content, data.query_terms)}
                </div>
            </div>
        `).join('');
    }
    
    resultsSection.style.display = 'block';
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    currentResults = data.results;
}

function displayQueryInfo(data) {
    const queryInfo = document.getElementById('query-info');
    queryInfo.innerHTML = `
        <strong>Query:</strong> "${escapeHtml(data.query)}"<br>
        <strong>Processed terms:</strong> ${data.query_terms.length > 0 ? data.query_terms.join(', ') : 'No valid terms found'}
    `;
    queryInfo.style.display = 'block';
}

function displayDocumentInfo(docNames) {
    const docInfo = document.getElementById('doc-info');
    const docCount = document.getElementById('doc-count');
    const docList = document.getElementById('doc-list');
    
    docCount.textContent = docNames.length;
    docList.innerHTML = docNames.map(name => `<span class="doc-tag">📄 ${escapeHtml(name)}</span>`).join('');
    docInfo.style.display = 'block';
}

// Inverted Index display
async function refreshInvertedIndex() {
    try {
        const response = await fetch('/load_documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: 'my_documents' })
        });
        
        const data = await response.json();
        
        if (data.success && data.inverted_index) {
            displayInvertedIndex(data.inverted_index);
        } else {
            document.getElementById('index-display').innerHTML = '<div class="loading">No documents loaded. Please load documents first.</div>';
        }
    } catch (error) {
        console.error(error);
    }
}

function displayInvertedIndex(indexData) {
    const indexDisplay = document.getElementById('index-display');
    const filterInput = document.getElementById('index-search');
    
    function renderIndex(filter = '') {
        const filteredData = indexData.filter(item => 
            item.term.toLowerCase().includes(filter.toLowerCase())
        );
        
        if (filteredData.length === 0) {
            indexDisplay.innerHTML = '<div class="loading">No terms found</div>';
            return;
        }
        
        const html = `
            <table class="index-table">
                <thead>
                    <tr>
                        <th>Term</th>
                        <th>DF</th>
                        <th>CF</th>
                        <th>Documents</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredData.map(item => `
                        <tr>
                            <td class="term-highlight">${escapeHtml(item.term)}</td>
                            <td>${item.df}</td>
                            <td>${item.cf}</td>
                            <td>
                                ${item.documents.map(doc => 
                                    `${escapeHtml(doc.doc_id)} (${doc.tf})`
                                ).join(', ')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        indexDisplay.innerHTML = html;
    }
    
    renderIndex();
    
    filterInput.oninput = () => renderIndex(filterInput.value);
}

// Statistics display
async function refreshStatistics() {
    try {
        const response = await fetch('/get_stats');
        const data = await response.json();
        
        if (data.success) {
            displayStatistics(data);
        } else {
            document.getElementById('stats-container').innerHTML = '<div class="loading">No statistics available. Please load documents first.</div>';
        }
    } catch (error) {
        console.error(error);
    }
}

function displayStatistics(stats) {
    const statsContainer = document.getElementById('stats-container');
    
    const html = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Documents</h3>
                <p>${stats.total_documents}</p>
            </div>
            <div class="stat-card">
                <h3>Average Document Length</h3>
                <p>${stats.avg_doc_length.toFixed(2)} terms</p>
            </div>
            <div class="stat-card">
                <h3>Vocabulary Size</h3>
                <p>${stats.vocab_size} unique terms</p>
            </div>
            <div class="stat-card">
                <h3>Most Common Terms</h3>
                <ul>
                    ${stats.most_common_terms.map(term => `<li>${escapeHtml(term.term)} (${term.cf} occurrences)</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    statsContainer.innerHTML = html;
}

// Utility functions
function showLoaderStatus(message, type) {
    const loaderStatus = document.getElementById('loader-status');
    loaderStatus.textContent = message;
    loaderStatus.className = `loader-status ${type}`;
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }           , 3000);
}

function highlightTerms(text, terms) {
    if (!terms || terms.length === 0) return escapeHtml(text);
    
    const escapedTerms = terms.map(term => escapeRegExp(term));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toggleResultExpand(element, docId) {
    const contentDiv = document.getElementById(`content-${docId}`);
    if (contentDiv.style.display === 'block') {
        contentDiv.style.display = 'none';
        element.classList.remove('expanded');
    } else {
        contentDiv.style.display = 'block';
        element.classList.add('expanded');
    }
}