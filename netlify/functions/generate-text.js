// Netlify Function: Generate text passage only (Phase 1)

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { blockIndex, textInfo } = JSON.parse(event.body);

    const aiPrompt = `Vygeneruj textovú ukážku pre NÚCEM test.

TYP: ${textInfo.desc}
AUTOR/TÉMA: Vyber náhodne z: ${textInfo.authors}
DĹŽKA: 200-300 slov

POŽIADAVKY:
- Text MUSÍ byť realistický a kvalitný
- Text MUSÍ obsahovať prvky na ktoré sa dajú spýtať otázky (postavy, literárne prostriedky, gramatické javy, špecifické slová)
- Pre prózu: jasné postavy, dej, miesto
- Pre poéziu: rým, metafora, epiteton, konkrétne verše
- Pre publicistiku: fakty, dátumy, mená, čísla, pojmy
- Pre drámu: jasné repliky, postavy, scénické poznámky

FORMÁT ODPOVEDE (validný JSON):
{
  "title": "Názov diela/textu",
  "text": "Celý text (200-300 slov). [[zvýraznený text]] ak treba.",
  "author": "Meno autora",
  "genre": "${textInfo.type}"
}

Vráť VÝLUČNE validný JSON bez markdown blokov.`;

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'Si expert na slovenské maturitné testy. Píšeš vysokú kvalitu literárnych textov. Vraciaš VÝLUČNE validný JSON.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.9,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: errorData.error?.message || 'OpenAI API error' })
      };
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    
    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        text: parsed
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
