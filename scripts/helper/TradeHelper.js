import { MODULE } from "../moduleConstants.js";
import { ChatHelper } from "./ChatHelper.js";
import { ItemHelper } from "./ItemHelper.js";

/**
 * @Module lootsheetnpct2k4e.Helpers.TradeHelper
 * @name TradeHelper
 *
 * @classdec Static helper methods for trading
 *
 * @since 3.4.5.3
 * @author Daniel Böttner <daniel@est-in.eu>
 * @license MIT
 */
export class TradeHelper {

    /**
     * @summary Handle the trade between two actors
     *
     * @description This method handles the trade between two actors.
     *
     * It is called by the trade button on the loot sheet.
     * - in the future may -> It is also called by the trade button on the item sheet.
     * - in the future may -> It is also called by the trade button on the character sheet.
     *
     * @param {ActorT2K} npcActor The NPC ActorT2K that is trading with the player
     * @param {ActorT2K} playerCharacter The Player Character that is trading with the NPC
     * @param {Array} trades The trades that are to be executed
     * @param {object} options The options for the trade
     *
     * @returns {Promise<boolean>}
     */
    static async tradeItems(npcActor, playerCharacter, trades, options = {}) {
        // for tradeType in object trades get the array
        for (let type in trades) {
            if (!trades[type].length > 0) continue;
            options.type = type;
            options.priceModifier = npcActor.getFlag(MODULE.ns, MODULE.flags.priceModifier) || { buy: 100, sell: 100 };
            await this._handleTradyByType(trades, playerCharacter, npcActor, options);
        }
    }

    /**
     * @summary loot items from one actor to another
     *
     * @description Move items from one actor to another
     * Assumes that the set of items is valid and can be moved.
     *
     * @param {ActorT2K} source
     * @param {ActorT2K} destination
     * @param {Array<Item>} items
     *
     * @inheritdoc
     */
    static async lootItems(source, destination, items, options) {
        let movedItems = await ItemHelper.moveItemsToDestination(source, destination, items);
        ChatHelper.tradeChatMessage(source, destination, movedItems, options);

    }

    /**
     * @summary -- 👽☠️🏴‍☠️ All ya Items belong to us 🏴‍☠️☠️👽  --
     *
     * @description Gets the lootable subset of the items in
     * the source actor and moves this subset to the destination actor.
     *
     * @param {ActorT2K} source
     * @param {ActorT2K} destination
     *
     * @returns {Promise<Array<Item>>}
     *
     * @function
     *
     * @since 3.4.5.3
     * @author Daniel Böttner < @DanielBoettner >
     */
    static async lootAllItems(source, destination, options = {}) {
        const items = ItemHelper.getLootableItems(source.items).map((item) => ({
            id: item.id,
            data: {
                data: {
                    quantity: item.data.data.quantity
                }
            }
        }));

        await this.lootItems(source, destination, items, options);
    }

    /**
     * Handle a buy transaction between a seller & a buyer
     *
     * @description
     * #### This could likely be refactored or scrubbed.
     * See [tradeItems](#tradeItems) for the more generic version.
     *
     * - First the buy item button in the inventory needs to be refactored.
     * - - The buttons action needs to be changed to tradeItems
     * - - The buttons class so it gets picket up by the actionButtons selector (eventListener)
     * - The items need to be parsed to resemble the item structure of items in the trade stage
     * - - see [_handleTradeStage](lootsheetnpct2k4e.Helpers.LootSheetNPCHelper._handleTradeStage) for more details
     * - - Maybe by making each html row(~item) a stage.
     *
     * @todo Refactor and make obsolete
     *
     * @see this.tradeItems for the more generic version
     * @see lootsheetnpct2k4e.Helpers.LootSheetNPCHelper._handleTradeStage for the stage handling
     *
     * @param {ActorT2K} seller
     * @param {ActorT2K} buyer
     * @param {string} itemId
     * @param {number} quantity
     * @param {object} options
     *
     * @returns {Promise<boolean>}
     *
     * @author Jan Ole Peek < @jopeek >
     * @author Daniel Böttner < @DanielBoettner >
     * @since 1.0.1
     *
     * @inheritdoc
     */
    // TODO Need to update this to use T2K4E currency model
    static async transaction(seller, buyer, itemId, quantity, options = { chatOutPut: true }) {
        // On 0 quantity skip everything to avoid error down the line
        const soldItem = seller.getEmbeddedDocument("Item", itemId),
            priceModifier = seller.getFlag(MODULE.ns, MODULE.flags.priceModifier) || { buy: 100, sell: 100 };

        options.priceModifier = (options.type === 'buy') ? priceModifier.buy : priceModifier.sell;

        if (!soldItem) return ItemHelper.errorMessageToActor(seller, `${seller.name} doesn't posses this item anymore.`);

        let moved = false;
        quantity = (soldItem.data.data.quantity < quantity) ? parseInt(soldItem.data.data.quantity) : parseInt(quantity);

        let successfulTransaction = this._updateFunds(seller, buyer, soldItem.data.data.price);
        if (!successfulTransaction) return false;
        moved = ItemHelper.moveItemsToDestination(seller, buyer, [{ id: itemId, data: { data: { quantity: quantity } } }]);

        options.type = "buy";
        ChatHelper.tradeChatMessage(seller, buyer, moved, options);
    }

    /**
     * @summary Handle a trade by its type
     * @description
     *
     * | Currently supported types |
     * | ---  | --- |
     * | buy  | Player actor buys from a NPC |
     * | sell | Player actor sells to NPC |
     * | loot | Player ActorT2K loots from the NPC |
     * | --- | --- |
     *
     * @param {Array} trades
     * @param {ActorT2K} playerCharacter
     * @param {ActorT2K} npcActor
     * @param {object} options
     *
     * @returns {Promise<boolean>}
     *
     * @function
     * @inheritdoc
     * @since 3.4.5.3
     * @author Daniel Böttner <@DanielBoettner>
     *
     */
    static async _handleTradyByType(trades, playerCharacter, npcActor, options) {
        let moved = { sell: [], buy: [], give: [], loot: [] };

        const tradeType = options.type,
            playerActions = ['sell', 'give'],
            playerToNPC = playerActions.includes(tradeType),
            source = playerToNPC ? playerCharacter : npcActor,
            destination = playerToNPC ? npcActor : playerCharacter,
            tradeTypePriceModifier = options.priceModifier[tradeType === 'sell' ? 'buy' : 'sell'];

        options.priceModifier = tradeTypePriceModifier;

        const preparedTrade = this._prepareTrade(source, trades[tradeType], options),
            successfullTransaction = await this.moneyExchange(source, destination, tradeType, preparedTrade.tradeSum, options);

        if (!successfullTransaction) return false;

        moved[tradeType] = await ItemHelper.moveItemsToDestination(source, destination, preparedTrade.items);
        ChatHelper.tradeChatMessage(npcActor, playerCharacter, moved[tradeType], options);
    }

    /**
     * @param {ActorT2K} source
     * @param {ActorT2K} destination
     * @param {string} tradeType
     * @param {number} tradeSum
     *
     * @returns {boolean} success
     */
    static async moneyExchange(source, destination, tradeType, tradeSum = 0, options = {}) {
        const freeTradeTypes = ['loot', 'give'];
        let successfullTransaction = true;

        if (!freeTradeTypes.includes(tradeType)) {
            console.warn(MODULE.ns, tradeSum, options.priceModifier);
            successfullTransaction = await this._updateFunds(source, destination, tradeSum, options);
        }

        return successfullTransaction;
    }

    /**
     *
     * @description
     * Check again if the source posses the item
     * If the source is not in possesion of the item anymore, remove it from the items array.
     *
     * If the source is in possession add its worth to the total tradesum.
     *
     * @param {ActorT2K} source
     * @param {Collection} items
     * @param {object} options
     *
     * @returns {Array} [items, tradeSum]
     *
     * @author Daniel Böttner <@DanielBoettner>
     */
    static _prepareTrade(source, items, options = {}) {
        const priceModifier = options.priceModifier.sell || 100;
        let tradeSum = 0;
        for (const [key, item] of items.entries()) {
            if (!source.items.find(i => i.id == item.id)) {
                console.log(`${MODULE.ns} | _prepareTrade | Removed item "${item.name}" (id: ${item.id}) from trade. Item not found in inventory of the source actor.`);
                delete items[key];
                continue;
            }
            // Add item price to the total sum of the trade
            const originalItemPrice = item.data.data.price;
            tradeSum += this._getItemPriceInGold(originalItemPrice, priceModifier, item.data.data.quantity);
            console.info(`${MODULE.ns} | ${this._prepareTrade.name} | tradeSum updated to: `, tradeSum);
        }

        return { items: items, tradeSum: tradeSum };
    }

    /**
     * @summary Get the items price in gold
     *
     * @param {number} price number
     * @param {number} priceModifier number
     * @param {number} quantity - defaults to 1

     * @returns {number} price - a float with 5 decimals
     */
    static _getItemPriceInGold(price, priceModifier, quantity = 1) {
        console.warn(`${MODULE.ns} | 'getItemPriceInGold' | priceModifier: ${priceModifier}`);
        return parseFloat(((price * priceModifier / 100) * quantity).toFixed(5));
    }

    /**
     *
     * @param {ActorT2K} actor
     *
     * @returns {number}
     *
     */
    static _getPriceModifier(actor) {
        let priceModifier = { buy: 100, sell: 100, give: 100, loot: 100 },
            flagIsObject = (typeof actor.getFlag(MODULE.ns, MODULE.flags.priceModifier) === 'object');

        if (flagIsObject) {
            priceModifier = actor.getFlag(MODULE.ns, MODULE.flags.priceModifier);
        } else {
            priceModifier.sell = actor.getFlag(MODULE.ns, MODULE.flags.priceModifier) || 100;
        }

        for (let p in priceModifier) {
            priceModifier[p] = parseFloat(priceModifier[p]).toPrecision(2);
        }

        return priceModifier;
    }

    /**
     * @summary Check the buyers funds and transfer the funds if they are enough
     *
     * @param {ActorT2K} seller
     * @param {ActorT2K} buyer
     * @param {number} itemCost
     *
     * @returns {boolean}
     *
     * @version 1.1.0
     *
     * @author Jan Ole Peek @jopeek
     * @author Daniel Böttner @DanielBoettner
     *
     * @returns {boolean} true if the transaction was successful
     */
    static async _updateFunds(seller, buyer, itemCost, options = {}) {

        let buyerFunds = buyer.data.data.currency,
            sellerFunds = seller.data.data.currency;

        if (itemCost > buyerFunds) {
            ui.notifications.error(buyer.name + " does not have enough funds to buy this item.");
            ItemHelper.errorMessageToActor(buyer, buyer.name + ` doesn't have enough funds to purchase an item for ${itemCost.gp}gp.`);
            return false;
        }

        let updatedFunds = this._getUpdatedFunds(buyerFunds, sellerFunds, itemCost);

        await seller.update({ data: { currency: updatedFunds.sellerFunds } });
        await buyer.update({ data: { currency: updatedFunds.buyerFunds } });

        return true;
    }

    /**
     *
     * @param {object} buyerFunds
     * @param {object} sellerFunds
     *
     * @returns {Array<object>} [buyerFunds, sellerFunds]
     *
     * @author Jan Ole Peek < @jopeek >
     * @author Daniel Böttner < @DanielBoettner >
     */
    static _getUpdatedFunds(buyerFunds, sellerFunds, itemCost) {
        if (buyerFunds >= itemCost) {
            buyerFunds -= itemCost;
            sellerFunds += itemCost;
        } else {
            buyerFunds -= itemCost;
            sellerFunds += itemCost;
        }

        return { buyerFunds: buyerFunds, sellerFunds: sellerFunds };
    }
}
