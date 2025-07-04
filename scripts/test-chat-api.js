const fetch = require('node-fetch');

const API_BASE = 'http://localhost:9002';

async function testChatAPI() {
  console.log('🧪 Testing Chat API Implementation...\n');
  
  try {
    // Test 1: New conversation (no thread_id)
    console.log('📝 Test 1: Starting new conversation...');
    const response1 = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: ['Hello, can you tell me about TAIC?'],
        guest_session_id: 'test_guest_123'
      })
    });
    
    if (!response1.ok) {
      throw new Error(`API Error: ${response1.status} ${response1.statusText}`);
    }
    
    // Read streaming response
    const reader = response1.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let threadId = '';
    let isFirstChunk = true;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      
      if (isFirstChunk) {
        // First chunk should contain thread_id
        const lines = chunk.split('\n');
        try {
          const threadInfo = JSON.parse(lines[0]);
          threadId = threadInfo.thread_id;
          console.log(`✅ Received thread_id: ${threadId}`);
          fullResponse += lines.slice(1).join('\n');
        } catch (e) {
          fullResponse += chunk;
        }
        isFirstChunk = false;
      } else {
        fullResponse += chunk;
      }
    }
    
    console.log(`✅ Response length: ${fullResponse.length} characters`);
    console.log(`📄 Response preview: ${fullResponse.substring(0, 100)}...\n`);
    
    // Test 2: Continue conversation with thread_id
    if (threadId) {
      console.log('📝 Test 2: Continuing conversation with thread_id...');
      const response2 = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: ['What are the benefits of using TAIC Coin?'],
          thread_id: threadId,
          guest_session_id: 'test_guest_123'
        })
      });
      
      if (!response2.ok) {
        throw new Error(`API Error: ${response2.status} ${response2.statusText}`);
      }
      
      const reader2 = response2.body.getReader();
      let fullResponse2 = '';
      let isFirstChunk2 = true;
      
      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        if (isFirstChunk2) {
          const lines = chunk.split('\n');
          try {
            const threadInfo = JSON.parse(lines[0]);
            console.log(`✅ Thread ID maintained: ${threadInfo.thread_id === threadId}`);
            fullResponse2 += lines.slice(1).join('\n');
          } catch (e) {
            fullResponse2 += chunk;
          }
          isFirstChunk2 = false;
        } else {
          fullResponse2 += chunk;
        }
      }
      
      console.log(`✅ Second response length: ${fullResponse2.length} characters`);
      console.log(`📄 Second response preview: ${fullResponse2.substring(0, 100)}...\n`);
    }
    
    // Test 3: JSON Action Response
    console.log('📝 Test 3: Testing JSON action response...');
    const response3 = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: ['Show me some options for getting started with TAIC'],
        thread_id: threadId,
        guest_session_id: 'test_guest_123'
      })
    });
    
    if (!response3.ok) {
      throw new Error(`API Error: ${response3.status} ${response3.statusText}`);
    }
    
    const reader3 = response3.body.getReader();
    let fullResponse3 = '';
    let isFirstChunk3 = true;
    
    while (true) {
      const { done, value } = await reader3.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      
      if (isFirstChunk3) {
        const lines = chunk.split('\n');
        try {
          JSON.parse(lines[0]); // Validate thread_id format
          fullResponse3 += lines.slice(1).join('\n');
        } catch (e) {
          fullResponse3 += chunk;
        }
        isFirstChunk3 = false;
      } else {
        fullResponse3 += chunk;
      }
    }
    
    // Test if response can be parsed as JSON (for actions)
    try {
      const jsonResponse = JSON.parse(fullResponse3.trim());
      if (jsonResponse.actions && Array.isArray(jsonResponse.actions)) {
        console.log(`✅ JSON actions detected: ${jsonResponse.actions.length} actions`);
        console.log(`📄 Actions: ${JSON.stringify(jsonResponse.actions, null, 2)}`);
      } else {
        console.log('ℹ️  Plain text response (no actions)');
      }
    } catch (e) {
      console.log('ℹ️  Plain text response (not JSON)');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testChatAPI()
    .then(() => {
      console.log('✅ Chat API tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testChatAPI };
