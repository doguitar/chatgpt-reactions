# ChatGPT Reactions Foundry VTT Plugin

This Foundry VTT plugin enhances the virtual tabletop experience by utilizing OpenAI's ChatGPT to generate unique, immersive narrative descriptions for attack, damage, and saving throw results. The plugin reacts to rolls made using the Midi-QOL module and creates dynamic, context-aware descriptions for each action and its consequences.

## Features

- Generates context-aware, immersive descriptions based on weapon/spell used, attack outcomes, and target disposition
- Handles critical hits, fumbles, and saving throws
- Sends results as chat messages visible only to the GM

## Installation

1. Ensure you have the [Midi-QOL](https://foundryvtt.com/packages/midi-qol/) module installed and activated in your Foundry VTT world.
2. Install the ChatGPT Reactions plugin by adding the module to your Foundry VTT setup.
3. Activate the ChatGPT Reactions module in your world.

## Configuration

After installation, you need to provide your ChatGPT API Key in the module's settings:

1. Go to the Foundry VTT settings tab (gear icon in the top-right corner).
2. Navigate to the "Manage Modules" section and locate the "ChatGPT Reactions" module in the list.
3. Click the "Settings" button next to the module's name.
4. Enter your ChatGPT API Key in the "ChatGPT Api Key" field.
5. Save your changes.

## Usage

Once the plugin is installed and configured, it will automatically generate narrative descriptions for attack, damage, and saving throw rolls made using the Midi-QOL module. The descriptions will be sent as chat messages visible only to the GM.

The plugin uses OpenAI's ChatGPT to generate unique descriptions based on the weapon or spell used, the attack outcome, and the condition of the targeted actor(s) after the attack. The plugin also takes into account critical hits, fumbles, and saving throw results.

## Dependencies

- [Foundry VTT](https://foundryvtt.com/) (version 10.0.0 or higher)
- [Midi-QOL](https://foundryvtt.com/packages/midi-qol/) module

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For questions, feature requests, or bug reports, please create an issue on the GitHub repository.
