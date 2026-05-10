from flask import Flask, render_template, request, jsonify, session
from ir_system_module import IRSystem, load_documents_from_db, save_document_to_db, delete_document_from_db
from flask_sqlalchemy import SQLAlchemy
import os
from pathlib import Path
import json

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///ir_system.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database model
class Document(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    content = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f'<Document {self.id}>'

# Global IR system instance
ir_system = None
DOCUMENTS_FOLDER = 'my_documents'

def initialize_ir_system():
    """Initialize or reload the IR system"""
    global ir_system
    documents = load_documents_from_db(db, Document)
    if documents:
        ir_system = IRSystem(documents)
        ir_system.build_inverted_index()
        return True
    return False

# Initialize on startup - moved to main

@app.route('/')
def index():
    """Home page with search interface"""
    stats = ir_system.get_document_info() if ir_system else {'doc_count': 0, 'unique_terms': 0}
    return render_template('index.html', stats=stats, doc_count=stats['doc_count'])

@app.route('/search', methods=['GET', 'POST'])
def search():
    """Handle search queries"""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        query = data.get('query', '').strip()
    else:
        query = request.args.get('q', '').strip()

    if not query or not ir_system:
        return jsonify({'success': True, 'results': [], 'query_terms': [], 'count': 0, 'query': query})

    results, query_terms = ir_system.process_query(query)
    
    formatted_results = []
    for doc_id, score in results[:20]:  # Limit to top 20
        content = ir_system.documents.get(doc_id, '')
        snippet = content[:200] + '...' if len(content) > 200 else content
        matching_terms = [term for term in query_terms if term in ir_system.tfidf_weights and doc_id in ir_system.tfidf_weights[term]]
        formatted_results.append({
            'doc_id': doc_id,
            'score': round(score, 4),
            'content': content,
            'snippet': snippet,
            'matching_terms': matching_terms[:5]
        })
    
    return jsonify({
        'success': True,
        'results': formatted_results,
        'query_terms': query_terms,
        'count': len(formatted_results),
        'query': query
    })

@app.route('/documents')
def list_documents():
    """List all documents"""
    if not ir_system:
        return jsonify({'documents': []})
    
    docs = []
    for doc_id, content in ir_system.documents.items():
        docs.append({
            'id': doc_id,
            'content': content,
            'length': len(content),
            'word_count': len(content.split())
        })
    
    return jsonify({'documents': docs})

@app.route('/documents/<doc_id>')
def get_document(doc_id):
    """Get a specific document"""
    if ir_system and doc_id in ir_system.documents:
        return jsonify({
            'id': doc_id,
            'content': ir_system.documents[doc_id]
        })
    return jsonify({'error': 'Document not found'}), 404

@app.route('/documents', methods=['POST'])
def add_document():
    """Add a new document"""
    data = request.json
    doc_id = data.get('id', '').strip()
    content = data.get('content', '').strip()
    
    if not doc_id or not content:
        return jsonify({'error': 'Document ID and content required'}), 400
    
    # Check if document already exists
    if ir_system and doc_id in ir_system.documents:
        return jsonify({'error': 'Document already exists'}), 409
    
    # Save to database
    if save_document_to_db(db, Document, doc_id, content):
        # Reload the system
        initialize_ir_system()
        return jsonify({'success': True, 'message': f'Document "{doc_id}" added successfully'})
    
    return jsonify({'error': 'Failed to save document'}), 500

@app.route('/documents/<doc_id>', methods=['DELETE'])
def remove_document(doc_id):
    """Delete a document"""
    if delete_document_from_db(db, Document, doc_id):
        initialize_ir_system()
        return jsonify({'success': True, 'message': f'Document "{doc_id}" deleted successfully'})
    return jsonify({'error': 'Document not found'}), 404

@app.route('/api/stats')
def get_stats():
    """Get system statistics"""
    if ir_system:
        return jsonify(ir_system.get_document_info())
    return jsonify({'doc_count': 0, 'unique_terms': 0})

@app.route('/api/term/<term>')
def get_term_info(term):
    """Get information about a specific term"""
    if ir_system:
        info = ir_system.get_term_info(term.lower())
        if info:
            return jsonify(info)
    return jsonify({'error': 'Term not found'}), 404

@app.route('/reload')
def reload_system():
    """Reload documents from folder"""
    initialize_ir_system()
    return jsonify({'success': True, 'message': 'System reloaded'})

@app.route('/load_documents', methods=['POST'])
def load_documents():
    """Load documents from a folder and rebuild the index"""
    data = request.get_json(silent=True) or {}
    folder_path = data.get('folder_path', DOCUMENTS_FOLDER)
    documents = load_documents_from_folder(folder_path)

    if not documents:
        return jsonify({'success': False, 'message': f'No documents found in folder "{folder_path}".'})

    global ir_system
    ir_system = IRSystem(documents)
    ir_system.build_inverted_index()

    inverted_index = []
    for term, docs in ir_system.inverted_index.items():
        inverted_index.append({
            'term': term,
            'df': ir_system.df[term],
            'cf': ir_system.cf[term],
            'documents': [{'doc_id': doc_id, 'tf': docs[doc_id]['tf']} for doc_id in docs]
        })

    return jsonify({
        'success': True,
        'doc_count': len(documents),
        'doc_names': list(documents.keys()),
        'inverted_index': inverted_index
    })

@app.route('/use_example', methods=['POST'])
def use_example():
    """Reload the current document set as example documents"""
    if initialize_ir_system():
        return jsonify({
            'success': True,
            'doc_count': ir_system.doc_count,
            'doc_names': list(ir_system.documents.keys())
        })
    return jsonify({'success': False, 'message': 'No example documents available.'})

@app.route('/get_stats')
def get_stats_route():
    """Return statistics for the current document set"""
    if not ir_system:
        return jsonify({'success': False, 'message': 'No documents loaded.'})

    total_documents = len(ir_system.documents)
    total_term_occurrences = sum(ir_system.cf.values())
    avg_doc_length = total_term_occurrences / total_documents if total_documents else 0
    most_common_terms = sorted(
        [{'term': term, 'cf': count} for term, count in ir_system.cf.items()],
        key=lambda item: item['cf'],
        reverse=True
    )[:10]

    return jsonify({
        'success': True,
        'total_documents': total_documents,
        'avg_doc_length': avg_doc_length,
        'vocab_size': len(ir_system.inverted_index),
        'most_common_terms': most_common_terms
    })

if __name__ == '__main__':
    # Create database tables
    with app.app_context():
        db.create_all()
        initialize_ir_system()
    # Create documents folder if it doesn't exist (for any file operations, but now using DB)
    Path(DOCUMENTS_FOLDER).mkdir(exist_ok=True)
    app.run(debug=True, port=5000)