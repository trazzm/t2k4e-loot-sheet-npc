import { LootSheetNPCT2k4e } from './lib/LootSheetNPCT2k4e.js';
import { LootsheetNPCHooks } from './hooks/LootSheetNPCHooks.js';

//Register the loot sheet
Actors.registerSheet("t2k4e", LootSheetNPCT2k4e, {
    types: ["npc"],
    makeDefault: false,
    label: 'T2K4E.LootSheet',
});

/**
 * Initial Setup with settings, socket, handlebars & API
 */
LootsheetNPCHooks.init();

