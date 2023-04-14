const DISPOSITION = {
  "-1" : "Hostile",
  0 : "Neutral",
  1 : "Friendly"
}
const moduleName = 'chatgpt-reactions';

let socket;
let apiKey;

Hooks.once('init', () => {
    log('Initializing ChatGPT FoundryVTT Plugin', this);

    game.settings.register(moduleName, 'apikey', {
        name: 'ChatGPT Api Key',
        hint: '',
        scope: 'world', // This setting is specific to a world.
        config: true, // This setting won't appear in the regular settings menu.
        type: String, // The type of the stored value.
        default: '' // The default value for this setting.
    });
    apiKey = game.settings.get(moduleName, 'apikey');
});
Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerModule(moduleName);
  socket.register("Execute", Execute);
});
Hooks.once('ready', async () => {
    Hooks.on("midi-qol.RollComplete", async (workflow) => {
      log('midi-qol.RollComplete', [workflow]);
      if(!workflow?.hitTargets?.size) return;
      try{
        let prompt = '';
        const actor = workflow.actor;
        const item = workflow.item;
        const targets = {};

        workflow.hitTargets.forEach(target =>{

          const disposition =
            target.document.disposition == workflow.token.document.disposition ? 1 :
            target.document.disposition == 0 ? 0 :
            -1;

          targets[target.id] = {
            name : target.document.name,
            hit  : false,
            save : null,
            maxHP : target.actor.system.attributes.hp.max,
            endHP : 0,
            startHP : 0,
            isCritical : workflow.isCritical,
            isFumble : target.isFumble,
            prompt : null,
            disposition : DISPOSITION[disposition]
          };
        });
        workflow.saveDisplayData.forEach(save =>{
          if(targets.hasOwnProperty(save.target.id)){
            const target = targets[save.target.id];
            target["save"] = {
              success : !save.saveString.toLowerCase().includes("fail"),
              flavor  : save.rollDetail.options.flavor
            };
          }
        });
        if(workflow.damageList){
          workflow.damageList.forEach(hit =>{
            if(targets.hasOwnProperty(hit.tokenId)){
              const target = targets[hit.tokenId];

              target.hit = true;
              target.startHP = hit.oldTempHP+hit.oldHP;
              target.endHP = hit.newTempHP+hit.newHP;
            }
          });
        }

        Object.entries(targets).forEach(kv => {
          const target = kv[1];
          let prompt = `${target.name}-${kv[0]} (${target.disposition}): `;
          if(target.hit){
            if(target.save?.success){
              prompt += `succeeded on a ${target.save.flavor} `;
            }
            if(target.endHP < target.startHP){
              const fromPercet = Number(target.startHP/target.maxHP).toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0});
              const toPercent = Number(target.endHP/target.maxHP).toLocaleString(undefined,{style: 'percent', minimumFractionDigits:0});
              prompt += `${target.isCritical? "critical " : ""}hit reducing health from ${fromPercet} to ${toPercent}`;
            }
          }
          else{
            prompt += `missed${target.isFumble ? " (fumble)" : ""}`;
          }
          target.prompt = prompt;
        });

        if(game.user.isGM){
          await Execute([actor, item, targets]);
        }
        else{
          await socket.executeAsGM("Execute", [actor, item, targets]);
        }

      } catch(ex){
        error('midi-qol.RollComplete',ex);
      }
    });
});

function log(message, data){
  console.log(`${moduleName} | ${message}`, data);
}
function error(message, ex){
  console.error(`${moduleName} | ${message}`, ex);
}

async function Execute(data){
  const actor = data[0];
  const item = data[1];
  const targets = data[2];
  prompt = createPrompt(actor, item, targets);
  log(prompt);
  const message = await ChatMessage.create({
    content: "Querying ChatGPT...",
    whisper: [game.user.id],
  });
  const response = await getGptResponse(prompt);
  await message.update({
    content: response
  });
  log(response);
}

async function getGptResponse(prompt) {
  const response = await fetchJsonWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },

    body: JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": [
              {
                  "role": "user",
                  "content": prompt
              }
          ]
      })
  });

  return response.choices[0].message.content.trim();
}

function createPrompt(actor, item, targets) {
  let prompt = `Speaking as a DND GM narrating an action, describe a character ${actor.name}, using ${item.name} and the scene afterwards.
    Keep the answer brief, around 3 sentences. Format your response in HTML.`;
  const keys = Object.keys(targets);
  if(keys.length > 0){
    prompt += "\r\nThe action targeted the following characters:"
    keys.forEach(key => {
      const target = targets[key];
      prompt += `\r\n${target.prompt}`
    });
 }
  prompt += "\r\nBriefly describe the scene after the action.";
  prompt += "\r\nDon't mention any mechanical aspects of DND or include specific number.";
  return prompt;
}
