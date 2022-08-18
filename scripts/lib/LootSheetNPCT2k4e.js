import ActorSheetT2K from "../../../../systems/t2k4e/module/actor/actorSheet.js";

import { MODULE } from '../moduleConstants.js';
import { LootSheetNPCHelper } from "../helper/LootSheetNPCHelper.js";
import { PermissionHelper } from '../helper/PermissionHelper.js';
import { TableHelper } from "../helper/TableHelper.js";
import { SheetListener } from "../hooks/SheetListener.js";

export class LootSheetNPCT2k4e extends ActorSheetT2K {

    /**
     * @module lootsheetnpct2k4e.LootSheetNPCT2k4e.template
     * @description Handle template loading for the sheet
     */
    get template() {
        const sheetType = 'default',
            fallbackPath = "systems/t2k4e/templates/actors/";

        let templateList = [
            MODULE.templateAppsPath + "/lootsheet.hbs",
            MODULE.templatePartialsPath + "/body.hbs",
            MODULE.templatePartialsPath + "/footer.hbs",
            MODULE.templatePartialsPath + "/header.hbs",
            MODULE.templatePartialsPath + "/equipment.hbs",
            MODULE.templatePartialsPath + "/slots/ammo-slot.hbs",
            MODULE.templatePartialsPath + "/slots/armor-slot.hbs",
            MODULE.templatePartialsPath + "/slots/gear-slot.hbs",
            MODULE.templatePartialsPath + "/slots/vehicle-weapon-slot.hbs",
            MODULE.templatePartialsPath + "/slots/weapon-slot.hbs",
            MODULE.templatePartialsPath + "/slots/slot-buttons.hbs",
            MODULE.templatePartialsPath + "/buttons/lootAll.hbs",
            MODULE.templatePartialsPath + "/header/navigation.hbs",
            MODULE.templatePartialsPath + "/list/" + sheetType + ".hbs",
            MODULE.templatePartialsPath + "/trade/index.hbs",
            MODULE.templatePartialsPath + "/trade/inventory.hbs"
        ];

        if (game.user.isGM) {
            templateList.push(MODULE.templatePartialsPath + "/gm/gm-settings.hbs");
            templateList.push(MODULE.templatePartialsPath + "/gm/permissions.hbs");
        }

        loadTemplates(templateList);

        if (!game.user.isGM && this.actor.limited) return fallbackPath + "character-sheet.hbs";

        return MODULE.templateAppsPath + "/lootsheet.hbs";
    }

    static get defaultOptions() {
        const options = super.defaultOptions;

        let lsnpcOptions = {
            classes: ["t2k4e", "sheet", "actor", "lsnpc", "npc", "npc-sheet", "character"],
            width: 550,
            height: 715,
        };

        if (game.user.isGM) {
            lsnpcOptions.classes.push('lsnpc-gmview');
        }

        return mergeObject(options, lsnpcOptions);
    }

    /**
     *
     * @returns {object} Data for sheet to render
     */
    async getData() {
        const typeKey = "lootsheettype",
            sheetType = await this._prepareSheetType(typeKey);

        let context = super.getData(),
            sheetDataActorItems = context.actor.data.items;

        context.lootsheettype = sheetType;
        context.priceModifier = 1;

        if (game.user.isGM) {
            context = await this._prepareGMSettings(context);
        }
        //actor.data.flags.lootsheetnpct2k4e.sheettint
        context = await this._enrichByType(context, sheetType);
        sheetDataActorItems = this._enrichItems(sheetDataActorItems);
        sheetDataActorItems = LootSheetNPCHelper.getLootableItems(sheetDataActorItems);
        let totals = this._getTotals(sheetDataActorItems, context.priceModifier);

        context.isGM = (game.user.isGM) ? true : false;
        context.isToken = (this?.token) ? true : false;
        context.items = sheetDataActorItems;
        context.interactingActor = game.user?.character?.name || "No Character selected";
        context.totalItems = sheetDataActorItems.length;
        context.totalWeight = totals.weight.toLocaleString('en');
        context.totalPrice = totals.price.toLocaleString('en') + " ammo";
        context.totalQuantity = totals.quantity;
        context.observerCount = PermissionHelper.getEligableActors(this.actor).length;
        return context;
    }


    render(force = false, options = {}) {
        /**
         * @type {Array<string>} appClasses
         */
        let appClasses = this.options.classes;
        const sheetStyle = this.actor.getFlag(MODULE.ns, 'sheettint.style'),
            darkMode = this.actor.getFlag(MODULE.ns, 'darkMode') || false,
            existingStylingIndex = appClasses.findIndex(e => (e.indexOf('styled') >= 0)),
            existingDarkModeIndex = appClasses.findIndex(e => (e.indexOf('darkMode') >= 0));

        if (existingStylingIndex > 0) appClasses.splice(existingStylingIndex, 1);
        if (existingDarkModeIndex > 0) appClasses.splice(existingDarkModeIndex, 1);
        if (darkMode === 'true') appClasses.push("lsnpc-darkMode");
        if (sheetStyle && sheetStyle.length) appClasses.push('styled ' + sheetStyle);

        this.options.classes = [...new Set(appClasses)];
        super.render(force, options);
    }

    /**
     * Enrich the data with data needed by diffrerent sheet types
     *
     * @param {object} sheetData
     * @param {string} sheetType
     * @returns
     */
    async _enrichByType(sheetData, sheetType) {
        const priceModifier = { buy: 100, sell: 100 };
        //enrich sheetData with type specific data
        switch (sheetType) {
            case "Merchant":
                sheetData.priceModifier = await this.actor.getFlag(MODULE.ns, MODULE.flags.priceModifier);
                if (typeof sheetData.priceModifier !== 'object') await this.actor.setFlag(MODULE.ns, MODULE.flags.priceModifier, priceModifier);
                sheetData.priceModifier = await this.actor.getFlag(MODULE.ns, MODULE.flags.priceModifier);
                break;
            default:
                break;
        }

        return sheetData;
    }

    /**
     * @summary Einrich the item data for the template with a uuid
     *
     * @param {object} sheetDataActorItems
     */
    _enrichItems(sheetDataActorItems) {
        //enrich with uuid
        for (let fullItem of this.actor.getEmbeddedCollection('Item')) {
            let sheetItem = sheetDataActorItems.find(i => i._id == fullItem.id);
            if (!sheetItem) continue;
            sheetItem.uuid = fullItem.uuid;
        }

        return sheetDataActorItems;
    }

    /**
     *
     * @param {*} sheetDataActorItems
     * @param {number} priceModifier
     * @returns
     */
    _getTotals(sheetDataActorItems, priceModifier = 1.0) {
        let totalWeight = 0,
            totalPrice = 0,
            totalQuantity = 0;
        sheetDataActorItems.forEach((item) => totalPrice += Math.round(item.data.quantity * ((item.data.price * priceModifier.sell) / 100)));
        sheetDataActorItems.forEach((item) => totalQuantity += Math.round((item.data.quantity * 100) / 100));
        sheetDataActorItems.forEach((item) => totalWeight += Math.round((item.data.quantity * item.data.weight * 100) / 100));

        return { weight: totalWeight, price: totalPrice, quantity: totalQuantity };
    }

    /**
     *
     * @param {string} typeKey
     * @returns
     */
    async _prepareSheetType(typeKey) {
        let type = this.actor.getFlag(MODULE.ns, typeKey);
        if (!type) {
            if (!this.actor.data.flags.lootsheetnpct2k4e) {
                await this.actor.update({ 'flags': MODULE.flags.default });
            }
        }
        return type;
    }

    async _onSubmit(e) {
        e.preventDefault();
        super._onSubmit(e);
    }


    /**
     * @param {jquery} html
     *
     * @version 1.1.0
     *
     * @override
     */
    async activateListeners(html) {
        super.activateListeners(html);
        const listener = new SheetListener(this.id, this.token, this.actor, this.options);
        await listener.activateListeners();

    }

    /* -------------------------------------------- */

    /**
     * Organize and classify Items for Loot NPC sheets
     * IDE shows it as unused, but it is used in the NPC sheet
     *
     * @private
     */
    _prepareItems(actorData) {
        const items = actorData.items,
            lootableItems = LootSheetNPCHelper.getLootableItems(items),
            playerCharacter = game.user?.character;

        //enrich with uuid
        for (let fullItem of this.actor.getEmbeddedCollection('Item')) {
            items.find(i => i._id == fullItem.id).uuid = fullItem.uuid;
        }

        // Iterate through items, allocating to containers
        actorData.actor.actions = LootSheetNPCHelper.sortAndGroupItems(items);
        actorData.actor.lootableItems = LootSheetNPCHelper.sortAndGroupItems(lootableItems);

        if (playerCharacter) {
            const playerItems = this._getTradeablePlayerInventory(playerCharacter);
            actorData.actor.playerInventory = LootSheetNPCHelper.sortAndGroupItems(playerItems);
        }
    }

    /**
     *
     * @param {Actor} playerCharacter
     * @returns
     */
    _getTradeablePlayerInventory(playerCharacter){
        let playerItems = duplicate(playerCharacter.data.items);


        //enrich with uuid
        for (let fullItem of playerCharacter.getEmbeddedCollection('Item')) {
            playerItems.find(i => i._id == fullItem.id).uuid = fullItem.uuid;
        }

        // filter equiped items with only 1 quantity
        playerItems = playerItems.filter(i => {
            if (i.data?.equipped && i.data.quantity > 1) return true;
            if (!i.data?.equipped) return true;
            return false;
        });
        // decrease quantity of equiped items by 1
        playerItems = playerItems.map(i => {
            if (i.data?.equipped) i.data.quantity -= 1;
            return i;
        });

        return LootSheetNPCHelper.getLootableItems(playerItems);
    }

    /**
     * @summary Prepares GM settings to be rendered by the loot sheet.
     *
     * @param {object} sheetData
     * @author Jan Ole Peek <@jopeek>
     *
     * @version 1.1.0
     *
     * @returns {object} sheetData
     */
    async _prepareGMSettings(sheetData) {
        const observers = PermissionHelper.getEligableActors(this.actor),
            permissionsInfo = PermissionHelper.getPermissionInfo(),
            permissions = this._playerPermissions(sheetData),
            gameWorldTables = await TableHelper.getGameWorldRolltables();

        let loot = {};
        loot.players = permissions.playerData;
        loot.observerCount = observers.length;
        loot.permissions = permissionsInfo;
        loot.playersPermission = permissions.playersPermission;
        loot.playersPermissionIcon = PermissionHelper.getPermissionInfo(permissions.playersPermission);
        loot.playersPermissionDescription = PermissionHelper.getPermissionInfo(permissions.playersPermission)?.description;

        sheetData.rolltables = gameWorldTables;
        sheetData.actor.data.flags.lootsheetnpct2k4e = {...this.actor.data.flags?.lootsheetnpct2k4e, ...loot};
        return sheetData;
    }

    /**
     * @description
     * Parse the sheetData and fill an array with specific player permissions.
     *
     * @param {object} sheetData
     * @private
     * @param {Actor|object} sheetData
     */
    _playerPermissions(sheetData) {
        // get all the players
        const players = game.users.players;
        if(game.user.isGM && game.user.character){
            players.push(game.user);
        }
        let playerData = [],
            commonPlayersPermission = -1;

        for (let player of players) {
            // get primary/active actor for a player
            const playerActor = game.actors.get(player.data.character);

            if (playerActor) {
                player.actor = playerActor.data.name;
                player.actorId = playerActor.data._id;
                player.playerId = player.data._id;
                player.lootPermission = PermissionHelper.getLootPermissionForPlayer(sheetData.actor, player);

                commonPlayersPermission = (commonPlayersPermission < 0) ? player.lootPermission : commonPlayersPermission;

                const lootPermissionInfo = PermissionHelper.getPermissionInfo(player.lootPermission);

                player.class = lootPermissionInfo.class;
                player.borderClass = lootPermissionInfo.borderClass;
                player.lootPermissionDescription = lootPermissionInfo.description;
                playerData.push(player);
            }
        }


        return {playerData: playerData, commonPlayersPermission: commonPlayersPermission};
    }
}
