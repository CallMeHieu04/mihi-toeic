import json
import time
from crawler import api_post, COURSE_IDS

parts_config = [
    {
        "slug": "part-1-photos",
        "partNumber": 1,
        "name": "Part 1: Photographs",
        "description": "Luyện nghe tranh ảnh (Mô tả hành động, vị trí, đồ vật)",
        "badge": "Photographs"
    },
    {
        "slug": "part-2-question-response",
        "partNumber": 2,
        "name": "Part 2: Question - Response",
        "description": "Luyện nghe hỏi - đáp (Các dạng câu hỏi Who, Where, When, Why, How, Yes/No)",
        "badge": "Q & A"
    },
    {
        "slug": "part-3-conversations",
        "partNumber": 3,
        "name": "Part 3: Conversations",
        "description": "Luyện nghe hội thoại ngắn giữa 2-3 người (Đoạn thoại công sở, dịch vụ)",
        "badge": "Conversations"
    },
    {
        "slug": "part-4-short-talks",
        "partNumber": 4,
        "name": "Part 4: Short Talks",
        "description": "Luyện nghe bài nói ngắn (Thông báo, tin nhắn thoại, bản tin thời tiết)",
        "badge": "Short Talks"
    },
    {
        "slug": "part-5-incomplete-sentences",
        "partNumber": 5,
        "name": "Part 5: Incomplete Sentences",
        "description": "Điền từ vào câu đơn (Từ loại, thì động từ, giới từ, liên từ)",
        "badge": "Sentences"
    },
    {
        "slug": "part-6-text-completion",
        "partNumber": 6,
        "name": "Part 6: Text Completion",
        "description": "Điền từ vào đoạn văn (Thư tín, thông báo nội bộ, bài báo)",
        "badge": "Text Completion"
    },
    {
        "slug": "part-7-single-passages",
        "partNumber": 7,
        "name": "Part 7: Single Passages",
        "description": "Đọc hiểu đoạn văn đơn (Email, tin nhắn, bài báo, lịch trình)",
        "badge": "Single Passages"
    },
    {
        "slug": "part-7-double-passages",
        "partNumber": 7,
        "name": "Part 7: Double Passages",
        "description": "Đọc hiểu đoạn văn kép (Kết nối thông tin giữa 2 văn bản)",
        "badge": "Double Passages"
    },
    {
        "slug": "part-7-triple-passages",
        "partNumber": 7,
        "name": "Part 7: Triple Passages",
        "description": "Đọc hiểu đoạn văn ba (Phân tích, đối chiếu 3 văn bản)",
        "badge": "Triple Passages"
    }
]

print("1. Fetching Part 1 to 7 structured lessons and practice tests...")
structured_parts = []

for p in parts_config:
    slug = p["slug"]
    print(f"Fetching {slug}...")
    try:
        res = api_post("/api/get-topics-by-parent-slug", {
            "courseId": COURSE_IDS["practice"],
            "slug": slug,
            "countPracticedUsers": False,
            "topicFields": ["_id", "name", "slug", "type", "description", "orderIndex", "avatar"],
            "exerciseFields": ["questionsNum", "duration"]
        })
        if res and len(res) > 0:
            parent = res[0]
            children = parent.get("children", [])
            
            lessons = []
            tests = []
            
            for c in children:
                c_type = c.get("type")
                item = {
                    "id": c.get("_id"),
                    "name": c.get("name").strip(),
                    "slug": c.get("slug"),
                    "orderIndex": c.get("orderIndex", 0)
                }
                
                if c_type == 1:
                    # Lesson (Study guide / theory)
                    item["description"] = c.get("description", "")
                    lessons.append(item)
                else:
                    # Practice Test
                    ex = c.get("topicExercise") or {}
                    item["questionsNum"] = ex.get("questionsNum") or (6 if p["partNumber"] == 1 else (25 if p["partNumber"] == 2 else 30))
                    item["duration"] = ex.get("duration") or 15
                    tests.append(item)
            
            # Sort tests naturally by name (Test 1, Test 2, etc.)
            def sort_key(t):
                import re
                m = re.search(r'\d+', t['name'])
                return int(m.group(0)) if m else 999
            
            tests.sort(key=sort_key)
            lessons.sort(key=lambda l: l.get("orderIndex", 0))

            structured_parts.append({
                "slug": slug,
                "partNumber": p["partNumber"],
                "name": p["name"],
                "badge": p["badge"],
                "description": p["description"],
                "lessonsCount": len(lessons),
                "testsCount": len(tests),
                "lessons": lessons,
                "tests": tests
            })
            print(f"  -> {p['name']}: {len(lessons)} lessons, {len(tests)} tests")
    except Exception as e:
        print(f"  -> Error {slug}: {e}")

print("\n2. Fetching Grammar topics (38 topics)...")
grammar_data = {
    "slug": "grammar",
    "name": "Ngữ pháp trọng tâm",
    "description": "38 chuyên đề ngữ pháp TOEIC then chốt kèm quy tắc và câu ví dụ minh họa",
    "topics": []
}
try:
    res = api_post("/api/get-topics-by-parent-slug", {
        "courseId": COURSE_IDS["practice"],
        "slug": "grammar",
        "topicFields": ["_id", "name", "slug", "type", "description", "orderIndex"],
        "exerciseFields": ["questionsNum", "duration"]
    })
    if res and len(res) > 0:
        children = res[0].get("children", [])
        for c in children:
            grammar_data["topics"].append({
                "id": c.get("_id"),
                "name": c.get("name").strip(),
                "slug": c.get("slug"),
                "description": c.get("description", ""),
                "orderIndex": c.get("orderIndex", 0)
            })
        print(f"  -> Grammar: {len(grammar_data['topics'])} topics loaded")
except Exception as e:
    print(f"  -> Error Grammar: {e}")

print("\n3. Fetching Vocabulary topics (48 topics by topic + 6 by part)...")
vocab_by_topic = []
try:
    res = api_post("/api/get-topics-by-parent-slug", {
        "courseId": COURSE_IDS["practice"],
        "slug": "toeic-vocabulary-by-topic",
        "topicFields": ["_id", "name", "slug", "type", "description", "orderIndex"],
        "exerciseFields": ["questionsNum", "duration"]
    })
    if res and len(res) > 0:
        for c in res[0].get("children", []):
            vocab_by_topic.append({
                "id": c.get("_id"),
                "name": c.get("name").strip(),
                "slug": c.get("slug"),
                "orderIndex": c.get("orderIndex", 0),
                "questionsNum": (c.get("topicExercise") or {}).get("questionsNum", 12)
            })
        print(f"  -> Vocab by topic: {len(vocab_by_topic)} topics loaded")
except Exception as e:
    print(f"  -> Error Vocab by topic: {e}")

vocab_by_part = []
try:
    res = api_post("/api/get-topics-by-parent-slug", {
        "courseId": COURSE_IDS["practice"],
        "slug": "toeic-vocabulary-by-part",
        "topicFields": ["_id", "name", "slug", "type", "description", "orderIndex"],
        "exerciseFields": ["questionsNum", "duration"]
    })
    if res and len(res) > 0:
        for c in res[0].get("children", []):
            vocab_by_part.append({
                "id": c.get("_id"),
                "name": c.get("name").strip(),
                "slug": c.get("slug"),
                "orderIndex": c.get("orderIndex", 0),
                "questionsNum": (c.get("topicExercise") or {}).get("questionsNum", 20)
            })
        print(f"  -> Vocab by part: {len(vocab_by_part)} topics loaded")
except Exception as e:
    print(f"  -> Error Vocab by part: {e}")

final_practice_summary = {
    "parts": structured_parts,
    "grammar": grammar_data,
    "vocabulary": {
        "byTopic": vocab_by_topic,
        "byPart": vocab_by_part
    }
}

with open("c:/Toeic/wed/data/practice_full_summary.json", "w", encoding="utf-8") as f:
    json.dump(final_practice_summary, f, ensure_ascii=False, indent=2)

print("\nSUCCESS! Saved data/practice_full_summary.json with complete lessons and tests.")
