import { MODULE } from "../moduleConstants.js";
import { LootSheetNPCHelper } from "../helper/LootSheetNPCHelper.js";
import { PermissionHelper } from "../helper/PermissionHelper.js";
import {SheetHelper} from "../helper/SheetHelper.js";
//import { TooltipListener } from "./TooltipListener.js";

export class SheetListener {
    /**
     *
     * @param {number} id current app id of the sheet
     * @param {Token} token current token of the sheet
     * @param {Actor} actor current actor of the sheet
     * @param {object} options options for the sheet
     */
    constructor(id, token, actor, options) {
        this.id = id;
        this.token = token;
        this.actor = actor;
        this.options = options;
    }

    /**
     *
     * @description activate the sheets main listeners for UI interaction
     *
     */
    async activateListeners(options = {}) {
        const app = document.querySelector(`#${this.id}`);
        if (!app) return;
        const sheetActionButtons = app.querySelectorAll('.lsnpc-action-link'),
            tradeableItems = app.querySelectorAll('.tradegrid .item'),
            helpTexts = app.querySelectorAll('.help');

        if (this.options.editable) {
            this._activateOwnerGMListeners(app);
        }

        this.tradeItemEventListeners(tradeableItems);

        // let tooltipListener = new TooltipListener(this.id);
        // tooltipListener.itemTooltips(tradeableItems);
        // tooltipListener.helperTooltips();
        // tooltipListener.miscTooltips();

        for (let actionButton of sheetActionButtons) {
            const eventType = actionButton.nodeName === 'SELECT' ? 'change' : 'click';
            actionButton.toggleAttribute('disabled', false);
            actionButton.addEventListener(eventType, ev => LootSheetNPCHelper.sendActionToSocket(this.actor, ev));
        }

        for (let helpText of helpTexts) {
            helpText.addEventListener('hover', ev => SheetHelper.toggleHelp(ev));
        }

        if (options && options?.verbose) console.log(`${MODULE.ns} | Sheet | Listeners activated`);
    }


    /**
    * GM or owner only
    */
    _activateOwnerGMListeners(app) {
        const bulkPermissions = app.querySelectorAll('.permission-option a'),
            individualPermissions = app.querySelectorAll('.permission-proficiency');
            // permissionsFilter = app.querySelector('.permissions-filter');
            // priceModifierDialog = app.querySelector('.price-modifier'),
            // sheetStylings = app.querySelector('.gm-settings .sheet-style'),
            // inventorySettings = app.querySelector('.gm-settings .inventory-settings'),
            // nventoryUpdate = app.querySelector('.gm-settings .update-inventory');

        if (game.user.isGM) {
            for (let button of bulkPermissions) {
                button.addEventListener('click', ev => PermissionHelper.bulkPermissionsUpdate(ev, this.actor));
            }

            for (let playerPermissionButton of individualPermissions) {
                playerPermissionButton.addEventListener('click', ev => PermissionHelper.cyclePermissions(ev, this.actor));
            }
        }

        // if (priceModifierDialog) {
        //     priceModifierDialog.addEventListener('click', ev => SheetHelper.renderPriceModifierDialog(ev, this.actor));
        // }
        //
        // inventorySettings.addEventListener('change', ev => this.inventorySettingChange(ev, this.actor));
        // sheetStylings.addEventListener('change', ev => this.sheetStyleChange(ev, this.actor));
        //inventoryUpdate.addEventListener('click', ev => this.inventoryUpdateListener(ev));
        // toggle infoboxes
    }

    /**
     * Put eventListeners on the given items
     *
     * @note See templates/trade/index.hbs for trade tab structure
     * This should be called on the trade tab.
     * It expects the following structure:
     * <main data-event-action="trade" >
     *  [...]
     *  <ul>
     *      <li class="item" [data attributes] ></li>
     *  </ul
     *
     * @param {Array} tradeableItems
     */
    tradeItemEventListeners(tradeableItems) {
        for (let item of tradeableItems) {
            item.addEventListener('click', ev => this._onClick(ev));
            item.addEventListener('contextmenu', ev => this._onClick(ev));
        }
    }

    /**
     *
     * @param {Event} event
     */
    _onClick(event) {
        if (!event.currentTarget.dataset) return;
        event.preventDefault();
        event.stopPropagation();

        const item = event.currentTarget.dataset;
        let data = {
            uuid: item.uuid,
            eventAction: event.currentTarget.closest('main').dataset.eventAction,
            source: event.currentTarget.closest('section'),
            stack: event.type === 'click' ? false : true
        };
        this._tradeItemStagingHandler(data, event);
    }

    /**
     * Handles the item loot button.
     *
     * @param event
     * @returns {*}
     * @private
     */
    _onItemLoot(event) {
        event.preventDefault();
        const elem = event.currentTarget;
        const itemId = elem.closest('.item').dataset.itemId;
        return this.actor.deleteEmbeddedDocuments('Item', [itemId]);
    }

    /**
     * @description
     * Accept the drop of an item.
     * Check the items source and place it in the correct container.
     *
     * @param {Event} event
     */
    static onDrop(event) {
        event.preventDefault();
        let data = JSON.parse(event.dataTransfer.getData("text/plain"));
        if (!data) return;
        this._tradeItemStagingHandler(data, event);
    }

    /**
     * Update the sheets inventory
     *
     * @param {Event} event
     *
     * @returns
     */
    async inventoryUpdateListener(event) {
        event.preventDefault();
        event.stopPropagation();

        const clearInventory = this.actor.getFlag(MODULE.ns, MODULE.flags.clearInventory);

        if (clearInventory) {
            let currentItems = this.actor.data.items.map(i => i.id);
            await this.actor.deleteEmbeddedDocuments("Item", currentItems);
        }

        await LootSeeder.seedItemsToActors([this.actor], { force: true });
    }

    // /**
    //  * Handle merchant settings change
    //  * @private
    //  */
    // async inventorySettingChange(event, actor) {
    //     return;
    //     event.preventDefault();
    //     event.stopPropagation();
    //
    //     // @todo get this from the settings, leverage the constants, if key exists in MODULE.
    //     const expectedKeys = [
    //         "lootsheettype",
    //         "rolltable",
    //         "shopQty",
    //         "itemQty",
    //         "itemQtyLimit",
    //         "clearInventory",
    //         "itemOnlyOnce",
    //         "currencyFormula"
    //     ];
    //
    //     let targetKey = event.target.name.split('.')[3];
    //
    //     console.log('key check' , expectedKeys.includes(targetKey));
    //
    //     if (!expectedKeys.includes(targetKey)) {
    //         console.log(MODULE.ns + ` | Error changing stettings for "${targetKey}".`);
    //         return ui.notifications.error(`Error changing stettings for "${targetKey}".`);
    //     }
    //
    //     if (targetKey == "clearInventory" || targetKey == "itemOnlyOnce") {
    //         console.log(MODULE.ns + " | " + targetKey + " set to " + event.target.checked);
    //         await actor.setFlag(MODULE.ns, targetKey, event.target.checked);
    //         return;
    //     }
    //
    //     await actor.setFlag(MODULE.ns, targetKey, event.target.value);
    //     console.log(MODULE.ns + " | " + targetKey + " set to " + event.target.value);
    // }

    // /**
    //  * Handle style changes manually
    //  *
    //  * @param {Event} event
    //  * @param {Actor} actor
    //  *
    //  * @private
    //  */
    // async sheetStyleChange(event, actor) {
    //     event.preventDefault();
    //     event.stopPropagation();
    //
    //     // @todo get this from the settings, leverage the constants, if key exists in MODULE.
    //     const expectedKeys = ["sheettint", "avatartint", "customBackground", "blendmode", "darkMode"];
    //
    //     let splittedName = event.target.name.split('.'),
    //         targetKey = splittedName[2],
    //         targetExtra = splittedName[3];
    //
    //         console.log(MODULE.ns + " | key check" , event.target.name, expectedKeys.includes(targetKey));
    //     if (!expectedKeys.includes(targetKey)) return;
    //
    //     if (!targetExtra) {
    //         const value = event.target.checked === undefined ? event.target.value : event.target.checked;
    //         await actor.setFlag(MODULE.ns, targetKey, value);
    //     } else {
    //         await actor.setFlag(MODULE.ns, targetKey + '.' + targetExtra, event.target.value);
    //     }
    //
    //     //await TokenHelper.handleRerender(actor.uuid);
    // }

    /**
     *
     * @param {object} data
     * @param {Event} event
     * @returns
     */
    _tradeItemStagingHandler(data, event) {
        const sourceSelector = 'main[data-event-action="' + data.eventAction + '"] ul',
            targetSelector = 'main[data-event-target="' + data.eventAction + '"] ul',
            sourceList = document.querySelector(sourceSelector),
            targetList = document.querySelector(targetSelector),
            item = sourceList.querySelector('.item[data-uuid="' + data.uuid + '"]'),
            targetItem = targetList.querySelector('.item[data-uuid="' + data.uuid + '"]');

        if (!item) return;

        let quantity = (event.type == 'contextmenu') ? parseInt(item.dataset.quantity) : 1;
        const newItem = item.cloneNode();

        if ((parseInt(item.dataset.quantity) - 1) === 0 || event.type == 'contextmenu') {
            item.remove();
        } else {
            item.dataset.quantity = parseInt(item.dataset.quantity) - quantity;
        }

        if (targetItem) {
            targetItem.dataset.quantity = parseInt(targetItem.dataset.quantity) + quantity;
        } else {
            newItem.dataset.quantity = quantity;
            newItem.addEventListener('click', ev => this._onClick(ev));
            newItem.addEventListener('contextmenu', ev => this._onClick(ev));
            targetList.appendChild(newItem);
        }

        // done goodbye 👋
    }
}