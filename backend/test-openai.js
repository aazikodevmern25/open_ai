const dotenv = require('dotenv');
dotenv.config();

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API Key...');
    console.log('API Key (first 20 chars):', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Say 'Hello! Your OpenAI API key is working!' in one sentence."
        }
      ],
      max_tokens: 50
    });

    console.log('\n✅ SUCCESS! OpenAI API Key is working!\n');
    console.log('Response:', completion.choices[0].message.content);
    console.log('\nAPI Usage:');
    console.log('- Prompt tokens:', completion.usage.prompt_tokens);
    console.log('- Completion tokens:', completion.usage.completion_tokens);
    console.log('- Total tokens:', completion.usage.total_tokens);
    console.log('- Estimated cost: $' + (completion.usage.total_tokens * 0.000002).toFixed(6));
    
  } catch (error) {
    console.error('\n❌ ERROR: OpenAI API Key test failed!\n');
    console.error('Error message:', error.message);
    
    if (error.status === 401) {
      console.error('\n⚠️  Invalid API Key - Please check your key in .env file');
    } else if (error.status === 429) {
      console.error('\n⚠️  Rate limit or quota exceeded - Check your OpenAI billing');
    }
  }
}

testOpenAI();
