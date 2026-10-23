import json
import re
import sys

import ollama

EXPLANATION_REQUEST = re.compile(
    r"\b(explain|teach|lesson|tutorial|in detail|step by step|"
    r"how does|how do|how can|how to|how it works|why does|why do|"
    r"describe|elaborate|compare|difference between)\b",
    re.IGNORECASE,
)
WORD_COUNT_REQUEST = re.compile(r"\b(\d[\d,]*)\s*words?\b", re.IGNORECASE)
MAX_REQUESTED_WORDS = 10_000
TOKENS_PER_WORD = 2


def get_answer_limits(question):
    match = WORD_COUNT_REQUEST.search(question)
    if match:
        requested_words = min(int(match.group(1).replace(",", "")), MAX_REQUESTED_WORDS)
        max_tokens = requested_words * TOKENS_PER_WORD
        answer_style = (
            f"The user explicitly requested about {requested_words:,} words. "
            "Honor this length request: give a complete, detailed answer in "
            "simple English. For a long answer, organize it with useful headings "
            "and clear sections. Do not replace it with a short summary or stop "
            "after an introduction."
        )
        return max_tokens, min(32_768, max(4_096, max_tokens + 2_048)), answer_style

    if EXPLANATION_REQUEST.search(question):
        answer_style = (
            "The user wants an explanation or lesson. Teach the topic in simple "
            "English. Explain the main ideas in a clear order and define difficult "
            "words. Use a short example when it helps. Give enough detail to "
            "explain the topic, without repetition or unnecessary jargon."
        )
        return 2_048, 8_192, answer_style

    answer_style = (
        "The user is asking for a quick factual answer. Use simple, everyday "
        "English and answer directly in no more than 4 short sentences "
        "(about 45 words total). Include only the most useful facts."
    )
    return 120, 4_096, answer_style


def main():
    request = json.loads(sys.stdin.readline())
    question = request.get("question")
    temperature = request.get("temperature", 0.7)

    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question must not be empty.")
    if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 1:
        raise ValueError("Temperature must be between 0 and 1.")

    max_tokens, context_tokens, answer_style = get_answer_limits(question)

    response = ollama.chat(
        model="gemma3:1b",
        messages=[
            {
                "role": "system",
                "content": (
                    "Be accurate. Use simple English and common words. Follow "
                    "the requested answer style and length exactly. If unsure, say so. "
                    f"{answer_style}"
                ),
            },
            {"role": "user", "content": question.strip()},
        ],
        options={
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": max_tokens,
            "num_ctx": context_tokens,
        },
        stream=True,
    )

    for part in response:
        text = part.message.content
        if text:
            print(json.dumps({"text": text}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()