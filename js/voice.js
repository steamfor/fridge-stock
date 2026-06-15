// ─────────────────────────────────────────────
// ASSISTANT VOCAL IA
// Parle → l'IA met à jour le stock
// ─────────────────────────────────────────────

let _voiceRecognition = null;
let _voiceListening   = false;
let _voiceActive      = false;

function openVoice() {
  if (!_checkVoiceSupport()) return;
  _voiceActive = true;
  document.getElementById('voice-transcript').textContent = '';
  document.getElementById('voice-response').textContent   = '';
  document.getElementById('modal-voice').classList.add('open');
  _setVoiceStatus('idle');
  _speak('Bonjour ! Dites-moi ce que vous voulez ajouter ou retirer.', () => {
    if (_voiceActive) startListening();
  });
}

function closeVoice() {
  _voiceActive = false;
  stopListening();
  speechSynthesis.cancel();
  document.getElementById('modal-voice').classList.remove('open');
}

function closeVoiceOnBg(e) {
  if (e.target === document.getElementById('modal-voice')) closeVoice();
}

function _checkVoiceSupport() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showToast('Reconnaissance vocale non disponible — utilisez Chrome ou Safari.');
    return false;
  }
  if (!mistralKey && !openaiKey && !anthropicKey) {
    showToast('Configurez une clé IA (Mistral, OpenAI ou Claude) dans les paramètres.');
    return false;
  }
  return true;
}

function startListening() {
  if (_voiceListening || !_voiceActive) return;
  _voiceListening = true;
  _setVoiceStatus('listening');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _voiceRecognition = new SR();
  _voiceRecognition.lang           = 'fr-FR';
  _voiceRecognition.continuous     = false;
  _voiceRecognition.interimResults = false;

  _voiceRecognition.onresult = (e) => {
    _voiceListening = false;
    _processVoiceInput(e.results[0][0].transcript.trim());
  };

  _voiceRecognition.onerror = (e) => {
    _voiceListening = false;
    _setVoiceStatus('idle');
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      showToast('Micro : ' + e.error);
    }
  };

  _voiceRecognition.onend = () => { _voiceListening = false; };

  try { _voiceRecognition.start(); } catch (_) { _voiceListening = false; _setVoiceStatus('idle'); }
}

function stopListening() {
  _voiceListening = false;
  if (_voiceRecognition) {
    try { _voiceRecognition.abort(); } catch (_) {}
    _voiceRecognition = null;
  }
}

async function _processVoiceInput(text) {
  _setVoiceStatus('thinking');
  document.getElementById('voice-transcript').textContent = '« ' + text + ' »';
  document.getElementById('voice-response').textContent   = '';

  const locLabel = { fridge: 'Frigo', freezer: 'Congélateur', pantry: 'Placard' };
  const stockLines = ['fridge', 'freezer', 'pantry'].flatMap(loc =>
    appData[loc].map(i => `id:${i.id}|${i.name}|x${formatQty(i.qty)}|${locLabel[loc]}`)
  ).join('\n') || '(vide)';

  const prompt = `Tu es un assistant vocal de gestion de stock alimentaire en français.

STOCK ACTUEL (format: id|nom|quantité|emplacement) :
${stockLines}

L'UTILISATEUR DIT : "${text}"

RÈGLES :
- "remove" : identifie le produit dans le stock par fuzzy match, donne son id exact.
- "add" : si le produit ressemble à un existant dans le stock, donne son id pour incrémenter. Sinon id null = nouveau produit.
- location pour nouveau produit : "fridge" par défaut, "freezer" si congélateur/surgelé mentionné, "pantry" si placard/épicerie.
- qty si non précisé : 1.
- "done": true si l'utilisateur dit qu'il n'a plus besoin (non, c'est tout, rien, merci, terminé…).
- "response" : phrase courte et naturelle en français confirmant les actions. Si done:false, terminer par "Autre chose ?".

JSON STRICT (aucun markdown, aucun texte hors JSON) :
{"actions":[{"type":"add","id":null,"name":"Lait","qty":1,"location":"fridge","cat":""},{"type":"remove","id":"uuid-exact","name":"Yaourt"}],"response":"J'ai ajouté du lait et retiré le yaourt. Autre chose ?","done":false}`;

  try {
    const raw    = (await _callAI(prompt)).replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    await _applyVoiceActions(result.actions || []);
    const reply  = result.response || 'C\'est fait !';
    const done   = result.done === true;
    document.getElementById('voice-response').textContent = reply;
    _setVoiceStatus('idle');
    _speak(reply, () => {
      if (!_voiceActive) return;
      if (done) setTimeout(closeVoice, 800);
      else startListening();
    });
  } catch (err) {
    const msg = 'Désolé, une erreur est survenue. Réessayez.';
    _setVoiceStatus('idle');
    document.getElementById('voice-response').textContent = msg;
    _speak(msg, () => { if (_voiceActive) startListening(); });
  }
}

async function _applyVoiceActions(actions) {
  for (const a of actions) {
    if (a.type === 'remove' && a.id) {
      const loc = ['fridge', 'freezer', 'pantry'].find(l => appData[l].some(i => i.id === a.id));
      if (loc) {
        appData[loc] = appData[loc].filter(i => i.id !== a.id);
        await sbClient.from('stock').delete().eq('id', a.id);
      }

    } else if (a.type === 'add') {
      if (a.id) {
        // produit existant → incrémenter
        const loc  = ['fridge', 'freezer', 'pantry'].find(l => appData[l].some(i => i.id === a.id));
        if (loc) {
          const item = appData[loc].find(i => i.id === a.id);
          item.qty  += (a.qty || 1);
          await sbClient.from('stock').update({ qty: item.qty }).eq('id', a.id);
        }
      } else {
        // nouveau produit
        const loc = a.location || 'fridge';
        const { data, error } = await sbClient.from('stock').insert({
          name: a.name, qty: a.qty || 1, cat: a.cat || '',
          exp: null, location: loc, added: Date.now(),
        }).select().single();
        if (!error && data) appData[loc].push(dbToItem(data));
      }
    }
  }
  render();
}

function _speak(text, onEnd) {
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = 'fr-FR';
  utt.rate  = 1.05;
  if (onEnd) utt.onend = onEnd;
  speechSynthesis.speak(utt);
}

function _setVoiceStatus(state) {
  const ind    = document.getElementById('voice-indicator');
  const micBtn = document.getElementById('voice-mic-btn');
  const labels = { listening: 'Je vous écoute…', thinking: 'Je réfléchis…', idle: 'Appuyez sur le micro' };
  ind.textContent = labels[state] || labels.idle;
  ind.className   = 'voice-indicator' + (state !== 'idle' ? ' ' + state : '');
  micBtn.classList.toggle('active', state === 'listening');
}
