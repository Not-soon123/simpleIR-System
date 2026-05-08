import math
from collections import defaultdict
import re
import os
from pathlib import Path
import json

class IRSystem:
    def __init__(self, documents=None):
        self.documents = documents or {}
        self.doc_count = len(self.documents)
        self.inverted_index = defaultdict(dict)
        self.df = defaultdict(int)
        self.cf = defaultdict(int)
        self.doc_lengths = {}
        self.tfidf_weights = defaultdict(dict)
    
    def preprocess(self, text):
        """Tokenize, lowercase, remove punctuation/stopwords, stem"""
        stopwords = {'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 
                     'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 
                     'to', 'was', 'were', 'will', 'with', 'the', 'this', 'that', 'these', 'those'}
        
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)
        tokens = text.split()
        
        stemmed_tokens = []
        for token in tokens:
            if token not in stopwords and len(token) > 2:
                if token.endswith('ing'):
                    token = token[:-3]
                elif token.endswith('ed'):
                    token = token[:-2]
                elif token.endswith('s') and not token.endswith('ss'):
                    token = token[:-1]
                stemmed_tokens.append(token)
        
        return stemmed_tokens
    
    def build_inverted_index(self):
        """Build inverted index with TF, DF, CF, and positions"""
        for doc_id, doc_text in self.documents.items():
            tokens = self.preprocess(doc_text)
            
            term_positions = defaultdict(list)
            for pos, term in enumerate(tokens):
                term_positions[term].append(pos)
            
            for term, positions in term_positions.items():
                tf = len(positions)
                self.inverted_index[term][doc_id] = {
                    'tf': tf,
                    'positions': positions
                }
                self.cf[term] += tf
            
            for term in set(tokens):
                self.df[term] += 1
        
        # Calculate TF-IDF weights
        for term, docs in self.inverted_index.items():
            idf = math.log(self.doc_count / self.df[term]) if self.doc_count > 0 else 0
            for doc_id, data in docs.items():
                tf = data['tf']
                tfidf = tf * idf
                self.tfidf_weights[term][doc_id] = tfidf
        
        # Calculate document lengths
        for doc_id in self.documents.keys():
            norm = 0
            for term in self.tfidf_weights:
                if doc_id in self.tfidf_weights[term]:
                    norm += self.tfidf_weights[term][doc_id] ** 2
            self.doc_lengths[doc_id] = math.sqrt(norm) if norm > 0 else 1
        
        return True
    
    def process_query(self, query_text):
        """Convert query to vector and compute similarities"""
        query_terms = self.preprocess(query_text)
        
        if not query_terms or self.doc_count == 0:
            return [], query_terms
        
        query_tf = defaultdict(int)
        for term in query_terms:
            query_tf[term] += 1
        
        query_vector = {}
        for term, tf in query_tf.items():
            if term in self.df:
                idf = math.log(self.doc_count / self.df[term])
                query_vector[term] = tf * idf
        
        if not query_vector:
            return [], query_terms
        
        query_norm = math.sqrt(sum(w**2 for w in query_vector.values()))
        
        similarities = {}
        for doc_id in self.documents.keys():
            dot_product = 0
            for term, q_weight in query_vector.items():
                if term in self.tfidf_weights and doc_id in self.tfidf_weights[term]:
                    dot_product += q_weight * self.tfidf_weights[term][doc_id]
            
            if self.doc_lengths[doc_id] > 0 and query_norm > 0:
                similarity = dot_product / (self.doc_lengths[doc_id] * query_norm)
            else:
                similarity = 0
            
            similarities[doc_id] = similarity
        
        ranked_docs = sorted(similarities.items(), key=lambda x: x[1], reverse=True)
        
        # Return only results with positive scores
        return [(doc_id, score) for doc_id, score in ranked_docs if score > 0], query_terms
    
    def get_document_info(self):
        """Get document metadata"""
        return {
            'doc_count': self.doc_count,
            'unique_terms': len(self.inverted_index),
            'total_term_occurrences': sum(self.cf.values()),
            'documents': list(self.documents.keys())
        }
    
    def get_term_info(self, term):
        """Get information about a specific term"""
        if term in self.inverted_index:
            return {
                'df': self.df[term],
                'cf': self.cf[term],
                'idf': math.log(self.doc_count / self.df[term]),
                'documents': list(self.inverted_index[term].keys())
            }
        return None

def load_documents_from_folder(folder_path):
    """Load all text files from a folder as documents"""
    documents = {}
    folder = Path(folder_path)
    folder.mkdir(exist_ok=True)
    
    txt_files = list(folder.glob("*.txt"))
    
    for file_path in txt_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            doc_name = file_path.stem
            documents[doc_name] = content
    
    return documents

def save_document(folder_path, doc_name, content):
    """Save a new document to the folder"""
    folder = Path(folder_path)
    folder.mkdir(exist_ok=True)
    file_path = folder / f"{doc_name}.txt"
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True

def delete_document(folder_path, doc_name):
    """Delete a document from the folder"""
    file_path = Path(folder_path) / f"{doc_name}.txt"
    if file_path.exists():
        file_path.unlink()
        return True
    return False