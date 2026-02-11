// Netlify Function: Generate 8 questions for a specific text (Phase 2)

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { blockIndex, textInfo, textData } = JSON.parse(event.body);

    const aiPrompt = `Máš text a musíš vytvoriť 8 otázok O TOMTO KONKRÉTNOM TEXTE.

TEXT:
Názov: ${textData.title}
Autor: ${textData.author}
Žáner: ${textData.genre}

${textData.text}

VYTVOR 8 OTÁZOK O TOMTO TEXTE:
- 5 multiple choice (MC)
- 3 short answer (SA)

⚠️ KRITICKÉ PRAVIDLÁ:
1. KAŽDÁ otázka MUSÍ byť o KONKRÉTNOM obsahu tohto textu
2. Otázky musia byť zodpovedateľné IBA z tohto textu
3. Ak sa pýtaš "Vypíšte slovo..." - musí existovať v texte
4. Ak sa pýtaš "V ktorej možnosti..." - všetky možnosti musia byť z textu
5. NIKDY nevymýšľaj otázky o veciach, ktoré NIE SÚ v texte!

TYPY OTÁZOK (vyber zmysluplne):
- Obsah: hlavná myšlienka, postavy, dej, nálada, posolstvo
- Literárne prostriedky: metafora, epiteton, personifikácia, protiklad (IBA ak sú v texte!)
- Gramatika: slovný druh konkrétneho slova, morfológia, syntax (IBA ak je v texte!)
- Štýl: typ rozprávača, osoba rozprávania, tempo, atmosféra
- Porozumenie: čo chcel autor vyjadriť, význam časti, interpretácia

FORMÁT ODPOVEDE (validný JSON):
{
  "questions": [
    {
      "id": 1,
      "question": "Konkrétna otázka o TOMTO texte",
      "type": "multiple_choice",
      "options": ["(A) odpoveď z textu", "(B) odpoveď z textu", "(C) odpoveď z textu", "(D) odpoveď z textu"],
      "correct": "A"
    },
    {
      "id": 2,
      "question": "Konkrétna otázka s jasnou odpoveďou",
      "type": "short_answer",
      "correct": "presná odpoveď (1-3 slová)"
    }
  ]
}

PRAVIDLÁ PRE ODPOVEDE:
- MC: odpoveď iba "A", "B", "C", alebo "D" (NIE "(A)")
- SA: PRESNÁ odpoveď (1-3 slová), nie viac variant
- Všetky 4 možnosti v MC musia dávať zmysel
- Správna odpoveď musí byť jednoznačne správna
- Nesprávne odpovede musia byť zjavne nesprávne
- NIKDY neuvádzaj správnu odpoveď v možnostiach v zátvorke

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
            content: 'Si expert na slovenské maturitné testy. VŽDY tvoríš otázky o KONKRÉTNOM texte, nie všeobecné otázky. Vraciaš VÝLUČNE validný JSON.' 
          },
          { role: 'user', content: aiPrompt }
        ],
        temperature: 0.7,
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

    // Validate and clean answers
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
        questions: parsed.questions
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
