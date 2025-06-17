"""Simple test file to verify pytest discovery."""

def test_always_passes():
    """Test that always passes."""
    assert True


def test_always_fails():
    """Test that always fails."""
    assert False, "This test is expected to fail"


async def test_async_passes():
    """Async test that always passes."""
    assert True
