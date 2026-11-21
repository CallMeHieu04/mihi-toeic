"""
TOEIC Test Pro / EstudyMe Data Scraper & Parser
================================================
Công cụ cào và chuẩn hóa toàn bộ dữ liệu từ EstudyMe / TOEIC Test Pro:
- Danh sách đề thi Full Test (200 câu), Mini Test (100 câu), Luyện tập Part 1-7
- Câu hỏi, các lựa chọn (A, B, C, D), đáp án đúng
- Giải thích chi tiết, Audio MP3, Hình ảnh minh họa, Bản dịch tiếng Việt & Transcript
"""

import os
import json
import argparse
import urllib.request
import urllib.error
from typing import Dict, List, Any

BASE_API = "https://v2.estudyme.com"
COURSE_IDS = {
    "practice": "611220911e6e0c7cbe105835",   # Part 1 -> Part 7, Grammar, Vocabulary
    "tests": "619da03e776cf622cda357fb"       # Full Test, Mini Test, Simulation Test
}

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def api_post(endpoint: str, payload: dict) -> Any:
    url = f"{BASE_API}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_test_list(slug: str = "full-test") -> List[Dict[str, Any]]:
    """Lấy danh sách các đề thi theo slug (full-test, minitest)"""
    payload = {
        "courseId": COURSE_IDS["tests"],
        "slug": slug,
        "countPracticedUsers": True,
        "topicFields": ["_id", "name", "avatar", "courseId", "orderIndex", "shortDescription", "slug", "accessLevel", "topicNew"],
        "exerciseFields": ["questionsNum", "duration", "topicSetting", "topicSettingId", "baremScore"]
    }
    data = api_post("/api/get-topics-by-parent-slug", payload)
    if data and len(data) > 0:
        return data[0].get("children", [])
    return []


def get_practice_topics() -> List[Dict[str, Any]]:
    """Lấy danh sách các bài luyện tập theo Part (Part 1 - 7, Grammar, Vocab)"""
    slugs = [
        "part-1-photos", "part-2-question-response", "part-3-conversations",
        "part-4-short-talks", "part-5-incomplete-sentences",
        "part-6-text-completion", "part-7-single-passages",
        "part-7-double-passages", "part-7-triple-passages", "grammar", "vocabulary"
    ]
    results = []
    for slug in slugs:
        payload = {
            "courseId": COURSE_IDS["practice"],
            "slug": slug,
            "countPracticedUsers": True,
            "topicFields": ["_id", "name", "avatar", "courseId", "orderIndex", "shortDescription", "slug"],
            "exerciseFields": ["questionsNum", "duration"]
        }
        try:
            data = api_post("/api/get-topics-by-parent-slug", payload)
            if data:
                results.extend(data)
        except Exception:
            pass
    return results


def parse_card(card: dict, question_num: int) -> dict:
    """Chuẩn hóa một câu hỏi/card thành schema dễ dùng để dựng Web"""
    q_data = card.get("question", {})
    ans_data = card.get("answer", {})
    
    # Chuẩn hóa link audio & ảnh
    sound_url = q_data.get("sound", "")
    if sound_url and not sound_url.startswith("http"):
        sound_url = f"https://storage.googleapis.com/{sound_url.lstrip('/')}"
    image_url = q_data.get("image", "")
    if image_url and not image_url.startswith("http"):
        image_url = f"https://storage.googleapis.com/{image_url.lstrip('/')}"

    # Đáp án đúng và các phương án gây nhiễu
    correct_answers = ans_data.get("texts", [])
    other_choices = ans_data.get("choices", [])
    
    # Ghép danh sách đáp án
    all_choices = []
    # Thường choices dạng: correct in texts, rest in choices
    if other_choices or correct_answers:
        raw_choices = correct_answers + other_choices
        # Sắp xếp hoặc giữ nguyên format A, B, C, D
        all_choices = sorted(raw_choices, key=lambda x: str(x))

    return {
        "id": card.get("_id"),
        "questionNumber": question_num,
        "questionText": q_data.get("text", "").strip(),
        "imageUrl": image_url,
        "audioUrl": sound_url,
        "choices": all_choices,
        "correctAnswer": correct_answers[0] if correct_answers else "",
        "explanationHtml": ans_data.get("hint", ""),
        "explanationViHtml": ans_data.get("mapLangHint", {}).get("vi", ""),
        "transcriptHtml": ans_data.get("hint", "")
    }


def get_test_detail(topic_id: str, test_name: str = "") -> dict:
    """Tải toàn bộ câu hỏi và cấu trúc của 1 đề thi"""
    cards = api_post("/api/get-card-by-topic-id", {"topicId": topic_id})
    
    parsed_questions = []
    q_counter = 1

    for c in cards:
        children = c.get("childCards", [])
        if children:
            # Nhóm câu hỏi có passage/audio/image chung (Part 3, 4, 6, 7)
            group_sound = c.get("question", {}).get("sound", "")
            if group_sound and not group_sound.startswith("http"):
                group_sound = f"https://storage.googleapis.com/{group_sound.lstrip('/')}"
            group_image = c.get("question", {}).get("image", "")
            if group_image and not group_image.startswith("http"):
                group_image = f"https://storage.googleapis.com/{group_image.lstrip('/')}"
            group_passage = c.get("question", {}).get("text", "") or c.get("question", {}).get("article", "")
            group_explanation = c.get("answer", {}).get("hint", "")
            group_explanation_vi = c.get("answer", {}).get("mapLangHint", {}).get("vi", "")

            sub_questions = []
            for child in children:
                sub_q = parse_card(child, q_counter)
                # Kế thừa audio hoặc passage từ nhóm nếu con không có
                if not sub_q["audioUrl"] and group_sound:
                    sub_q["audioUrl"] = group_sound
                if not sub_q["imageUrl"] and group_image:
                    sub_q["imageUrl"] = group_image
                if not sub_q["explanationViHtml"] and group_explanation_vi:
                    sub_q["explanationViHtml"] = group_explanation_vi
                sub_questions.append(sub_q)
                q_counter += 1

            parsed_questions.append({
                "type": "group",
                "groupId": c.get("_id"),
                "audioUrl": group_sound,
                "imageUrl": group_image,
                "passageHtml": group_passage,
                "transcriptHtml": group_explanation,
                "transcriptViHtml": group_explanation_vi,
                "questions": sub_questions
            })
        else:
            # Câu hỏi đơn (Part 1, Part 2, Part 5)
            q = parse_card(c, q_counter)
            parsed_questions.append({
                "type": "single",
                "question": q
            })
            q_counter += 1

    return {
        "topicId": topic_id,
        "title": test_name,
        "totalCards": len(cards),
        "totalQuestions": q_counter - 1,
        "data": parsed_questions
    }


def main():
    parser = argparse.ArgumentParser(description="TOEIC Data Scraper")
    parser.add_argument("--list", action="store_true", help="Liệt kê danh sách các đề thi Full Test & Mini Test")
    parser.add_argument("--crawl-test", type=str, help="ID của đề thi cần cào")
    parser.add_argument("--output-dir", type=str, default="c:/Toeic/wed/data", help="Thư mục lưu data")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    if args.list:
        print("\n--- DANH SÁCH FULL TESTS (200 câu/đề) ---")
        full_tests = get_test_list("full-test")
        for idx, t in enumerate(full_tests, 1):
            q_num = t.get("topicExercise", {}).get("questionsNum", 200)
            print(f"{idx:02d}. [{t.get('_id')}] {t.get('name')} ({q_num} câu)")

        print("\n--- DANH SÁCH MINI TESTS (100 câu/đề) ---")
        mini_tests = get_test_list("minitest")
        for idx, t in enumerate(mini_tests, 1):
            q_num = t.get("topicExercise", {}).get("questionsNum", 100)
            print(f"{idx:02d}. [{t.get('_id')}] {t.get('name')} ({q_num} câu)")

    elif args.crawl_test:
        print(f"Đang cào dữ liệu cho Test ID: {args.crawl_test}...")
        test_data = get_test_detail(args.crawl_test)
        out_file = os.path.join(args.output_dir, f"{args.crawl_test}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(test_data, f, ensure_ascii=False, indent=2)
        print(f"-> Hoàn tất! Đã lưu {test_data['totalQuestions']} câu hỏi vào: {out_file}")

    else:
        print("Sử dụng: python crawler.py --list để xem danh sách hoặc python crawler.py --crawl-test <id>")


if __name__ == "__main__":
    main()

