// Netlify Function: Generate single block
// Save this as: netlify/functions/generate-block.js

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse request
  const { blockIndex, textInfo, questions } = JSON.parse(event.body);

  // Build question list
  const questionList = questions.map((q, idx) => 
    `${idx + 1}. [${q.question_type === 'multiple_choice' ? 'MC' : 'SA'}] ${q.question_template}`
  ).join('\n');

  const aiPrompt = `Vygeneruj textovú ukážku pre NÚCEM test.

TYP: ${textInfo.desc}
AUTOR/TÉMA: Vyber náhodne z: ${textInfo.authors}
DĹŽKA: 200-300 slov

Potom ODPOVEDZ na tieto KONKRÉTNE otázky o tvojom texte:

${questionList}

FORMÁT ODPOVEDE - vráť validný JSON:
{
  "title": "Názov diela/textu",
  "text": "Celý text ukážky (200-300 slov). Použi [[text]] na zvýraznenie ak treba.",
  "author": "Meno autora",
  "genre": "${textInfo.type}",
  "questions": [
    {
      "id": 1,
      "question": "presný text otázky",
      "type": "multiple_choice",
      "options": ["(A) možnosť 1", "(B) možnosť 2", "(C) možnosť 3", "(D) možnosť 4"],
      "correct": "A"
    },
    {
      "id": 2,
      "question": "presný text otázky",
      "type": "short_answer",
      "correct": "presná odpoveď"
    }
  ]
}

PRAVIDLÁ:
- Text MUSÍ byť 200-300 slov, realistický
- Multiple choice: 4 možnosti, odpoveď iba "A", "B", "C" alebo "D"
- Short answer: PRESNÁ odpoveď (1-3 slová)
- Ak otázka vyžaduje gramatiku (spodobovanie, slovný druh), text MUSÍ obsahovať príklady
- Ak otázka vyžaduje literárny prostriedok (metafora), text MUSÍ ho obsahovať
- Použitím [[text]] v texte vytvoríš zvýraznenie

Vráť VÝLUČNE validný JSON bez markdown blokov.`;

  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Si expert na tvorbu textov pre slovenské maturitné testy NÚCEM. Vraciaš VÝLUČNE validný JSON.' },
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
        block: parsed,
        questionIds: questions.map(q => q.id)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
