Of course. Here is the content of the "SitePal API AI Agent Integration" document converted to Markdown format.

---

# **A Developer's Guide to Advanced Sitepal API Integration: AI Agents and User-Generated Avatars**

## **Executive Summary**

This report serves as a comprehensive developer's guide to leveraging the Sitepal platform for two distinct, high-value use cases: first, deploying a sophisticated, conversational AI Agent powered by a third-party knowledge base, and second, enabling end-users to create their own custom avatars through a deeply integrated framework. 1

The analysis reveals that these two objectives map directly to separate and escalating tiers of Sitepal's service offerings. 2AI Agent implementation is achievable with the

**Gold Plan**, while enabling user-generated avatar creation requires the more advanced **Sitepal Avatar Framework**. 3Understanding this fundamental distinction is critical for accurate project planning, budgeting, and technical strategy. 4This document will provide detailed architectural patterns, API breakdowns, and implementation workflows for both objectives. 5

---

## **Part I: Implementing a Sitepal AI Agent on Your Website**

This section details the process of integrating a Sitepal avatar with an external AI knowledge base to create an intelligent, conversational agent for a website. 6

### **Section 1.1: Foundational Concepts and Prerequisites**

Before beginning implementation, it is essential to establish a clear understanding of Sitepal's terminology and the mandatory account and security configurations. 7

#### **Defining the Components**

Sitepal distinguishes between the "brain" and the "face" of the conversational experience, and understanding this separation is key to a successful integration. 8

* **The "AI Bot"**: This refers to the faceless, text-in/text-out knowledge base that provides the intelligence for the interaction. 9This is the "brain" of the operation. 10It is responsible for processing a user's textual question and generating a relevant textual answer. 11This component is typically created and managed on a third-party platform, such as OpenAI's ChatGPT, Google's Dialogflow, Chatbase, or Sitepal's own built-in AIML-based solution, the AIMC. 12  
* **The "AI Agent"**: This is the complete, user-facing entity. 13 It is the combination of the animated Sitepal avatar (the "face" and "voice") embedded on a webpage and the underlying AI Bot. The AI Agent receives user input, passes it to the AI Bot, and then speaks the bot's textual response aloud using Text-to-Speech (TTS) technology. 14

#### **Subscription and Security Requirements**

Several prerequisites must be met to enable the functionality of an AI Agent. 15These are non-negotiable requirements for a successful implementation. 16

* **Account Plan**: The implementation of an AI Agent requires a **Sitepal Gold Plan or higher**. 17This subscription level unlocks access to the specific API functions, such as  
   sayAI, which are necessary to connect the avatar to an AI knowledge base. 18Lower-tier plans, such as Silver, support some Client API functions but lack the specific AI integration capabilities. 19  
* **Licensed Domains**: A critical security measure for enabling the avatar's voice is the configuration of Licensed Domains. 20The dynamic Text-to-Speech (TTS) functionality will not work unless the domain of the hosting webpage is explicitly authorized in the Sitepal account settings. 21This feature prevents unauthorized use of an account's TTS audio credits on unapproved websites. 22For development purposes,  
   localhost and 127.0.0.1 are always supported and do not need to be added. 23Wildcards for the first part of the domain (e.g.,  
   \*.mycompany.com) are also supported. 24  
* **Web Server Deployment**: The final HTML page containing the embedded Sitepal agent must be delivered by a web server. 25It cannot be run by simply opening the local HTML file in a browser (i.e., via a  
   file:// protocol). 26This is due to standard browser security policies, such as Cross-Origin Resource Sharing (CORS). 27

---

### **Section 1.2: The Core of Interaction: The sayAI Client API Function**

The linchpin of a pre-integrated AI Agent implementation is the

sayAI() JavaScript function, which is part of the Sitepal Client API. 28This single function call encapsulates the entire process of sending a user's query to the configured AI Bot and initiating the avatar's spoken response. 29The

sayAI() function is available only to Gold Plan and higher accounts and requires a licensed domain to be configured. 30

| Parameter | Type | Description | Example/Notes |  |  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| txtQ | String | The user's question, submitted as a text string. 31 | myInput.value |  |  |
| voice | Integer | The numeric ID of the Text-to-Speech (TTS) voice the avatar will use. 32 |  | 3 (for the voice 'Julie (US)') 33 |  |
| lang | Integer | The numeric ID of the language for the TTS response. 34 | 1 (for English) |  |  |
| engine | Integer | The numeric ID of the TTS engine to be used. 35 | 39 |  |  |
| effect | Integer | [cite\_start](https://www.google.com/search?q=Optional) The numeric ID for an audio effect. 36 | "" (or null) for no effect. |  |  |
| effLevel | Integer | [cite\_start](https://www.google.com/search?q=Optional) The intensity level for the selected audio effect. 37 | "" (or null) for no effect. |  |  |
| botVendor | String |  | **Crucial Parameter.** A string identifier for the pre-integrated AI provider. 38 |  | 'CB' for Chatbase, or 'OAI' for ChatGPT. 39 |
| botName | String |  | **Crucial Parameter.** The unique, user-defined name assigned to the bot configuration. 40 | 'Alice5' |  |
| resLength | Integer | [cite\_start](https://www.google.com/search?q=Optional) A suggestion for the maximum response length in words. 41 | 100 |  |  |
| xData1, xData2 | String | [cite\_start](https://www.google.com/search?q=Optional) Custom data fields that can be passed with the API call. 42 | "" (or null) |  |  |

This parameter set demonstrates that the

sayAI function acts as a pointer; configuration details like a system prompt must be set up beforehand within the third-party AI platform itself. 43

---

### **Section 1.3: Integration Pathways for Your Knowledge Base**

There are two primary architectural patterns for connecting a Sitepal agent to an AI Bot. 44

#### **Subsection 1.3.1: The Pre-Integrated Approach (Recommended for Simplicity)**

This is the most direct method for connecting to popular AI services that Sitepal has officially partnered with, such as ChatGPT and Chatbase. 45This approach minimizes development complexity by leveraging Sitepal's backend to manage the secure communication with the AI provider. 46 The process is:

1. **Configure the Bot in Sitepal:** In the Sitepal account's "Connect" page, add an API key from the chosen third-party AI provider (e.g., an OpenAI API key) and give this connection a unique botName. 47  
2. **Embed the Sitepal Scene:** Copy the embed code for your avatar scene from the Sitepal platform into your webpage. 48  
3. **Implement the API Call:** In your webpage's JavaScript, create an event handler that calls the sayAI() function, passing the user's text along with the correct botVendor and botName. 49

#### **Subsection 1.3.2: The Custom Integration Approach (Advanced)**

For AI providers not pre-integrated with Sitepal, a more involved integration using a

**Server-Side Relay (or Proxy)** is necessary. 50505050This pattern is required for security, as it prevents your secret API key from being exposed in the browser. 51The architectural flow is as follows52:

1. **Client-Side Request:** JavaScript on your website captures the user's question. 53  
2. **Call to Your Server:** The JavaScript makes a fetch or AJAX call to a custom endpoint on your own server (e.g., POST /api/ask-bot). 54  
3. **Server-Side Relay:** Your server's backend code receives the request and makes a secure, server-to-server API call to the third-party AI vendor, including the secret API key. 55  
4. **AI Response to Server:** The AI vendor sends its text response back to your server. 56  
5. **Response to Client:** Your server relays the AI's response back to the client-side JavaScript. 57  
6. **Avatar Speaks:** The client-side JavaScript receives the text and calls the Sitepal sayText() function to make the avatar speak it. 58

| Feature | Pre-Integrated (sayAI) | Custom Relay (sayText) |  |  |
| :---- | :---- | :---- | :---- | :---- |
| **Complexity** | Low (client-side only) 59 | High (front-end and back-end) 60 |  |  |
| **Security** | High (Sitepal manages the key) 61 | Developer's responsibility 62 |  |  |
| **Flexibility** | Limited to pre-integrated vendors 63 | Unlimited (any REST API) 64 |  |  |
| **Primary API Call** |  | sayAI() 65 |  | sayText() 66 |
| **Key Management** | Stored in Sitepal "Connect" page 67 | Stored on developer's server 68 |  |  |

---

### **Section 1.4: Providing the Knowledge Base and System Prompt**

A common requirement is to provide the AI Agent with a specific knowledge base and a system prompt. 69These elements are

**not** configured through Sitepal's API calls. 70The locus of control resides entirely within the third-party AI platform. 71Sitepal's role is that of a presentation layer. 72

* **Knowledge Base Configuration:** This is handled directly on the chosen AI provider's platform, typically by uploading documents (PDFs, text files), providing URLs to scrape, or entering question-and-answer pairs. 73  
* **System Prompt Configuration:** The bot's persona, rules, and instructions are defined in the "system prompt" or "custom instructions" section within the AI provider's dashboard. 74

### **Section 1.5: Enhancing User Interaction with Speech-to-Text (STT)**

To allow users to speak their questions, you can implement Speech-to-Text (STT). 75The core technology is the

**Web Speech API**, which is built into most modern browsers. 76It is critical to account for browser compatibility, as Firefox has notable exceptions. 77A best practice is to detect if the API is available and gracefully degrade to a text input field if it is not. 78

---

## **Part II: Enabling Customer Avatar Creation on Your Platform**

This addresses the advanced objective of allowing your own customers to create, customize, and use Sitepal avatars. 79

### **Section 2.1: Understanding Sitepal's Advanced API Tiers & The Avatar Framework**

This functionality is not available through standard Sitepal plans (Silver, Gold, Platinum) but is exclusively part of a distinct B2B product called the

**Sitepal Avatar Framework**. 80

| API Tier | Purpose | Key Capabilities | Required Plan / Product |  |
| :---- | :---- | :---- | :---- | :---- |
| **Client API** | Control an embedded avatar's behavior. 81 |  | sayAI, sayText, setFacialExpression. 82 | Silver Plan or higher 83 |
| **Server API** | Remotely manage accounts and assets. 84 | User/scene management, TTS/video generation. 85 | Platinum or Avatar Framework 86 |  |
| **Editor-Integration API** | Securely launch the Sitepal avatar editor. 87 | Launch editor for a specific user, handle save callbacks. 88 | Sitepal Avatar Framework Only 89 |  |

The key takeaway is that the Client API is for controlling an existing avatar, while the Server and Editor-Integration APIs are required for user-based creation and are part of the Avatar Framework. 90

### **Section 2.2: The Editor-Integration API: Your Gateway to User Creation**

The Avatar Framework does not provide a raw API for building an editor from scratch. 91Instead, it provides a mechanism to securely embed and launch Sitepal's own powerful, pre-built editor. 92

The core of this integration is the

LaunchEditor.php endpoint. 93A call to this endpoint requires secure parameters, including a Partner ID (

PID), the partner's user ID (UID), a single-use session token (TKN), and a checksum (CS) calculated with a secret phrase to verify authenticity. 94949494The system uses a server-to-server verification handshake to ensure security before launching the editor. 95

### **Section 2.3: Implementation Workflow for User-Generated Avatars**

The end-to-end process involves a coordinated sequence:

1. **Initiate from UI:** A user clicks a "Create Your Avatar" button on your site. 96  
2. **Request to Backend:** The browser sends a request to your backend server. 97  
3. **Generate Secure URL:** Your backend generates the full, secure URL for LaunchEditor.php, including a new token and checksum. 98  
4. **Redirect to Sitepal:** Your server redirects the user's browser to the generated Sitepal URL. 99  
5. **Editor Experience:** After a security handshake, the Sitepal editor loads for the user. 100  
6. **Save and Callback:** When the user clicks "Save," Sitepal's server makes a POST request to a pre-configured endpoint on your backend, providing the new SceneID. 101  
7. **Store Scene Data:** Your backend receives this callback and stores the new SceneID in your database, associating it with the user. 102

### **Section 2.4: Managing User-Generated Content with the Server API**

The Sitepal Server API provides tools for programmatic management of user accounts and assets, including scenes and uploaded media. 103103103103103103103103103It can also be used to programmatically generate TTS audio or videos from a user's scene. 104

---

## **Part III: Advanced Customization and Best Practices**

### **Section 3.1: Mastering Text-to-Speech (TTS) Customization**

The

**ttsdemo.com** website is a valuable tool for sampling Sitepal's TTS voices and languages. 105 To use a specific voice:

1. Navigate to ttsdemo.com or aispeechdemo.com. 106  
2. Select and sample various languages and voices. 107  
3. Hover over the 'cloud' icon to the right of the voice selection. 108  
4. A tooltip will display the numeric IDs for the Voice ID, Language ID, and Engine ID. 109  
5. Use these three IDs as parameters in any  
    sayAI or sayText API call. 110

### **Section 3.2: Integrating with Modern JavaScript Frameworks**

Sitepal provides official support and resources for integration with frameworks like React, Angular, Vue, and NextJS. 111

* **Key Adaptation:** When embedding a scene in a component-based framework, the context parameter (the 10th parameter in AC\_Vhost\_Embed) must be changed from its default to 1. 112  
* **Official NPM Packages:** To simplify integration, Sitepal maintains official NPM packages like sitepal-react-v2 for React and NextJS applications. 113

### **Section 3.3: API Callbacks and Asynchronous Event Handling**

A common pitfall is the race condition: attempting to interact with the avatar before it has fully loaded. 114API calls made before the scene is initialized will fail. 115

The correct way to manage this is by using Sitepal's event callback system. 116The most important of these is the

vh\_sceneLoaded callback. 117This is a JavaScript function you define in the global scope, which Sitepal's code will automatically invoke once the avatar is fully loaded and ready for API calls. 118A best practice is to defer all API interactions until this event has fired. 119

JavaScript  
// This function must be defined in the global scope of your page  
// to be detected by the Sitepal environment.  
function vh\_sceneLoaded (slideIndex, portal) {  
    console.log("The Sitepal Scene is now fully loaded and ready for API calls.");  
    // It is now safe to make API calls.  
    // For example, make the avatar speak a welcome message on load.  
    sayText("Welcome to our interactive experience\!", 3, 1, 3);  
}

120

Other useful callbacks, such as

vh\_talkStarted and vh\_talkEnded, can be used to synchronize UI elements with the avatar's speech. 121

---

## **Conclusion and Strategic Recommendations**

The analysis confirms that Sitepal offers a powerful platform, but the implementation paths for an AI Agent and user-generated avatars are fundamentally different. 122

* **Path 1: The AI Agent** is accessible via the Gold Plan and is primarily a client-side integration task using the Client API. 123  
* **Path 2: User-Generated Avatars** requires the Sitepal Avatar Framework product and involves significant back-end development. 124

A phased implementation strategy is recommended:

1. **Phase 1 \- Master the AI Agent:** Begin by implementing the AI Agent using a Gold Plan subscription. 125This allows the development team to gain hands-on experience with the Sitepal Client API, embedding, TTS, and callbacks. 126  
2. **Phase 2 \- Evaluate and Architect for the Avatar Framework:** After deploying the AI Agent, undertake a thorough evaluation for the Avatar Framework. 127This should involve discussions with Sitepal's sales team and architecting the necessary backend infrastructure. 128

This phased approach mitigates risk by tackling the less complex objective first and enabling a more informed decision regarding the significant commitment required for the Avatar Framework. 129

### **Works Cited**

1. Implementing\_Your\_Al\_Agent\_W\_Code.pdf 130  
2. Talking Characters For Your Website \- SitePal, accessed June 23, 2025,  
    [https://sitepal.com/features/ai](https://sitepal.com/features/ai) 131  
3. Product Updates Archives \- SitePal, accessed June 23, 2025 132  
4. General/ SitePal, accessed June 23, 2025 133  
5. General/ SitePal, accessed June 23, 2025,  
    [https://community.sitepal.com/?page=3](https://community.sitepal.com/?page=3) 134  
6. SitePal Technical Note: Using the Text-To-Speech API, accessed June 23, 2025,  
    [https://www.sitepal.com/docs/Using](https://www.sitepal.com/docs/Using) The TTS API.pdf 135  
7. SitePal Technical Note: Using the Text-To-Speech API \- Oddcast, accessed June 23, 2025,  
    [http://www-vs.oddcast.com/support/docs/vhost\_Tech\_Note\_5.pdf](http://www-vs.oddcast.com/support/docs/vhost_Tech_Note_5.pdf) 136  
8. SitePal Client API Reference, accessed June 23, 2025,  
    [https://www.sitepal.com/docs/SitePal](https://www.sitepal.com/docs/SitePal) API Reference.pdf 137  
9. Best Text-to-Speech Demo: Create Talking Avatars and Online Characters | Oddcast TTS Demo, accessed June 23, 2025,  
    [https://ttsdemo.com/](https://ttsdemo.com/) 138  
10. Oddcast Support \- sayAl \- SitePal, accessed June 23, 2025,  
     [https://www.sitepal.com/api/examples/sayAI-STT.html](https://www.sitepal.com/api/examples/sayAI-STT.html) 139  
11. New 2-Way Speech Demo \- SitePal, accessed June 23, 2025 140  
12. Speech Input & 3rd Party Al Connectivity \- SitePal, accessed June 23, 2025 141  
13. SitePal API, accessed June 23, 2025,  
     [http://www-vs.sitepal.com/api/](http://www-vs.sitepal.com/api/) 142  
14. Talking Characters For Your Website \- SitePal, accessed June 23, 2025,  
     [https://www.sitepal.com/features/api](https://www.sitepal.com/features/api) 143  
15. SitePal Avatar Framework, accessed June 23, 2025,  
     [http://www-vs.sitepal.com/avatar-framework/](http://www-vs.sitepal.com/avatar-framework/) 144  
16. Avatar Framework Integration API Release 1.7 \- Sitepal, accessed June 23, 2025,  
     [http://www-vs.sitepal.com/pdf/avatar](http://www-vs.sitepal.com/pdf/avatar) framwork API.pdf 145  
17. Features Overview \- SitePal, accessed June 23, 2025,  
     [https://www.sitepal.com/features](https://www.sitepal.com/features) 146  
18. Oddcast Account Management API \- SitePal, accessed June 23, 2025,  
     [https://www.sitepal.com/docs/SitePal](https://www.sitepal.com/docs/SitePal) Server API.pdf 147  
19. What Makes SitePal Unique?, accessed June 23, 2025,  
     [https://www.sitepal.com/why-SitePal](https://www.sitepal.com/why-SitePal) 148  
20. Best Text-to-Speech Demo: Create Talking Avatars and Online Characters Oddcast, accessed June 23, 2025,  
     [https://www.oddcast.com/aidemo/index.php](https://www.oddcast.com/aidemo/index.php) 149  
21. Official Support Page \- SitePal, accessed June 23, 2025,  
     [https://www.sitepal.com/support](https://www.sitepal.com/support) 150  
22. Embedding SitePal in JavaScript Frameworks, accessed June 23, 2025,  
     [https://www.sitepal.com/docs/Embed](https://www.sitepal.com/docs/Embed) SitePal in JS Frameworks.pdf 151  
23. Sitepal React, accessed June 23, 2025,  
     [https://www.sitepal.com/api/examples/react/index.html](https://www.sitepal.com/api/examples/react/index.html) 152  
24. Client API Reference v16.4 \- Mar 21st 2021 Oddcast Inc., accessed June 23, 2025,  
     [https://www-vs.oddcast.com/support/docs/vhost](https://www-vs.oddcast.com/support/docs/vhost) API Reference.pdf 153  
25. Avatar Framework Client API Reference \- Sitepal, accessed June 23, 2025,  
     [http://www-vs.sitepal.com/pdf/avatar\_framework\_client\_api.pdf](http://www-vs.sitepal.com/pdf/avatar_framework_client_api.pdf) 154

