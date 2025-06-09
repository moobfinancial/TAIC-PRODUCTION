import httpx # Ensure httpx is in requirements.txt
from typing import List, Optional, Dict, Any
# Corrected relative import path assuming models are in app/models/
# and this file is in app/llm_clients/
from ..models.shopping_assistant import ChatMessageSchema

OPENROUTER_API_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"

class OpenRouterError(Exception):
    """Custom exception for OpenRouter API errors."""
    def __init__(self, status_code: int, error_data: Optional[Dict[str, Any]], message_prefix="OpenRouter API Error"):
        self.status_code = status_code
        self.error_data = error_data
        error_detail_message = error_data.get("error", {}).get("message") if isinstance(error_data, dict) and isinstance(error_data.get("error"), dict) else str(error_data)
        full_message = f"{message_prefix} {status_code}: {error_detail_message}"
        super().__init__(full_message)

async def call_openrouter_mistral(
    prompt_messages: List[ChatMessageSchema],
    api_key: str,
    model_name: str,
    site_url: str,
    app_title: str = "TAIC Platform"
) -> str:
    if not api_key or api_key == "your_openrouter_api_key_here" or api_key == "placeholder_replace_in_env_openrouter_api_key":
        print("Warning: OpenRouter API Key is a placeholder or missing. Returning a mock error response from client.")
        # This indicates a configuration issue that should ideally be caught before calling.
        # Raising an error here or returning a specific string can help in debugging.
        # For a production system, this check might be done earlier or handled more gracefully.
        raise OpenRouterError(status_code=401, error_data={"error": {"message": "OpenRouter API Key not configured or is a placeholder."}}, message_prefix="Configuration Error")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": site_url,
        "X-Title": app_title,
        "Content-Type": "application/json",
    }

    messages_payload = [msg.model_dump(exclude_none=True) for msg in prompt_messages]
    payload = { "model": model_name, "messages": messages_payload }

    # print(f"Calling OpenRouter: {model_name} with {len(messages_payload)} messages. Site: {site_url}, App: {app_title}") # Debug

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(OPENROUTER_API_CHAT_COMPLETIONS_URL, headers=headers, json=payload)

            # Try to get JSON regardless of status for error details
            response_data = {}
            try:
                response_data = response.json()
            except Exception: # If response is not JSON
                response_data = {"error_text": response.text}

            response.raise_for_status() # Raises HTTPStatusError for 4xx/5xx responses AFTER attempting to get JSON

            choices = response_data.get("choices")
            if choices and isinstance(choices, list) and len(choices) > 0:
                first_choice = choices[0]
                if first_choice.get("message") and isinstance(first_choice["message"], dict):
                    content = first_choice["message"].get("content")
                    if content is not None:
                        # print("Successfully received response from OpenRouter.") # Debug
                        return str(content)

            # If structure is not as expected
            print(f"OpenRouter Error: Unexpected response structure. Status: {response.status_code}, Data: {response_data}")
            raise OpenRouterError(response.status_code, {"error": {"message": "Unexpected response structure from OpenRouter"}, "details": response_data})

        except httpx.HTTPStatusError as e:
            # error_content already captured in response_data if JSON, or e.response.text if not
            error_details_for_exception = response_data if response_data.get("error_text") is None else {"error_text": e.response.text}
            print(f"OpenRouter API HTTPStatusError: {e.response.status_code} - Details: {error_details_for_exception}")
            raise OpenRouterError(e.response.status_code, error_details_for_exception) from e
        except httpx.RequestError as e: # Covers network errors, timeouts, etc.
            print(f"OpenRouter API RequestError: {e}")
            raise OpenRouterError(status_code=503, error_data={"error": {"message": "Network request to OpenRouter failed"}, "details": str(e)}) from e
        except Exception as e: # Catch any other unexpected errors during the process
            print(f"Unexpected error calling OpenRouter: {type(e).__name__} - {e}")
            raise OpenRouterError(status_code=500, error_data={"error": {"message": "Unexpected error during OpenRouter call"}, "details": str(e)}) from e
