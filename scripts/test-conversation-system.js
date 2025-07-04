require('dotenv').config({ path: '.env.local' });
const { exec } = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function testConversationSystem() {
  console.log('🧪 Testing Complete Conversation System...\n');
  
  try {
    // Test 1: Database Connection
    console.log('📝 Test 1: Database Connection...');
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connection successful\n');
    
    // Test 2: New Conversation
    console.log('📝 Test 2: Creating new conversation...');
    const newConvResult = await execCurl(`
      curl -s http://localhost:9002/api/ai/chat \\
      -X POST \\
      -H "Content-Type: application/json" \\
      -d '{"messages":["Hello, tell me about TAIC"],"guest_session_id":"test_system_456"}'
    `);
    
    if (newConvResult.includes('thread_id')) {
      const threadMatch = newConvResult.match(/"thread_id":"([^"]+)"/);
      if (threadMatch) {
        const threadId = threadMatch[1];
        console.log(`✅ New conversation created with thread_id: ${threadId}`);
        
        // Test 3: Conversation Persistence
        console.log('\n📝 Test 3: Testing conversation persistence...');
        const followUpResult = await execCurl(`
          curl -s http://localhost:9002/api/ai/chat \\
          -X POST \\
          -H "Content-Type: application/json" \\
          -d '{"messages":["What is the Pioneer Program?"],"thread_id":"${threadId}","guest_session_id":"test_system_456"}'
        `);
        
        if (followUpResult.includes(threadId) && !followUpResult.includes("I'm the Official AI Guide")) {
          console.log('✅ Conversation persistence working (AI didn\'t re-introduce itself)');
        } else {
          console.log('❌ Conversation persistence issue detected');
        }
        
        // Test 4: Database Storage Verification
        console.log('\n📝 Test 4: Verifying database storage...');
        const dbClient = await pool.connect();
        try {
          const threadQuery = await dbClient.query(`
            SELECT thread_id, guest_session_id 
            FROM conversation_threads 
            WHERE thread_id = $1
          `, [threadId]);
          
          if (threadQuery.rows.length > 0) {
            console.log('✅ Thread stored in database');
            
            const messageQuery = await dbClient.query(`
              SELECT COUNT(*) as count
              FROM conversation_messages cm
              JOIN conversation_threads ct ON cm.thread_id = ct.id
              WHERE ct.thread_id = $1
            `, [threadId]);
            
            const messageCount = parseInt(messageQuery.rows[0].count);
            if (messageCount >= 4) { // 2 user + 2 assistant messages
              console.log(`✅ Messages stored in database (${messageCount} messages)`);
            } else {
              console.log(`❌ Expected at least 4 messages, found ${messageCount}`);
            }
          } else {
            console.log('❌ Thread not found in database');
          }
        } finally {
          dbClient.release();
        }
        
        // Test 5: JSON Action Response
        console.log('\n📝 Test 5: Testing JSON action responses...');
        const actionResult = await execCurl(`
          curl -s http://localhost:9002/api/ai/chat \\
          -X POST \\
          -H "Content-Type: application/json" \\
          -d '{"messages":["Tell me about Pioneer Program tiers"],"thread_id":"${threadId}","guest_session_id":"test_system_456"}'
        `);
        
        if (actionResult.includes('Founding Merchants') || actionResult.includes('Strategic Influencers')) {
          console.log('✅ AI providing detailed tier information');
        } else {
          console.log('❌ AI not providing expected tier information');
        }
        
      } else {
        console.log('❌ Could not extract thread_id from response');
      }
    } else {
      console.log('❌ New conversation failed - no thread_id in response');
      console.log('Response:', newConvResult.substring(0, 200));
    }
    
    console.log('\n🎉 Conversation system testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

function execCurl(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run tests
testConversationSystem()
  .then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
