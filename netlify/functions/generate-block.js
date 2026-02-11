// Netlify Function: Generate single block
// This version generates text FIRST, then answers questions about THAT text

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { blockIndex, textInfo, questions } = JSON.parse(event.body);

    // Build question list with templates
    const questionList = questions.map((q, idx) => {
      const type = q.question_type === 'multiple_choice' ? 'MC' : 'SA';
      return `${idx + 1}. [${type}] ${q.question_template}`;
    }).join('\n');

    const aiPrompt = `Vygeneruj textovú ukážku pre NÚCEM test a potom na ňu vytvor otázky.

KROK 1 - VYGENERUJ TEXT:
- Typ: ${textInfo.desc}
- Autor/téma: ${textInfo.authors}
- Dĺžka: 200-300 slov
- Text MUSÍ obsahovať elementy potrebné na otázky (gramatické javy, literárne prostriedky, konkrétne slová)

KROK 2 - VYTVOR OTÁZKY PODĽA TÝCHTO ŠABLÓN:
${questionList}

⚠️ KRITICKÉ PRAVIDLÁ:
1. Otázky MUSIA byť o KONKRÉTNOM texte, ktorý si práve napísal
2. Ak otázka hovorí "Vypíšte z ukážky..." - musí existovať konkrétne slovo v texte
3. Ak otázka hovorí "V ktorej možnosti..." - všetky možnosti musia byť z textu alebo o texte
4. NIKDY nevymýšľaj otázky o veciach, ktoré NIE SÚ v texte!
5. Pre gramatické otázky (spodobovanie, slovný druh): text MUSÍ obsahovať jasné príklady
6. Pre literárne prostriedky (metafora, epiteton): text ich MUSÍ obsahovať

FORMÁT ODPOVEDE (validný JSON):
{
  "title": "Názov diela",
  "text": "Celý text (200-300 slov). [[zvýraznený text]] ak treba.",
  "author": "Meno autora",
  "genre": "${textInfo.type}",
  "questions": [
    {
      "id": 1,
      "question": "Konkrétna otázka o TOMTO texte",
      "type": "multiple_choice",
      "options": ["(A) z textu", "(B) z textu", "(C) z textu", "(D) z textu"],
      "correct": "A"
    },
    {
      "id": 2,
      "question": "Otázka s jasnou odpoveďou",
      "type": "short_answer",
      "correct": "presná odpoveď"
    }
  ]
}

PRAVIDLÁ PRE ODPOVEDE:
- Multiple choice: odpoveď iba "A", "B", "C" alebo "D" (NIE "(A)")
- Short answer: PRESNÁ odpoveď (1-3 slová), nie viac variant
- Všetky 4 možnosti v MC musia dávať zmysel
- Správna odpoveď musí byť jednoznačne správna
- Nesprávne odpovede musia byť zjavne nesprávne

Vráť VÝLUČNE validný JSON.`;

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
            content: 'Si expert na slovenské maturitné testy. VŽDY píš otázky o KONKRÉTNOM texte, nie všeobecné otázky. Vraciaš VÝLUČNE validný JSON.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.8,
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

    // Validate answers
    parsed.questions.forEach((q, idx) => {
      if (q.type === 'multiple_choice') {
        // Clean correct answer - remove any "(A)" formatting, keep just "A"
        q.correct = q.correct.replace(/[()]/g, '').trim().toUpperCase();
        
        // Validate it's A, B, C, or D
        if (!['A', 'B', 'C', 'D'].includes(q.correct)) {
          console.error(`Invalid MC answer for question ${idx + 1}:`, q.correct);
          q.correct = 'A'; // Default to A if invalid
        }
      }
    });
    
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
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
