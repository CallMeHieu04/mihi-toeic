import json
from crawler import api_post, COURSE_IDS

parts_config = [
    {"slug": "part-1-photos", "name": "Part 1: Photos", "description": "Luyện nghe tranh ảnh (6 câu/bài)"},
    {"slug": "part-2-question-response", "name": "Part 2: Question - Response", "description": "Luyện nghe hỏi - đáp (25 câu/bài)"},
    {"slug": "part-3-conversations", "name": "Part 3: Conversations", "description": "Luyện nghe hội thoại ngắn (39 câu/bài)"},
    {"slug": "part-4-short-talks", "name": "Part 4: Short Talks", "description": "Luyện nghe bài nói ngắn (30 câu/bài)"},
    {"slug": "part-5-incomplete-sentences", "name": "Part 5: Incomplete Sentences", "description": "Điền từ vào câu (30 câu/bài)"},
    {"slug": "part-6-text-completion", "name": "Part 6: Text Completion", "description": "Điền từ vào đoạn văn (16 câu/bài)"},
    {"slug": "part-7-single-passages", "name": "Part 7: Single Passages", "description": "Đọc hiểu đoạn đơn (29 câu/bài)"},
    {"slug": "part-7-double-passages", "name": "Part 7: Double Passages", "description": "Đọc hiểu đoạn kép (10 câu/bài)"},
    {"slug": "part-7-triple-passages", "name": "Part 7: Triple Passages", "description": "Đọc hiểu đoạn ba (15 câu/bài)"},
    {"slug": "grammar", "name": "Ngữ pháp trọng tâm", "description": "38 chuyên đề ngữ pháp then chốt TOEIC"},
    {"slug": "vocabulary", "name": "Từ vựng ăn điểm", "description": "48 chủ đề từ vựng và từ vựng theo Part"}
]

practice_data = []

for p in parts_config:
    slug = p["slug"]
    print(f"Fetching {slug}...")
    try:
        res = api_post("/api/get-topics-by-parent-slug", {
            "courseId": COURSE_IDS["practice"],
            "slug": slug,
            "countPracticedUsers": True,
            "topicFields": ["_id", "name", "slug", "orderIndex", "avatar", "shortDescription"],
            "exerciseFields": ["questionsNum", "duration"]
        })
        if res and len(res) > 0:
            parent = res[0]
            children = parent.get("children", [])
            sub_items = []
            for c in children:
                sub_items.append({
                    "id": c.get("_id"),
                    "name": c.get("name"),
                    "slug": c.get("slug"),
                    "questionsNum": c.get("topicExercise", {}).get("questionsNum", 0),
                    "duration": c.get("topicExercise", {}).get("duration", 0)
                })
            practice_data.append({
                "slug": slug,
                "name": p["name"],
                "description": p["description"],
                "totalSubTopics": len(sub_items),
                "subTopics": sub_items
            })
            print(f"  -> {p['name']}: {len(sub_items)} subtopics")
    except Exception as e:
        print(f"  -> Error {slug}: {e}")

with open("c:/Toeic/wed/data/practice_summary.json", "w", encoding="utf-8") as f:
    json.dump(practice_data, f, ensure_ascii=False, indent=2)

print("Saved practice_summary.json successfully!")
