import pytest
import sys

print("Attempting to run pytest programmatically...")

# Explicitly list the test files we want to target
test_files_to_run = [
    "/Users/boommac/Downloads/TAIC-Master/fastapi_ai_backend/test_discovery.py",
    "/Users/boommac/Downloads/TAIC-Master/fastapi_ai_backend/minimal_test.py",
    "/Users/boommac/Downloads/TAIC-Master/fastapi_ai_backend/tests/"  # Target the whole directory
]

print(f"Targeting test files: {test_files_to_run}")

# Pytest arguments, including verbosity and specifying the minimal config
# We'll use the minimal_pytest.ini we created earlier
pytest_args = [
    "-v",
    "-c", "/Users/boommac/Downloads/TAIC-Master/fastapi_ai_backend/minimal_pytest.ini",
] + test_files_to_run

print(f"Pytest arguments: {pytest_args}")

try:
    # Change current directory to fastapi_ai_backend so pytest paths are relative if needed by plugins/hooks
    # However, we are providing absolute paths to test files for clarity here.
    # import os
    # os.chdir("/Users/boommac/Downloads/TAIC-Master/fastapi_ai_backend")
    # print(f"Changed CWD to: {os.getcwd()}")

    exit_code = pytest.main(pytest_args)
    print(f"Pytest finished with exit code: {exit_code}")
    sys.exit(exit_code)
except Exception as e:
    print(f"An exception occurred while trying to run pytest: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1) # Exit with a non-zero code to indicate failure
