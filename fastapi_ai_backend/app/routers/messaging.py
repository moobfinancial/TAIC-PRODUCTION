import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Path as FastApiPath
import asyncpg
from datetime import datetime

from app.models.messaging_models import (
    ConversationCreate,
    ConversationResponse,
    ConversationParticipantResponse,
    MessageCreate,
    MessageResponse
)
from app.db import get_db_connection, release_db_connection
from app.dependencies import get_current_active_user_id # Assuming this dependency exists
from app.email_utils import send_new_customer_message_email, FRONTEND_BASE_URL # Import email utility

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Messaging Center"],
    # Actual prefix will be /api/messaging (from main.py)
)

# --- Helper to check if user is a participant ---
async def verify_user_participant(
    conn: asyncpg.Connection,
    conversation_id: str,
    user_id: str
):
    is_participant = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = $1 AND user_id = $2
        )
        """,
        conversation_id, user_id
    )
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a participant of this conversation."
        )

# --- API Endpoints ---

@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start New Conversation",
    description="Starts a new conversation with another user, optionally related to a product, and sends an initial message."
)
async def start_new_conversation(
    payload: ConversationCreate,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    if current_user_id == payload.recipient_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot start a conversation with yourself.")

    # Check if recipient exists (optional, but good practice)
    recipient_exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)", payload.recipient_id)
    if not recipient_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found.")

    # Check if product exists if product_id is provided
    if payload.product_id:
        product_exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM products WHERE id = $1)", payload.product_id)
        if not product_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID {payload.product_id} not found.")

    conversation_id = str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    async with conn.transaction():
        # 1. Create Conversation
        convo_row = await conn.fetchrow(
            """
            INSERT INTO conversations (id, product_id, subject, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING *
            """,
            conversation_id, payload.product_id, payload.subject
        )
        if not convo_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create conversation.")

        # 2. Add Participants (sender and recipient)
        # Sender
        await conn.execute(
            """
            INSERT INTO conversation_participants (conversation_id, user_id, joined_at, last_read_at)
            VALUES ($1, $2, NOW(), NOW())
            """,
            conversation_id, current_user_id
        )
        # Recipient
        await conn.execute(
            """
            INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
            VALUES ($1, $2, NOW())
            """,
            conversation_id, payload.recipient_id
        )

        # 3. Create Initial Message
        msg_row = await conn.fetchrow(
            """
            INSERT INTO messages (id, conversation_id, sender_id, message_text, sent_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
            """,
            message_id, conversation_id, current_user_id, payload.initial_message_text
        )
        if not msg_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create initial message.")

    # For response: fetch participants and construct ConversationResponse
    participants_rows = await conn.fetch(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = $1",
        conversation_id
    )
    participants_list = [ConversationParticipantResponse(user_id=p['user_id']) for p in participants_rows]

    return ConversationResponse(
        **dict(convo_row),
        participants=participants_list,
        latest_message_preview=payload.initial_message_text[:100], # Preview of the first message
        unread_messages_count=0 # For the sender, it's 0 initially
    )

@router.get(
    "/conversations",
    response_model=List[ConversationResponse],
    summary="List My Conversations",
    description="Retrieves a list of all conversations the current user is a participant in, ordered by the most recent activity."
)
async def list_my_conversations(
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    query = """
        SELECT
            c.id, c.product_id, c.subject, c.created_at, c.updated_at,
            cp_user.last_read_at AS current_user_last_read_at,
            (
                SELECT m.message_text FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.sent_at DESC LIMIT 1
            ) AS latest_message_preview,
            (
                SELECT COUNT(m.id) FROM messages m
                WHERE m.conversation_id = c.id AND m.sent_at > COALESCE(cp_user.last_read_at, '-infinity'::timestamptz)
                AND m.sender_id != $1
            ) AS unread_messages_count
        FROM conversations c
        JOIN conversation_participants cp_user ON c.id = cp_user.conversation_id AND cp_user.user_id = $1
        ORDER BY c.updated_at DESC
    """
    conversation_rows = await conn.fetch(query, current_user_id)

    response_list = []
    for row in conversation_rows:
        convo_dict = dict(row)
        # Fetch all participants for this conversation
        participants_rows = await conn.fetch(
            "SELECT user_id FROM conversation_participants WHERE conversation_id = $1",
            row['id']
        )
        participants_list = [ConversationParticipantResponse(user_id=p['user_id']) for p in participants_rows]

        response_list.append(ConversationResponse(
            **convo_dict,
            participants=participants_list,
            latest_message_preview=convo_dict.get('latest_message_preview', '')[:100] if convo_dict.get('latest_message_preview') else None,
            unread_messages_count=convo_dict.get('unread_messages_count', 0)
        ))
    return response_list

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[MessageResponse],
    summary="List Messages in a Conversation",
    description="Retrieves all messages within a specific conversation. Updates the user's last_read_at timestamp for this conversation."
)
async def list_messages_in_conversation(
    conversation_id: str = FastApiPath(..., description="ID of the conversation to fetch messages from."),
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    await verify_user_participant(conn, conversation_id, current_user_id)

    messages_rows = await conn.fetch(
        "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sent_at ASC",
        conversation_id
    )

    # Update last_read_at for the current user in this conversation
    await conn.execute(
        """
        UPDATE conversation_participants
        SET last_read_at = NOW()
        WHERE conversation_id = $1 AND user_id = $2
        """,
        conversation_id, current_user_id
    )

    return [MessageResponse(**dict(row)) for row in messages_rows]

@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message in Conversation",
    description="Sends a new message from the authenticated user to an existing conversation."
)
async def send_message_in_conversation(
    conversation_id: str = FastApiPath(..., description="ID of the conversation to send a message to."),
    payload: MessageCreate,
    current_user_id: str = Depends(get_current_active_user_id),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    await verify_user_participant(conn, conversation_id, current_user_id)

    message_id = str(uuid.uuid4())

    async with conn.transaction():
        msg_row = await conn.fetchrow(
            """
            INSERT INTO messages (id, conversation_id, sender_id, message_text, sent_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
            """,
            message_id, conversation_id, current_user_id, payload.message_text
        )
        if not msg_row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not send message.")

        # Update conversation's updated_at timestamp
        await conn.execute(
            "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
            conversation_id
        )

        new_message = MessageResponse(**dict(msg_row))

        # --- Send Email Notification to Other Participants (especially Merchants) ---
        other_participants_rows = await conn.fetch(
            """
            SELECT u.id, u.email, u.role, u.full_name
            FROM users u
            JOIN conversation_participants cp ON u.id = cp.user_id
            WHERE cp.conversation_id = $1 AND cp.user_id != $2
            """,
            conversation_id, current_user_id
        )

        for recipient_row in other_participants_rows:
            if recipient_row['role'] == 'MERCHANT' and recipient_row['email']:
                try:
                    merchant_name = recipient_row['full_name'] or recipient_row['email']
                    # Construct a direct link to the conversation
                    # This might need adjustment based on frontend routing
                    conversation_link = f"{FRONTEND_BASE_URL}/dashboard/messages/{conversation_id}"
                    message_preview = new_message.message_text[:150] # Preview of the new message

                    email_sent = await send_new_customer_message_email(
                        to_email=recipient_row['email'],
                        merchant_name=merchant_name,
                        message_preview=message_preview,
                        conversation_link=conversation_link
                    )
                    if email_sent:
                        logger.info(f"New message notification email sent to merchant {recipient_row['id']} at {recipient_row['email']} for conversation {conversation_id}")
                    else:
                        logger.warning(f"Failed to send new message notification email to merchant {recipient_row['id']} for conversation {conversation_id}")
                except Exception as e_email:
                    logger.error(f"Error sending new message notification to merchant {recipient_row['id']}: {e_email}")
            # Add logic here if Shoppers should also be notified of new messages from Merchants.
            # For now, focusing on Merchant notification for messages from Shoppers (or other users).

        return new_message

# TODO:
# - Add endpoint to mark a conversation as read explicitly if needed (though GET /messages does this)
# - Consider pagination for listing messages within a conversation
# - Potential for real-time updates via WebSockets (future phase)
# - Soft delete for messages/conversations
# - Blocking/reporting users within conversations
# - Rich text / attachments for messages (future phase)
