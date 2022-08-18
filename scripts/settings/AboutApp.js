import { MODULE } from "../moduleConstants.js";
import { SettingsHelper } from "../helper/SettingsHelper.js";

export class AboutApp extends FormApplication {
    constructor() {
        super();
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game.i18n.localize('lsnpc.moduleTitle'),
            id: MODULE.appIds.lootsheetAbout,
            template: `${MODULE.templateAppsPath}/about.hbs`,
            popOut: true,
            width: 500,
            height: "auto",
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // No user specific settings currently
        if (!game.user.isGM) return;

        /**
         * The settings assigned to this need a "group" that is either of these tabs.name
         */
        let data = {
            tabs: [
                {
                    name: MODULE.settings.groups.sheet.moduleDefaults,
                    i18nName: game.i18n.localize('lsnpc.settings.menu.moduleDefaults'),
                    class: "fas fa-cog", menus: [], settings: []
                },
                // {
                //   name: MODULE.settings.groups.sheet.ui,
                //   i18nName: game.i18n.localize('lsnpc.settings.menu.ui'),
                //   class: "fas fa-bag", menus: [], settings: []
                // },
                // {
                //   name: MODULE.settings.groups.sheet.loot,
                //   i18nName: game.i18n.localize('lsnpc.settings.menu.loot'),
                //   class: "fab fa-grunt", menus: [], settings: []
                // }
                // {
                //   name: MODULE.settings.groups.sheet.merchant,
                //   i18nName: `${game.i18n.localize('lsnpc.settings.menu.merchant')}`,
                //   class: "fas fa-coins", menus: [], settings: []
                // }
            ]
        };

        // Return data
        return {
            systemTitle: game.system.data.title,
            version: game.modules.get(MODULE.ns).data.version,
            data: SettingsHelper.getTabbedSettings(data, MODULE.ns)
        };
    }
}