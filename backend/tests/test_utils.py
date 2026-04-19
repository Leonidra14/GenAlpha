import pytest

from app.core.utils import sanitize_text, validate_password_spaces


class TestSanitizeText:
    def test_none_returns_none(self):
        assert sanitize_text(None) is None

    def test_strips_html_tags(self):
        assert sanitize_text("<p>Hello</p>") == "Hello"
        assert sanitize_text('<a href="#">x</a>') == "x"

    def test_strips_outer_whitespace(self):
        assert sanitize_text("  hi  ") == "hi"

    def test_empty_after_strip(self):
        assert sanitize_text("   ") == ""

    def test_plain_text_unchanged(self):
        assert sanitize_text("no tags") == "no tags"


class TestValidatePasswordSpaces:
    def test_no_spaces_returns_value(self):
        assert validate_password_spaces("secret") == "secret"

    def test_space_raises(self):
        with pytest.raises(ValueError, match="mezery"):
            validate_password_spaces("bad pass")
