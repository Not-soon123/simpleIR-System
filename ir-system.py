import math
from collections import defaultdict
import re
import os
from pathlib import Path

class IRSystem:
    def __init__(self, documents):
        self.documents = documents
        self.doc_count = len(documents)
        self.inverted_index = defaultdict(dict)
        self.df = defaultdict(int)
        self.cf = defaultdict(int)
        self.doc_lengths = {}
    
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
        
        self.tfidf_weights = defaultdict(dict)
        for term, docs in self.inverted_index.items():
            idf = math.log(self.doc_count / self.df[term])
            for doc_id, data in docs.items():
                tf = data['tf']
                tfidf = tf * idf
                self.tfidf_weights[term][doc_id] = tfidf
        
        for doc_id in self.documents.keys():
            norm = 0
            for term in self.tfidf_weights:
                if doc_id in self.tfidf_weights[term]:
                    norm += self.tfidf_weights[term][doc_id] ** 2
            self.doc_lengths[doc_id] = math.sqrt(norm)
    
    def display_inverted_index(self):
        """Display inverted index in readable format"""
        print("\n" + "="*80)
        print("INVERTED INDEX")
        print("="*80)
        print(f"{'Term':<15} {'DocID':<10} {'TF':<6} {'Positions':<20} {'DF':<6} {'CF':<6}")
        print("-"*80)
        
        for term in sorted(self.inverted_index.keys()):
            df = self.df[term]
            cf = self.cf[term]
            first = True
            for doc_id in sorted(self.inverted_index[term].keys()):
                tf = self.inverted_index[term][doc_id]['tf']
                positions = self.inverted_index[term][doc_id]['positions']
                if first:
                    print(f"{term:<15} {doc_id:<10} {tf:<6} {str(positions):<20} {df:<6} {cf:<6}")
                    first = False
                else:
                    print(f"{'':<15} {doc_id:<10} {tf:<6} {str(positions):<20} {'':<6} {'':<6}")
        print("="*80)
    
    def process_query(self, query_text):
        """Convert query to vector and compute similarities"""
        query_terms = self.preprocess(query_text)
        
        if not query_terms:
            print("\n⚠️ No valid terms found after preprocessing")
            return [], []
        
        query_tf = defaultdict(int)
        for term in query_terms:
            query_tf[term] += 1
        
        query_vector = {}
        for term, tf in query_tf.items():
            if term in self.df:
                idf = math.log(self.doc_count / self.df[term])
                query_vector[term] = tf * idf
            else:
                print(f"\n⚠️ Term '{term}' not found in any document")
        
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
        
        return ranked_docs, query_terms
    
    def display_query_results(self, query_text):
        """Display ranked results for a query"""
        ranked_docs, query_terms = self.process_query(query_text)
        
        print(f"\n{'='*80}")
        print(f"QUERY: \"{query_text}\"")
        if query_terms:
            print(f"Processed terms: {query_terms}")
        print(f"{'='*80}")
        
        if not ranked_docs:
            print("No results found.")
            return
        
        print(f"{'Rank':<6} {'DocID':<12} {'Score':<12} {'Document Content (first 80 chars)'}")
        print("-"*80)
        
        results_count = 0
        for rank, (doc_id, score) in enumerate(ranked_docs, 1):
            if score > 0:
                content = self.documents[doc_id][:80] + "..." if len(self.documents[doc_id]) > 80 else self.documents[doc_id]
                print(f"{rank:<6} {doc_id:<12} {score:.4f}     {content}")
                results_count += 1
        
        if results_count == 0:
            print("No relevant documents found")
        
        print("="*80)

def load_documents_from_folder(folder_path):
    """Load all text files from a folder as documents"""
    documents = {}
    
    # Create folder if it doesn't exist
    Path(folder_path).mkdir(exist_ok=True)
    
    # Check if folder is empty
    txt_files = list(Path(folder_path).glob("*.txt"))
    
    if not txt_files:
        print(f"\n⚠️ No .txt files found in '{folder_path}' folder!")
        print(f"Please add some text files or create them.")
        return None
    
    for file_path in txt_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            doc_name = file_path.stem  # Use filename without extension as doc ID
            documents[doc_name] = content
    
    return documents

def load_documents_from_strings():
    """Alternative: Load from predefined strings (for quick testing)"""
    documents = {
        "Doc1": "The quick brown fox jumps over the lazy dog near the river bank.",
        "Doc2": "A dog is a loyal pet that loves to play fetch with its owner.",
        "Doc3": "Cats are independent pets and often sleep in sunny places.",
        "Doc4": "The fox is clever and quick but dog is loyal and friendly.",
        "Doc5": "Many people keep dogs as pets because they are loyal companions."
    }
    return documents

def create_sample_documents():
    """Create sample text files for demonstration"""
    folder = "my_documents"
    Path(folder).mkdir(exist_ok=True)
    
    sample_docs = {
        "sports": "Football is the most popular sport in the world. Many people watch soccer matches every week.",
        "technology": "Artificial intelligence and machine learning are transforming the technology industry rapidly.",
        "nature": "The Amazon rainforest is home to incredible biodiversity and plays a crucial role in Earth's climate.",
        "programming": "Python is a versatile programming language used for web development and data science.",
        "music": "Classical music has influenced generations of musicians and continues to inspire new artists."
    }
    
    for doc_name, content in sample_docs.items():
        file_path = Path(folder) / f"{doc_name}.txt"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    print(f"✅ Created {len(sample_docs)} sample documents in '{folder}/' folder")

# Main Menu System
if __name__ == "__main__":
    print("\n" + "="*80)
    print("📚 DYNAMIC DOCUMENT IR SYSTEM")
    print("="*80)
    
    while True:
        print("\n📋 MENU:")
        print("1. Load documents from text file folder")
        print("2. Create sample documents (for testing)")
        print("3. Use built-in example documents")
        print("4. Exit")
        
        choice = input("\n👉 Enter your choice (1-4): ").strip()
        
        if choice == '1':
            folder_path = input("Enter folder path (default: 'my_documents'): ").strip()
            if not folder_path:
                folder_path = "my_documents"
            
            documents = load_documents_from_folder(folder_path)
            if documents and len(documents) > 0:
                print(f"\n✅ Loaded {len(documents)} documents from '{folder_path}'")
                print(f"Documents: {', '.join(documents.keys())}")
                
                # Build IR system
                ir_system = IRSystem(documents)
                ir_system.build_inverted_index()
                ir_system.display_inverted_index()
                
                # Interactive query
                ir_system.display_inverted_index()  # Show index before querying
                
                print("\n" + "="*80)
                print("🔍 Starting interactive query session")
                print("="*80)
                
                query_count = 0
                while True:
                    print("\n" + "-"*40)
                    query = input("\n💬 Enter your query (or 'back' to return to menu, 'exit' to quit): ").strip()
                    
                    if query.lower() == 'back':
                        break
                    elif query.lower() in ['exit', 'quit']:
                        print("\n👋 Goodbye!")
                        exit()
                    elif not query:
                        print("⚠️ Please enter a valid query")
                        continue
                    
                    query_count += 1
                    print(f"\n📝 Query #{query_count}")
                    ir_system.display_query_results(query)
            else:
                print("\n❌ No documents loaded. Please add .txt files to the folder first.")
        
        elif choice == '2':
            create_sample_documents()
            print("\n✅ Sample documents created! Now choose option 1 to load them.")
        
        elif choice == '3':
            print("\n📖 Using built-in example documents...")
            documents = load_documents_from_strings()
            ir_system = IRSystem(documents)
            ir_system.build_inverted_index()
            ir_system.display_inverted_index()
            
            # Interactive query
            print("\n" + "="*80)
            print("🔍 Starting interactive query session")
            print("="*80)
            
            query_count = 0
            while True:
                print("\n" + "-"*40)
                query = input("\n💬 Enter your query (or 'back' to return to menu, 'exit' to quit): ").strip()
                
                if query.lower() == 'back':
                    break
                elif query.lower() in ['exit', 'quit']:
                    print("\n👋 Goodbye!")
                    exit()
                elif not query:
                    print("⚠️ Please enter a valid query")
                    continue
                
                query_count += 1
                print(f"\n📝 Query #{query_count}")
                ir_system.display_query_results(query)
        
        elif choice == '4':
            print("\n👋 Goodbye!")
            break
        
        else:
            print("\n❌ Invalid choice. Please enter 1, 2, 3, or 4.")