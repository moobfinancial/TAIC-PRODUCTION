from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

class Settings(BaseSettings):
    # Default value is provided if the environment variable is not set.
    # For sensitive defaults like passwords, it's better to ensure they are set in the env.
    DATABASE_URL: str = "postgresql://user:password@db:5432/appdb" # Example placeholder

    # Example for other potential settings:
    # PROJECT_NAME: str = "TAIC AI Services"
    # API_V1_STR: str = "/api/v1"
    # OPENAI_API_KEY: str | None = None # Optional setting

    # Pydantic V2 (pydantic-settings) configuration
    # Loads variables from a .env file if present.
    # `extra='ignore'` allows other environment variables not defined in Settings to exist.
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", ".env"), # Allow overriding .env file via ENV_FILE env var
        env_file_encoding='utf-8',
        extra='ignore'
    )

@lru_cache() # Cache the settings instance for efficiency
def get_settings() -> Settings:
    # Load .env file using python-dotenv if explicitly needed before Pydantic,
    # but Pydantic-settings should handle it with env_file.
    # from dotenv import load_dotenv
    # load_dotenv() # This line might be redundant if Pydantic's env_file works as expected.
    return Settings()

settings = get_settings()
