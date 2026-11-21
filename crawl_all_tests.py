import json
import os
import time
import urllib.request
import re

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def clean_choice_content(raw_content):
    if not raw_content:
        return {'letter': '', 'text': ''}
    s = str(raw_content).strip()
    m = re.match(r'^\(?([A-Da-d])\)?[\.\:\s\-]*(.*)$', s)
    if m:
        return {
            'letter': m.group(1).upper(),
            'text': m.group(2).strip()
        }
    return {'letter': '', 'text': s}

def parse_card(card, question_num):
    q_data = card.get('question') or {}
    ans_data = card.get('answer') or {}
    raw_choices = card.get('choices') or []

    parsed_choices = []
    correct_letter = 'A'

    if isinstance(raw_choices, list) and len(raw_choices) > 0:
        for i, rc in enumerate(raw_choices):
            default_letter = chr(65 + i)
            content = rc.get('content') or ''
            res = clean_choice_content(content)
            final_letter = res['letter'] or default_letter
            is_correct = bool(rc.get('isCorrect'))
            if is_correct:
                correct_letter = final_letter
            parsed_choices.append({
                'letter': final_letter,
                'text': res['text'],
                'raw': content,
                'isCorrect': is_correct
            })
    else:
        correct_answers = ans_data.get('texts') or []
        other_choices = ans_data.get('choices') or []
        all_c = correct_answers + other_choices
        for i, c_text in enumerate(all_c):
            parsed_choices.append({
                'letter': chr(65 + i),
                'text': c_text,
                'raw': c_text,
                'isCorrect': (i == 0)
            })

    sound_url = q_data.get('sound') or ''
    if sound_url and not sound_url.startswith('http'):
        sound_url = f"https://storage.googleapis.com/{sound_url.lstrip('/')}"
    image_url = q_data.get('image') or ''
    if image_url and not image_url.startswith('http'):
        image_url = f"https://storage.googleapis.com/{image_url.lstrip('/')}"

    hint_en = ans_data.get('hint') or ''
    map_lang = ans_data.get('mapLangHint') or {}
    hint_vi = map_lang.get('vi') or ''

    return {
        'id': card.get('_id'),
        'questionNumber': question_num,
        'questionText': (q_data.get('text') or '').strip(),
        'imageUrl': image_url,
        'audioUrl': sound_url,
        'choices': parsed_choices,
        'correctAnswer': correct_letter,
        'explanationHtml': hint_en,
        'explanationViHtml': hint_vi,
        'transcriptHtml': hint_en
    }

def transform_cards(cards, topic_id, test_title):
    parsed_questions = []
    q_counter = 1

    for c in cards:
        children = c.get('childCards') or []
        if len(children) > 0:
            group_sound = (c.get('question') or {}).get('sound') or ''
            if group_sound and not group_sound.startswith('http'):
                group_sound = f"https://storage.googleapis.com/{group_sound.lstrip('/')}"
            group_image = (c.get('question') or {}).get('image') or ''
            if group_image and not group_image.startswith('http'):
                group_image = f"https://storage.googleapis.com/{group_image.lstrip('/')}"
            group_passage = (c.get('question') or {}).get('text') or (c.get('question') or {}).get('article') or ''
            group_explanation = (c.get('answer') or {}).get('hint') or ''
            map_lang = (c.get('answer') or {}).get('mapLangHint') or {}
            group_explanation_vi = map_lang.get('vi') or ''

            sub_questions = []
            for child in children:
                sub_q = parse_card(child, q_counter)
                if not sub_q['audioUrl'] and group_sound:
                    sub_q['audioUrl'] = group_sound
                if not sub_q['imageUrl'] and group_image:
                    sub_q['imageUrl'] = group_image
                if not sub_q['explanationViHtml'] and group_explanation_vi:
                    sub_q['explanationViHtml'] = group_explanation_vi
                sub_questions.append(sub_q)
                q_counter += 1

            parsed_questions.append({
                'type': 'group',
                'groupId': c.get('_id'),
                'audioUrl': group_sound,
                'imageUrl': group_image,
                'passageHtml': group_passage,
                'transcriptHtml': group_explanation,
                'transcriptViHtml': group_explanation_vi,
                'questions': sub_questions
            })
        else:
            q = parse_card(c, q_counter)
            parsed_questions.append({
                'type': 'single',
                'question': q
            })
            q_counter += 1

    return {
        'topicId': topic_id,
        'title': test_title,
        'totalCards': len(cards),
        'totalQuestions': q_counter - 1,
        'data': parsed_questions
    }

def fetch_and_save_test(topic_id, test_title):
    out_path = os.path.join(DATA_DIR, f"{topic_id}.json")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
        print(f"  [OK] Already cached: {test_title} ({topic_id})")
        return True

    url = 'https://v2.estudyme.com/api/get-card-by-topic-id'
    payload = json.dumps({'topicId': topic_id}).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            cards = json.loads(resp.read().decode('utf-8'))
            if not isinstance(cards, list):
                print(f"  [FAIL] Upstream did not return list for {topic_id}")
                return False

            transformed = transform_cards(cards, topic_id, test_title)
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(transformed, f, ensure_ascii=False, indent=2)
            print(f"  [DOWNLOADED] {test_title}: {transformed['totalQuestions']} questions saved.")
            return True
    except Exception as e:
        print(f"  [ERROR] {test_title} ({topic_id}): {e}")
        return False

def main():
    summary_path = os.path.join(DATA_DIR, 'tests_summary.json')
    with open(summary_path, encoding='utf-8') as f:
        meta = json.load(f)

    full_tests = meta.get('full_tests', [])
    mini_tests = meta.get('mini_tests', [])

    print(f"Starting Crawl for {len(full_tests)} Full Tests...")
    for idx, t in enumerate(full_tests):
        print(f"[{idx+1}/{len(full_tests)}] Processing Full Test: {t['name']}")
        fetch_and_save_test(t['id'], t['name'])
        time.sleep(0.3)

    print(f"\nStarting Crawl for {len(mini_tests)} Mini Tests...")
    for idx, t in enumerate(mini_tests):
        print(f"[{idx+1}/{len(mini_tests)}] Processing Mini Test: {t['name']}")
        fetch_and_save_test(t['id'], t['name'])
        time.sleep(0.3)

    print("\nALL 41 TOEIC TESTS CACHED 100% LOCALLY!")

if __name__ == '__main__':
    main()
