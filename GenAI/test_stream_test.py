import importlib.util
import io
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("stream-test.py")
SPEC = importlib.util.spec_from_file_location("stream_test", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load stream-test.py")
stream_test = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stream_test)


class AnswerLimitsTests(unittest.TestCase):
    def test_factual_questions_keep_the_short_answer_budget(self):
        tokens, context, _ = stream_test.get_answer_limits("Who is Ada Lovelace?")
        self.assertEqual(tokens, 120)
        self.assertEqual(context, 4096)

    def test_explanations_without_a_word_count_get_more_room(self):
        tokens, context, _ = stream_test.get_answer_limits("Explain photosynthesis.")
        self.assertEqual(tokens, 2048)
        self.assertEqual(context, 8192)

    def test_explicit_word_count_sets_generation_and_context_budgets(self):
        tokens, context, prompt = stream_test.get_answer_limits(
            "Explain photosynthesis in 10,000 words."
        )
        self.assertEqual(tokens, 20_000)
        self.assertEqual(context, 22_048)
        self.assertIn("10,000 words", prompt)

    def test_explicit_word_count_is_capped_to_model_context_capacity(self):
        tokens, context, prompt = stream_test.get_answer_limits(
            "Explain this in 50000 words."
        )
        self.assertEqual(tokens, 20_000)
        self.assertEqual(context, 22_048)
        self.assertIn("10,000 words", prompt)


class WebSearchTests(unittest.TestCase):
    def test_current_information_questions_trigger_search(self):
        self.assertTrue(stream_test.needs_web_search("What is today's date?"))
        self.assertTrue(stream_test.needs_web_search("What is the latest Python release?"))
        self.assertTrue(stream_test.needs_web_search("What is the weather today?"))

    def test_general_questions_do_not_trigger_search(self):
        self.assertFalse(stream_test.needs_web_search("Who was Ada Lovelace?"))

    def test_search_requires_a_tavily_api_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(stream_test.WebSearchError, "TAVILY_API_KEY"):
                stream_test.search_web("What is today's date?")

    def test_search_returns_capped_sources(self):
        payload = {
            "results": [
                {
                    "title": "Today's news",
                    "url": "https://example.com/news",
                    "content": "Recent information.",
                }
            ]
        }
        response = io.BytesIO(json.dumps(payload).encode("utf-8"))
        with (
            patch.dict(os.environ, {"TAVILY_API_KEY": "test-key"}),
            patch.object(stream_test, "urlopen", return_value=response) as urlopen,
        ):
            sources = stream_test.search_web("What is today's news?")

        self.assertEqual(
            sources,
            [
                {
                    "title": "Today's news",
                    "url": "https://example.com/news",
                    "content": "Recent information.",
                }
            ],
        )
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.tavily.com/search")
        self.assertEqual(json.loads(request.data)["api_key"], "test-key")


if __name__ == "__main__":
    unittest.main()
