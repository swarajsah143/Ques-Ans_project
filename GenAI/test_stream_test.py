import importlib.util
import unittest
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()
