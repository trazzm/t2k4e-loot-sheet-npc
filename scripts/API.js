import { PermissionHelper } from './helper/PermissionHelper.js';
import { LootSheetNPCHelper } from "./helper/LootSheetNPCHelper.js";
import { MODULE } from './moduleConstants.js';
import { TableRoller } from './lib/TableRoller.js';
import { LootProcessor } from './lib/LootProcessor.js';

/**
 * @description The lootsheet API
 *
 * @module lootsheetnpct2k4e.API
 *
 * @title Lootsheet NPC T2K4E API
 * @version 1.0.0
 */
class API {

    /**
     * @title resetTokens()
     * @description Convert a stack of Tokens back to the default
     * @module lootsheetnpct2k4e.API.resetTokens
     *
     * @param {Array<Token>} tokens Array of ActorTokens
     * @param {boolean} log verbose
     * @returns {object}
     */
    static async resetTokens(
        tokens,
        verbose = false ) {
        const tokenstack = (tokens) ? (tokens.length > 0) ? tokens : [tokens] : canvas.tokens.controlled;

        let response = API._response(200, 'success');

        for (let token of tokenstack) {
            response.data[token.uuid] = await API.resetToken(token, verbose)
        }

        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * Reset the given token back to the default npc actor sheet
     * @param token
     * @param verbose
     * @returns {Promise<{msg: string, code, data: {}, error: boolean}>}
     */
    static async resetToken(
        token = canvas.tokens.controlled[0],
        verbose = false ) {
        let response = API._response(200, 'success');
        if (!token) {
            response.code = 403;
            response.msg = 'No token selected or supplied';
            response.error = true;
            if (verbose) API._verbose(response);
            return response;
        }

        if (!game.user.isGM) return;
        if (!token.actor.sheet) return;

        const sheet = token.actor.sheet,
            priorState = sheet._state; // -1 for opened before but now closed, // 0 for closed and never opened // 1 for currently open

        let newActorData = {
            flags: {
                core: {
                    sheetClass: 't2k4e.ActorSheetT2KCharacter',
                }
            }
        };

        // Close the old sheet if it's open
        await sheet.close();

        newActorData.items = LootSheetNPCHelper.getLootableItems(
            token.actor.items,
            {}
        );

        // Delete all items first
        await token.document.actor.deleteEmbeddedDocuments(
            'Item',
            Array.from(token.actor.items.keys())
        );

        // Update actor with the new sheet and items
        await token.document.actor.update(newActorData);

        // Update the document with the overlay icon and new permissions
        await token.document.update({
            overlayEffect: '',
            vision: false,
            actorData: {
                actor: {
                },
                permission: PermissionHelper._updatedUserPermissions(token, 0),
            },
        });

        // Deregister the old sheet class
        token.actor._sheet = null;
        delete token.actor.apps[sheet.appId];

        if (priorState > 0) {
            // Re-draw the updated sheet if it was open
            token.actor.sheet.render(true);
        }

        response.data = token;
        if (verbose) API._verbose(response);
        return response;
    }


    /**
     * @title Converts the provided token to a lootable sheet
     *
     * @note titleAdapted from dfreds pocketChange Module
     * Originally adappted from the convert-to-lootable.js by @unsoluble, @Akaito, @honeybadger, @kekilla, and @cole.
     *
     * @module lootsheetnpct2k4e.API.convertToken
     *
     * @param {object} options
     * @param {Token} token - the token to convert
     * @param {string} type Type of Lootsheet
     * @param {number} options.chanceOfDamagedItems - (optional) the chance an item is considered damaged from 0 to 1. Uses the setting if undefined
     * @param {number} options.damagedItemsMultiplier - (optional) the amount to reduce the value of a damaged item by. Uses the setting if undefined
     * @param {boolean} options.removeDamagedItems - (optional) if true, removes items that are damaged
     */
    static async convertToken(
        token = canvas.tokens.controlled[0],
        type = 'loot',
        options = {},
        verbose = false
    ) {
        let response = API._response(200, 'success');
        if (!token) {
            response.code = 403;
            response.msg = 'No token selected or supplied';
            response.error = true;
            if (verbose) API._verbose(response);
            return response;
        }

        if (!game.user.isGM) return;
        if (!token.actor.sheet) return;

        const sheet = token.actor.sheet,
            priorState = sheet._state; // -1 for opened before but now closed, // 0 for closed and never opened // 1 for currently open

        let lootIcon = 'icons/svg/chest.svg';

        let newActorData = {
            flags: {
                core: {
                    sheetClass: 't2k4e.LootSheetNPCT2k4e',
                },
                lootsheetnpct2k4e: {
                    lootsheettype: 'Loot',
                },
            },
        };

        if (type && type.toLowerCase() === 'merchant') {
            newActorData.flags.lootsheetnpct2k4e.lootsheettype = 'Merchant';
            lootIcon = 'icons/svg/coins.svg';
        }

        // Close the old sheet if it's open
        await sheet.close();

        newActorData.items = LootSheetNPCHelper.getLootableItems(
            token.actor.items,
            options
        );

        // Delete all items first
        await token.document.actor.deleteEmbeddedDocuments(
            'Item',
            Array.from(token.actor.items.keys())
        );

        // Update actor with the new sheet and items
        await token.document.actor.update(newActorData);

        // Update the document with the overlay icon and new permissions
        await token.document.update({
            overlayEffect: lootIcon,
            vision: false,
            actorData: {
                actor: {
                    flags: {
                        lootsheetnpct2k4e: {
                            playersPermission: CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER,
                        },
                    },
                },
                permission: PermissionHelper._updatedUserPermissions(token),
            },
        });

        // Deregister the old sheet class
        token.actor._sheet = null;
        delete token.actor.apps[sheet.appId];

        if (priorState > 0) {
            // Re-draw the updated sheet if it was open
            token.actor.sheet.render(true);
        }

        response.data = token;
        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * @title convertTokens()
     * @description Convert a stack of Tokens to a given type, apply modifiers if given
     * @module lootsheetnpct2k4e.API.convertTokens
     *
     * @param {Array<Token>} tokens Array of ActorTokens
     * @param {string} type Type of sheet (loot|merchant)
     * @param {object} options
     * @returns {object}
     */
    static async convertTokens(
        tokens,
        type = 'loot',
        options = {},
        verbose = false
    ) {
        const tokenstack = (tokens) ? (tokens.length > 0) ? tokens : [tokens] : canvas.tokens.controlled;

        let response = API._response(200, 'success');

        for (let token of tokenstack) {
            response.data[token.uuid] = await API.convertToken(token, type, options, verbose)
        }

        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * Roll a table and add the resulting loot to a given target.
     *
     * @param {RollTable} table
     * @param {Array<ActorT2K|PlaceableObject>|ActorT2K|PlaceableObject} stack
     * @param {options} object
     *
     * @returns
     */
    static async addLootToTarget(stack = null, table = null, options = {}) {
        let tokenstack = [];

        if (null == stack && (canvas.tokens.controlled.length === 0)) {
            return ui.notifications.error('No tokens given or selected');
        } else {
            tokenstack = (stack) ? (stack.length >= 0) ? stack : [stack] : canvas.tokens.controlled;
        }

        if (options?.verbose) ui.notifications.info(MODULE.ns + ' | API | Loot generation started for.');

        let tableRoller = new TableRoller(table);

        for (let target of tokenstack) {
            const actor = (target.actor) ? target.actor : target;
            const rollResults = await tableRoller.roll(options),
                lootProcess = new LootProcessor(rollResults, actor, options),
                betterResults = await lootProcess.buildResults(options);
            lootProcess.addItemsToActor(actor, options);
        }

        if (options?.verbose) return ui.notifications.info(MODULE.ns + ' | API | Loot generation complete.');
    }

    /**
     * @module lootsheetnpct2k4e.API.makeObservable
     *
     * @description Make the provided tokens observable
     *
     * @param {Token|Array<Token>} tokens A a selection tokens or null (defaults to all controlled tokens)
     * @param {Array<User>|null} players Optional array with users to update (defaults to all)
     *
     * @returns {object} API response object
     */
    static async makeObservable(
        tokens = game.canvas.tokens.controlled,
        players = PermissionHelper.getPlayers(),
        verbose = false
    ) {
        if (!game.user.isGM) return;

        const tokenstack = (tokens) ? (tokens.length > 0) ? tokens : [tokens] : canvas.tokens.controlled;

        let response = API._response(200, 'success'),
            responseData = {};

        for (let token of tokenstack) {
            if (!token.actor || token.actor.hasPlayerOwner) continue;
            token.actor.data.permission = PermissionHelper._updatedUserPermissions(token, CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER, players);
            await token.document.update({actor: {data: {permission: token.actor.data.permission}}});
        }

        response.data = responseData;
        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * @description Return the player(s) current permissions or the tokens default permissions
     *
     * @module lootsheetnpct2k4e.API.getPermissionForPlayers
     *
     * @param {Token} token token or null (defaults to all controlled tokens)
     * @param {Array<User>|null} players Optional array with users to update (defaults to all)
     * @returns {object} permissions Array of an permission enum values or a single permission
     */
    static getPermissionForPlayers(
        token = canvas.tokens.controlled[0],
        players = PermissionHelper.getPlayers(),
        verbose = false
    ) {
        let response = API._response(200, 'success', {});
        if (!token) {
            response.code = 403;
            response.msg = 'No token selected or supplied';
            if (verbose) API._verbose(response);
            return response;
        }

        for (let player of players) {
            response.data[player.data._id] = PermissionHelper.getLootPermissionForPlayer(token.actor.data, player);
        }

        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * Use the PermissionHelper to update the users permissions for the token
     *
     * @param {Token} token
     * @param {number|null} permission enum
     *
     * @return {object} reponse object
     */
    static async updatePermissionForPlayers() {
        let response = API._response(200, permissions, 'success');
        const
            tokens = canvas.tokens.controlled,
            players = PermissionHelper.getPlayers();

        for (let token of tokens) {
            const
                permissions = PermissionHelper._updatedUserPermissions(token, players);

            response.data[token.data.uuid] = permissions;
        }

        if (verbose) API._verbose(response);
        return response;
    }

    /**
     * @description Verbose ouput wrapper
     *
     * @module lootsheetnpct2k4e.API._verbose
     * @param {string} text
     * @private
     */
    static _verbose(data = '') {
        console.log(`${MODULE.ns} | API (verbose output) | data, '|--- ' + MODULE.ns + ' API (/verbose output)---|`);
    }

    static _response(code, msg = '', data = {}, error = false) {
        return {
            code: code,
            data: data,
            msg: msg,
            error: error
        }
    }
}

export { API };