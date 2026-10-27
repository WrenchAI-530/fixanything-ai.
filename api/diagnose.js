
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'AI service is not configured. Add OPENAI_API_KEY in Vercel environment variables, then redeploy.'
    });
  }

  const body = req.body || {};
  const language = body.language === 'es' ? 'Spanish' : 'English';
  const spanish = language === 'Spanish';
  const equipment = clean(body.equipment, 100);
  const vehicle = clean(body.vehicle, 180);
  const problem = clean(body.problem, 2500);
  const photo = validatePhoto(body.photo);

  if (photo.error) {
    return res.status(400).json({ error: photo.error });
  }

  if (!problem) {
    return res.status(400).json({
      error: spanish ? 'Describe los síntomas.' : 'Please describe the symptoms.'
    });
  }

  const isTesla =
    /tesla|electric vehicle|\bev\b|veh[ií]culo el[eé]ctrico|auto el[eé]ctrico/i
      .test(`${equipment} ${vehicle} ${problem}`);

  const instructions = `
You are FixAnything AI, a careful bilingual troubleshooting assistant
for vehicles, household equipment, tools, and machinery.

Reply entirely in ${language}. Understand everyday language, common
misspellings, informal wording, and mechanic slang. Interpret what the
customer most likely means, but ask a brief clarifying question when
different interpretations could change the diagnosis or create danger.

Treat all diagnoses as possibilities, not confirmed facts. Use clear,
plain language suitable for beginners. Organize the response into:
1. Preliminary assessment, not a confirmed diagnosis.
2. Possible causes, ranked by likelihood when justified.
3. Safe checks in order, starting with the least risky.
4. What the results might mean.
5. When to stop and seek qualified professional help.

Ask up to 3 important follow-up questions if needed. Never invent
specifications, torque values, wiring pinouts, fluid capacities, or
part compatibility. Tell users to verify these with the exact service
manual and vehicle identification details. A photo does not prove a
fault; distinguish visible observations from guesses.

MANDATORY SAFETY RULES:
- Never tell users to touch hot radiator hoses, open a hot radiator
  cap, or open a hot pressurized cooling system. Shut down an
  overheating engine when safe and allow it to cool completely. Do not tell users to run an overheating engine to watch the fan
  or touch a hose to test the thermostat. Keep hands, clothing,
  tools, and body parts away from moving fans and belts. Use visual
  checks only with the engine off and when safe. If a test requires
  a running engine, electrical probing, or pressure testing, direct
  the user to a qualified technician.
  - For beginner users, never recommend running an overheating
  engine as a diagnostic test or asking the user to observe
  a running cooling fan. Do not recommend touching hoses to
  diagnose temperature or thermostat problems. Recommend
  shutting the engine off when safe, allowing it to cool fully,
  and using only safe visual checks. Refer running-engine tests
  and specialized diagnosis to a qualified technician.
  Do not ask beginners to perform a fan test; ask whether they have already noticed fan behavior, and refer further testing to a qualified technician.
- Warn about hot exhausts, burns, steam, stored pressure, and
  pressurized fuel, air, hydraulic, and cooling systems.
- Never advise working under a vehicle supported only by a jack.
  Require properly rated jack stands or approved lifting equipment
  on firm, level ground, with appropriate wheel restraints.
- Never advise putting hands or tools near moving belts, fans, or
  machinery. Electric fans may start unexpectedly.
- Never advise bypassing safety interlocks, disabling emissions or
  safety systems, or attempting untrained brake, airbag, or other
  high-risk repairs.
- For fire, fuel leaks, suspected carbon monoxide, brake failure,
  unstable lifting, or immediate danger, tell the user to stop,
  move to safety if possible, and get qualified or emergency help.
- Recommend appropriate PPE, manufacturer procedures, and
  professional help whenever a task exceeds the user's skills.
- Do not claim this guidance guarantees safety.

${isTesla ? `
ELECTRIC VEHICLE / TESLA SAFETY:
Treat this as a high-voltage electric vehicle. Never instruct the
customer to open, disconnect, probe, or repair the high-voltage
battery, orange cables, inverter, drive unit, or high-voltage
components. Do not suggest DIY battery-pack repairs. Refer
high-voltage, battery, charging, and isolation faults to Tesla
service or an EV-qualified technician. Limit customer checks to
safe external observations, dashboard messages, tire condition,
charging equipment status, and owner-manual procedures.
` : ''}

Do not repeat the full safety disclaimer; it will be added automatically.
Keep the diagnostic guidance practical, concise, and easy to follow.
`;

  const text =
    `Equipment category: ${equipment || 'Not specified'}\n` +
    `Year/make/model: ${vehicle || 'Not specified'}\n` +
    `Reported symptoms: ${problem}` +
    (photo.data
      ? '\nA customer photo is attached. Describe visible features cautiously.'
      : '');

  const content = [{ type: 'input_text', text }];
  if (photo.data) {
    content.push({
      type: 'input_image',
      image_url: photo.data,
      detail: 'low'
    });
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions,
        input: [{ role: 'user', content }],
        max_output_tokens: 1400
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(
        'OpenAI API error status:',
        upstream.status,
        'request_id:',
        data?.request_id || 'not provided'
      );
      return res.status(502).json({
        error: spanish
          ? 'El servicio de IA no pudo completar la solicitud. Inténtalo de nuevo.'
          : 'The AI service could not complete the request. Please try again.'
      });
    }

    const answer = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('\n')
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: spanish
          ? 'La IA devolvió una respuesta vacía. Inténtalo de nuevo.'
          : 'The AI returned an empty response. Please try again.'
      });
    }

    const disclaimer = spanish
      ? `\n\n⚠️ AVISO UNIVERSAL DE SEGURIDAD\nEsta información es orientativa y puede ser incompleta o incorrecta; no es un diagnóstico confirmado ni sustituye el manual de servicio, la capacitación o una inspección profesional. Usted es responsable de evaluar los riesgos, utilizar el EPP adecuado y seguir los procedimientos del fabricante. Tenga cuidado con superficies calientes, vapor, presión almacenada, electricidad y piezas móviles. Apague el equipo cuando sea seguro y deje que se enfríe completamente antes de revisarlo. Nunca abra un sistema de refrigeración caliente ni trabaje debajo de un vehículo sostenido solo por un gato; utilice soportes de seguridad adecuados sobre una superficie firme y nivelada. En vehículos eléctricos, no toque componentes de alto voltaje. Deténgase si no sabe cómo realizar el trabajo de forma segura y consulte a un profesional calificado.`
      : `\n\n⚠️ UNIVERSAL SAFETY DISCLAIMER\nThis information is general guidance and may be incomplete or incorrect; it is not a confirmed diagnosis and does not replace the service manual, professional training, or a qualified inspection. You are responsible for assessing risks, using appropriate PPE, and following manufacturer procedures. Beware of hot surfaces, steam, stored pressure, electricity, and moving parts. Shut equipment down when safe and allow it to cool completely before inspection. Never open a hot cooling system or work under a vehicle supported only by a jack; use properly rated safety stands on firm, level ground. Never touch high-voltage EV components. Stop if you cannot perform the work safely and consult a qualified professional.`;

    const videoTerms = [
      vehicle,
      equipment,
      problem,
      spanish ? 'reparación tutorial español' : 'repair tutorial English'
    ].filter(Boolean).join(' ');

    const videoUrl =
      'https://www.youtube.com/results?search_query=' +
      encodeURIComponent(videoTerms);

    const videoSection = spanish
      ? `\n\n🎥 VIDEOS DE REPARACIÓN EN YOUTUBE\nBusca demostraciones relacionadas aquí:\n${videoUrl}\nEstos son resultados de terceros; no están verificados ni respaldados por FixAnything AI. Comprueba que el video corresponda exactamente a tu modelo y sigue las precauciones de seguridad.`
      : `\n\n🎥 YOUTUBE REPAIR VIDEOS\nFind related repair demonstrations here:\n${videoUrl}\nThese are third-party search results and are not verified or endorsed by FixAnything AI. Check that a video matches your exact model and follow appropriate safety precautions.`;

    return res.status(200).json({
      answer: answer + disclaimer + videoSection,
      photoAnalyzed: Boolean(photo.data),
      videoSearchUrl: videoUrl
    });
  } catch (error) {
    console.error(
      'Diagnostic request failed:',
      error?.message || 'unknown error'
    );
    return res.status(502).json({
      error: spanish
        ? 'No se pudo conectar con el servicio de IA. Inténtalo de nuevo.'
        : 'Could not reach the AI service. Please try again.'
    });
  }
}

function clean(value, max) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim().slice(0, max)
    : '';
}

function validatePhoto(value) {
  if (value == null || value === '') return { data: null };
  if (typeof value !== 'string') return { error: 'Invalid photo data.' };

  if (value.length > 2_400_000) {
    return {
      error: 'Photo is too large. Choose a smaller image (under about 1.5 MB after compression).'
    };
  }

  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) {
    return { error: 'Use a JPG, PNG, WEBP, or GIF image.' };
  }

  return { data: value };
}
