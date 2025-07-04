import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_order: number;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface ConversationThread {
  id?: string;
  thread_id: string;
  user_id?: string;
  guest_session_id?: string;
  conversation_type: 'pioneer_ama' | 'shopping_assistant' | 'general';
  title?: string;
  status: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  messages?: ConversationMessage[];
}

export class ConversationStorage {

  /**
   * Create a new conversation thread
   */
  static async createThread(
    threadId: string,
    userId?: string,
    guestSessionId?: string,
    conversationType: 'pioneer_ama' | 'shopping_assistant' | 'general' = 'pioneer_ama'
  ): Promise<ConversationThread> {
    const client = await pool.connect();

    try {
      // Set expiration for anonymous conversations (24 hours)
      const expiresAt = !userId ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

      const result = await client.query(`
        INSERT INTO conversation_threads (
          thread_id, user_id, guest_session_id, conversation_type, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [threadId, userId || null, guestSessionId || null, conversationType, expiresAt]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation thread by thread_id
   */
  static async getThread(threadId: string): Promise<ConversationThread | null> {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT * FROM conversation_threads
        WHERE thread_id = $1 AND status = 'active'
      `, [threadId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation messages for a thread
   */
  static async getMessages(threadId: string): Promise<ConversationMessage[]> {
    const client = await pool.connect();

    try {
      const threadResult = await client.query(`
        SELECT id FROM conversation_threads WHERE thread_id = $1
      `, [threadId]);

      if (threadResult.rows.length === 0) {
        return [];
      }

      const internalThreadId = threadResult.rows[0].id;

      const result = await client.query(`
        SELECT * FROM conversation_messages
        WHERE thread_id = $1
        ORDER BY message_order ASC
      `, [internalThreadId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Add a message to a conversation thread
   */
  static async addMessage(
    threadId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<ConversationMessage> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get the internal thread ID
      const threadResult = await client.query(`
        SELECT id FROM conversation_threads WHERE thread_id = $1
      `, [threadId]);

      if (threadResult.rows.length === 0) {
        throw new Error(`Thread ${threadId} not found`);
      }

      const internalThreadId = threadResult.rows[0].id;

      // Get the next message order
      const orderResult = await client.query(`
        SELECT COALESCE(MAX(message_order), 0) + 1 as next_order
        FROM conversation_messages WHERE thread_id = $1
      `, [internalThreadId]);

      const messageOrder = orderResult.rows[0].next_order;

      // Insert the message
      const result = await client.query(`
        INSERT INTO conversation_messages (
          thread_id, role, content, message_order, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [internalThreadId, role, content, messageOrder, metadata || {}]);

      // Update thread's updated_at timestamp
      await client.query(`
        UPDATE conversation_threads
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [internalThreadId]);

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get full conversation history (thread + messages)
   */
  static async getConversationHistory(threadId: string): Promise<ConversationThread | null> {
    const thread = await this.getThread(threadId);
    if (!thread) {
      return null;
    }

    const messages = await this.getMessages(threadId);
    return {
      ...thread,
      messages
    };
  }

  /**
   * Link anonymous conversations to a user account
   */
  static async linkGuestConversationsToUser(
    guestSessionId: string,
    userId: string
  ): Promise<number> {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT link_guest_conversations_to_user($1, $2) as linked_count
      `, [guestSessionId, userId]);

      return result.rows[0].linked_count;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired anonymous conversations
   */
  static async cleanupExpiredConversations(): Promise<number> {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT cleanup_expired_conversations() as deleted_count
      `);

      return result.rows[0].deleted_count;
    } finally {
      client.release();
    }
  }

  /**
   * Generate a guest session ID for anonymous users
   */
  static generateGuestSessionId(): string {
    return `guest_${uuidv4()}`;
  }

  /**
   * Generate a thread ID
   */
  static generateThreadId(): string {
    return `thread_${uuidv4()}`;
  }

  /**
   * Convert messages to OpenAI format
   */
  static messagesToOpenAIFormat(messages: ConversationMessage[]): Array<{role: string, content: string}> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Extract actions and canvas state from message metadata
   */
  static extractMessageMetadata(content: string): {
    cleanContent: string;
    actions?: any[];
    canvasState?: string;
  } {
    try {
      // Try to parse as JSON first
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        const parsed = JSON.parse(content);

        if (typeof parsed === 'object' && parsed !== null) {
          return {
            cleanContent: parsed.responseText || parsed.speak_text || content,
            actions: parsed.actions,
            canvasState: parsed.canvas_state
          };
        }
      }

      // If not JSON, return as-is
      return { cleanContent: content };
    } catch (error) {
      // If parsing fails, return original content
      return { cleanContent: content };
    }
  }
}