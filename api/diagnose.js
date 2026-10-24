export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI service is not configured. Add OPENAI_API_KEY in Vercel environment variables, then redeploy.' });

  const body = req.body || {};
  const language = body.language === 'es' ? 'Spanish' : 'English';
  const equipment = clean(body.equipment, 100);
  const vehicle = clean(body.vehicle, 180);
  const problem = clean(body.problem, 2500);
  const photo = validatePhoto(body.photo);
  if (photo.error) return res.status(400).json({ error: photo.error });
  if (!problem) return res.status(400).json({ error: language === 'Spanish' ? 'Describe los síntomas.' : 'Please describe the symptoms.' });

  const isTesla = /tesla|electric vehicle|ev |veh[ií]culo el[eé]ctrico|auto el[eé]ctrico/i.test(`${equipment} ${vehicle} ${problem}`);
  const instructions = `You are FixAnything AI, a cautious bilingual vehicle and equipment troubleshooting assistant. Reply entirely in ${language}. Help users understand possible causes and safe preliminary checks, not a definitive diagnosis. Be practical, plain-spoken, and organized. Start by saying this is preliminary guidance, not a confirmed diagnosis. Provide (1) brief summary, (2) likely causes ranked as possibilities, (3) safe checks in order, (4) what results may mean, (5) when to stop and call a qualified technician. Ask up to 3 essential follow-up questions if key details are missing. Never invent exact specifications, torque values, wiring pinouts, fluid capacities, or part compatibility; say to verify using the exact service manual/VIN. Do not claim a photo proves a fault; describe only visible features and uncertainty. Never advise disabling emissions or safety systems, bypassing interlocks, defeating neutral safety switches, working under unsupported equipment, or dangerous high-voltage, pressurized fuel, airbag, brake, or lifting operations without appropriate training. For signs of fire, fuel leak, carbon monoxide, brake failure, unstable lifting equipment, or immediate danger, advise stopping, moving to safety if possible, and contacting emergency/qualified help. ${isTesla ? 'TESLA / HIGH-VOLTAGE RULE: Treat this as an electric vehicle. Do not instruct the user to open, disconnect, probe, repair, or touch the high-voltage battery, orange cables, inverter, drive unit, pyrotechnic disconnect, or high-voltage components. Do not suggest DIY battery pack repairs. Recommend Tesla service or an EV-qualified technician for high-voltage, battery, charging, or isolation faults. Limit user checks to low-risk external observations, dashboard messages, tire condition, 12V symptoms, charging cable/charger status, and owner-manual procedures.' : ''} Keep answer concise and useful.`;
  const text = `Equipment category: ${equipment || 'Not specified'}\nYear/make/model: ${vehicle || 'Not specified'}\nReported symptoms: ${problem}${photo.data ? '\nA customer photo is attached. Inspect it cautiously and distinguish visible observations from guesses.' : ''}`;
  const content = [{ type: 'input_text', text }];
  if (photo.data) content.push({ type: 'input_image', image_url: photo.data, detail: 'low' });

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions,
        input: [{ role: 'user', content }],
        max_output_tokens: 1100
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('OpenAI API error status:', upstream.status, 'request_id:', data?.request_id || 'not provided');
      return res.status(502).json({ error: language === 'Spanish' ? 'El servicio de IA no pudo completar la solicitud. Inténtalo de nuevo.' : 'The AI service could not complete the request. Please try again.' });
    }
    const answer = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
    if (!answer) return res.status(502).json({ error: language === 'Spanish' ? 'La IA devolvió una respuesta vacía. Inténtalo de nuevo.' : 'The AI returned an empty response. Please try again.' });
    return res.status(200).json({ answer, photoAnalyzed: Boolean(photo.data) });
  } catch (error) {
    console.error('Diagnostic request failed:', error?.message || 'unknown error');
    return res.status(502).json({ error: language === 'Spanish' ? 'No se pudo conectar con el servicio de IA. Inténtalo de nuevo.' : 'Could not reach the AI service. Please try again.' });
  }
}

function clean(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '';
}
function validatePhoto(value) {
  if (value == null || value === '') return { data: null };
  if (typeof value !== 'string') return { error: 'Invalid photo data.' };
  // Keep comfortably below serverless request-body limits. Client also compresses images.
  if (value.length > 2_400_000) return { error: 'Photo is too large. Choose a smaller image (under about 1.5 MB after compression).' };
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { error: 'Use a JPG, PNG, WEBP, or GIF image.' };
  return { data: value };
}
