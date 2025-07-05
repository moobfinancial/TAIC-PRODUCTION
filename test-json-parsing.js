// Test script to verify JSON parsing logic works correctly
// This simulates the response parsing logic from HomePageSitePalCanvas.tsx

function testResponseParsing() {
  console.log('🧪 Testing SitePal Avatar Response Parsing Logic\n');

  // Test cases
  const testCases = [
    {
      name: 'Valid JSON with responseText and actions',
      response: '{"responseText": "Welcome to the Pioneer Program! Here are your options:", "actions": [{"label": "Founding Merchants", "value": "Tell me about merchants", "icon": "store", "action_type": "command"}]}',
      expectedSpeech: 'Welcome to the Pioneer Program! Here are your options:',
      expectedActions: 1
    },
    {
      name: 'JSON with speak_text field',
      response: '{"speak_text": "Let me tell you about our benefits.", "actions": []}',
      expectedSpeech: 'Let me tell you about our benefits.',
      expectedActions: 0
    },
    {
      name: 'Plain text response',
      response: 'This is a simple text response without JSON.',
      expectedSpeech: 'This is a simple text response without JSON.',
      expectedActions: 0
    },
    {
      name: 'Malformed JSON (should fallback to plain text)',
      response: '{"responseText": "Hello", "actions": [invalid json}',
      expectedSpeech: 'responseText: Hello, actions: [invalid json',
      expectedActions: 0
    },
    {
      name: 'JSON with curly braces in text (should be cleaned)',
      response: '{"responseText": "The {Pioneer Program} offers [amazing benefits]!", "actions": []}',
      expectedSpeech: 'The Pioneer Program offers amazing benefits!',
      expectedActions: 0
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
    console.log(`📥 Input: ${testCase.response.substring(0, 80)}${testCase.response.length > 80 ? '...' : ''}`);
    
    // Simulate the parsing logic from HomePageSitePalCanvas.tsx
    let textToSpeak = 'I understand. How else can I help you with the Pioneer Program?';
    let actionsToSet = [];
    const fullResponse = testCase.response;

    if (fullResponse.trim()) {
      if (fullResponse.trim().startsWith('{') || fullResponse.trim().startsWith('[')) {
        try {
          const parsedJson = JSON.parse(fullResponse.trim());
          if (typeof parsedJson === 'object' && parsedJson !== null) {
            // CRITICAL FIX: Extract ONLY the speech text, never the full JSON
            textToSpeak = parsedJson.responseText || parsedJson.speak_text || 'I have some options for you.';
            
            // Ensure textToSpeak is clean text without JSON artifacts
            if (typeof textToSpeak !== 'string') {
              textToSpeak = 'I have some options for you.';
            }
            
            // Remove any remaining JSON-like content from speech text
            textToSpeak = textToSpeak.replace(/[\{\}\[\]"]/g, '').trim();

            // Handle actions if present
            if (Array.isArray(parsedJson.actions)) {
              actionsToSet = parsedJson.actions.map((action) => ({
                label: action.label || 'Action',
                command: action.command,
                link: action.link,
                value: action.value || action.command,
                icon: action.icon || 'help-circle',
                action_type: action.action_type || 'command'
              }));
            }
          } else {
            textToSpeak = String(parsedJson).replace(/[\{\}\[\]"]/g, '').trim();
          }
        } catch (e) {
          console.log('   ⚠️  JSON parsing failed, using as plain text');
          textToSpeak = fullResponse.trim().replace(/[\{\}\[\]"]/g, '').trim();
        }
      } else {
        textToSpeak = fullResponse.trim().replace(/[\{\}\[\]"]/g, '').trim();
      }
    }

    // Verify results
    const speechMatch = textToSpeak === testCase.expectedSpeech;
    const actionsMatch = actionsToSet.length === testCase.expectedActions;
    
    console.log(`🗣️  Speech Text: "${textToSpeak}"`);
    console.log(`🎯 Expected: "${testCase.expectedSpeech}"`);
    console.log(`✅ Speech Match: ${speechMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔘 Actions Count: ${actionsToSet.length} (expected: ${testCase.expectedActions})`);
    console.log(`✅ Actions Match: ${actionsMatch ? '✅ PASS' : '❌ FAIL'}`);
    
    if (actionsToSet.length > 0) {
      console.log(`🎮 Sample Action:`, actionsToSet[0]);
    }
  });

  console.log('\n🏁 JSON Parsing Tests Complete!');
}

// Run the tests
testResponseParsing();
