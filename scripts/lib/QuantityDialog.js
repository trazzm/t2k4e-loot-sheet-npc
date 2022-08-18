class QuantityDialog extends Dialog {
    constructor(callback, options) {
        if (typeof (options) !== "object") {
            options = {};
        }

        let applyChanges = false;
        super({
            title: game.i18n.localize('lsnpc.defaults.quantity-title'),
            content: `
            <form>
                <div class="form-group">
                    <label>${game.i18n.localize('lsnpc.defaults.quantity-title')}:</label>
                    <input type="number" min="1" max="`+ options.max +`" step="1" id="quantity" name="${game.i18n.localize('lsnpc.defaults.quantity')}" value="1">
                    <label style="margin-left: 10px;">${game.i18n.localize('lsnpc.defaults.of')} ${options.max}</label>
                </div>
				<br />
            </form>`,
            buttons: {
                yes: {
                    icon: "<i class='fas fa-check'></i>",
                    label: options.acceptLabel ? options.acceptLabel : game.i18n.localize('lsnpc.defaults.accept-title'),
                    callback: () => applyChanges = true
                },
                no: {
                    icon: "<i class='fas fa-times'></i>",
                    label: game.i18n.localize('lsnpc.defaults.cancel-title')
                },
            },
            default: "yes",
            close: () => {
                if (applyChanges) {
                    var quantity = document.getElementById('quantity').value

                    if (isNaN(quantity)) {
                        console.log("Loot Sheet | Item quantity invalid");
                        return ui.notifications.error(`Item quantity invalid.`);
                    }

                    callback(quantity);

                }
            }
        });
    }
}

export { QuantityDialog };