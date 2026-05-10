from app import app, db, Document
from pathlib import Path

with app.app_context():
    db.create_all()
    # Load existing documents from folder
    documents = {}
    folder = Path('my_documents')
    if folder.exists():
        txt_files = list(folder.glob("*.txt"))
        for file_path in txt_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                doc_name = file_path.stem
                documents[doc_name] = content
    
    for doc_id, content in documents.items():
        if not db.session.get(Document, doc_id):
            new_doc = Document(id=doc_id, content=content)
            db.session.add(new_doc)
    db.session.commit()
    print("Migrated documents to database.")