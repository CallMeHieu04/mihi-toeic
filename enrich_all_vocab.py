import json
import os
import urllib.request
import re
import html
import time

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def extract_meaning_vi(vi_html):
    if not vi_html:
        return ''
    m = re.search(r'<strong>(.*?)</strong>', vi_html)
    if m:
        return html.unescape(m.group(1)).strip()
    clean = re.sub(r'<[^>]+>', '', vi_html).strip()
    return clean[:60]

def clean_html(text):
    if not text:
        return ''
    clean = re.sub(r'<[^>]+>', '', text).strip()
    return html.unescape(clean)

with open(os.path.join(DATA_DIR, 'practice_full_summary.json'), encoding='utf-8') as f:
    full = json.load(f)

vocab_topics = full['vocabulary']['byTopic'] + full['vocabulary']['byPart']
print(f"Enriching {len(vocab_topics)} vocabulary topics with flashcard data...")

for idx, t in enumerate(vocab_topics):
    topic_id = t['id']
    topic_name = t['name']
    file_path = os.path.join(DATA_DIR, f"{topic_id}.json")
    
    # Fetch raw cards
    try:
        url = 'https://v2.estudyme.com/api/get-card-by-topic-id'
        req = urllib.request.Request(
            url,
            data=json.dumps({'topicId': topic_id}).encode(),
            headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            cards = json.loads(resp.read().decode('utf-8'))
            
        flashcards = []
        for c in cards:
            q = c.get('question') or {}
            a = c.get('answer') or {}
            
            word = (q.get('text') or '').strip()
            phonetic = (q.get('hint') or '').strip()
            
            img = q.get('image') or ''
            if img and not img.startswith('http'):
                img = f"https://storage.googleapis.com/{img}"
                
            sound = q.get('sound') or ''
            
            meanings_en = a.get('texts') or []
            meaning_en = meanings_en[0] if meanings_en else ''
            
            map_lang = a.get('mapLangHint') or {}
            ex_vi_html = map_lang.get('vi') or ''
            ex_en_html = a.get('hint') or ''
            
            meaning_vi = extract_meaning_vi(ex_vi_html)
            
            flashcards.append({
                'id': c.get('_id'),
                'word': word,
                'phonetic': phonetic,
                'imageUrl': img,
                'audioUrl': sound,
                'meaningVi': meaning_vi,
                'meaningEn': meaning_en,
                'exampleEnHtml': ex_en_html,
                'exampleViHtml': ex_vi_html,
                'exampleEn': clean_html(ex_en_html),
                'exampleVi': clean_html(ex_vi_html)
            })
            
        # Load existing json or create new
        existing_data = {}
        if os.path.exists(file_path):
            try:
                with open(file_path, encoding='utf-8') as f:
                    existing_data = json.load(f)
            except Exception:
                existing_data = {}
                
        existing_data['topicId'] = topic_id
        existing_data['title'] = f"Từ vựng: {topic_name}"
        existing_data['flashcards'] = flashcards
        existing_data['totalFlashcards'] = len(flashcards)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)
            
        print(f"[{idx+1}/{len(vocab_topics)}] {topic_name}: {len(flashcards)} flashcards enriched.")
        time.sleep(0.05)
    except Exception as e:
        print(f"[{idx+1}/{len(vocab_topics)}] Error {topic_name} ({topic_id}): {e}")

print("\nSUCCESS! All vocabulary topics enriched with Flashcards.")
