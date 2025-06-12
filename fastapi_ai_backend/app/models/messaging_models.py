from typing import Optional, List
from pydantic import BaseModel, Field, constr
from datetime import datetime

# --- ConversationParticipant Models ---
class ConversationParticipantResponse(BaseModel):
    user_id: str = Field(..., description="Identifier of the user participating in the conversation.")
    # Not including joined_at and last_read_at here, as they are specific to the user's view of the conversation,
    # and might be better placed in a model that represents a user's conversation entry (like ConversationListEntry)
    # For now, keeping it simple. If these are needed for *other* participants in a ConversationResponse, they can be added.
    # Re-evaluating: For `ConversationResponse.participants`, `user_id` is enough.
    # If we need a model for the `conversation_participants` table rows directly, it would have more.

    class Config:
        from_attributes = True

# --- Message Models ---
class MessageResponse(BaseModel):
    id: str = Field(..., description="Unique identifier for the message.")
    conversation_id: str = Field(..., description="Identifier of the conversation this message belongs to.")
    sender_id: str = Field(..., description="Identifier of the user who sent the message.")
    message_text: str = Field(..., description="The text content of the message.")
    sent_at: datetime = Field(..., description="Timestamp of when the message was sent.")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "msg_uuid_789",
                "conversation_id": "convo_uuid_123",
                "sender_id": "user_uuid_abc",
                "message_text": "Hello, I have a question about this product.",
                "sent_at": "2023-10-28T10:05:00Z"
            }
        }

class MessageCreate(BaseModel):
    message_text: str = Field(..., min_length=1, description="The text content of the message to be sent.")

    class Config:
        json_schema_extra = {
            "example": {
                "message_text": "Can you provide more details on the warranty?"
            }
        }

# --- Conversation Models ---
class ConversationBase(BaseModel):
    product_id: Optional[str] = Field(default=None, description="Optional identifier of the product this conversation is about.")
    subject: Optional[str] = Field(default=None, max_length=255, description="Optional subject for the conversation.")

class ConversationCreate(BaseModel):
    recipient_id: str = Field(..., description="The user ID of the recipient to start the conversation with.")
    product_id: Optional[str] = Field(default=None, description="Optional product ID if the conversation is related to a specific product.")
    initial_message_text: str = Field(..., min_length=1, description="The initial message text to start the conversation.")
    subject: Optional[str] = Field(default=None, max_length=255, description="Optional subject for the new conversation.")


    class Config:
        json_schema_extra = {
            "example": {
                "recipient_id": "user_uuid_xyz",
                "product_id": "product_uuid_123",
                "initial_message_text": "Hi, I'm interested in your product!",
                "subject": "Question about Product ABC"
            }
        }

class ConversationResponse(ConversationBase):
    id: str = Field(..., description="Unique identifier for the conversation.")
    created_at: datetime = Field(..., description="Timestamp of when the conversation was created.")
    updated_at: datetime = Field(..., description="Timestamp of the last activity (e.g., new message) in the conversation.")
    participants: List[ConversationParticipantResponse] = Field(..., description="List of participants in the conversation.")
    latest_message_preview: Optional[str] = Field(default=None, description="A short preview of the latest message in the conversation.")
    unread_messages_count: Optional[int] = Field(default=None, description="Number of unread messages for the current authenticated user in this conversation.")
    # last_message_at: Optional[datetime] = None # Could be useful for sorting, derived from latest message or updated_at

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "convo_uuid_123",
                "product_id": "product_uuid_123",
                "subject": "Inquiry about Product X",
                "created_at": "2023-10-28T10:00:00Z",
                "updated_at": "2023-10-28T10:05:00Z",
                "participants": [
                    {"user_id": "user_uuid_abc"},
                    {"user_id": "user_uuid_xyz"}
                ],
                "latest_message_preview": "Hello, I have a question...",
                "unread_messages_count": 1
            }
        }
