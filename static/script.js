// Global variables
let currentIRSystem = null;
let currentResults = [];

// Add Document Modal Functionality
document.addEventListener('DOMContentLoaded', function() {
    const showAddDocBtn = document.getElementById('showAddDocBtn');
    const addDocModal = document.getElementById('addDocModal');
    const addDocForm = document.getElementById('addDocForm');
    const cancelBtn = document.querySelector('#addDocModal .cancel-btn');
    const closeBtn = document.querySelector('#addDocModal .close-btn');
    
    // Open modal
    if (showAddDocBtn) {
        showAddDocBtn.addEventListener('click', () => {
            if (addDocModal) {
                addDocModal.style.display = 'block';
                addDocForm.reset();
            }
        });
    }
    
    // Close modal functions
    function closeModal() {
        if (addDocModal) {
            addDocModal.style.display = 'none';
        }
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === addDocModal) {
            closeModal();
        }
    });
    
    // Handle form submission
    if (addDocForm) {
        addDocForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const docId = document.getElementById('docId').value.trim();
            const docContent = document.getElementById('docContent').value.trim();
            
            if (!docId || !docContent) {
                showToast('Please fill in all fields', 'warning');
                return;
            }
            
            // Show loading state
            const submitBtn = addDocForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            
            try {
                const response = await fetch('/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        id: docId, 
                        content: docContent 
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast(`Document "${docId}" added successfully!`, 'success');
                    closeModal();
                    addDocForm.reset();
                    // Reload documents
                    loadAndDisplayDocuments();
                } else {
                    showToast(data.error || data.message || 'Failed to add document', 'error');
                }
            } catch (error) {
                showToast('Error adding document', 'error');
                console.error(error);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

// Load and display documents
async function loadAndDisplayDocuments() {
    if (window.USER_ROLE !== 'admin') {
        return;
    }
    try {
        const response = await fetch('/documents');
        const data = await response.json();
        
        if (data.documents && data.documents.length > 0) {
            displayDocuments(data.documents);
        } else {
            const documentsList = document.getElementById('documentsList');
            if (documentsList) {
                documentsList.innerHTML = '<div class="no-documents">No documents loaded yet. Add or load documents to get started.</div>';
            }
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// Display documents in grid
function displayDocuments(documents) {
    const documentsList = document.getElementById('documentsList');
    if (!documentsList) return;
    
    if (documents.length === 0) {
        documentsList.innerHTML = '<div class="no-documents">No documents loaded yet.</div>';
        return;
    }
    
    const html = documents.map(doc => `
        <div class="document-card">
            <div class="document-header">
                <h3><i class="fas fa-file-alt"></i> ${escapeHtml(doc.id)}</h3>
                <span class="document-size">${doc.word_count} words</span>
            </div>
            <div class="document-preview">
                ${escapeHtml(doc.content.substring(0, 150))}${doc.content.length > 150 ? '...' : ''}
            </div>
            <div class="document-actions">
                <button class="btn-small" onclick="viewDocument('${escapeHtml(doc.id)}')">View</button>
                <button class="btn-small btn-danger" onclick="deleteDocument('${escapeHtml(doc.id)}')">Delete</button>
            </div>
        </div>
    `).join('');
    
    documentsList.innerHTML = html;
}

// View document
function viewDocument(docId) {
    const viewDocModal = document.getElementById('viewDocModal');
    const viewDocTitle = document.getElementById('viewDocTitle');
    const viewDocContent = document.getElementById('viewDocContent');
    
    fetch(`/documents/${docId}`)
        .then(response => response.json())
        .then(data => {
            if (data.id) {
                viewDocTitle.textContent = `Document: ${escapeHtml(data.id)}`;
                viewDocContent.textContent = data.content;
                viewDocModal.style.display = 'block';
            }
        })
        .catch(error => {
            showToast('Error loading document', 'error');
            console.error(error);
        });
}

// Delete document
async function deleteDocument(docId) {
    if (!confirm(`Are you sure you want to delete "${docId}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/documents/${docId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`Document "${docId}" deleted successfully!`, 'success');
            loadAndDisplayDocuments();
        } else {
            showToast(data.error || 'Failed to delete document', 'error');
        }
    } catch (error) {
        showToast('Error deleting document', 'error');
        console.error(error);
    }
}

// Close view document modal and setup on page load
document.addEventListener('DOMContentLoaded', function() {
    const viewDocModal = document.getElementById('viewDocModal');
    const closeBtn = document.querySelector('#viewDocModal .close-btn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (viewDocModal) viewDocModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === viewDocModal) {
            viewDocModal.style.display = 'none';
        }
    });
    
    // Load documents on page load only for admin users
    if (window.USER_ROLE === 'admin') {
        loadAndDisplayDocuments();
    }
});

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
                showLoaderStatus(`<i class="fas fa-check-circle"></i> Successfully loaded ${data.doc_count} documents!`, 'success');
                displayDocumentInfo(data.doc_names);
                showToast(`${data.doc_count} documents loaded successfully`, 'success');
            } else {
                showLoaderStatus(`<i class="fas fa-exclamation-circle"></i> ${data.message}`, 'error');
            }
        } catch (error) {
            showLoaderStatus('<i class="fas fa-exclamation-circle"></i> Error loading documents', 'error');
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
                showLoaderStatus(`<i class="fas fa-check-circle"></i> Successfully loaded ${data.doc_count} example documents!`, 'success');
                displayDocumentInfo(data.doc_names);
                showToast('Example documents loaded successfully', 'success');
            }
        } catch (error) {
            showLoaderStatus('<i class="fas fa-exclamation-circle"></i> Error loading example documents', 'error');
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
                    <span class="result-doc-id"><i class="fas fa-file-alt"></i> ${escapeHtml(result.doc_id)}</span>
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
    docList.innerHTML = docNames.map(name => `<span class="doc-tag"><i class="fas fa-file-alt"></i> ${escapeHtml(name)}</span>`).join('');
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