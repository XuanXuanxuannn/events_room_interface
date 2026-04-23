from models import SessionLocal, ContentItem

db = SessionLocal()
items = db.query(ContentItem).all()

for item in items:
    print(item.id, item.title, item.type)

db.close()