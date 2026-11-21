import json

with open("data/practice_full_summary.json", encoding="utf-8") as f:
    full = json.load(f)

# Also create practice_summary.json with both format support
summary_list = []
for p in full["parts"]:
    summary_list.append({
        "slug": p["slug"],
        "partNumber": p["partNumber"],
        "name": p["name"],
        "badge": p["badge"],
        "description": p["description"],
        "totalSubTopics": p["testsCount"] + p["lessonsCount"],
        "lessonsCount": p["lessonsCount"],
        "testsCount": p["testsCount"],
        "lessons": p["lessons"],
        "tests": p["tests"],
        "subTopics": p["tests"]  # default fallback
    })

# Add Grammar
summary_list.append({
    "slug": "grammar",
    "name": "Ngữ pháp trọng tâm",
    "description": "38 chuyên đề ngữ pháp TOEIC then chốt kèm quy tắc và câu ví dụ minh họa",
    "totalSubTopics": len(full["grammar"]["topics"]),
    "subTopics": full["grammar"]["topics"],
    "topics": full["grammar"]["topics"]
})

# Add Vocabulary
all_vocab = full["vocabulary"]["byTopic"] + full["vocabulary"]["byPart"]
summary_list.append({
    "slug": "vocabulary",
    "name": "Từ vựng ăn điểm",
    "description": "48 chủ đề từ vựng và 6 bộ từ vựng theo Part",
    "totalSubTopics": len(all_vocab),
    "byTopic": full["vocabulary"]["byTopic"],
    "byPart": full["vocabulary"]["byPart"],
    "subTopics": all_vocab
})

with open("data/practice_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary_list, f, ensure_ascii=False, indent=2)

print("Updated data/practice_summary.json with full rich structure!")
