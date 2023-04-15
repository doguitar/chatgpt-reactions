class ChatGTPReactions {
  constructor() {
    this.DISPOSITION = {
      "-1": "Hostile",
      0: "Neutral",
      1: "Friendly"
    }
    this.moduleName = 'chatgpt-reactions';

    this.socket;
    this.apiKey;

    Hooks.once('init', () => this.init());
    Hooks.once("socketlib.ready", () => this.initSocket());
    Hooks.once('ready', async () => await this.ready());
  }

  init() {
    this.log('Initializing ChatGPT FoundryVTT Plugin', this);

    game.settings.register(this.moduleName, 'apikey', {
      name: 'ChatGPT Api Key',
      hint: '',
      scope: 'world', // This setting is specific to a world.
      config: true, // This setting won't appear in the regular settings menu.
      type: String, // The type of the stored value.
      default: '' // The default value for this setting.
    });
    this.apiKey = game.settings.get(this.moduleName, 'apikey');
  }

  initSocket() {

    this.socket = socketlib.registerModule(this.moduleName);
    this.socket.register("Execute", this.Execute);
  }
  async ready() {

    Hooks.on("midi-qol.RollComplete", async (workflow) => {
      this.log('midi-qol.RollComplete', [workflow]);
      if (!workflow?.hitTargets?.size) return;
      try {
        let prompt = '';
        const actor = workflow.actor;
        const item = workflow.item;
        const targets = {};

        workflow.hitTargets.forEach(target => {

          const disposition =
            target.document.disposition == workflow.token.document.disposition ? 1 :
              target.document.disposition == 0 ? 0 :
                -1;

          targets[target.id] = {
            name: target.document.name,
            hit: false,
            save: null,
            maxHP: target.actor.system.attributes.hp.max,
            endHP: 0,
            startHP: 0,
            isCritical: workflow.isCritical,
            isFumble: target.isFumble,
            prompt: null,
            disposition: this.DISPOSITION[disposition]
          };
        });
        workflow.saveDisplayData.forEach(save => {
          if (targets.hasOwnProperty(save.target.id)) {
            const target = targets[save.target.id];
            target["save"] = {
              success: !save.saveString.toLowerCase().includes("fail"),
              flavor: save.rollDetail.options.flavor
            };
          }
        });
        if (workflow.damageList) {
          workflow.damageList.forEach(hit => {
            if (targets.hasOwnProperty(hit.tokenId)) {
              const target = targets[hit.tokenId];

              target.hit = true;
              target.startHP = hit.oldTempHP + hit.oldHP;
              target.endHP = hit.newTempHP + hit.newHP;
            }
          });
        }

        Object.entries(targets).forEach(kv => {
          const target = kv[1];
          let prompt = `${target.name}-${kv[0]} (${target.disposition}): `;
          if (target.hit) {
            if (target.save?.success) {
              prompt += `succeeded on a ${target.save.flavor} `;
            }
            if (target.endHP < target.startHP) {
              const fromPercet = Number(target.startHP / target.maxHP).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 });
              const toPercent = Number(target.endHP / target.maxHP).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 });
              prompt += `${target.isCritical ? "critical " : ""}hit reducing health from ${fromPercet} to ${toPercent}`;
            }
          }
          else {
            prompt += `missed${target.isFumble ? " (fumble)" : ""}`;
          }
          target.prompt = prompt;
        });

        if (game.user.isGM) {
          await this.Execute([actor, item, targets]);
        }
        else {
          await this.socket.executeAsGM("Execute", [actor, item, targets]);
        }

      } catch (ex) {
        this.error('midi-qol.RollComplete', ex);
      }
    });
  }

  log(message, data) {
    console.log(`${this.moduleName} | ${message}`, data);
  }
  error(message, ex) {
    console.error(`${this.moduleName} | ${message}`, ex);
  }

  async Execute(data) {
    const actor = data[0];
    const item = data[1];
    const targets = data[2];
    prompt = this.createPrompt(actor, item, targets);
    this.log(prompt);
    const message = await ChatMessage.create({
      content: "Querying ChatGPT...",
      whisper: [game.user.id],
    });
    const response = await this.getGptResponse(prompt);
    await message.update({
      content: response
    });
    this.log(response);
  }

  async getGptResponse(prompt) {
    const response = await fetchJsonWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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

  createPrompt(actor, item, targets) {
    let prompt = `Speaking as a DND GM narrating an action, describe a character ${actor.name}, using ${item.name} and the scene afterwards.
    Keep the answer brief, around 3 sentences. Format your response in HTML.`;
    const keys = Object.keys(targets);
    if (keys.length > 0) {
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
}

const chatgptReactions = new ChatGTPReactions();