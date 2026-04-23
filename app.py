from flask import Flask, jsonify
from models import SessionLocal, ContentItem

app = Flask(__name__)

@app.route("/api/content")
def get_content():
    db = SessionLocal()
    items = db.query(ContentItem).all()

    result = []
    for item in items:
        result.append({
            "id": item.id,
            "title": item.title,
            "type": item.type,
            "description": item.description,
            "media_url": item.media_url
        })

    db.close()
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)