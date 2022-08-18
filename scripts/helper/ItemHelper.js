import ItemT2K from "/systems/t2k4e/module/item/item.js";
import ActorT2K from "/systems/t2k4e/module/actor/actor.js";
import { MODULE } from '../moduleConstants.js';

class ItemHelper {

    /**
     * Take an options object and either keep values or set the default
     *
     * @param {object} options
     * @returns {object}
     *
     */
    static _getOptionsDefault(options = {}) {
        return {
            breakableRarities: options?.breakableRarities || ['none', 'common'],
            chanceOfDamagedItems: options?.chanceOfDamagedItems || 0,
            damagedItemsMultiplier: options?.damagedItemsMultiplier || 0,
            removeDamagedItems: options?.removeDamagedItems || false
        };
    }

    /**
     * Check if an item is damaged
     *
     * @description Checks if an item is damaged by a random number between 0 and 1
     *
     * @param {ItemT2K} item
     * @param {number} chanceOfDamagedItems between 0 and 1
     *
     * @returns {boolean}
     *
     * @version 0.2.0
     *
     */
    static isItemDamaged(item, chanceOfDamagedItems) {
        const defaultOptions = this._getOptionsDefault();
        chanceOfDamagedItems = chanceOfDamagedItems || defaultOptions.chanceOfDamagedItems;
        if (chanceOfDamagedItems === 0) return false;
        return Math.random() < chanceOfDamagedItems;
    }

    /**
     * @description Move items from one actor to another
     *
     *
     * @param {ActorT2K} source
     * @param {ActorT2K} destination
     * @param {Array<ItemT2K>} items
     * @returns {Array<object>} Array with moved items
     *
     * @inheritdoc
     */
    static async moveItemsToDestination(source, destination, items) {
        const sourceUpdates = [],
            sourceDeletes = [],
            destinationAdditions = [],
            destinationUpdates = [],
            results = [];

        /**
         *  Could be optimized to do a direct call instead of {crudAction}embeddedDocuments
         *  when items is only one item.
         **/
        for (let item of items) {
            const sourceItem = source.getEmbeddedDocument("Item", item.id);
            if(!sourceItem){
                ui.notifications.info(`${source.name} does not possess this ${item.name} anymore.`);
                continue;
            }
            const quantity = (sourceItem.data.data.qty < item.data.data.quantity) ? parseInt(sourceItem.data.data.qty) : parseInt(item.data.data.quantity),
                updatedItem = { _id: sourceItem.id, data: { qty: sourceItem.data.data.qty - quantity } },
                targetItem = destination.getEmbeddedCollection('Item').find(i =>
                    sourceItem.name === i.name
                    && sourceItem.data.data.price === i.data.data.price
                    && sourceItem.data.data.weight === i.data.data.weight
                );

            let newItem = {};

            if (targetItem) {
                let targetUpdate = { _id: targetItem.id, data: { qty: parseInt(targetItem.data.data.qty + quantity) } };
                destinationUpdates.push(targetUpdate);
            } else {
                newItem = duplicate(sourceItem);
                newItem.data.qty = parseInt(quantity);
                newItem.data.equipped = false;
                destinationAdditions.push(newItem);
            }

            if (updatedItem.data.qty === 0) {
                sourceDeletes.push(sourceItem.id);
            } else {
                sourceUpdates.push(updatedItem);
            }

            results.push({
                item: targetItem || newItem,
                quantity: quantity
            });
        }

        await ItemHelper._updateActorInventory(source, { type: 'delete', data: sourceDeletes }, sourceUpdates);
        await ItemHelper._updateActorInventory(destination, { type: 'create', data: destinationAdditions }, destinationUpdates);

        return results;
    }

    /**
     * @param {Array<object>} items items to be filtered for lootable items
     *
     * @returns {Array<Items>} all lootable items of the given items
     */
    static getLootableItems(
        items,
        options = {}
    ) {
        options = this._getOptionsDefault(options);

        return items
            /** .map((item) => {
                return item.toObject();
            })*/
            .filter((item) => {
                if(item.documentName){
                    item = item.data; // we only need the item data
                }

                if (options?.filterNaturalWeapons) {
                    if (item.type == 'weapon') {
                        const filteredWeaponTypes = ['natural'];

                        return !filteredWeaponTypes.includes(item.data.weaponType);
                    }
                }

                if (item.type == 'equipment') {
                    if (!item.data.armor) return true;
                    return item.data.armor.type != 'natural';
                }

                return !['class', 'spell', 'feat'].includes(item.type);
            })
            .filter((item) => {
                if (this.isItemDamaged(item, options.chanceOfDamagedItems)) {
                    if (options.removeDamagedItems) return false;

                    item.name += ' (Damaged)';
                    item.data.price *= options.damagedItemsMultiplier;
                }

                return true;
            })
            .map((item) => {
                item.data.equipped = false;
                return item;
            });
    }

    /**
     * Updates items in an actor's inventory
     *
     * @param {ActorT2K} actor
     * @param {object} items
     * @param {Array<Item>} updatedItems
     *
     * @returns {Promise<void>}
     */
    static async _updateActorInventory(actor, items, updatedItems) {
        if (items.data.length > 0) {
            if (items.type === 'create') {
                return actor.createEmbeddedDocuments("Item", items.data);
            } else if (items.type === 'delete') {
                return actor.deleteEmbeddedDocuments("Item", items.data);
            }
        }

        if (updatedItems.length > 0)
            return actor.updateEmbeddedDocuments("Item", updatedItems);
    }

    /**
     *
     * @param {ActorT2K} token
     * @param {string} message
     */
    static errorMessageToActor(token, message) {
        const packet = {
            action: "error",
            triggerActorId: game.user.character?.id ||null,
            tokenUuid: token.uuid,
            message: message
        };

        game.socket.emit(MODULE.socket, packet);
    }



    /**
     * Converts certain non lootable documents to lootable items
     *
     * @description This function is called when a document is converted to loot.
     * It checks itemData for the item type.
     *
     *  * Converts "spell" items to spellScrolls
     *  * checks the given or default conversions
     *  * If conversions are given for the itemType replace the given properties accordingly
     *
     * @param {Item} itemData ~ {Item}.data
     * @param {string} itemType ~ {Item}.documentName
     * @param {object} conversions
     * @returns
     */
    static async applyItemConversions(itemData, itemType, conversions = null) {
        const randomPriceFormula = twist.random(),
            priceRoller = new Roll('1d' + randomPriceFormula),
            priceRoll = priceRoller.roll({async: true});

        /**
         *  If we have a conversion for the itemType, use it
         *  The defaults conversions should be moved somewhere
         */
        const defaultConversions = {
            Actor: {
                name: `${itemData.name} Portrait`,
                img: itemData?.img || "icons/svg/mystery-man.svg",
                type: 'loot',
                data: {
                    price: priceRoll.total || 0.1
                }
            },
            Scene: {
                name: 'Map of ' + itemData.name,
                img: itemData.thumb || "icons/svg/direction.svg",
                data: {
                    price: priceRoll.total || 0.1
                },
                type: 'loot'
            }
        };

        conversions = conversions || defaultConversions;

        const convert = conversions[itemType] ?? false;

        if (convert) {
            for (const prop in convert) {
                itemData[prop] = convert[prop];
            }
        }

        return itemData;
    }

}
export { ItemHelper };
